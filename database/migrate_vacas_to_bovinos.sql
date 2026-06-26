-- Migración: vacas -> bovinos (ejecutar una sola vez en bases existentes)
-- Nota: ejecutar sin transacción global para evitar rollback parcial.

ALTER TABLE IF EXISTS vacas RENAME TO bovinos;
ALTER INDEX IF EXISTS vacas_usuario_id_idx RENAME TO bovinos_usuario_id_idx;

ALTER TABLE IF EXISTS historial_propiedad RENAME COLUMN vaca_id TO bovino_id;
ALTER INDEX IF EXISTS historial_propiedad_vaca_id_idx RENAME TO historial_propiedad_bovino_id_idx;

ALTER TABLE IF EXISTS vacuna_aplicada RENAME COLUMN vaca_id TO bovino_id;
ALTER INDEX IF EXISTS vacuna_aplicada_vaca_id_idx RENAME TO vacuna_aplicada_bovino_id_idx;

ALTER TABLE IF EXISTS pesos RENAME COLUMN vaca_id TO bovino_id;
ALTER INDEX IF EXISTS pesos_vaca_id_idx RENAME TO pesos_bovino_id_idx;

ALTER TABLE IF EXISTS enfermedades RENAME COLUMN vaca_id TO bovino_id;
ALTER INDEX IF EXISTS enfermedades_vaca_id_idx RENAME TO enfermedades_bovino_id_idx;

ALTER TABLE IF EXISTS ventas RENAME COLUMN vaca_id TO bovino_id;
ALTER INDEX IF EXISTS ventas_vaca_id_idx RENAME TO ventas_bovino_id_idx;

ALTER TABLE IF EXISTS semantic_contexts RENAME COLUMN vaca_id TO bovino_id;
ALTER INDEX IF EXISTS semantic_contexts_vaca_id_idx RENAME TO semantic_contexts_bovino_id_idx;
