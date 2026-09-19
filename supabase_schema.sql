-- BEATITUDES INTERNATIONAL SCHOOL
-- Supabase/PostgreSQL production database starter
-- Run in Supabase SQL Editor AFTER creating the project.
-- Then enable Email/Password Auth and create users in Authentication.

create extension if not exists pgcrypto;

create type public.user_role as enum ('management','teacher','parent');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'parent',
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.pupils (
  id uuid primary key default gen_random_uuid(),
  admission_number text unique not null,
  full_name text not null,
  gender text check (gender in ('Male','Female')),
  class_id uuid references public.classes(id),
  date_of_birth date,
  parent_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  pupil_id uuid not null references public.pupils(id) on delete cascade,
  attendance_date date not null,
  status text not null check (status in ('Present','Absent','Late')),
  recorded_by uuid references public.profiles(id),
  unique(pupil_id, attendance_date)
);

create table if not exists public.fees (
  id uuid primary key default gen_random_uuid(),
  pupil_id uuid not null references public.pupils(id) on delete cascade,
  term text not null,
  item text not null,
  amount_due numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  payment_date date,
  reference text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  pupil_id uuid not null references public.pupils(id) on delete cascade,
  subject text not null,
  assessment_name text not null,
  score numeric(6,2),
  term text not null,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null default 'all',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

insert into public.classes(name) values
('Baby Class'),('Middle Class'),('Reception'),('Grade 1'),('Grade 2'),
('Grade 3'),('Grade 4'),('Grade 5'),('Form 1')
on conflict(name) do nothing;

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.pupils enable row level security;
alter table public.attendance enable row level security;
alter table public.fees enable row level security;
alter table public.assessments enable row level security;
alter table public.notices enable row level security;

create or replace function public.my_role()
returns public.user_role
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create policy "users read own profile" on public.profiles
for select using (id = auth.uid());

create policy "management read profiles" on public.profiles
for select using (public.my_role() = 'management');

create policy "classes authenticated read" on public.classes
for select using (auth.uid() is not null);

create policy "management full pupils" on public.pupils
for all using (public.my_role() = 'management') with check (public.my_role() = 'management');

create policy "parent read own pupil" on public.pupils
for select using (parent_id = auth.uid());

create policy "management attendance" on public.attendance
for all using (public.my_role() in ('management','teacher'))
with check (public.my_role() in ('management','teacher'));

create policy "parent read own attendance" on public.attendance
for select using (exists(select 1 from public.pupils p where p.id=pupil_id and p.parent_id=auth.uid()));

create policy "management fees" on public.fees
for all using (public.my_role() = 'management')
with check (public.my_role() = 'management');

create policy "parent read own fees" on public.fees
for select using (exists(select 1 from public.pupils p where p.id=pupil_id and p.parent_id=auth.uid()));

create policy "management academics" on public.assessments
for all using (public.my_role() in ('management','teacher'))
with check (public.my_role() in ('management','teacher'));

create policy "parent read own academics" on public.assessments
for select using (exists(select 1 from public.pupils p where p.id=pupil_id and p.parent_id=auth.uid()));

create policy "authenticated notices" on public.notices
for select using (auth.uid() is not null);

create policy "management notices" on public.notices
for insert with check (public.my_role() = 'management');

-- IMPORTANT:
-- Create management/teacher/parent users in Supabase Authentication.
-- Then insert their profile rows using the Auth user UUID.
-- Never put a Supabase service-role key in this HTML file.
