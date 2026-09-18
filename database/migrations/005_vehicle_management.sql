DO $$ BEGIN
  CREATE TYPE ignition_wiring_mode AS ENUM ('UNKNOWN','NOT_CONNECTED','CONNECTED_POWER_PLUS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE devices ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS sim_operator text;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS sim_type text;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS capabilities jsonb NOT NULL DEFAULT '{}';

UPDATE devices d SET owner_id=v.owner_id
FROM vehicle_device_assignments a JOIN vehicles v ON v.id=a.vehicle_id
WHERE a.device_id=d.id AND a.unassigned_at IS NULL AND d.owner_id IS NULL;

-- GT06 heartbeat decoding has a verified ignition bit. Other hardware features,
-- and all W15 capability flags, remain unknown until explicitly provisioned.
UPDATE devices SET capabilities=capabilities||'{"ignition":"SUPPORTED"}'::jsonb WHERE protocol='GT06';

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS coins numeric(14,2) NOT NULL DEFAULT 0 CHECK (coins >= 0);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS billing_start date;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS billing_due date;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS auto_renewal boolean NOT NULL DEFAULT false;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS door_configured boolean NOT NULL DEFAULT false;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS relay_configured boolean NOT NULL DEFAULT false;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS buzzer_configured boolean NOT NULL DEFAULT false;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ignition_wiring ignition_wiring_mode NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ac_power_plus boolean NOT NULL DEFAULT false;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS parking_alarm_on_ignition boolean NOT NULL DEFAULT false;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_billing_dates_check CHECK (billing_due IS NULL OR billing_start IS NULL OR billing_due >= billing_start);

CREATE INDEX IF NOT EXISTS devices_owner_active_idx ON devices (owner_id, active);
CREATE INDEX IF NOT EXISTS vehicles_owner_updated_idx ON vehicles (owner_id, updated_at DESC);
