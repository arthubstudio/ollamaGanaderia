\set ON_ERROR_STOP on

DO $$
BEGIN
  IF current_database() <> 'ganaderia_ai_security_test' THEN
    RAISE EXCEPTION 'Refusing to reset unexpected database: %', current_database();
  END IF;
END $$;

TRUNCATE TABLE
  security_rate_limits,
  activity_audit_logs,
  notification_reads,
  notifications,
  community_messages,
  community_conversation_members,
  community_conversations,
  friendships,
  friend_requests,
  bovino_transfer_events,
  bovino_transfers,
  rancho_duenos,
  bovino_duenos,
  stress_seed_batches,
  ai_logs,
  conversation_messages,
  conversations,
  memories,
  semantic_contexts,
  ventas,
  enfermedades,
  pesos,
  vacuna_aplicada,
  historial_propiedad,
  bovino_arete_sequences,
  bovinos,
  ranchos,
  duenos,
  vacunas,
  usuarios
RESTART IDENTITY CASCADE;
