import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin, supabaseForUser } from "../lib/supabase.js";

const supabaseAnon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const router = Router();
/**
 * Flow: frontend calls supabase.auth.signInWithOtp({ phone }) then
 * supabase.auth.verifyOtp({...}) itself — Supabase handles the OTP
 * round-trip directly with the client SDK. Once verified, the
 * frontend calls THIS endpoint once with the resulting session so
 * we can link the new auth.users row to the pre-created coaches
 * row (owner already invited this phone number).
 */
router.post("/link-coach", async (req, res) => {
  const { phone } = req.body;
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !phone) return res.status(400).json({ error: "phone and bearer token required" });

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: "Invalid session" });

  const { error } = await supabaseAdmin.rpc("link_coach_auth_user", {
    p_phone: phone,
    p_auth_user_id: userData.user.id,
  });
  if (error) return res.status(500).json({ error: error.message });

  res.json({
    linked: true,
    note: "Ask the client to refresh its session now — the JWT won't carry academy_id/role until the next token refresh.",
  });
});

/**
 * Dev-only bypass so pilot testing isn't blocked on MSG91 setup.
 * Creates (or reuses) a real Supabase auth user for this phone,
 * signs in with a throwaway password to mint a REAL Supabase
 * session/JWT (so the custom_access_token_hook fires exactly as
 * it would in production), and links it to the pre-invited coach
 * row via the same RPC link-coach uses.
 *
 * Flip DEV_LOGIN_ENABLED to false (or remove it) in Railway before
 * real pilot launch — 404s in any other configuration.
 */
router.post("/dev-login", async (req, res) => {
  if (process.env.NODE_ENV !== "production" || process.env.DEV_LOGIN_ENABLED !== "true") {
    return res.status(404).end();
  }
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "phone required" });

  const devPassword = process.env.DEV_LOGIN_PASSWORD || "dev-login-only-not-for-prod";

  try {
    let userId;
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const found = existing?.users?.find((u) => u.phone === phone.replace("+", ""));

    if (found) {
      userId = found.id;
      await supabaseAdmin.auth.admin.updateUserById(userId, { password: devPassword });
    } else {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        phone,
        phone_confirm: true,
        password: devPassword,
      });
      if (createErr) throw createErr;
      userId = created.user.id;
    }

    const { error: linkErr } = await supabaseAdmin.rpc("link_coach_auth_user", {
      p_phone: phone,
      p_auth_user_id: userId,
    });
    if (linkErr) throw linkErr;
    const { data: session, error: signInErr } = await supabaseAnon.auth.signInWithPassword({
    phone,
      password: devPassword,
    });
    if (signInErr) throw signInErr;

    res.json({
      token: session.session.access_token,
      refresh_token: session.session.refresh_token,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
