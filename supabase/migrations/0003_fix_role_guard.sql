-- Tiled — fix the role-change trigger to allow bootstrapping.
--
-- The 0002 trigger blocked any role change unless public.is_owner() returned
-- true. But in the SQL Editor (or any admin tool) auth.uid() is NULL, so
-- is_owner() is false, so even the first 'set role = owner' statement was
-- rejected — leaving no way to create the very first owner.
--
-- This version: allow the change when there's no authenticated user
-- (running as the Postgres role in SQL Editor, server-side admin scripts,
-- etc.). Within the API, auth.uid() is always set, so the rule "only the
-- Owner can change roles" still holds for normal app traffic.

create or replace function public.profile_role_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- not actually changing the role → allow
  if new.role is not distinct from old.role then
    return new;
  end if;
  -- running as the Postgres superuser (SQL Editor, migration scripts) → allow
  if auth.uid() is null then
    return new;
  end if;
  -- authenticated request → must be the Owner
  if not public.is_owner() then
    raise exception 'Only the owner can change roles.';
  end if;
  return new;
end;
$$;
