import jwt from "jsonwebtoken";
import crypto from "crypto";

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour, matches Supabase's own default
const REFRESH_TOKEN_TTL_DAYS = 30;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Finds or creates a Supabase auth.users row for this phone via the
 * Admin API. We never trigger Supabase's own OTP/SMS here — phone_confirm:
 * true marks it verified without Supabase sending anything, since MSG91
 * already did the verification before this is ever called.
 */
async function getOrCreateAuthUser(supabaseAdmin, phone) {
  const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ phone });
  // listUsers doesn't filter server-side by phone on all Supabase versions;
  // filter defensively client-side too.
  const found = existing?.users?.find((u) => u.phone === phone.replace(/^\+/, ""));
  if (found) return found;

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    phone: phone.replace(/^\+/, ""),
    phone_confirm: true,
  });
  if (error) throw error;
  return data.user;
}

/**
 * Mints an access token Supabase's PostgREST/RLS will accept exactly
 * like one of its own — same aud/role claims, signed with the same
 * secret — plus whatever product-specific claims (academy_id, role,
 * coach_id, clinic_id, ...) the caller supplies.
 */
function issueAccessToken({ jwtSecret, userId, customClaims }) {
  return jwt.sign(
    { aud: "authenticated", role: "authenticated", sub: userId, ...customClaims },
    jwtSecret,
    { expiresIn: ACCESS_TOKEN_TTL_SECONDS }
  );
}

async function issueRefreshToken(supabaseAdmin, userId) {
  const raw = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 86400 * 1000);
  const { error } = await supabaseAdmin.from("auth_sessions").insert({
    user_id: userId,
    refresh_token_hash: hashToken(raw),
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw error;
  return raw;
}

/**
 * Full post-OTP-verification flow: provision/find the Supabase user,
 * resolve product-specific claims, issue both tokens.
 *
 * resolveClaims(phone, authUser) -> object | null
 *   Return null to REJECT login (e.g. phone not pre-invited by an
 *   owner) — this is where each product enforces its own "who's
 *   allowed in" rule.
 */
export async function createSession({ supabaseAdmin, jwtSecret, phone, resolveClaims }) {
  const authUser = await getOrCreateAuthUser(supabaseAdmin, phone);
  const customClaims = await resolveClaims(phone, authUser);
  if (!customClaims) {
    const err = new Error("This phone number is not linked to an account. Ask your owner to invite you first.");
    err.status = 403;
    throw err;
  }

  const access_token = issueAccessToken({ jwtSecret, userId: authUser.id, customClaims });
  const refresh_token = await issueRefreshToken(supabaseAdmin, authUser.id);
  return { access_token, refresh_token, expires_in: ACCESS_TOKEN_TTL_SECONDS, user: authUser };
}

/**
 * Rotates a refresh token: validates it against the stored hash,
 * revokes the old one, issues a new access+refresh pair. Re-runs
 * resolveClaims so a role change (e.g. promoted to Assistant) takes
 * effect on next refresh, not just next OTP login.
 */
export async function refreshSession({ supabaseAdmin, jwtSecret, refreshToken, resolveClaimsByUserId }) {
  const tokenHash = hashToken(refreshToken);
  const { data: row, error } = await supabaseAdmin
    .from("auth_sessions")
    .select("*")
    .eq("refresh_token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();
  if (error || !row || new Date(row.expires_at) < new Date()) {
    const err = new Error("Invalid or expired refresh token");
    err.status = 401;
    throw err;
  }

  await supabaseAdmin.from("auth_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", row.id);

  const customClaims = await resolveClaimsByUserId(row.user_id);
  if (!customClaims) {
    const err = new Error("Account no longer active");
    err.status = 403;
    throw err;
  }

  const access_token = issueAccessToken({ jwtSecret, userId: row.user_id, customClaims });
  const refresh_token = await issueRefreshToken(supabaseAdmin, row.user_id);
  return { access_token, refresh_token, expires_in: ACCESS_TOKEN_TTL_SECONDS };
}
