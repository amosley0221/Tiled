// supabase/functions/send-push/index.ts
//
// Web Push fan-out for Tiled. Receives { user_id, title, body, ... },
// looks up the user's push_subscriptions, and calls the Web Push
// protocol via the npm:web-push library (Deno supports npm: imports).
//
// Required env vars (set with `supabase secrets set ...`):
//   VAPID_PUBLIC_KEY    matches window.VAPID_PUBLIC_KEY in Tiled.html
//   VAPID_PRIVATE_KEY   keep this secret
//   VAPID_SUBJECT       a mailto: URL, e.g. mailto:you@example.com
//
// Generate a VAPID keypair locally with:
//   npx web-push generate-vapid-keys
//
// Deploy with:
//   supabase functions deploy send-push --no-verify-jwt
//
// The trigger in 0012_push_subscriptions.sql calls this function with
// the service role key, so leave --no-verify-jwt off if you want to
// restrict invocation to that key only. (See README in this folder.)

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:notifications@tiled.app';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response('bad json', { status: 400 });
  }

  const userId = payload.user_id as string | undefined;
  if (!userId) return new Response('user_id required', { status: 400 });

  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (error) {
    console.error('lookup failed', error);
    return new Response('lookup failed', { status: 500 });
  }
  if (!subs || subs.length === 0) return new Response('no subs', { status: 200 });

  const body = JSON.stringify({
    title: payload.title || 'Tiled',
    body: payload.body || '',
    tag: payload.tag,
    url: payload.url || '/',
  });

  const results = await Promise.allSettled(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
      );
    } catch (err: any) {
      // 404 / 410 mean the subscription is dead — clean it up.
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await admin.from('push_subscriptions')
          .delete()
          .match({ endpoint: s.endpoint });
      } else {
        throw err;
      }
    }
  }));

  const failed = results.filter((r) => r.status === 'rejected').length;
  return new Response(JSON.stringify({ sent: subs.length - failed, failed }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
