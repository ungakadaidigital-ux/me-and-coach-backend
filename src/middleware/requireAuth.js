import { supabaseForUser } from "../lib/supabase.js";

/**
 * Expects `Authorization: Bearer <supabase-jwt>`.
 * Verifies the token, attaches:
 *   req.supabase   — client scoped to this user (RLS applies)
 *   req.academyId  — from the academy_id custom claim
 *   req.role       — 'owner' | 'coach' | 'assistant'
 *   req.coachId    — coaches.id for this user
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  const client = supabaseForUser(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: "Invalid or expired token" });

  // Custom claims land in the JWT itself; decode without re-verifying
  // signature here (Supabase already verified it in getUser above).
  const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());

  if (!payload.academy_id || !payload.role) {
    return res.status(403).json({
      error: "Account not linked to an academy yet. Complete OTP invite acceptance first.",
    });
  }

  req.supabase = client;
  req.academyId = payload.academy_id;
  req.role = payload.role;
  req.coachId = payload.coach_id || null;
  next();
}

/** Restricts a route to specific roles, e.g. requireRole('owner') */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.role)) {
      return res.status(403).json({ error: `Requires role: ${roles.join(" or ")}` });
    }
    next();
  };
}

