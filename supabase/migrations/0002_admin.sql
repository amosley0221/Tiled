-- Tiled — admin & owner support
-- Run in Supabase SQL Editor (New query → paste → Run). Idempotent.
--
-- Adds:
--   1. is_admin() / is_owner() helper functions for RLS use
--   2. A trigger that prevents users from changing their own role
--      (only an owner can promote/demote anyone)
--   3. RLS policy letting owners update any profile (so the Admin panel
--      can change roles via the API instead of going to SQL Editor)
--   4. Hooks for admins/owners to delete any tile or comment

-- ──────────────────────────────────────────────────────────────────────────
-- helpers
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.is_owner()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  )
$$;
grant execute on function public.is_owner() to anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','owner')
  )
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- role guard — only an owner can change the role column.
-- The user's own UPDATE policy still lets them change name/avatar/bio.
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.profile_role_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_owner() then
    raise exception 'Only the owner can change roles.';
  end if;
  return new;
end;
$$;

drop trigger if exists profile_role_guard_trg on public.profiles;
create trigger profile_role_guard_trg
  before update on public.profiles
  for each row execute function public.profile_role_guard();

-- ──────────────────────────────────────────────────────────────────────────
-- profiles: owner can update any profile (used to change roles).
-- Existing "update own" policy is kept so users can still edit their bio/avatar.
-- ──────────────────────────────────────────────────────────────────────────
drop policy if exists profiles_update_by_owner on public.profiles;
create policy profiles_update_by_owner on public.profiles for update
  using (public.is_owner()) with check (public.is_owner());

-- ──────────────────────────────────────────────────────────────────────────
-- tiles: admins/owner can delete any tile (moderation).
-- ──────────────────────────────────────────────────────────────────────────
drop policy if exists tiles_delete_by_admin on public.tiles;
create policy tiles_delete_by_admin on public.tiles for delete
  using (public.is_admin());

-- ──────────────────────────────────────────────────────────────────────────
-- comments: admins/owner can delete any comment.
-- ──────────────────────────────────────────────────────────────────────────
drop policy if exists comments_delete_by_admin on public.comments;
create policy comments_delete_by_admin on public.comments for delete
  using (public.is_admin());

-- ──────────────────────────────────────────────────────────────────────────
-- Convenience view: profile counts per role.
-- ──────────────────────────────────────────────────────────────────────────
create or replace view public.role_counts as
  select role, count(*)::int as count
  from public.profiles
  group by role;
