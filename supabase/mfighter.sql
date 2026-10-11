-- mFighter online backend, applied to the promptGov Supabase project as migrations
-- mfighter_init and mfighter_report_fix (the latter replaces mf_report_match).
-- The mfighter schema is not exposed through the API; the game only calls public.mf_* with the
-- publishable key. Players are guests (random id + name kept on the device), not Supabase Auth
-- users, so the game never creates accounts or profiles in the host project.
-- Realtime: each room uses the public broadcast/presence channel "mf-room-<room id>".

-- ===== mfighter_init =====
-- mFighter (formerly คมแฝก). Replaces the komfaek schema / kf_* functions, which only held test rooms.
drop function if exists public.kf_create_room(text, text, boolean), public.kf_quick_match(text, text),
  public.kf_join_room(text, text, text), public.kf_list_rooms(), public.kf_room(text),
  public.kf_set_status(uuid, uuid, text), public.kf_leave_room(uuid, uuid);
drop schema if exists komfaek cascade;

-- Everything lives in its own schema, which the API does not expose; the game reaches it
-- only through the public.mf_* functions (callable with the publishable key).
create schema mfighter;
revoke all on schema mfighter from anon, authenticated;

-- ---------- players (guests: a random id + name kept on the device) ----------
create table mfighter.players (
  id text primary key check (length(id) between 8 and 64),
  name text not null,
  rating int not null default 1000,
  matches int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  rounds_won int not null default 0,
  rounds_lost int not null default 0,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index players_rating_idx on mfighter.players (rating desc) where matches > 0;

-- ---------- rooms ----------
create table mfighter.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  is_public boolean not null default true,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'done')),
  host_id text not null,
  host_name text not null,
  host_token uuid not null default gen_random_uuid(),
  guest_id text,
  guest_name text,
  guest_token uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index rooms_live_code_idx on mfighter.rooms (code) where status <> 'done';
create index rooms_open_idx on mfighter.rooms (status, is_public, created_at);

-- ---------- online matches (best of 3). Rated only when host and guest report the same result ----------
create table mfighter.matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references mfighter.rooms (id) on delete cascade,
  set_no int not null,                         -- 1st, 2nd... set played in this room
  host_id text not null,
  guest_id text not null,
  host_kit text,
  guest_kit text,
  winner_id text,
  score_host int,
  score_guest int,
  host_report jsonb,
  guest_report jsonb,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'disputed')),
  rating_delta int,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique (room_id, set_no)
);
create index matches_confirmed_idx on mfighter.matches (confirmed_at desc) where status = 'confirmed';

-- ---------- activity: one open-ended event log (type + jsonb), so new stats need no schema change ----------
create table mfighter.events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  player_id text,
  session_id text,
  type text not null,
  data jsonb not null default '{}'::jsonb
);
create index events_type_at_idx on mfighter.events (type, at desc);
create index events_player_idx on mfighter.events (player_id, at desc);
create index events_at_idx on mfighter.events (at desc);

alter table mfighter.players enable row level security;
alter table mfighter.rooms enable row level security;
alter table mfighter.matches enable row level security;
alter table mfighter.events enable row level security;
-- no policies on purpose: only the security-definer functions below read or write these tables

-- ---------- helpers ----------
create function mfighter.clean_name(p text) returns text
language sql immutable set search_path = pg_catalog as $$ select left(coalesce(nullif(btrim(p), ''), 'ผู้เล่น'), 20) $$;

create function mfighter.check_player(p text) returns void
language plpgsql immutable set search_path = pg_catalog as $$
begin
  if p is null or length(p) < 8 or length(p) > 64 then raise exception 'bad player'; end if;
end $$;

create function mfighter.new_code() returns text
language plpgsql set search_path = mfighter, extensions, pg_catalog as $$
declare c text;
begin
  loop
    c := upper(substr(translate(encode(gen_random_bytes(6), 'base64'), '+/=0O1I', 'XYZ2Q3J'), 1, 5));
    exit when not exists (select 1 from mfighter.rooms where code = c and status <> 'done');
  end loop;
  return c;
end $$;

