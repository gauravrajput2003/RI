-- Cellular estimates are independent of GPS fixes and GPS distance calculations.
CREATE TABLE cell_location_cache (
  cell_key text PRIMARY KEY,
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  address text,
  attribution text,
  provider text NOT NULL DEFAULT 'OpenCellID',
  lookup_status text NOT NULL DEFAULT 'resolved' CHECK(lookup_status IN ('resolved','not_found')),
  resolved_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
CREATE INDEX locations_serving_cell_latest ON locations(vehicle_id,device_id,server_received_at DESC)
  WHERE metadata ? 'cell' OR metadata ? 'cellId';
