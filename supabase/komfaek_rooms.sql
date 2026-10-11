-- คมแฝก online rooms (applied to the promptGov Supabase project as migrations
-- komfaek_rooms + komfaek_fix_search_path). The komfaek schema is not exposed through
-- the API; the game only calls the public.kf_* functions with the publishable key.
-- Players are guests (a random id + name kept on the device), not Supabase Auth users,
-- so the game never creates accounts or profiles in the host project.
--
-- Realtime: each room uses the public broadcast/presence channel "kf-room-<room id>"
-- for picks, round control, WebRTC signalling, spectator snapshots and the relay fallback.

-- คมแฝก online rooms. Kept in its own schema (not exposed through the API);
-- the game reaches it only through the kf_* functions below.
create schema if not exists komfaek;

create table komfaek.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
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
create index rooms_open_idx on komfaek.rooms (status, is_public, created_at);
alter table komfaek.rooms enable row level security;   -- no policies: only the functions below touch it
revoke all on schema komfaek from anon, authenticated;

create or replace function komfaek.clean_name(p text) returns text
language sql immutable as $$ select left(coalesce(nullif(btrim(p), ''), 'ผู้เล่น'), 20) $$;

create or replace function komfaek.new_code() returns text
language plpgsql as $$
declare c text;
begin
  loop
    c := upper(substr(translate(encode(gen_random_bytes(6), 'base64'), '+/=0O1I', 'XYZ2Q3J'), 1, 5));
    exit when not exists (select 1 from komfaek.rooms where code = c and status <> 'done');
  end loop;
  return c;
end $$;

-- create a room; the caller becomes the host
create or replace function public.kf_create_room(p_player text, p_name text, p_public boolean default false)
returns json language plpgsql security definer set search_path = komfaek, public, extensions as $$
declare r komfaek.rooms;
begin
  if p_player is null or length(p_player) < 8 then raise exception 'bad player'; end if;
  insert into komfaek.rooms (code, is_public, host_id, host_name)
  values (komfaek.new_code(), p_public, p_player, komfaek.clean_name(p_name)) returning * into r;
  return json_build_object('id', r.id, 'code', r.code, 'token', r.host_token, 'role', 'host');
end $$;

-- quick match: take the oldest open public room, or open a new one and wait
create or replace function public.kf_quick_match(p_player text, p_name text)
returns json language plpgsql security definer set search_path = komfaek, public, extensions as $$
declare r komfaek.rooms;
begin
  if p_player is null or length(p_player) < 8 then raise exception 'bad player'; end if;
  update komfaek.rooms set guest_id = p_player, guest_name = komfaek.clean_name(p_name),
         guest_token = gen_random_uuid(), updated_at = now()
   where id = (select id from komfaek.rooms
                where status = 'waiting' and is_public and guest_id is null and host_id <> p_player
                  and updated_at > now() - interval '3 minutes'
                order by created_at limit 1 for update skip locked)
  returning * into r;
  if found then
    return json_build_object('id', r.id, 'code', r.code, 'token', r.guest_token, 'role', 'guest');
  end if;
  return public.kf_create_room(p_player, p_name, true);
end $$;

-- join a room by its code as the second player
create or replace function public.kf_join_room(p_code text, p_player text, p_name text)
returns json language plpgsql security definer set search_path = komfaek, public, extensions as $$
declare r komfaek.rooms;
begin
  select * into r from komfaek.rooms where code = upper(btrim(p_code)) and status <> 'done' for update;
  if not found then raise exception 'room not found'; end if;
  if r.host_id = p_player then
    return json_build_object('id', r.id, 'code', r.code, 'token', r.host_token, 'role', 'host');
  end if;
  if r.guest_id is not null and r.guest_id <> p_player then raise exception 'room full'; end if;
  update komfaek.rooms set guest_id = p_player, guest_name = komfaek.clean_name(p_name),
         guest_token = coalesce(guest_token, gen_random_uuid()), updated_at = now()
   where id = r.id returning * into r;
  return json_build_object('id', r.id, 'code', r.code, 'token', r.guest_token, 'role', 'guest');
end $$;

-- rooms people can watch (no tokens)
create or replace function public.kf_list_rooms()
returns table (id uuid, code text, status text, host_name text, guest_name text, updated_at timestamptz)
language sql security definer set search_path = komfaek, public as $$
  select id, code, status, host_name, guest_name, updated_at from komfaek.rooms
   where status <> 'done' and updated_at > now() - interval '30 minutes'
   order by (status = 'playing') desc, updated_at desc limit 30
$$;

-- room details for spectators joining by code
create or replace function public.kf_room(p_code text)
returns table (id uuid, code text, status text, host_name text, guest_name text)
language sql security definer set search_path = komfaek, public as $$
  select id, code, status, host_name, guest_name from komfaek.rooms where code = upper(btrim(p_code)) and status <> 'done'
$$;

-- a player in the room updates its status (playing / waiting / done); also a heartbeat
create or replace function public.kf_set_status(p_id uuid, p_token uuid, p_status text)
returns void language plpgsql security definer set search_path = komfaek, public as $$
begin
  if p_status not in ('waiting', 'playing', 'done') then raise exception 'bad status'; end if;
  update komfaek.rooms set status = p_status, updated_at = now()
   where id = p_id and (host_token = p_token or guest_token = p_token);
end $$;

-- leave: the guest frees the seat; the host closes the room
create or replace function public.kf_leave_room(p_id uuid, p_token uuid)
returns void language plpgsql security definer set search_path = komfaek, public as $$
begin
  update komfaek.rooms set status = 'done', updated_at = now() where id = p_id and host_token = p_token;
  update komfaek.rooms set guest_id = null, guest_name = null, guest_token = null, status = 'waiting', updated_at = now()
   where id = p_id and guest_token = p_token and status <> 'done';
end $$;

revoke all on function public.kf_create_room(text, text, boolean), public.kf_quick_match(text, text),
  public.kf_join_room(text, text, text), public.kf_list_rooms(), public.kf_room(text),
  public.kf_set_status(uuid, uuid, text), public.kf_leave_room(uuid, uuid) from public;
grant execute on function public.kf_create_room(text, text, boolean), public.kf_quick_match(text, text),
  public.kf_join_room(text, text, text), public.kf_list_rooms(), public.kf_room(text),
  public.kf_set_status(uuid, uuid, text), public.kf_leave_room(uuid, uuid) to anon, authenticated;


-- komfaek_fix_search_path
alter function komfaek.clean_name(text) set search_path = komfaek, pg_catalog;
alter function komfaek.new_code() set search_path = komfaek, extensions, pg_catalog;