-- ---------- players ----------
create function public.mf_hello(p_player text, p_name text)
returns json language plpgsql security definer set search_path = mfighter, pg_catalog as $$
declare r mfighter.players;
begin
  perform mfighter.check_player(p_player);
  insert into mfighter.players (id, name) values (p_player, mfighter.clean_name(p_name))
  on conflict (id) do update set name = excluded.name, last_seen = now()
  returning * into r;
  return json_build_object('rating', r.rating, 'matches', r.matches, 'wins', r.wins, 'losses', r.losses,
    'rank', (select count(*) + 1 from mfighter.players p where p.matches > 0 and p.rating > r.rating));
end $$;

create function public.mf_leaderboard(p_limit int default 50)
returns table (rank bigint, id text, name text, rating int, matches int, wins int, losses int, rounds_won int, rounds_lost int)
language sql security definer set search_path = mfighter, pg_catalog as $$
  select rank() over (order by rating desc), id, name, rating, matches, wins, losses, rounds_won, rounds_lost
    from mfighter.players where matches > 0
   order by rating desc, wins desc limit least(greatest(p_limit, 1), 200)
$$;

-- ---------- rooms ----------
create function public.mf_create_room(p_player text, p_name text, p_public boolean default false)
returns json language plpgsql security definer set search_path = mfighter, pg_catalog as $$
declare r mfighter.rooms;
begin
  perform mfighter.check_player(p_player);
  insert into mfighter.rooms (code, is_public, host_id, host_name)
  values (mfighter.new_code(), p_public, p_player, mfighter.clean_name(p_name)) returning * into r;
  return json_build_object('id', r.id, 'code', r.code, 'token', r.host_token, 'role', 'host');
end $$;

create function public.mf_quick_match(p_player text, p_name text)
returns json language plpgsql security definer set search_path = mfighter, pg_catalog as $$
declare r mfighter.rooms;
begin
  perform mfighter.check_player(p_player);
  update mfighter.rooms set guest_id = p_player, guest_name = mfighter.clean_name(p_name),
         guest_token = gen_random_uuid(), updated_at = now()
   where id = (select id from mfighter.rooms
                where status = 'waiting' and is_public and guest_id is null and host_id <> p_player
                  and updated_at > now() - interval '3 minutes'
                order by created_at limit 1 for update skip locked)
  returning * into r;
  if found then
    return json_build_object('id', r.id, 'code', r.code, 'token', r.guest_token, 'role', 'guest');
  end if;
  return public.mf_create_room(p_player, p_name, true);
end $$;

create function public.mf_join_room(p_code text, p_player text, p_name text)
returns json language plpgsql security definer set search_path = mfighter, pg_catalog as $$
declare r mfighter.rooms;
begin
  perform mfighter.check_player(p_player);
  select * into r from mfighter.rooms where code = upper(btrim(p_code)) and status <> 'done' for update;
  if not found then raise exception 'room not found'; end if;
  if r.host_id = p_player then
    return json_build_object('id', r.id, 'code', r.code, 'token', r.host_token, 'role', 'host');
  end if;
  if r.guest_id is not null and r.guest_id <> p_player then raise exception 'room full'; end if;
  update mfighter.rooms set guest_id = p_player, guest_name = mfighter.clean_name(p_name),
         guest_token = coalesce(guest_token, gen_random_uuid()), updated_at = now()
   where id = r.id returning * into r;
  return json_build_object('id', r.id, 'code', r.code, 'token', r.guest_token, 'role', 'guest');
end $$;

create function public.mf_list_rooms()
returns table (id uuid, code text, status text, host_name text, guest_name text, updated_at timestamptz)
language sql security definer set search_path = mfighter, pg_catalog as $$
  select id, code, status, host_name, guest_name, updated_at from mfighter.rooms
   where status <> 'done' and updated_at > now() - interval '30 minutes'
   order by (status = 'playing') desc, updated_at desc limit 30
$$;

