ALTER TABLE sessions_auth ADD COLUMN expires_at INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_sessions_auth_expires_at
  ON sessions_auth (expires_at);
