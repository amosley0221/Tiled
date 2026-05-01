-- Tiled — initial schema, RLS policies, and triggers.
-- Run this in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.

create extension if not exists "uuid-ossp";

-- ──────────────────────────────────────────────────────────────────────────
-- profiles (one row per auth.users entry, auto-created by trigger)
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  name        text not null,
  avatar      text not null,                  -- 2-letter initials shown in the app
  bio         text default '',
  role        text not null default 'user'
              check (role in ('owner', 'admin', 'user')),
  created_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all on public.profiles for select using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- ──────────────────────────────────────────────────────────────────────────
-- auto-create a profile row whenever a new auth.users row appears.
-- Username comes from raw_user_meta_data.username if present, else from
-- the local part of the email. If the desired username is taken we append
-- a random 1-3 digit suffix until it's unique.
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uname        text := lower(coalesce(
                 nullif(new.raw_user_meta_data->>'username', ''),
                 split_part(new.email, '@', 1)));
  display_name text := initcap(replace(uname, '_', ' '));
  ava          text := upper(substring(uname, 1, 2));
  suffix       int;
begin
  while exists (select 1 from public.profiles where username = uname) loop
    suffix := floor(random() * 900 + 100)::int;
    uname  := lower(coalesce(
                nullif(new.raw_user_meta_data->>'username', ''),
                split_part(new.email, '@', 1))) || suffix::text;
  end loop;

  insert into public.profiles (id, username, name, avatar)
  values (new.id, uname, display_name, ava);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ──────────────────────────────────────────────────────────────────────────
-- Look up an email by username, used for "log in with username" support.
-- SECURITY DEFINER so it can read auth.users while RLS-protected callers
-- can't enumerate the auth schema directly.
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.get_email_for_username(uname text)
returns text
language sql
security definer
set search_path = public, auth
as $$
  select au.email::text
  from auth.users au
  join public.profiles p on p.id = au.id
  where lower(p.username) = lower(uname)
  limit 1
$$;
grant execute on function public.get_email_for_username(text) to anon, authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- tiles
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.tiles (
  id          uuid primary key default uuid_generate_v4(),
  author_id   uuid not null references public.profiles(id) on delete cascade,
  kind        text not null
              check (kind in ('photo','video','text','audio','live','link','poll','chart','grid')),
  mode        text not null default 'social'
              check (mode in ('social','pro','private')),
  body        text,
  caption     text,
  media       jsonb,
  link        jsonb,
  poll        jsonb,
  chart       jsonb,
  grid        jsonb,
  is_private  boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.tiles enable row level security;

drop policy if exists tiles_select on public.tiles;
create policy tiles_select on public.tiles for select
  using (is_private = false or author_id = auth.uid());

drop policy if exists tiles_insert_own on public.tiles;
create policy tiles_insert_own on public.tiles for insert
  with check (author_id = auth.uid());

drop policy if exists tiles_update_own on public.tiles;
create policy tiles_update_own on public.tiles for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());

drop policy if exists tiles_delete_own on public.tiles;
create policy tiles_delete_own on public.tiles for delete
  using (author_id = auth.uid());

