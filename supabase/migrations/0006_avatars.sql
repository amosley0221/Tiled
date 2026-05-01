-- Tiled — profile pictures (Supabase Storage)
-- Run via SQL Editor → New query → paste → Run. Idempotent.
--
-- Adds:
--   1. profiles.avatar_url       — public URL of an uploaded image
--   2. tile_feed view            — re-defined to include author_avatar_url
--   3. profile_stats view        — re-defined to include avatar_url
--   4. storage bucket 'avatars'  — public bucket for profile pictures
--   5. RLS on storage.objects    — users can only upload to their own folder
--      (path = '<auth.uid()>/<filename>'), reads are public

-- ──────────────────────────────────────────────────────────────────────────
-- profiles.avatar_url column
-- ──────────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists avatar_url text;

-- ──────────────────────────────────────────────────────────────────────────
-- tile_feed view — pull in author_avatar_url
-- We DROP first because Postgres won't let CREATE OR REPLACE VIEW change a
-- column's name or position; the new view inserts avatar_url between
-- author_avatar and author_role.
-- ──────────────────────────────────────────────────────────────────────────
drop view if exists public.tile_feed;
create or replace view public.tile_feed as
  select
    t.id,
    t.author_id,
    t.kind,
    t.mode,
    t.body,
    t.caption,
    t.media,
    t.link,
    t.poll,
    t.chart,
    t.grid,
    t.is_private,
    t.created_at,
    p.username       as author_username,
    p.name           as author_name,
    p.avatar         as author_avatar,
    p.avatar_url     as author_avatar_url,
    p.role           as author_role,
    coalesce((select count(*)::int from public.likes    where tile_id = t.id), 0) as like_count,
    coalesce((select count(*)::int from public.comments where tile_id = t.id), 0) as comment_count,
    coalesce((select array_agg(tag) from public.tile_tags where tile_id = t.id), array[]::text[]) as tags
  from public.tiles t
  join public.profiles p on p.id = t.author_id;

-- ──────────────────────────────────────────────────────────────────────────
-- profile_stats view — include avatar_url (drop first, same reason as above)
-- ──────────────────────────────────────────────────────────────────────────
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
    p.created_at,
    coalesce((select count(*)::int from public.follows where followee_id = p.id), 0) as follower_count,
    coalesce((select count(*)::int from public.follows where follower_id = p.id), 0) as following_count
  from public.profiles p;

-- ──────────────────────────────────────────────────────────────────────────
-- Storage bucket 'avatars' (public read, owner-only write)
-- ──────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Storage policies (created against storage.objects)
drop policy if exists "Avatar public read" on storage.objects;
create policy "Avatar public read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "Avatar upload by owner" on storage.objects;
create policy "Avatar upload by owner" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Avatar update by owner" on storage.objects;
create policy "Avatar update by owner" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Avatar delete by owner" on storage.objects;
create policy "Avatar delete by owner" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
