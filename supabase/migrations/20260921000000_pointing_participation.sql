-- Vote totals for the session summary email (TJW-370).
-- Kept on the session row so people who leave are still counted.
alter table public.pointing_sessions
  add column if not exists participation jsonb not null default '{}'::jsonb;
