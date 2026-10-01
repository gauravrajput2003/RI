-- Abort on invalid existing ownership; never silently reparent accounts.
ALTER TABLE users ADD CONSTRAINT users_owner_required CHECK (
  (role='SUPER_ADMIN' AND owner_id IS NULL) OR (role<>'SUPER_ADMIN' AND owner_id IS NOT NULL)
);
CREATE UNIQUE INDEX users_single_super_admin ON users ((role)) WHERE role='SUPER_ADMIN';

CREATE FUNCTION enforce_user_ownership() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role='SUPER_ADMIN' THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.owner_id AND role IN ('SUPER_ADMIN','ADMIN')) THEN
    RAISE EXCEPTION 'Account owner must be an admin or super-admin' USING ERRCODE='23514';
  END IF;
  IF EXISTS (WITH RECURSIVE ancestors AS (
    SELECT id,owner_id FROM users WHERE id=NEW.owner_id
    UNION SELECT u.id,u.owner_id FROM users u JOIN ancestors a ON u.id=a.owner_id
  ) SELECT 1 FROM ancestors WHERE id=NEW.id) THEN
    RAISE EXCEPTION 'Account ownership cannot contain cycles' USING ERRCODE='23514';
  END IF;
  IF EXISTS (SELECT 1 FROM users WHERE owner_id=NEW.id) AND NEW.role NOT IN ('SUPER_ADMIN','ADMIN') THEN
    RAISE EXCEPTION 'An account with children must remain an admin' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER users_validate_ownership BEFORE INSERT OR UPDATE OF owner_id,role ON users
  FOR EACH ROW EXECUTE FUNCTION enforce_user_ownership();

DO $$ BEGIN
  IF EXISTS (WITH RECURSIVE rooted AS (
    SELECT id FROM users WHERE role='SUPER_ADMIN'
    UNION SELECT u.id FROM users u JOIN rooted r ON u.owner_id=r.id
  ) SELECT 1 FROM users WHERE id NOT IN (SELECT id FROM rooted)) THEN
    RAISE EXCEPTION 'Existing accounts do not resolve to the root super-admin; repair ownership before migrating';
  END IF;
  IF EXISTS (SELECT 1 FROM users child JOIN users parent ON parent.id=child.owner_id
    WHERE parent.role NOT IN ('SUPER_ADMIN','ADMIN')) THEN
    RAISE EXCEPTION 'Existing account owner is not an admin';
  END IF;
END $$;
