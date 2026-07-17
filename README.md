# Me & Coach API

## Setup
1. `npm install`
2. Copy `.env.example` → `.env`, fill in Supabase/Razorpay/Wati keys
3. Run migrations against your Supabase project in order:
   `migrations/001_init_schema.sql` → `002_rls_policies.sql` → `003_auth_claims.sql`
4. **Manual step (can't be done via SQL):** Supabase Dashboard →
   Authentication → Hooks → Custom Access Token → select
   `public.custom_access_token_hook`. Without this, JWTs won't carry
   `academy_id`/`role`/`coach_id` and every RLS-protected route will
   403.
5. `npm run dev`

## Deploy (Railway)
- Deploy this folder as a Railway service; set the same env vars there.
- Add two Railway Cron jobs (Settings → Cron):
  - `npm run job:generate-payments` — daily, early morning
  - `npm run job:send-reminders` — daily, after the above

## Not yet built (flagged, not forgotten)
- Same-day-only attendance edit window — needs enforcing in the
  attendance route (currently only handles new bulk syncs, not edits
  to a past day)
- Wati template name mapping in `src/lib/wati.js` — placeholders,
  swap in your actual approved template names once created in Wati
- Coach OTP flow on the frontend (Supabase `signInWithOtp` +
  `verifyOtp`) — this backend only handles the linking step after
