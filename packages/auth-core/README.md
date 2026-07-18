# @me-and/auth-core

MSG91 OTP send/verify + Supabase-compatible session issuance, shared
across every "Me &" product. Each product keeps its own Supabase
project — this package doesn't share a database, only the auth logic.

## What it does NOT do
- Store OTPs (MSG91 owns that state entirely — send/verify only)
- Know anything about academies, clinics, salons, or any other
  product-specific concept
- Decide who's allowed to log in — that's `resolveClaims`, supplied
  by each product

## Integration steps (per product)

1. `npm install` this package (currently via `file:` reference in a
   monorepo — worth publishing to a private npm registry once a third
   product needs it, not before)
2. Run `migrations/001_auth_sessions.sql` against the product's own
   Supabase DB
3. Env vars: `MSG91_AUTH_KEY`, `MSG91_OTP_TEMPLATE_ID`,
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
4. Write ONE file: a claims resolver. Example shape (see Coach's
   `routes/auth.js` for a working one):

   ```js
   async function resolveClaims(phone, authUser) {
     // Look up your product's own "who owns this phone number" table.
     // Return null to reject login. Return whatever claims your RLS
     // policies expect, e.g. { clinic_id, role, doctor_id }.
   }
   async function resolveClaimsByUserId(userId) {
     // Same shape, keyed by Supabase user id — used on token refresh.
   }
   ```

5. Mount it:
   ```js
   import { createAuthRouter } from "@me-and/auth-core";
   app.use("/api/auth", createAuthRouter({ supabaseAdmin, jwtSecret, resolveClaims, resolveClaimsByUserId }));
   ```
6. **Store phone numbers in your product's tables in normalized
   form** — digits only, with country code, no `+` (e.g.
   `919876543210`). `resolveClaims` receives phone already normalized
   via `normalizePhone`, but if your invite flow writes phone numbers
   in a different format, the lookup will silently never match. This
   bit consistently trips people up — matching formats up front avoids
   a debugging session.

## What each product's own middleware still needs
`auth-core` only issues tokens — verifying them on incoming requests
is still each product's own `requireAuth` middleware: `jwt.verify(token, SUPABASE_JWT_SECRET)`
locally, no network call. Copy Coach's `middleware/requireAuth.js` —
it's ~25 lines and product-agnostic already; not worth extracting
into this package until a second product needs the exact same file.

## Known limitations (intentional, not oversights)
- Refresh tokens are opaque + hashed, rotated on every refresh — no
  device/session management UI. Fine for MVP; add if multi-device
  logout ever becomes a real requirement.
- No rate limiting on `/send-otp` beyond whatever MSG91 enforces
  server-side. Add express-rate-limit in front of this router if OTP
  abuse becomes a problem.
- `getOrCreateAuthUser` uses `listUsers({ phone })` which isn't
  guaranteed to filter server-side on every Supabase version — there's
  a client-side filter as a backstop, but at high user counts this is
  worth revisiting with a direct lookup instead.
