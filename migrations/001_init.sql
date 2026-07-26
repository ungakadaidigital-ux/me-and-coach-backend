-- ============================================================
-- Me & Coach (Academy OS) — Initial schema
-- Follows "Me &" family Design & Product Principles:
--   #1 Auth: phone+password (pseudo-email under the hood)
--   #6 Editability: every record carries is_edited/edited_at/edited_by
-- ============================================================

create extension if not exists "pgcrypto";

create table academies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  district text,
  verticals text[] not null default '{}',
  plan text not null default 'starter',
  language text not null default 'ta',
  created_at timestamptz default now()
);

create table vertical_configs (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid references academies(id) on delete cascade,
  vertical text not null,
  field_key text not null,
  field_label_ta text not null,
  field_label_en text,
  field_type text not null default 'text',
  options jsonb,
  sort_order int default 0,
  unique (academy_id, vertical, field_key)
);

create table coaches (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  academy_id uuid references academies(id) on delete cascade,
  name text not null,
  phone text unique not null,
  role text not null default 'coach',
  verticals text[] default '{}',
  created_at timestamptz default now()
);
create index idx_coaches_phone on coaches(phone);

create table batches (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid references academies(id) on delete cascade,
  vertical text not null,
  name text not null,
  coach_id uuid references coaches(id),
  location text,
  days_of_week int[] not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz default now()
);

create table students (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid references academies(id) on delete cascade,
  batch_id uuid references batches(id),
  vertical text not null,
  name text not null,
  parent_phone text not null,
  parent_name text,
  join_date date default current_date,
  status text not null default 'active',
  custom_fields jsonb not null default '{}',
  is_edited boolean not null default false,
  edited_at timestamptz,
  edited_by uuid references coaches(id),
  created_at timestamptz default now()
);
create index idx_students_academy on students(academy_id);
create index idx_students_vertical on students(academy_id, vertical);

create table attendance (
  id uuid primary key,
  academy_id uuid references academies(id) on delete cascade,
  batch_id uuid references batches(id),
  student_id uuid references students(id),
  session_date date not null,
  status text not null,
  marked_by uuid references coaches(id),
  device_marked_at timestamptz not null,
  synced_at timestamptz default now(),
  is_edited boolean not null default false,
  edited_at timestamptz,
  edited_by uuid references coaches(id),
  unique (batch_id, student_id, session_date)
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid references academies(id) on delete cascade,
  student_id uuid references students(id),
  amount numeric(10,2) not null,
  due_date date not null,
  paid_date date,
  status text not null default 'due',
  method text,
  razorpay_link text,
  is_edited boolean not null default false,
  edited_at timestamptz,
  edited_by uuid references coaches(id),
  created_at timestamptz default now()
);

create table reminders (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid references academies(id) on delete cascade,
  student_id uuid references students(id),
  payment_id uuid references payments(id),
  template text not null,
  sent_at timestamptz default now(),
  wati_message_id text,
  status text not null default 'sent'
);

alter table academies enable row level security;
alter table vertical_configs enable row level security;
alter table coaches enable row level security;
alter table batches enable row level security;
alter table students enable row level security;
alter table attendance enable row level security;
alter table payments enable row level security;
alter table reminders enable row level security;

create policy academy_isolation_students on students
  using (academy_id::text = current_setting('request.jwt.claim.academy_id', true));
create policy academy_isolation_batches on batches
  using (academy_id::text = current_setting('request.jwt.claim.academy_id', true));
create policy academy_isolation_attendance on attendance
  using (academy_id::text = current_setting('request.jwt.claim.academy_id', true));
create policy academy_isolation_payments on payments
  using (academy_id::text = current_setting('request.jwt.claim.academy_id', true));
create policy academy_isolation_reminders on reminders
  using (academy_id::text = current_setting('request.jwt.claim.academy_id', true));
create policy academy_isolation_coaches on coaches
  using (academy_id::text = current_setting('request.jwt.claim.academy_id', true));
create policy academy_isolation_vconfig on vertical_configs
  using (academy_id::text = current_setting('request.jwt.claim.academy_id', true));
