-- Free-text SIM identification and GPS installation position for managed vehicles.
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS sim_info text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS gps_location text;
