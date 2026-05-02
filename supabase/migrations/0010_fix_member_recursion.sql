-- Tiled — fix infinite recursion in conversation_members SELECT policy
--
-- 0009 added an OR clause to conversation_members.members_select_member that
-- queries conversation_members from inside its own SELECT policy. Postgres
-- detects the self-reference and throws
--   "infinite recursion detected in policy for relation conversation_members"
-- on every query that touches conversation_members directly OR indirectly
-- (conversations and messages both reference it from their own policies).
-- That makes the entire DM feature unreadable.
--
-- Fix: route the "am I a member of this conversation?" check through a
-- SECURITY DEFINER function. The function runs with owner privileges and
-- bypasses RLS, so referencing it from a policy doesn't re-enter RLS on
-- conversation_members.

create or replace function public.is_conversation_member(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation_id and user_id = p_user_id
  );
$$;
revoke all on function public.is_conversation_member(uuid, uuid) from public;
grant execute on function public.is_conversation_member(uuid, uuid) to authenticated;

-- conversation_members: drop the recursive clause, use the helper instead.
drop policy if exists members_select_member on public.conversation_members;
create policy members_select_member on public.conversation_members for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.conversations
      where id = conversation_members.conversation_id and created_by = auth.uid()
    )
    or public.is_conversation_member(conversation_members.conversation_id, auth.uid())
  );

-- conversations: same — the previous existence check on conversation_members
-- triggered the recursive policy transitively.
drop policy if exists conversations_select_member on public.conversations;
create policy conversations_select_member on public.conversations for select
  using (
    created_by = auth.uid()
    or public.is_conversation_member(conversations.id, auth.uid())
  );

drop policy if exists conversations_update_member on public.conversations;
create policy conversations_update_member on public.conversations for update
  using (public.is_conversation_member(conversations.id, auth.uid()));

-- messages: route membership checks through the helper too.
drop policy if exists messages_select_member on public.messages;
create policy messages_select_member on public.messages for select
  using (public.is_conversation_member(messages.conversation_id, auth.uid()));

drop policy if exists messages_insert_member on public.messages;
create policy messages_insert_member on public.messages for insert
  with check (
    sender_id = auth.uid()
    and public.is_conversation_member(messages.conversation_id, auth.uid())
  );

drop policy if exists messages_update_member on public.messages;
create policy messages_update_member on public.messages for update
  using (public.is_conversation_member(messages.conversation_id, auth.uid()));