-- ──────────────────────────────────────────────────────────────────────────
-- comments
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.comments (
  id          uuid primary key default uuid_generate_v4(),
  tile_id     uuid not null references public.tiles(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now()
);
alter table public.comments enable row level security;

drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select using (true);

drop policy if exists comments_insert_own on public.comments;
create policy comments_insert_own on public.comments for insert with check (author_id = auth.uid());

drop policy if exists comments_update_own on public.comments;
create policy comments_update_own on public.comments for update using (author_id = auth.uid());

drop policy if exists comments_delete_own on public.comments;
create policy comments_delete_own on public.comments for delete using (author_id = auth.uid());

-- ──────────────────────────────────────────────────────────────────────────
-- tile_tags
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.tile_tags (
  tile_id  uuid not null references public.tiles(id) on delete cascade,
  tag      text not null,
  primary key (tile_id, tag)
);
alter table public.tile_tags enable row level security;

drop policy if exists tags_select on public.tile_tags;
create policy tags_select on public.tile_tags for select using (true);

drop policy if exists tags_modify_by_owner on public.tile_tags;
create policy tags_modify_by_owner on public.tile_tags for all
  using (exists (select 1 from public.tiles t where t.id = tile_id and t.author_id = auth.uid()))
  with check (exists (select 1 from public.tiles t where t.id = tile_id and t.author_id = auth.uid()));

-- ──────────────────────────────────────────────────────────────────────────
-- likes / saves / dismissals (all per-user, per-tile)
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.likes (
  tile_id     uuid not null references public.tiles(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (tile_id, user_id)
);
alter table public.likes enable row level security;
drop policy if exists likes_select_all on public.likes;
create policy likes_select_all on public.likes for select using (true);
drop policy if exists likes_insert_own on public.likes;
create policy likes_insert_own on public.likes for insert with check (user_id = auth.uid());
drop policy if exists likes_delete_own on public.likes;
create policy likes_delete_own on public.likes for delete using (user_id = auth.uid());

create table if not exists public.saves (
  tile_id     uuid not null references public.tiles(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (tile_id, user_id)
);
alter table public.saves enable row level security;
drop policy if exists saves_select_own on public.saves;
create policy saves_select_own on public.saves for select using (user_id = auth.uid());
drop policy if exists saves_insert_own on public.saves;
create policy saves_insert_own on public.saves for insert with check (user_id = auth.uid());
drop policy if exists saves_delete_own on public.saves;
create policy saves_delete_own on public.saves for delete using (user_id = auth.uid());

create table if not exists public.dismissals (
  tile_id     uuid not null references public.tiles(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (tile_id, user_id)
);
alter table public.dismissals enable row level security;
drop policy if exists dismissals_select_own on public.dismissals;
create policy dismissals_select_own on public.dismissals for select using (user_id = auth.uid());
drop policy if exists dismissals_insert_own on public.dismissals;
create policy dismissals_insert_own on public.dismissals for insert with check (user_id = auth.uid());
drop policy if exists dismissals_delete_own on public.dismissals;
create policy dismissals_delete_own on public.dismissals for delete using (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────────────────
-- poll votes
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.poll_votes (
  tile_id     uuid not null references public.tiles(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  option_id   text not null,
  created_at  timestamptz not null default now(),
  primary key (tile_id, user_id)
);
alter table public.poll_votes enable row level security;
drop policy if exists votes_select_all on public.poll_votes;
create policy votes_select_all on public.poll_votes for select using (true);
drop policy if exists votes_insert_own on public.poll_votes;
create policy votes_insert_own on public.poll_votes for insert with check (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────────────────
-- notifications
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id            uuid primary key default uuid_generate_v4(),
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  actor_id      uuid references public.profiles(id) on delete cascade,
  kind          text not null
                check (kind in ('like','comment','follow','mention','save','reply','live')),
  tile_id       uuid references public.tiles(id) on delete cascade,
  body          text,
  preview       text,
  created_at    timestamptz not null default now(),
  read_at       timestamptz
);
alter table public.notifications enable row level security;
drop policy if exists notifs_select_own on public.notifications;
create policy notifs_select_own on public.notifications for select using (recipient_id = auth.uid());
drop policy if exists notifs_insert_authed on public.notifications;
create policy notifs_insert_authed on public.notifications for insert with check (auth.uid() is not null);
drop policy if exists notifs_update_own on public.notifications;
create policy notifs_update_own on public.notifications for update using (recipient_id = auth.uid());
drop policy if exists notifs_delete_own on public.notifications;
create policy notifs_delete_own on public.notifications for delete using (recipient_id = auth.uid());

-- ──────────────────────────────────────────────────────────────────────────
-- indexes
-- ──────────────────────────────────────────────────────────────────────────
create index if not exists tiles_created_at_idx     on public.tiles(created_at desc);
create index if not exists tiles_mode_idx           on public.tiles(mode);
create index if not exists tiles_author_idx         on public.tiles(author_id);
create index if not exists comments_tile_idx        on public.comments(tile_id);
create index if not exists notifs_recipient_idx     on public.notifications(recipient_id, created_at desc);
create index if not exists tile_tags_tag_idx        on public.tile_tags(tag);
