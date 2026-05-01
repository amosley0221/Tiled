-- Tiled — demo data seed (idempotent, re-runnable)
--
-- Creates 6 demo accounts under @tiled.demo plus a small set of tiles,
-- comments, and tags so a freshly-cloned project doesn't open to an empty
-- feed. Demo profiles are tagged with bio prefix '[demo]' so they're easy
-- to identify and remove.
--
-- Run AFTER the four migration files in supabase/migrations/.
-- Run via Supabase SQL Editor → New query → paste this whole file → Run.
--
-- Re-running deletes any existing demo tiles/comments and recreates them,
-- so you'll always end up in a clean known state. Demo auth.users are
-- preserved across re-runs (their UUIDs are stable so existing sessions
-- still work).
--
-- To remove the demo data entirely: run supabase/seed/99_remove_demo_data.sql

-- ──────────────────────────────────────────────────────────────────────────
-- Helper: idempotently create a demo user + auth.users row.
-- profile is auto-created by the handle_new_user trigger; we then update
-- name / avatar / bio so it shows up correctly.
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.create_demo_user(
  p_email    text,
  p_username text,
  p_name     text,
  p_avatar   text,
  p_bio      text
) returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  user_uuid uuid;
begin
  -- already exists? just refresh the profile fields and return
  select id into user_uuid from auth.users where email = p_email;
  if user_uuid is not null then
    update public.profiles
      set bio    = '[demo] ' || p_bio,
          name   = p_name,
          avatar = p_avatar
      where id = user_uuid;
    return user_uuid;
  end if;

  user_uuid := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token,
    email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000',
    user_uuid,
    'authenticated', 'authenticated',
    p_email,
    extensions.crypt('TiledDemo!2026' || p_username, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('username', p_username),
    now(), now(),
    '', '', '', ''
  );

  -- profile row exists thanks to handle_new_user trigger; tag it as demo
  update public.profiles
    set bio    = '[demo] ' || p_bio,
        name   = p_name,
        avatar = p_avatar
    where id = user_uuid;

  return user_uuid;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- Wipe any prior demo content (but keep demo profiles + auth users).
-- Cascades take care of comments, likes, saves, dismissals, tags, votes.
-- ──────────────────────────────────────────────────────────────────────────
delete from public.tiles
  where author_id in (select id from public.profiles where bio like '[demo]%');

-- ──────────────────────────────────────────────────────────────────────────
-- Demo profiles + tiles
-- ──────────────────────────────────────────────────────────────────────────
do $$
declare
  mira       uuid := public.create_demo_user('mira@tiled.demo',       'mira',       'Mira Okafor',     'MO', 'Designer + photographer.');
  noah       uuid := public.create_demo_user('noah@tiled.demo',       'noah',       'Noah Reyes',      'NR', 'Sound designer, modular synths.');
  tessa      uuid := public.create_demo_user('tessa@tiled.demo',      'tessa',      'Tessa Whitfield', 'TW', 'Writer · long-form essays on attention.');
  devon      uuid := public.create_demo_user('devon@tiled.demo',      'devon',      'Devon Yu',        'DY', 'Musician shipping a record this fall.');
  rune       uuid := public.create_demo_user('rune@tiled.demo',       'rune',       'Rune Halvorsen',  'RH', 'Builder of tools, sometimes loud.');
  metrics    uuid := public.create_demo_user('metrics@tiled.demo',    'metrics',    'Metrics',         'MX', 'Data tiles for the Pro feed.');

  t1 uuid := gen_random_uuid();
  t2 uuid := gen_random_uuid();
  t3 uuid := gen_random_uuid();
  t4 uuid := gen_random_uuid();
  t5 uuid := gen_random_uuid();
  t6 uuid := gen_random_uuid();
  t7 uuid := gen_random_uuid();
  t8 uuid := gen_random_uuid();
  t9 uuid := gen_random_uuid();
  t10 uuid := gen_random_uuid();
