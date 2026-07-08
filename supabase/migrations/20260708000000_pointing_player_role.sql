-- Add player role for Pointing Showdown (product / qa / dev).
alter table public.pointing_players
  add column if not exists role text not null default 'dev';

alter table public.pointing_players
  add constraint pointing_players_role_check
  check (role in ('product', 'qa', 'dev'));
