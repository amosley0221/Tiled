-- Tiled — direct messages between users
-- Run via SQL Editor → New query → paste → Run. Idempotent.
--
-- Adds:
--   1. public.messages       — text DMs (kind/media columns can be added later)
--   2. RLS                   — both ends of a conversation can read; only
--                              senders can insert; only recipients can flip
--                              read_at; either side can delete from their copy
--   3. realtime publication  — so new messages appear without polling

create extension if not exists "uuid-ossp";

create table if not exists public.messages (
  id            uuid primary key default uuid_generate_v4(),
  sender_id     uuid not null references public.profiles(id) on delete cascade,
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  body          text not null,
  created_at    timestamptz not null default now(),
  read_at       timestamptz,
  check (sender_id <> recipient_id),
  check (length(body) between 1 and 1000)
);
alter table public.messages enable row level security;

drop policy if exists messages_select_own on public.messages;
create policy messages_select_own on public.messages for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists messages_insert_own on public.messages;
create policy messages_insert_own on public.messages for insert
  with check (sender_id = auth.uid());

drop policy if exists messages_update_recipient on public.messages;
create policy messages_update_recipient on public.messages for update
  using (recipient_id = auth.uid());

drop policy if exists messages_delete_own on public.messages;
create policy messages_delete_own on public.messages for delete
  using (sender_id = auth.uid() or recipient_id = auth.uid());

create index if not exists messages_pair_idx       on public.messages(sender_id, recipient_id, created_at desc);
create index if not exists messages_recipient_idx  on public.messages(recipient_id, read_at);
create index if not exists messages_created_at_idx on public.messages(created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
