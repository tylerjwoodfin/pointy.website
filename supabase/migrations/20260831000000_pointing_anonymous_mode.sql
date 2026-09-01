-- Optional Anonymous Mode for Pointy sessions (TJW-353).
-- Default off: joiners enter a display name.
alter table public.pointing_sessions
  add column if not exists anonymous_mode boolean not null default false;
