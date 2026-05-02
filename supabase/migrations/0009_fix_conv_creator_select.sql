-- Tiled — fix conversation creation RLS race
--
-- After inserting a conversation, the client immediately tries to .select()
-- the row to get its id. The 0008 SELECT policy required membership, but the
-- creator hasn't been added to conversation_members yet — so the select
-- returns nothing and the client thinks the create failed.
--
-- Fix: allow the conversation row to be visible to its creator OR to any
-- member. Same fix applied to conversation_members so the followup member
-- insert can also be selected back.

drop policy if exists conversations_select_member on public.conversations;
create policy conversations_select_member on public.conversations for select
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.conversation_members
      where conversation_id = conversations.id and user_id = auth.uid()
    )
  );

drop policy if exists members_select_member on public.conversation_members;
create policy members_select_member on public.conversation_members for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.conversations
      where id = conversation_members.conversation_id and created_by = auth.uid()
    )
    or exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = conversation_members.conversation_id
        and cm.user_id = auth.uid()
    )
  );
