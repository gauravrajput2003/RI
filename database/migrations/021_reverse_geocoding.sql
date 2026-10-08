CREATE TABLE IF NOT EXISTS reverse_geocode_cache (
  coordinate_key text PRIMARY KEY,
  address text,
  attribution text,
  expires_at timestamptz NOT NULL
);
