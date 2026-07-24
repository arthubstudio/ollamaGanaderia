BEGIN;

ALTER TABLE community_messages
  ADD COLUMN IF NOT EXISTS client_message_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS community_messages_sender_client_id_idx
ON community_messages (sender_user_id, client_message_id)
WHERE client_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS community_messages_pending_delivery_idx
ON community_messages (conversation_id, id)
WHERE delivered_at IS NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS community_messages_pending_read_idx
ON community_messages (conversation_id, id)
WHERE read_at IS NULL AND deleted_at IS NULL;

COMMIT;
