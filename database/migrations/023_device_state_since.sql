-- Keep the actual state transition time separate from the last packet update.
-- Existing rows stay unknown until their next transition; do not invent history.
ALTER TABLE device_status ADD COLUMN state_since_at timestamptz;
CREATE FUNCTION record_device_state_since() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.state_since_at := now();
  ELSIF NEW.state IS DISTINCT FROM OLD.state THEN
    NEW.state_since_at := now();
  ELSE
    NEW.state_since_at := OLD.state_since_at;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER device_state_since BEFORE INSERT OR UPDATE ON device_status
FOR EACH ROW EXECUTE FUNCTION record_device_state_since();
