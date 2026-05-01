-- Tiled — follows table, real follower/following counts, follow notifications
-- Run via SQL Editor → New query → paste → Run. Idempotent.

-- ──────────────────────────────────────────────────────────────────────────
-- follows: directed edge (follower_id → followee_id)
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
alter table public.follows enable row level security;

drop policy if exists follows_select_all on public.follows;
create policy follows_select_all on public.follows for select using (true);

drop policy if exists follows_insert_own on public.follows;
create policy follows_insert_own on public.follows for insert
  with check (follower_id = auth.uid());

drop policy if exists follows_delete_own on public.follows;
create policy follows_delete_own on public.follows for delete
  using (follower_id = auth.uid());

create index if not exists follows_followee_idx on public.follows(followee_id);
create index if not exists follows_follower_idx on public.follows(follower_id);

-- ──────────────────────────────────────────────────────────────────────────
-- profile_stats: profile + live follower / following counts
-- ──────────────────────────────────────────────────────────────────────────
create or replace view public.profile_stats as
  select
    p.id,
    p.username,
    p.name,
    p.avatar,
    p.bio,
    p.role,
    p.created_at,
    coalesce((select count(*)::int from public.follows where followee_id = p.id), 0) as follower_count,
    coalesce((select count(*)::int from public.follows where follower_id = p.id), 0) as following_count
  from public.profiles p;

-- ──────────────────────────────────────────────────────────────────────────
-- Follow notification trigger
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (recipient_id, actor_id, kind, body)
  values (new.followee_id, new.follower_id, 'follow', 'started following you');
  return new;
end;
$$;

drop trigger if exists on_follow_inserted on public.follows;
create trigger on_follow_inserted
  after insert on public.follows
  for each row execute function public.notify_on_follow();

-- ──────────────────────────────────────────────────────────────────────────
-- Add follows to the realtime publication so follower badges update live
-- ──────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'follows'
  ) then
    alter publication supabase_realtime add table public.follows;
  end if;
end $$;