begin
  -- ── tiles ────────────────────────────────────────────────────────────
  insert into public.tiles (id, author_id, kind, mode, body, caption, media, link, poll, chart, grid, created_at) values
    (t1, mira,    'photo', 'social', null, 'fog rolling off the bay this morning. shutter wide open.',
     '{"tone":220,"label":"long exposure · 30s"}'::jsonb, null, null, null, null, now() - interval '12 minutes'),

    (t2, noah,    'video', 'social', null, 'first run of the new sequencer patch',
     '{"tone":12,"label":"video · 0:42","duration":"0:42"}'::jsonb, null, null, null, null, now() - interval '34 minutes'),

    (t3, tessa,   'text',  'social',
     'Shipping is a feature. The longer you sit on something the more it owns you, not the other way around.',
     null, null, null, null, null, null, now() - interval '1 hour'),

    (t4, devon,   'audio', 'social', null, 'voice memo — chord progression for the bridge',
     ('{"duration":"1:12","waveform":[0.3,0.5,0.7,0.4,0.8,0.6,0.9,0.7,0.5,0.8,0.6,0.4,'
      || '0.7,0.9,0.5,0.6,0.8,0.4,0.7,0.5,0.6,0.8,0.7,0.4,0.6,0.5,0.7,0.4,0.3,0.5,0.6,'
      || '0.4,0.7,0.5,0.3,0.4]}')::jsonb,
     null, null, null, null, now() - interval '2 hours'),

    (t5, rune,    'text',  'social',
     'late-night thought: every tool you use is also using you. choose carefully.',
     null, null, null, null, null, null, now() - interval '6 hours'),

    (t6, tessa,   'link',  'pro',
     'A piece on the economics of attention I keep coming back to.',
     null, null,
     '{"domain":"longform.org","title":"The Compounding Cost of Distraction","excerpt":"How the cheapest minute of your day became the most expensive one."}'::jsonb,
     null, null, null, now() - interval '3 hours'),

    (t7, devon,   'poll',  'social', 'choosing a name for the new record', null, null, null,
     '{"options":[{"id":"a","label":"Slow Light","votes":142},{"id":"b","label":"Half-Tide","votes":87},{"id":"c","label":"After-Image","votes":213}],"voted":null}'::jsonb,
     null, null, now() - interval '4 hours'),

    (t8, mira,    'photo', 'pro',  null, 'concept boards for the Q3 campaign · final round',
     '{"tone":40,"label":"case study · 6 frames"}'::jsonb, null, null, null, null, now() - interval '5 hours'),

    (t9, metrics, 'chart', 'pro',  null, 'Q3 weekly active users — up 24% over the quarter',
     null, null, null,
     '{"label":"WAU · last 8 weeks","unit":"thousands","data":[{"label":"W1","value":42},{"label":"W2","value":51},{"label":"W3","value":58},{"label":"W4","value":54},{"label":"W5","value":67},{"label":"W6","value":74},{"label":"W7","value":81},{"label":"W8","value":92}]}'::jsonb,
     null, now() - interval '40 minutes'),

    (t10, metrics, 'grid', 'pro', null, 'shipping queue · this week',
     null, null, null, null,
     '{"columns":["Project","Owner","Status","ETA"],"rows":[["Tiled v2","@yohan",{"label":"In review","tone":"warn"},"Fri"],["Pro charts","@asha",{"label":"Shipped","tone":"good"},"—"],["Mobile shell","@noor",{"label":"In progress","tone":"info"},"Mon"],["Onboarding","@mira",{"label":"Blocked","tone":"bad"},"TBD"]]}'::jsonb,
     now() - interval '2 hours');

  -- ── tags ─────────────────────────────────────────────────────────────
  insert into public.tile_tags (tile_id, tag) values
    (t1, 'photography'), (t1, 'sf-bay'),
    (t2, 'music'), (t2, 'production'),
    (t3, 'startups'), (t3, 'product'),
    (t4, 'music'),
    (t5, 'philosophy'),
    (t6, 'reading'), (t6, 'attention'),
    (t7, 'music'),
    (t8, 'design'), (t8, 'case-study'),
    (t9, 'analytics'), (t9, 'growth'),
    (t10, 'ops'), (t10, 'roadmap');

  -- ── comments ─────────────────────────────────────────────────────────
  insert into public.comments (tile_id, author_id, body, created_at) values
    (t1, noah,  'this is unreal. what lens?',           now() - interval '8 minutes'),
    (t1, mira,  '50mm 1.4. the fog did the work.',      now() - interval '6 minutes'),
    (t1, rune,  'cinematic.',                            now() - interval '3 minutes'),
    (t2, devon, 'the second drop is filthy 🎛️',         now() - interval '20 minutes'),
    (t3, tessa, 'needed this today.',                   now() - interval '50 minutes'),
    (t3, devon, 'pinning this.',                         now() - interval '40 minutes'),
    (t7, mira,  'after-image, no question.',            now() - interval '3 hours');
end $$;
