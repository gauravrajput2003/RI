CREATE TABLE mobile_push_devices (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expo_token text UNIQUE, platform text NOT NULL CHECK(platform IN ('android','ios','web')),
 refresh_token_hash text NOT NULL, enabled boolean NOT NULL DEFAULT true,
 sound boolean NOT NULL DEFAULT true, vibration boolean NOT NULL DEFAULT true,
 voice boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE mobile_vehicle_transitions (
 vehicle_id uuid PRIMARY KEY REFERENCES vehicles(id) ON DELETE CASCADE,
 state text NOT NULL, sequence bigint NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE mobile_push_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL,
 device_id uuid NOT NULL REFERENCES mobile_push_devices(id) ON DELETE CASCADE,
 vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
 sequence bigint NOT NULL, payload jsonb NOT NULL, attempts int NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '5 minutes',
 sent_at timestamptz, ticket_id text, receipt_checked boolean NOT NULL DEFAULT false,
 UNIQUE(device_id,vehicle_id,sequence)
);
CREATE INDEX mobile_push_pending ON mobile_push_outbox(next_attempt_at) WHERE sent_at IS NULL;
