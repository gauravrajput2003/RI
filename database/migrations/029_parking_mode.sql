CREATE TABLE parking_modes (
 vehicle_id uuid PRIMARY KEY REFERENCES vehicles(id), owner_id uuid NOT NULL REFERENCES users(id),
 device_id uuid NOT NULL REFERENCES devices(id), assignment_id uuid NOT NULL REFERENCES vehicle_device_assignments(id),
 enabled boolean NOT NULL, version integer NOT NULL DEFAULT 1, activation_id uuid NOT NULL,
 latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90),
 longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 reference_at timestamptz NOT NULL, activated_at timestamptz NOT NULL,
 radius_m integer NOT NULL CHECK(radius_m IN (20,30,40,50)),
 repeat_minutes integer NOT NULL CHECK(repeat_minutes IN (1,2,5,10)),
 boundary_state text NOT NULL DEFAULT 'inside' CHECK(boundary_state IN ('inside','outside','unknown')),
 outside_count integer NOT NULL DEFAULT 0, inside_count integer NOT NULL DEFAULT 0,
 cursor_at timestamptz NOT NULL,cursor_id uuid NOT NULL,
 last_gps_at timestamptz,last_point jsonb,last_distance_m double precision,quality_ok boolean NOT NULL DEFAULT true,
 movement_id uuid,last_movement_at timestamptz,last_alert_at timestamptz,
 alert_sequence bigint NOT NULL DEFAULT 0,
 updated_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX parking_active_idx ON parking_modes(vehicle_id) WHERE enabled;
CREATE INDEX parking_locations_cursor_idx ON locations(vehicle_id,device_id,server_received_at,id);
-- Reuse the existing push outbox, with a separate sequence namespace.
ALTER TABLE mobile_push_outbox ADD COLUMN source text NOT NULL DEFAULT 'state';
ALTER TABLE mobile_push_outbox ADD COLUMN cancelled_at timestamptz;
ALTER TABLE mobile_push_outbox ADD COLUMN last_error text;
ALTER TABLE mobile_push_outbox DROP CONSTRAINT mobile_push_outbox_device_id_vehicle_id_sequence_key;
ALTER TABLE mobile_push_outbox ADD CONSTRAINT mobile_push_source_sequence UNIQUE(device_id,vehicle_id,source,sequence);
