-- ============================================================
-- auth-core: refresh token store
-- Product-agnostic — user_id references this product's own
-- Supabase auth.users, nothing else.
-- ============================================================
create table auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  refresh_token_hash text not null unique,
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index idx_auth_sessions_user on auth_sessions(user_id);

-- Service role only — this table is never queried through a
-- user-scoped client, only via the auth-core package's admin client.
alter table auth_sessions enable row level security;
-- No policies defined = no access via anon/authenticated roles,
-- only service_role (which bypasses RLS entirely). Intentional.
