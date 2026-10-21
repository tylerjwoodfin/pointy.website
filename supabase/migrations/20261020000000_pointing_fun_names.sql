-- Fun Names for Pointy sessions (TJW-450).
-- On by default. fun_title is the "Sleepy Eagle" half of "Bob the Sleepy Eagle".
alter table public.pointing_sessions
  add column if not exists fun_names boolean not null default true;

alter table public.pointing_players
  add column if not exists fun_title text;
