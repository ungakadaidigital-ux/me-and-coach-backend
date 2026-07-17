import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase env vars — check .env against .env.example");
}

/**
 * Per-request client: forwards the caller's JWT so every query runs
 * under their identity and RLS policies apply exactly as written in
 * 002_rls_policies.sql. Use this for all normal API routes.
 */
export function supabaseForUser(userJwt) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
    auth: { persistSession: false },
  });
}

/**
 * Admin client: uses the service role key, bypasses RLS entirely.
 * Only for: OTP → coach linking, cron jobs (payment generation,
 * reminder sends), and webhook handlers (Razorpay/Wati have no
 * user JWT to present). Never expose this key or this client to
 * anything reachable from the frontend.
 */
export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

