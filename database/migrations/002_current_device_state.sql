ALTER TABLE devices ADD COLUMN IF NOT EXISTS identity_type varchar(32) NOT NULL DEFAULT 'IMEI';
ALTER TABLE devices ADD COLUMN IF NOT EXISTS identity_value varchar(128);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS manufacturer text;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_location_at timestamptz;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz;

UPDATE devices SET identity_value = imei WHERE identity_value IS NULL;

ALTER TABLE devices ALTER COLUMN identity_value SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS devices_identity_unique ON devices (identity_type, identity_value);

ALTER TABLE device_status ADD COLUMN IF NOT EXISTS current_position geography(Point, 4326);
ALTER TABLE device_status ADD COLUMN IF NOT EXISTS current_speed real;
ALTER TABLE device_status ADD COLUMN IF NOT EXISTS current_ignition boolean;
ALTER TABLE device_status ADD COLUMN IF NOT EXISTS current_gps_valid boolean;
ALTER TABLE device_status ADD COLUMN IF NOT EXISTS current_satellites smallint;
ALTER TABLE device_status ADD COLUMN IF NOT EXISTS current_battery_percent real;
ALTER TABLE device_status ADD COLUMN IF NOT EXISTS current_gsm_signal smallint;
