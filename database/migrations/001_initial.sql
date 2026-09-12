CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'USER');
CREATE TYPE device_connection_state AS ENUM ('ONLINE', 'OFFLINE', 'MOVING', 'IDLE', 'STOPPED');

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    role user_role NOT NULL DEFAULT 'USER',
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    owner_id uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (owner_id, name)
);

CREATE TABLE devices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    imei varchar(32) NOT NULL UNIQUE,
    protocol varchar(32) NOT NULL,
    model text,
    serial_number text,
    sim_number text,
    active boolean NOT NULL DEFAULT true,
    last_seen_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX devices_last_seen_at_idx ON devices (last_seen_at DESC);

CREATE TABLE vehicles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_number text NOT NULL UNIQUE,
    alias text,
    vehicle_type text,
    image_url text,
    remark text,
    mileage numeric,
    odometer numeric,
    overspeed_limit numeric,
    active boolean NOT NULL DEFAULT true,
    owner_id uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE vehicle_device_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id uuid NOT NULL REFERENCES vehicles(id),
    device_id uuid NOT NULL REFERENCES devices(id),
    assigned_at timestamptz NOT NULL DEFAULT now(),
    unassigned_at timestamptz,
    CHECK (unassigned_at IS NULL OR unassigned_at > assigned_at)
);

CREATE UNIQUE INDEX one_active_device_assignment ON vehicle_device_assignments (device_id) WHERE unassigned_at IS NULL;
CREATE INDEX active_vehicle_assignment_idx ON vehicle_device_assignments (vehicle_id) WHERE unassigned_at IS NULL;

CREATE TABLE vehicle_groups (
    vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    PRIMARY KEY (vehicle_id, group_id)
);

CREATE TABLE device_status (
    device_id uuid PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
    state device_connection_state NOT NULL DEFAULT 'OFFLINE',
    last_location_at timestamptz,
    last_heartbeat_at timestamptz,
    connected_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id uuid NOT NULL REFERENCES devices(id),
    vehicle_id uuid REFERENCES vehicles(id),
    tracker_timestamp timestamptz,
    server_received_at timestamptz NOT NULL DEFAULT now(),
    latitude double precision,
    longitude double precision,
    position geography(Point, 4326),
    speed real,
    course real,
    ignition boolean,
    satellites smallint,
    gps_valid boolean NOT NULL,
    battery_percent real,
    battery_voltage real,
    gsm_signal smallint,
    odometer numeric,
    ac boolean,
    door boolean,
    relay boolean,
    protocol varchar(32) NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX locations_device_time_idx ON locations (device_id, tracker_timestamp DESC);
CREATE INDEX locations_vehicle_time_idx ON locations (vehicle_id, tracker_timestamp DESC);
CREATE INDEX locations_received_idx ON locations (server_received_at DESC);
CREATE INDEX locations_protocol_idx ON locations (protocol);
CREATE INDEX locations_position_gist ON locations USING GIST (position);

CREATE TABLE events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id uuid REFERENCES devices(id),
    vehicle_id uuid REFERENCES vehicles(id),
    event_type text NOT NULL,
    severity smallint NOT NULL DEFAULT 1,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    payload jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX events_vehicle_time_idx ON events (vehicle_id, occurred_at DESC);

CREATE TABLE subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    plan text NOT NULL,
    status text NOT NULL,
    starts_at timestamptz,
    ends_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id) WHERE revoked_at IS NULL;