create function public.mf_set_status(p_id uuid, p_token uuid, p_status text)
returns void language plpgsql security definer set search_path = mfighter, pg_catalog as $$
begin
  if p_status not in ('waiting', 'playing', 'done') then raise exception 'bad status'; end if;
  update mfighter.rooms set status = p_status, updated_at = now()
   where id = p_id and (host_token = p_token or guest_token = p_token);
end $$;

create function public.mf_leave_room(p_id uuid, p_token uuid)
returns void language plpgsql security definer set search_path = mfighter, pg_catalog as $$
begin
  update mfighter.rooms set status = 'done', updated_at = now() where id = p_id and host_token = p_token;
  update mfighter.rooms set guest_id = null, guest_name = null, guest_token = null, status = 'waiting', updated_at = now()
   where id = p_id and guest_token = p_token and status <> 'done';
end $$;

-- ---------- results: each player reports the set; matching reports are rated (Elo, K = 32) ----------
-- p_report: { set_no, winner: "host"|"guest", score: {host, guest}, host_kit, guest_kit, rounds: [...] }
create function public.mf_report_match(p_room uuid, p_token uuid, p_report jsonb)
returns json language plpgsql security definer set search_path = mfighter, pg_catalog as $$
declare
  r mfighter.rooms; m mfighter.matches; seat text; set_no int;
  w text; l text; wr int; lr int; expected float; delta int;
begin
  select * into r from mfighter.rooms where id = p_room;
  if not found or r.guest_id is null then raise exception 'room not found'; end if;
  seat := case when r.host_token = p_token then 'host' when r.guest_token = p_token then 'guest' end;
  if seat is null then raise exception 'not a player'; end if;
  if p_report->>'winner' not in ('host', 'guest') then raise exception 'bad report'; end if;
  set_no := (p_report->>'set_no')::int;

  insert into mfighter.matches (room_id, set_no, host_id, guest_id, host_kit, guest_kit)
  values (r.id, set_no, r.host_id, r.guest_id, p_report->>'host_kit', p_report->>'guest_kit')
  on conflict (room_id, set_no) do nothing;
  select * into m from mfighter.matches where room_id = r.id and matches.set_no = set_no for update;
  if m.status <> 'pending' then return json_build_object('status', m.status, 'delta', m.rating_delta); end if;

  if seat = 'host' then update mfighter.matches set host_report = p_report where id = m.id returning * into m;
  else update mfighter.matches set guest_report = p_report where id = m.id returning * into m; end if;
  if m.host_report is null or m.guest_report is null then return json_build_object('status', 'pending'); end if;

  if m.host_report->>'winner' is distinct from m.guest_report->>'winner' then
    update mfighter.matches set status = 'disputed' where id = m.id;
    return json_build_object('status', 'disputed');
  end if;

  w := case when m.host_report->>'winner' = 'host' then m.host_id else m.guest_id end;
  l := case when w = m.host_id then m.guest_id else m.host_id end;
  insert into mfighter.players (id, name) values (m.host_id, r.host_name), (m.guest_id, coalesce(r.guest_name, 'ผู้เล่น'))
  on conflict (id) do nothing;
  select rating into wr from mfighter.players where id = w for update;
  select rating into lr from mfighter.players where id = l for update;
  expected := 1.0 / (1 + power(10, (lr - wr) / 400.0));
  delta := greatest(1, round(32 * (1 - expected)))::int;
  update mfighter.players set rating = rating + delta, matches = matches + 1, wins = wins + 1,
    rounds_won = rounds_won + coalesce((m.host_report->'score'->>(case when w = m.host_id then 'host' else 'guest' end))::int, 0),
    rounds_lost = rounds_lost + coalesce((m.host_report->'score'->>(case when w = m.host_id then 'guest' else 'host' end))::int, 0)
   where id = w;
  update mfighter.players set rating = greatest(100, rating - delta), matches = matches + 1, losses = losses + 1,
    rounds_won = rounds_won + coalesce((m.host_report->'score'->>(case when l = m.host_id then 'host' else 'guest' end))::int, 0),
    rounds_lost = rounds_lost + coalesce((m.host_report->'score'->>(case when l = m.host_id then 'guest' else 'host' end))::int, 0)
   where id = l;
  update mfighter.matches set status = 'confirmed', winner_id = w, rating_delta = delta, confirmed_at = now(),
    score_host = (m.host_report->'score'->>'host')::int, score_guest = (m.host_report->'score'->>'guest')::int
   where id = m.id;
  return json_build_object('status', 'confirmed', 'delta', delta, 'winner', w);
