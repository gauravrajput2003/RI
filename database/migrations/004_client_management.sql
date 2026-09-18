ALTER TABLE users
  ADD COLUMN IF NOT EXISTS inactive_timeout_seconds integer NOT NULL DEFAULT 43200
  CHECK (inactive_timeout_seconds > 0);

CREATE INDEX IF NOT EXISTS users_role_active_idx ON users (role, active);

