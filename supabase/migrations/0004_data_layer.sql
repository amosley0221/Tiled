-- Tiled — data-layer helpers for the migrated app
-- Adds:
--   1. tile_feed view: tiles + author + like/comment counts + tag list
--   2. cast_poll_vote(tile_id, option_id): SECURITY DEFINER RPC so any
--      authenticated user can vote without needing UPDATE on tiles
--   3. Notification triggers: like / comment / save automatically
--      insert a row into notifications for the tile's author
--   4. Realtime publication on tiles + notifications

-- ──────────────────────────────────────────────────────────────────────────
-- tile_feed view
-- One row per tile, joined with author profile, with aggregated counts
-- and a tag array. Use this instead of selecting from tiles directly so
-- the client gets everything in one query.
-- ──────────────────────────────────────────────────────────────────────────
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
    p.role           as author_role,
    coalesce((select count(*)::int from public.likes    where tile_id = t.id), 0) as like_count,
    coalesce((select count(*)::int from public.comments where tile_id = t.id), 0) as comment_count,
    coalesce((select array_agg(tag)  from public.tile_tags where tile_id = t.id), array[]::text[]) as tags
  from public.tiles t
  join public.profiles p on p.id = t.author_id;

-- the view inherits RLS from its base tables (Postgres 15+), so no policies
-- needed here. The tiles_select policy already restricts visibility to
-- non-private tiles plus the user's own.

-- ──────────────────────────────────────────────────────────────────────────
-- cast_poll_vote: any authenticated user can vote on any visible poll
-- without owning the tile (the standard tile UPDATE policy would block them).
-- The function:
--   - Inserts into poll_votes (PK on tile_id+user_id prevents double-voting)
--   - Updates the JSON poll structure to increment that option's count
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.cast_poll_vote(p_tile_id uuid, p_option_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cur_poll jsonb;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to vote.';
  end if;

  -- record the vote (PK violation if already voted on this tile)
  insert into public.poll_votes (tile_id, user_id, option_id)
  values (p_tile_id, auth.uid(), p_option_id);

  -- bump the option's count inside the poll JSON
  select poll into cur_poll from public.tiles where id = p_tile_id;
  if cur_poll is null then
    raise exception 'Tile has no poll.';
  end if;

  update public.tiles
    set poll = jsonb_set(
      poll,
      '{options}',
      (
        select jsonb_agg(
          case
            when opt->>'id' = p_option_id
            then jsonb_set(opt, '{votes}', to_jsonb(coalesce((opt->>'votes')::int, 0) + 1))
            else opt
          end
        )
        from jsonb_array_elements(poll->'options') opt
      )
    )
    where id = p_tile_id;
end;
$$;
grant execute on function public.cast_poll_vote(uuid, text) to authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- Notification triggers
-- ──────────────────────────────────────────────────────────────────────────

-- like → notify author (skip self-likes)
create or replace function public.notify_on_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tile_author uuid;
begin
  select author_id into tile_author from public.tiles where id = new.tile_id;
  if tile_author is null or tile_author = new.user_id then
    return new;
  end if;
  insert into public.notifications (recipient_id, actor_id, kind, tile_id, body)
  values (tile_author, new.user_id, 'like', new.tile_id, 'liked your tile');
  return new;
end;
$$;
drop trigger if exists on_like_inserted on public.likes;
create trigger on_like_inserted
  after insert on public.likes
  for each row execute function public.notify_on_like();

-- save → notify author (skip self-saves)
create or replace function public.notify_on_save()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tile_author uuid;
begin
  select author_id into tile_author from public.tiles where id = new.tile_id;
  if tile_author is null or tile_author = new.user_id then
    return new;
  end if;
  insert into public.notifications (recipient_id, actor_id, kind, tile_id, body)
  values (tile_author, new.user_id, 'save', new.tile_id, 'saved your tile for later');
  return new;
end;
$$;
drop trigger if exists on_save_inserted on public.saves;
create trigger on_save_inserted
  after insert on public.saves
  for each row execute function public.notify_on_save();

-- comment → notify author (skip self-comments)
create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tile_author uuid;
begin
  select author_id into tile_author from public.tiles where id = new.tile_id;
  if tile_author is null or tile_author = new.author_id then
    return new;
  end if;
  insert into public.notifications (recipient_id, actor_id, kind, tile_id, body, preview)
  values (
    tile_author, new.author_id, 'comment', new.tile_id,
    'commented on your tile',
    case when length(new.body) > 100 then substring(new.body, 1, 99) || '…' else new.body end
  );
  return new;
end;
$$;
drop trigger if exists on_comment_inserted on public.comments;
create trigger on_comment_inserted
  after insert on public.comments
  for each row execute function public.notify_on_comment();

-- ──────────────────────────────────────────────────────────────────────────
-- Realtime: enable INSERT events for tiles and notifications so the next
-- migration step can subscribe (we'll wire the client up in step 3.5).
-- ──────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'tiles'
  ) then
    alter publication supabase_realtime add table public.tiles;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
