-- Tiled — shared tiles in DMs
--
-- Lets a DM message carry a "this was shared from another tile" attribution
-- block. We keep the message's existing kind/body/caption/media/link so the
-- recipient sees the same tile content; the new column just adds the
-- author header that the UI renders above the bubble.
--
-- shared shape: { tile_id: uuid, author: { id, handle, name, avatar, avatar_url }, kind: text }

alter table public.messages add column if not exists shared jsonb;
