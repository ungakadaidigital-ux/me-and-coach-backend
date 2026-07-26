Me & Coach — Backend
Express API on Node.js + Supabase (Postgres). Built to the "Me &" family Design & Product Principles — see comments in migrations/001_init.sql, src/routes/auth.js, and src/middleware/auth.js for where each principle is implemented.
Setup
Create a Supabase project.
Run migrations/001_init.sql in the Supabase SQL editor (or via supabase db push).
Copy .env.example to .env and fill in real values.
npm install
npm run dev
Deploy order (important)
Per the dev process notes: SQL migration → Backend → Frontend, in that order. Deploying the backend before the migration, or the frontend before the backend, will surface confusing dependency errors.
Creating the first coach account (manual onboarding phase)
There is no public sign-up screen yet. Create the first academy + coach with:
curl -X POST $API_URL/api/auth/admin/create-account \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9840000000",
    "password": "TempPass123",
    "name": "Coach Selvan",
    "academy_id": "<uuid from academies table>",
    "role": "owner"
  }'
Keep an Excel sheet of phone → password for support to hand off and reset, exactly as described in the Design & Product Principles doc.
Railway deployment notes
Set trust proxy is already handled in server.js — required for express-rate-limit to read X-Forwarded-For correctly behind Railway's proxy, especially once a custom domain is added to FRONTEND_URL/CORS.
Environment variables to set on Railway: everything in .env.example.
