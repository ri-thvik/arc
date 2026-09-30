-- Winter Arc · Phase 1 schema. Run in the Supabase SQL editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '', email text, start_date date,
  duration integer not null default 30 check (duration in (30, 60, 90) or duration between 1 and 365),
  goal text, motto text check (motto is null or char_length(motto) <= 120),
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text check (description is null or char_length(description) <= 100),
  icon text not null default 'spark', accent text not null default '#b4c5a6',
  type text not null default 'BOOLEAN' check (type in ('BOOLEAN', 'NUMBER', 'DURATION')),
  target numeric, unit text, frequency text not null default 'daily',
  active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null, value numeric, completed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint habit_completions_user_habit_date_key unique (user_id, habit_id, date)
);
create index if not exists habits_user_active_idx on public.habits(user_id, active, created_at);
create index if not exists completions_user_date_idx on public.habit_completions(user_id, date desc);
create index if not exists completions_habit_date_idx on public.habit_completions(habit_id, date desc);

alter table public.profiles enable row level security;
alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;
drop policy if exists "Users manage own profile" on public.profiles;
create policy "Users manage own profile" on public.profiles for all to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "Users manage own habits" on public.habits;
create policy "Users manage own habits" on public.habits for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own completions" on public.habit_completions;
create policy "Users manage own completions" on public.habit_completions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id and exists (
    select 1 from public.habits h where h.id = habit_id and h.user_id = auth.uid()
  ));

create or replace function public.validate_completion_owner()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.habits h where h.id = new.habit_id and h.user_id = new.user_id) then
    raise exception 'Habit does not belong to this user';
  end if;
  return new;
end;
$$;
drop trigger if exists validate_completion_owner on public.habit_completions;
create trigger validate_completion_owner before insert or update of habit_id, user_id
  on public.habit_completions for each row execute function public.validate_completion_owner();