end $$;

-- ---------- activity tracking ----------
-- p_events: [{ type, data, at? }] (max 50 per call). Known types are documented in web/track.js.
create function public.mf_track(p_player text, p_session text, p_events jsonb)
returns int language plpgsql security definer set search_path = mfighter, pg_catalog as $$
declare n int;
begin
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 50 then raise exception 'bad events'; end if;
  insert into mfighter.events (player_id, session_id, type, data, at)
  select left(p_player, 64), left(p_session, 64), left(e->>'type', 40),
         case when jsonb_typeof(e->'data') = 'object' and length((e->'data')::text) <= 4000 then e->'data' else '{}'::jsonb end,
         least(now(), greatest(now() - interval '1 day', coalesce((e->>'at')::timestamptz, now())))
    from jsonb_array_elements(p_events) e
   where e ? 'type';
  get diagnostics n = row_count;
  return n;
end $$;

-- summary for the in-game stats page; p_days = how far back (null = all time)
create function public.mf_stats(p_days int default 7)
returns json language sql security definer set search_path = mfighter, pg_catalog as $$
  with ev as (select * from mfighter.events where p_days is null or at > now() - make_interval(days => p_days)),
  rounds as (select * from ev where type = 'round_end'),
  picks as (
    select data->>'p1_kit' as kit, data->>'winner' = 'p1' as won from rounds
    union all select data->>'p2_kit', data->>'winner' = 'p2' from rounds
  ),
  skills as (
    select s.key as skill, sum(s.value::int) as uses from rounds,
      lateral jsonb_each_text(coalesce(data->'p1_skills', '{}'::jsonb) || '{}'::jsonb) s group by 1
    union all
    select s.key, sum(s.value::int) from rounds, lateral jsonb_each_text(coalesce(data->'p2_skills', '{}'::jsonb)) s group by 1
  )
  select json_build_object(
    'days', p_days,
    'players', (select count(distinct player_id) from ev),
    'sessions', (select count(distinct session_id) from ev),
    'online_players', (select count(*) from mfighter.players where matches > 0),
    'matches', (select count(*) from ev where type = 'match_end'),
    'matches_online', (select count(*) from ev where type = 'match_end' and data->>'mode' = 'online'),
    'matches_cpu', (select count(*) from ev where type = 'match_end' and data->>'mode' = 'cpu'),
    'rounds', (select count(*) from rounds),
    'avg_round_sec', (select round(avg((data->>'secs')::numeric), 1) from rounds),
    'characters', (select coalesce(json_agg(c order by c.picks desc), '[]') from (
        select kit, count(*) as picks, round(100.0 * avg(won::int), 0) as win_rate from picks where kit is not null group by kit) c),
    'skills', (select coalesce(json_agg(s order by s.uses desc), '[]') from (
        select skill, sum(uses) as uses from skills group by skill order by 2 desc limit 15) s),
    'recent', (select coalesce(json_agg(x), '[]') from (
        select m.confirmed_at as at, hp.name as host, gp.name as guest, m.host_kit, m.guest_kit,
               m.score_host, m.score_guest, wp.name as winner, m.rating_delta
          from mfighter.matches m
          join mfighter.players hp on hp.id = m.host_id join mfighter.players gp on gp.id = m.guest_id
          left join mfighter.players wp on wp.id = m.winner_id
         where m.status = 'confirmed' order by m.confirmed_at desc limit 10) x)
  )
$$;

revoke all on function public.mf_hello(text, text), public.mf_leaderboard(int), public.mf_create_room(text, text, boolean),
  public.mf_quick_match(text, text), public.mf_join_room(text, text, text), public.mf_list_rooms(),
  public.mf_set_status(uuid, uuid, text), public.mf_leave_room(uuid, uuid), public.mf_report_match(uuid, uuid, jsonb),
  public.mf_track(text, text, jsonb), public.mf_stats(int) from public;
