BEGIN;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS security_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

UPDATE usuarios
SET security_locked_at = COALESCE(security_locked_at, NOW()),
    rol = 'usuario'
WHERE LOWER(email) IN ('hugo@ganaderia.com', 'pedro@gmail.com');

UPDATE auth_sessions s
SET revoked_at = COALESCE(s.revoked_at, NOW())
WHERE s.user_id IN (
  SELECT id
  FROM usuarios
  WHERE security_locked_at IS NOT NULL
);

COMMIT;
