-- Add the optional personal motto without recreating or replacing profiles.
alter table public.profiles
  add column if not exists motto text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_motto_length_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_motto_length_check
      check (motto is null or char_length(motto) <= 120);
  end if;
end;
$$;
