-- Tiled — remove demo data
--
-- Run via Supabase SQL Editor → New query → paste → Run.
-- This deletes:
--   - All auth.users with @tiled.demo emails (cascades to profiles, tiles,
--     comments, likes, saves, dismissals, poll_votes, notifications via
--     the schema's ON DELETE CASCADE foreign keys)
--   - The create_demo_user helper function
--
-- Real user accounts and the migrations themselves are NOT touched.

delete from auth.users where email like '%@tiled.demo';

drop function if exists public.create_demo_user(text, text, text, text, text);

-- belt-and-suspenders: any orphaned profiles still tagged [demo] (shouldn't
-- happen because of the CASCADE, but covers the case where someone created
-- a profile manually with that bio)
delete from public.profiles where bio like '[demo]%';
