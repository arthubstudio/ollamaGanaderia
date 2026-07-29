BEGIN;

CREATE TABLE IF NOT EXISTS security_rate_limits (
    key_hash VARCHAR(160) PRIMARY KEY,
    request_count INTEGER NOT NULL DEFAULT 0,
    window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS security_rate_limits_expires_idx
ON security_rate_limits (expires_at);

COMMIT;
