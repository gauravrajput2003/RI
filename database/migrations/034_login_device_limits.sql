ALTER TABLE users ADD COLUMN max_login_devices integer NOT NULL DEFAULT 2 CHECK(max_login_devices BETWEEN 1 AND 100);
ALTER TABLE refresh_tokens ADD COLUMN session_id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE refresh_tokens ADD COLUMN device_id text;
CREATE INDEX refresh_tokens_sessions ON refresh_tokens(user_id,session_id) WHERE revoked_at IS NULL;
-- Lowering a limit keeps the most recently created sessions and revokes excess slots.
CREATE FUNCTION enforce_login_device_reduction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.max_login_devices < OLD.max_login_devices AND NEW.role='CLIENT' THEN
 UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=NEW.id AND revoked_at IS NULL AND session_id IN (
 SELECT session_id FROM refresh_tokens WHERE user_id=NEW.id AND revoked_at IS NULL AND expires_at>now()
 GROUP BY session_id ORDER BY max(created_at) DESC,session_id OFFSET NEW.max_login_devices);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER users_login_device_reduction AFTER UPDATE OF max_login_devices ON users FOR EACH ROW EXECUTE FUNCTION enforce_login_device_reduction();
