const { createClient } = require("@supabase/supabase-js");

// Service-role client — used ONLY on the backend, never shipped to the
// frontend. Bypasses RLS by default; per-request academy scoping is
// enforced in code (see middleware/auth.js) as a defense-in-depth layer
// on top of the RLS policies defined in migrations/001_init.sql.
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const PSEUDO_EMAIL_DOMAIN = process.env.PSEUDO_EMAIL_DOMAIN || "meandcoach.internal";

// Phone -> pseudo-email. Supabase Auth requires an email under the hood;
// the coach never sees this value (Design & Product Principles #1).
function phoneToPseudoEmail(phone) {
  const cleaned = String(phone).replace(/[^0-9]/g, "");
  return `${cleaned}@${PSEUDO_EMAIL_DOMAIN}`;
}

module.exports = { supabaseAdmin, phoneToPseudoEmail };
