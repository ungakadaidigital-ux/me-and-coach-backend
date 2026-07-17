import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase.js";

const router = Router();

/**
 * Flow: frontend calls supabase.auth.signInWithOtp({ phone }) then
 * supabase.auth.verifyOtp({...}) itself — Supabase handles the OTP
 * round-trip directly with the client SDK. Once verified, the
 * frontend calls THIS endpoint once with the resulting session so
 * we can link the new auth.users row to the pre-created coaches
 * row (owner already invited this phone number).
 *
 * POST /api/auth/link-coach
 * body: { phone: "+91XXXXXXXXXX" }
 * header: Authorization: Bearer <the new session's access token>
 */
router.post("/link-coach", async (req, res) => {
  const { phone } = req.body;
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !phone) return res.status(400).json({ error: "phone and bearer token required" });

  // Confirm the token is a real, freshly-verified Supabase session.
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

export default router;

