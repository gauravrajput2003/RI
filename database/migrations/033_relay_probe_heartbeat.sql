ALTER TABLE vehicle_relay_commands
 ADD COLUMN probe_profile text,
 ADD COLUMN probe_profile_digest text,
 ADD COLUMN heartbeat_relay_state boolean,
 ADD COLUMN heartbeat_terminal_info smallint,
 ADD COLUMN heartbeat_observed_at timestamptz,
 ADD COLUMN heartbeat_matches boolean;
ALTER TABLE vehicle_relay_commands ADD CONSTRAINT relay_probe_restore_only CHECK(probe_profile IS NULL OR action='unlock');
-- true means Bit7 reports oil/electric disconnected; secondary evidence only.
ALTER TABLE device_status
 ADD COLUMN relay_state_reported boolean,
 ADD COLUMN relay_terminal_info smallint,
 ADD COLUMN relay_reported_at timestamptz,
 ADD COLUMN relay_reported_connection_id uuid;
