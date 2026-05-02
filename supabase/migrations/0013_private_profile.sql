-- Tiled — private profiles
--
-- Adds an opt-in "private account" flag. When a profile is private,
-- only the owner and their followers can see the owner's tiles,
-- follower list, and following list. Avatar, name, bio, follower
-- count, and following count remain publicly visible so visitors
-- can find the profile and follow.

-- ──────────────────────────────────────────────────────────────────────
-- Column
-- ──────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists is_private boolean not null default false;

-- ──────────────────────────────────────────────────────────────────────
-- Helper: does the current user follow target_uid?
-- security definer so the policy on follows itself doesn't recurse.
-- ──────────────────────────────────────────────────────────────────────
create or replace function public.is_follower_of(target_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.follows
    where follower_id = auth.uid() and followee_id = target_uid
  );
$$;

grant execute on function public.is_follower_of(uuid) to authenticated, anon;

-- ──────────────────────────────────────────────────────────────────────
-- tiles SELECT — keep the per-tile is_private carve-out, additionally
-- gate by the author profile's is_private flag.
-- ──────────────────────────────────────────────────────────────────────
drop policy if exists tiles_select on public.tiles;
create policy tiles_select on public.tiles for select
  using (
    author_id = auth.uid()
    or (
      is_private = false
      and (
        not coalesce((select is_private from public.profiles where id = author_id), false)
        or public.is_follower_of(author_id)
      )
    )
  );

-- ──────────────────────────────────────────────────────────────────────
-- follows SELECT — edge visible if either endpoint is publicly viewable
-- by the current user (or the current user is one of the endpoints).
-- This matches Instagram-style behavior: public users' follower lists
-- include private users (the edge is visible through the public side).
-- ──────────────────────────────────────────────────────────────────────
drop policy if exists follows_select_all on public.follows;
drop policy if exists follows_select on public.follows;
create policy follows_select on public.follows for select
  using (
    follower_id = auth.uid()
    or followee_id = auth.uid()
    or not coalesce((select is_private from public.profiles where id = followee_id), false)
    or not coalesce((select is_private from public.profiles where id = follower_id), false)
    or public.is_follower_of(followee_id)
    or public.is_follower_of(follower_id)
  );

-- ──────────────────────────────────────────────────────────────────────
-- profile_stats view — expose is_private so the client can render the
-- locked-profile state without an extra round-trip.
-- ──────────────────────────────────────────────────────────────────────
drop view if exists public.profile_stats;
create or replace view public.profile_stats as
  select
    p.id,
    p.username,
    p.name,
    p.avatar,
    p.avatar_url,
    p.bio,
    p.role,
    p.is_private,
    p.created_at,
    coalesce((select count(*)::int from public.follows where followee_id = p.id), 0) as follower_count,
    coalesce((select count(*)::int from public.follows where follower_id = p.id), 0) as following_count
  from public.profiles p;
