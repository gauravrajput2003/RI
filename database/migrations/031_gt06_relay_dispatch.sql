-- Explicit device profile; protocol-family registration alone does not enable a relay.
ALTER TABLE devices ADD COLUMN relay_profile text CHECK(relay_profile IS NULL OR relay_profile='CONCOX_GT06_DYD');
CREATE TABLE tracker_connections (
 device_id uuid PRIMARY KEY REFERENCES devices(id),connection_id uuid NOT NULL,instance_id uuid NOT NULL,
 protocol text NOT NULL,expires_at timestamptz NOT NULL,updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE SEQUENCE relay_server_flag_seq MINVALUE 1 MAXVALUE 4294967295 NO CYCLE;
ALTER TABLE vehicle_relay_commands
 ADD COLUMN assignment_id uuid REFERENCES vehicle_device_assignments(id),
 ADD COLUMN owner_id uuid REFERENCES users(id),
 ADD COLUMN connection_id uuid,
 ADD COLUMN command_profile text,
 ADD COLUMN server_flag bigint UNIQUE,
 ADD COLUMN dispatch_before timestamptz,
 ADD COLUMN expires_at timestamptz,
 ADD COLUMN sent_at timestamptz,
 ADD COLUMN completed_at timestamptz,
 ADD COLUMN response_text text;
CREATE INDEX relay_dispatch_idx ON vehicle_relay_commands(device_id,created_at) WHERE status='pending';

-- One snapshot is used by the API and tracker immediately before physical dispatch.
CREATE FUNCTION relay_command_snapshot(target uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object(
  'id',v.id,'owner_id',v.owner_id,'vehicle_number',v.vehicle_number,'vehicle_type',v.vehicle_type,
  'active',v.active,'relay_configured',v.relay_configured,'assignment_count',
  (SELECT count(*) FROM vehicle_device_assignments WHERE vehicle_id=v.id AND unassigned_at IS NULL),
  'assignment_id',a.id,'assigned_at',a.assigned_at,'device_id',d.id,'device_active',d.active,
  'device_owner_matches',d.owner_id=v.owner_id,'protocol',d.protocol,'relay_profile',d.relay_profile,
  'last_seen_at',d.last_seen_at,'connection_id',c.connection_id,'connection_expires_at',c.expires_at,
  'gps_valid',l.gps_valid,'latitude',l.latitude,'longitude',l.longitude,'speed',l.speed,
  'tracker_timestamp',l.tracker_timestamp,'server_received_at',l.server_received_at,
  'current_speed',s.current_speed,'ignition',s.current_ignition,'heartbeat_at',s.last_heartbeat_at)
 FROM vehicles v
 LEFT JOIN LATERAL(SELECT * FROM vehicle_device_assignments WHERE vehicle_id=v.id AND unassigned_at IS NULL ORDER BY assigned_at DESC LIMIT 1) a ON true
 LEFT JOIN devices d ON d.id=a.device_id LEFT JOIN device_status s ON s.device_id=d.id
 LEFT JOIN tracker_connections c ON c.device_id=d.id AND c.protocol=d.protocol
 LEFT JOIN LATERAL(SELECT * FROM locations WHERE vehicle_id=v.id AND device_id=d.id AND server_received_at>=a.assigned_at ORDER BY server_received_at DESC,id DESC LIMIT 1) l ON true
 WHERE v.id=target
$$;
