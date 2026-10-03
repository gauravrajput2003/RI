ALTER TABLE users ADD COLUMN password_recovery_ciphertext text;

CREATE TABLE password_access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('REVEAL','RESET')),
  created_at timestamptz NOT NULL DEFAULT now()
);
