# Tiled — Supabase setup

This project uses [Supabase](https://supabase.com) for auth, database, storage,
and (later) realtime updates.

## One-time setup

1. **Run the schema migration**
   - Go to your Supabase dashboard → **SQL Editor** → **New query**
   - Copy the contents of `migrations/0001_init.sql`, paste, click **Run**
   - You should see "Success. No rows returned." for each block.

2. **Confirm Email auth is on**
   - Dashboard → **Authentication** → **Providers** → **Email** → enabled
   - For prototype testing, turn **Confirm email** OFF so you can sign up
     and immediately log in. (Turn it on for production.)

3. **Create the Owner / Admin accounts** (optional, for testing roles)
   - Sign up two accounts through the Tiled app:
     - `yohan@tiled.app` with username `yohan`
     - `asha@tiled.app`  with username `asha`
   - Then promote them via SQL Editor:
     ```sql
     update public.profiles set role = 'owner' where username = 'yohan';
     update public.profiles set role = 'admin' where username = 'asha';
     ```

## Schema at a glance

| Table          | Purpose                                              |
|----------------|------------------------------------------------------|
| `profiles`     | One row per `auth.users`, holds username/avatar/role |
| `tiles`        | Posts (photo/video/text/audio/live/link/poll/chart/grid) |
| `comments`     | Comments on tiles                                    |
| `tile_tags`    | Tag membership (many-to-many via composite key)      |
| `likes`        | Per-user heart                                       |
| `saves`        | Per-user bookmark                                    |
| `dismissals`   | Per-user "hide from my feed"                         |
| `poll_votes`   | One vote per user per poll tile                      |
| `notifications`| Inbox items                                          |

## RLS summary

- **Reads**: tiles, comments, tags, likes, poll_votes, profiles → public.
  Saves, dismissals, notifications → only the owning user.
- **Writes**: every table requires `user_id = auth.uid()` (or the equivalent),
  so a logged-in user can only modify their own rows.
- **Tags**: only the tile's author can add or remove tags from that tile.

## Re-running the migration

The migration is idempotent — `create table if not exists`, `drop policy if
exists` before each `create policy`, etc. — so you can re-run it after edits.

## Migrations index

- `0001_init.sql` — schema, triggers, RLS for the data layer
- `0002_admin.sql` — `is_admin()` / `is_owner()` helpers, role-change trigger
  guard, RLS letting Owner update any profile, RLS letting Admin/Owner delete
  any tile or comment
- `0003_fix_role_guard.sql` — fix the role-guard trigger so that a Postgres
  superuser running in the SQL Editor can bootstrap the first Owner. Within
  the API the rule still holds: only an Owner can change roles.
- `0004_data_layer.sql` — `tile_feed` view (joined query for the feed),
  `cast_poll_vote` RPC (lets non-authors vote), notification triggers
  (auto-insert on like/save/comment), and adds `tiles` + `notifications`
  to the realtime publication for the next migration step.

Run them in order. All migrations are idempotent.
