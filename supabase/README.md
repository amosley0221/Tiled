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