grant execute on function public.mf_hello(text, text), public.mf_leaderboard(int), public.mf_create_room(text, text, boolean),
  public.mf_quick_match(text, text), public.mf_join_room(text, text, text), public.mf_list_rooms(),
  public.mf_set_status(uuid, uuid, text), public.mf_leave_room(uuid, uuid), public.mf_report_match(uuid, uuid, jsonb),
  public.mf_track(text, text, jsonb), public.mf_stats(int) to anon, authenticated;


-- ===== mfighter_report_fix =====
create or replace function public.mf_report_match(p_room uuid, p_token uuid, p_report jsonb)
returns json language plpgsql security definer set search_path = mfighter, pg_catalog as $$
declare
  r mfighter.rooms; m mfighter.matches; seat text; v_set int;
  w text; l text; wr int; lr int; expected float; delta int;
begin
  select * into r from mfighter.rooms where id = p_room;
  if not found or r.guest_id is null then raise exception 'room not found'; end if;
  seat := case when r.host_token = p_token then 'host' when r.guest_token = p_token then 'guest' end;
  if seat is null then raise exception 'not a player'; end if;
  if p_report->>'winner' not in ('host', 'guest') then raise exception 'bad report'; end if;
  v_set := (p_report->>'set_no')::int;

  insert into mfighter.matches (room_id, set_no, host_id, guest_id, host_kit, guest_kit)
  values (r.id, v_set, r.host_id, r.guest_id, p_report->>'host_kit', p_report->>'guest_kit')
  on conflict (room_id, set_no) do nothing;
  select * into m from mfighter.matches where room_id = r.id and matches.set_no = v_set for update;
  if m.status <> 'pending' then return json_build_object('status', m.status, 'delta', m.rating_delta); end if;

  if seat = 'host' then update mfighter.matches set host_report = p_report where id = m.id returning * into m;
  else update mfighter.matches set guest_report = p_report where id = m.id returning * into m; end if;
  if m.host_report is null or m.guest_report is null then return json_build_object('status', 'pending'); end if;

  if m.host_report->>'winner' is distinct from m.guest_report->>'winner' then
    update mfighter.matches set status = 'disputed' where id = m.id;
    return json_build_object('status', 'disputed');
  end if;

  w := case when m.host_report->>'winner' = 'host' then m.host_id else m.guest_id end;
  l := case when w = m.host_id then m.guest_id else m.host_id end;
  insert into mfighter.players (id, name) values (m.host_id, r.host_name), (m.guest_id, coalesce(r.guest_name, 'ผู้เล่น'))
  on conflict (id) do nothing;
  select rating into wr from mfighter.players where id = w for update;
  select rating into lr from mfighter.players where id = l for update;
  expected := 1.0 / (1 + power(10, (lr - wr) / 400.0));
  delta := greatest(1, round(32 * (1 - expected)))::int;
  update mfighter.players set rating = rating + delta, matches = matches + 1, wins = wins + 1,
    rounds_won = rounds_won + coalesce((m.host_report->'score'->>(case when w = m.host_id then 'host' else 'guest' end))::int, 0),
    rounds_lost = rounds_lost + coalesce((m.host_report->'score'->>(case when w = m.host_id then 'guest' else 'host' end))::int, 0)
   where id = w;
  update mfighter.players set rating = greatest(100, rating - delta), matches = matches + 1, losses = losses + 1,
    rounds_won = rounds_won + coalesce((m.host_report->'score'->>(case when l = m.host_id then 'host' else 'guest' end))::int, 0),
    rounds_lost = rounds_lost + coalesce((m.host_report->'score'->>(case when l = m.host_id then 'guest' else 'host' end))::int, 0)
   where id = l;
  update mfighter.matches set status = 'confirmed', winner_id = w, rating_delta = delta, confirmed_at = now(),
    score_host = (m.host_report->'score'->>'host')::int, score_guest = (m.host_report->'score'->>'guest')::int
   where id = m.id;
  return json_build_object('status', 'confirmed', 'delta', delta, 'winner', w);
end $$;
