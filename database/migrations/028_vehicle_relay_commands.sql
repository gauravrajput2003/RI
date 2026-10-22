-- Reuse vehicles.relay_configured. No vehicle, assignment or telemetry changes.
-- The current adapters cannot dispatch relay commands; owned rejected attempts
-- are retained here instead of fabricating sent or successful results.
CREATE TABLE vehicle_relay_commands (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id uuid NOT NULL REFERENCES users(id),
 vehicle_id uuid NOT NULL REFERENCES vehicles(id),
 device_id uuid REFERENCES devices(id),
 protocol text,
 action text NOT NULL CHECK(action IN ('lock','unlock')),
 idempotency_key uuid NOT NULL,
 status text NOT NULL CHECK(status IN ('pending','sent','succeeded','failed','timed_out','rejected')),
 result_code text NOT NULL,
 result_message text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(actor_id,vehicle_id,idempotency_key)
);
CREATE INDEX vehicle_relay_history_idx ON vehicle_relay_commands(vehicle_id,created_at DESC);
CREATE UNIQUE INDEX vehicle_relay_pending_idx ON vehicle_relay_commands(vehicle_id) WHERE status IN ('pending','sent');
