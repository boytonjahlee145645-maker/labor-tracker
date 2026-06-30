-- Labor Tracker Schema
-- Run this in your Supabase SQL editor

create table if not exists workers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hourly_rate numeric not null,
  my_cut_per_hour numeric not null default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid references workers(id) on delete cascade,
  date date not null,
  shift text not null check (shift in ('morning', 'evening')),
  hours_worked numeric not null default 0,
  status text not null check (status in ('present', 'absent', 'substitute')),
  substitute_for uuid references workers(id),
  created_at timestamptz default now(),
  unique(worker_id, date, shift)
);

create table if not exists periods (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  total_worker_wages numeric,
  my_total_earnings numeric,
  is_settled boolean default false,
  created_at timestamptz default now()
);

-- Enable Row Level Security (optional for single-user app, but good practice)
alter table workers enable row level security;
alter table attendance enable row level security;
alter table periods enable row level security;

-- Allow all operations (no auth required for single-user)
create policy "Allow all" on workers for all using (true) with check (true);
create policy "Allow all" on attendance for all using (true) with check (true);
create policy "Allow all" on periods for all using (true) with check (true);
