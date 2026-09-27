CREATE TABLE alert_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  mapping_type text NOT NULL CHECK (mapping_type IN ('ALL_VEHICLES','CLIENT','VEHICLE')),
  mapping_value uuid,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CHECK ((mapping_type='ALL_VEHICLES' AND mapping_value IS NULL) OR
         (mapping_type<>'ALL_VEHICLES' AND mapping_value IS NOT NULL))
);
CREATE UNIQUE INDEX alert_configurations_owner_name_idx
  ON alert_configurations(owner_id,lower(name)) WHERE archived_at IS NULL;
CREATE INDEX alert_configurations_owner_updated_idx
  ON alert_configurations(owner_id,updated_at DESC) WHERE archived_at IS NULL;

CREATE TABLE alert_configuration_events (
  alert_id uuid NOT NULL REFERENCES alert_configurations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  PRIMARY KEY(alert_id,event_type)
);

CREATE TABLE notification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid REFERENCES alert_configurations(id) ON DELETE SET NULL,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  message text NOT NULL,
  latitude double precision,
  longitude double precision,
  address text,
  occurred_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  dedup_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notification_history_vehicle_time_idx ON notification_history(vehicle_id,occurred_at DESC);
CREATE INDEX notification_history_event_time_idx ON notification_history(event_type,occurred_at DESC);

CREATE TABLE alert_vehicle_event_state (
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  active boolean NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  transition_number bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(vehicle_id,event_type)
);

CREATE TABLE alert_geofence_state (
  geofence_id uuid NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  inside boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(geofence_id,vehicle_id)
);

CREATE TABLE announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  target_type text NOT NULL CHECK (target_type IN ('ALL_CLIENTS','CLIENT')),
  target_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  message_type text NOT NULL DEFAULT 'TEXT' CHECK (message_type='TEXT'),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  body_html text NOT NULL CHECK (length(trim(body_html)) BETWEEN 1 AND 20000),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true,
  dont_show_again boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CHECK (ends_at >= starts_at),
  CHECK ((target_type='ALL_CLIENTS' AND target_id IS NULL) OR
         (target_type='CLIENT' AND target_id IS NOT NULL))
);
CREATE INDEX announcements_owner_window_idx ON announcements(owner_id,starts_at,ends_at)
  WHERE archived_at IS NULL AND active=true;

CREATE TABLE announcement_dismissals (
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(announcement_id,user_id)
);
