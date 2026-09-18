ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'CLIENT';

ALTER TABLE users ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS coins numeric(14,2) NOT NULL DEFAULT 0 CHECK (coins >= 0);

CREATE INDEX IF NOT EXISTS users_owner_id_idx ON users (owner_id);
CREATE INDEX IF NOT EXISTS users_owner_active_idx ON users (owner_id, active);
CREATE UNIQUE INDEX IF NOT EXISTS users_owner_username_unique
  ON users (COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(username))
  WHERE username IS NOT NULL;

