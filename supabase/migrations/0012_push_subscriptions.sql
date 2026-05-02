-- Tiled — push subscriptions for Web Push (PWA notifications)
--
-- One row per (user, endpoint). Endpoints differ across devices, so a
-- single user can have many subscriptions (phone, tablet, etc.).

create table if not exists public.push_subscriptions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  unique (user_id, endpoint)
);
alter table public.push_subscriptions enable row level security;

create index if not exists push_subs_user_idx on public.push_subscriptions(user_id);

drop policy if exists push_subs_select_own on public.push_subscriptions;
create policy push_subs_select_own on public.push_subscriptions for select
  using (user_id = auth.uid());

drop policy if exists push_subs_insert_own on public.push_subscriptions;
create policy push_subs_insert_own on public.push_subscriptions for insert
  with check (user_id = auth.uid());

drop policy if exists push_subs_update_own on public.push_subscriptions;
create policy push_subs_update_own on public.push_subscriptions for update
  using (user_id = auth.uid());

drop policy if exists push_subs_delete_own on public.push_subscriptions;
create policy push_subs_delete_own on public.push_subscriptions for delete
  using (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────────────────
-- Trigger: when a notification or message lands, call the send-push Edge
-- Function. Requires the pg_net extension and the project URL + service
-- role key wired up via app.settings.* GUCs. See README in
-- supabase/functions/send-push/ for the exact deploy steps.
-- ──────────────────────────────────────────────────────────────────────────
create extension if not exists pg_net;

create or replace function public.dispatch_push(p_user_id uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fn_url text := current_setting('app.settings.send_push_url', true);
  svc_key text := current_setting('app.settings.service_role_key', true);
begin
  if fn_url is null or svc_key is null then return; end if;
  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body := jsonb_build_object('user_id', p_user_id) || p_payload
  );
end;
$$;

create or replace function public.on_notification_push()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.dispatch_push(
    new.recipient_id,
    jsonb_build_object(
      'title', 'Tiled',
      'body', coalesce(new.body, ''),
      'tag', 'notif:' || new.id::text,
      'url', '/'
    )
  );
  return new;
end;
$$;

drop trigger if exists on_notification_insert_push on public.notifications;
create trigger on_notification_insert_push
  after insert on public.notifications
  for each row execute function public.on_notification_push();

create or replace function public.on_message_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  recipient record;
  preview text;
begin
  preview := coalesce(
    case when new.kind = 'text' then new.body
         when new.kind = 'photo' then '📷 Photo'
         when new.kind = 'video' then '🎞️ Video'
         when new.kind = 'audio' then '🎙️ Audio'
         when new.kind = 'link' then '🔗 Link'
         else new.body end,
    ''
  );
  if new.link ? '_share' then preview := '↗ Shared a tile'; end if;

  for recipient in
    select user_id from public.conversation_members
    where conversation_id = new.conversation_id
      and user_id <> new.sender_id
  loop
    perform public.dispatch_push(
      recipient.user_id,
      jsonb_build_object(
        'title', 'New message',
        'body', preview,
        'tag', 'conv:' || new.conversation_id::text,
        'url', '/'
      )
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists on_message_insert_push on public.messages;
create trigger on_message_insert_push
  after insert on public.messages
  for each row execute function public.on_message_push();
