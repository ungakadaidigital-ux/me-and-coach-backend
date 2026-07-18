import { Router } from "express";
import { sendOtp, verifyOtp, resendOtp } from "./msg91.js";
import { createSession, refreshSession } from "./session.js";

/**
 * createAuthRouter({ supabaseAdmin, jwtSecret, resolveClaims, resolveClaimsByUserId })
 *
 * supabaseAdmin        — this product's service-role Supabase client
 * jwtSecret             — this product's SUPABASE_JWT_SECRET
 * resolveClaims(phone, authUser) -> claims | null
 *   Product-specific "who is this and are they allowed in" lookup.
 *   For Coach: query `coaches` by phone, return
 *   { academy_id, role, coach_id } or null if not invited.
 * resolveClaimsByUserId(userId) -> claims | null
 *   Same shape, keyed by the Supabase user id — used on refresh so
 *   we don't need the phone number again.
 *
 * Mounts: POST /send-otp, POST /verify-otp, POST /refresh
 */
export function createAuthRouter({ supabaseAdmin, jwtSecret, resolveClaims, resolveClaimsByUserId }) {
  const router = Router();

  router.post("/send-otp", async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "phone required" });
    try {
      await sendOtp(phone);
      res.json({ sent: true });
    } catch (e) {
      res.status(502).json({ error: e.message });
    }
  });

  router.post("/resend-otp", async (req, res) => {
    const { phone, retryType } = req.body;
    if (!phone) return res.status(400).json({ error: "phone required" });
    try {
      await resendOtp(phone, retryType);
      res.json({ sent: true });
    } catch (e) {
      res.status(502).json({ error: e.message });
    }
  });

  router.post("/verify-otp", async (req, res) => {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ error: "phone and otp required" });

    const verification = await verifyOtp(phone, otp);
    if (!verification.ok) {
      return res.status(401).json({ error: verification.message || "Invalid OTP" });
    }

    try {
      const session = await createSession({ supabaseAdmin, jwtSecret, phone, resolveClaims });
      res.json(session);
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  });

  /**
   * DEV-ONLY bypass: issues a real session via the exact same
   * createSession/resolveClaims path as verify-otp, just without
   * calling MSG91. Double-gated — must be explicitly enabled AND
   never runs when NODE_ENV=production, regardless of the flag,
   * so a misconfigured prod env can't accidentally expose it.
   * Delete nothing to re-enable OTP later — just unset the flag.
   */
  if (process.env.DEV_LOGIN_ENABLED === "true" && process.env.NODE_ENV !== "production") {
    router.post("/dev-login", async (req, res) => {
      const { phone } = req.body;
      if (!phone) return res.status(400).json({ error: "phone required" });
      try {
        const session = await createSession({ supabaseAdmin, jwtSecret, phone, resolveClaims });
        res.json(session);
      } catch (e) {
        res.status(e.status || 500).json({ error: e.message });
      }
    });
  }
