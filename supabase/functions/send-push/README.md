# send-push (Web Push fan-out)

Edge Function that sends Web Push notifications to a user's registered
devices. Called by the `dispatch_push` SQL function (see
`supabase/migrations/0012_push_subscriptions.sql`) on inserts to
`notifications` and `messages`.

## One-time setup

1. **Generate a VAPID keypair**

   ```sh
   npx web-push generate-vapid-keys
   ```

   You'll get a `Public Key` and a `Private Key` (URL-safe base64).

2. **Wire the public key into the client**

   In `Tiled.html`, replace `__REPLACE_WITH_VAPID_PUBLIC_KEY__` with the
   public key value. Commit and redeploy the static site.

3. **Set Edge Function secrets**

   ```sh
   supabase secrets set VAPID_PUBLIC_KEY=...
   supabase secrets set VAPID_PRIVATE_KEY=...
   supabase secrets set VAPID_SUBJECT=mailto:you@example.com
   ```

4. **Deploy the function**

   ```sh
   supabase functions deploy send-push
   ```

5. **Run migration `0012_push_subscriptions.sql`** in the SQL editor.
   This creates the `push_subscriptions` table, the `dispatch_push`
   helper, and triggers on `notifications` / `messages`.

6. **Configure database GUCs** so `dispatch_push` knows where the
   function lives and which key to call it with. Run once in SQL
   editor (replace with your project URL and service role key from
   Project Settings → API):

   ```sql
   alter database postgres set "app.settings.send_push_url" = 'https://YOUR-REF.supabase.co/functions/v1/send-push';
   alter database postgres set "app.settings.service_role_key" = 'YOUR-SERVICE-ROLE-KEY';
   ```

   These reload on the next connection. Reconnect any pgbouncer/admin
   sessions if needed.

## Testing

Open the deployed site, sign in, **install to home screen** (iOS) or
**Install app** (Android), open from the home-screen icon, then go to
Edit profile → Push notifications → Enable. Trigger a notification
(for example, have another account follow you or send you a DM) and
the device should buzz.

## Notes

- iOS requires the app to be installed to the home screen. Web push
  does not work in a regular Safari tab.
- Android Chrome works in both regular tabs and installed PWAs.
- Subscriptions that return HTTP 404 / 410 (Gone) get cleaned up on
  the next send attempt.
