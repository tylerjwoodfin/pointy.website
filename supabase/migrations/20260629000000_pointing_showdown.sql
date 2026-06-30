-- Pointing Showdown session persistence (TJW-271).
-- Run in the Supabase SQL editor or via `supabase db push`.

create table if not exists public.pointing_sessions (
  id text primary key,
  revealed boolean not null default false,
  game_over boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists pointing_sessions_expires_at_idx
  on public.pointing_sessions (expires_at);

create table if not exists public.pointing_players (
  id uuid primary key,
  session_id text not null references public.pointing_sessions (id) on delete cascade,
  name text not null,
  brb boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists pointing_players_session_id_idx
  on public.pointing_players (session_id);

create table if not exists public.pointing_votes (
  session_id text not null references public.pointing_sessions (id) on delete cascade,
  player_id uuid not null references public.pointing_players (id) on delete cascade,
  value integer not null,
  primary key (session_id, player_id)
);

alter table public.pointing_sessions enable row level security;
alter table public.pointing_players enable row level security;
alter table public.pointing_votes enable row level security;

-- No anon/authenticated policies: only the service role (WebSocket server) accesses these tables.
