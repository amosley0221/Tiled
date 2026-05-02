-- Tiled — conversations / group DMs, tile-format messages, tile media bucket
-- Run via SQL Editor → New query → paste → Run. Idempotent.
--
-- This migration is the largest one yet and reshapes a couple of tables.
-- Read top-to-bottom before running so you know what changes.

-- ──────────────────────────────────────────────────────────────────────────
-- Conversations + membership
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.conversations (
  id              uuid primary key default uuid_generate_v4(),
  type            text not null check (type in ('dm', 'group')),
  name            text,                       -- nullable for DMs
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz default now()
);
alter table public.conversations enable row level security;

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  joined_at       timestamptz not null default now(),
  last_read_at    timestamptz,
  primary key (conversation_id, user_id)
);
alter table public.conversation_members enable row level security;

create index if not exists conv_members_user_idx
  on public.conversation_members(user_id);
create index if not exists conv_last_message_idx
  on public.conversations(last_message_at desc);

-- ──────────────────────────────────────────────────────────────────────────
-- Migrate existing 1:1 messages: backfill conversations and members, then
-- repoint the messages.conversation_id column. Pre-migration messages have
-- (sender_id, recipient_id, body) only. Drop recipient_id afterwards.
-- ──────────────────────────────────────────────────────────────────────────
alter table public.messages
  add column if not exists conversation_id uuid references public.conversations(id) on delete cascade;

do $$
declare
  pair record;
  conv_id uuid;
begin
  -- only run if there are any messages without a conversation_id
  if exists (select 1 from public.messages where conversation_id is null and recipient_id is not null) then
    for pair in (
      select least(sender_id, recipient_id) as a, greatest(sender_id, recipient_id) as b
      from public.messages
      where conversation_id is null
      group by 1, 2
    ) loop
      insert into public.conversations (type, created_by) values ('dm', pair.a) returning id into conv_id;
      insert into public.conversation_members (conversation_id, user_id) values
        (conv_id, pair.a), (conv_id, pair.b);
      update public.messages
        set conversation_id = conv_id
        where conversation_id is null
          and ((sender_id = pair.a and recipient_id = pair.b)
            or (sender_id = pair.b and recipient_id = pair.a));
    end loop;
  end if;
end $$;

-- ──────────────────────────────────────────────────────────────────────────
-- Tile-format columns on messages so DMs can carry photo/video/etc.
-- ──────────────────────────────────────────────────────────────────────────
alter table public.messages
  add column if not exists kind text default 'text'
    check (kind in ('text','photo','video','audio','live','link','poll','chart','grid'));
alter table public.messages add column if not exists caption text;
alter table public.messages add column if not exists media   jsonb;
alter table public.messages add column if not exists link    jsonb;
alter table public.messages add column if not exists poll    jsonb;
alter table public.messages add column if not exists chart   jsonb;
alter table public.messages add column if not exists grid    jsonb;

-- relax the body length check (some tile kinds don't need a body)
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages drop constraint if exists messages_body_check1;
alter table public.messages add constraint messages_body_len_check
  check (body is null or length(body) <= 5000);
alter table public.messages alter column body drop not null;

-- conversation_id is required from here on
alter table public.messages alter column conversation_id set not null;

-- recipient_id is now redundant (membership lives on conversation_members)
alter table public.messages drop column if exists recipient_id;

-- ──────────────────────────────────────────────────────────────────────────
-- RLS: rewrite messages policies based on membership
-- ──────────────────────────────────────────────────────────────────────────
drop policy if exists messages_select_own       on public.messages;
drop policy if exists messages_insert_own       on public.messages;
drop policy if exists messages_update_recipient on public.messages;
drop policy if exists messages_delete_own       on public.messages;

create policy messages_select_member on public.messages for select
  using (exists (
    select 1 from public.conversation_members
    where conversation_id = messages.conversation_id and user_id = auth.uid()
  ));

create policy messages_insert_member on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversation_members
      where conversation_id = messages.conversation_id and user_id = auth.uid()
    )
  );

create policy messages_update_member on public.messages for update
  using (exists (
    select 1 from public.conversation_members
    where conversation_id = messages.conversation_id and user_id = auth.uid()
  ));

create policy messages_delete_own on public.messages for delete
  using (sender_id = auth.uid());

-- conversations RLS: members can read; anyone can create; members can update
drop policy if exists conversations_select_member on public.conversations;
create policy conversations_select_member on public.conversations for select
  using (exists (
    select 1 from public.conversation_members
    where conversation_id = conversations.id and user_id = auth.uid()
  ));

drop policy if exists conversations_insert_authed on public.conversations;
create policy conversations_insert_authed on public.conversations for insert
  with check (auth.uid() is not null and created_by = auth.uid());

drop policy if exists conversations_update_member on public.conversations;
create policy conversations_update_member on public.conversations for update
  using (exists (
    select 1 from public.conversation_members
    where conversation_id = conversations.id and user_id = auth.uid()
  ));

-- conversation_members RLS:
--   * read if you're a member of that conversation
--   * the creator can add anyone; users can add themselves
--   * users can remove themselves
drop policy if exists members_select_member  on public.conversation_members;
create policy members_select_member on public.conversation_members for select
  using (exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conversation_members.conversation_id and cm.user_id = auth.uid()
  ));

drop policy if exists members_insert_creator on public.conversation_members;
create policy members_insert_creator on public.conversation_members for insert
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.conversations
      where id = conversation_id and created_by = auth.uid()
    )
  );

drop policy if exists members_delete_self on public.conversation_members;
create policy members_delete_self on public.conversation_members for delete
  using (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────────────────
-- Helper RPC: mark conversation as read up to now (drives unread badges
-- and read-receipt 'seen' indicators on the sender side)
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.conversation_members
    set last_read_at = now()
    where conversation_id = p_conversation_id and user_id = auth.uid();
$$;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- Trigger: bump conversations.last_message_at when a new message lands
create or replace function public.update_conversation_last_message()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  update public.conversations
    set last_message_at = new.created_at
    where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists on_message_insert_update_conv on public.messages;
create trigger on_message_insert_update_conv
  after insert on public.messages
  for each row execute function public.update_conversation_last_message();

-- ──────────────────────────────────────────────────────────────────────────
-- Realtime: add the new tables
-- ──────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'conversation_members'
  ) then
    alter publication supabase_realtime add table public.conversation_members;
  end if;
end $$;

-- ──────────────────────────────────────────────────────────────────────────
-- tile-media bucket — for photos / videos / audio attached to tiles or DMs
-- ──────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('tile-media', 'tile-media', true)
on conflict (id) do nothing;

drop policy if exists "Tile media public read" on storage.objects;
create policy "Tile media public read" on storage.objects
  for select using (bucket_id = 'tile-media');

drop policy if exists "Tile media upload by owner" on storage.objects;
create policy "Tile media upload by owner" on storage.objects
  for insert with check (
    bucket_id = 'tile-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Tile media update by owner" on storage.objects;
create policy "Tile media update by owner" on storage.objects
  for update using (
    bucket_id = 'tile-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Tile media delete by owner" on storage.objects;
create policy "Tile media delete by owner" on storage.objects
  for delete using (
    bucket_id = 'tile-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
