CREATE TABLE drivers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
 mobile text NOT NULL CHECK (mobile ~ '^\+?[0-9]{7,15}$'),
 licence_number text NOT NULL CHECK (length(licence_number) BETWEEN 5 AND 40),
 licence_key text GENERATED ALWAYS AS (regexp_replace(upper(licence_number),'[^A-Z0-9]','','g')) STORED,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (length(licence_key) BETWEEN 5 AND 30),
 UNIQUE(owner_id,licence_key)
);
CREATE INDEX drivers_owner_page ON drivers(owner_id,id);
CREATE TABLE vehicle_driver_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
 driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE RESTRICT,
 assigned_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 assigned_at timestamptz NOT NULL DEFAULT now(),
 unassigned_at timestamptz,
 CHECK (unassigned_at IS NULL OR unassigned_at>=assigned_at)
);
CREATE UNIQUE INDEX vehicle_driver_one_current_vehicle ON vehicle_driver_assignments(vehicle_id) WHERE unassigned_at IS NULL;
CREATE UNIQUE INDEX vehicle_driver_one_current_driver ON vehicle_driver_assignments(driver_id) WHERE unassigned_at IS NULL;
CREATE INDEX vehicle_driver_history ON vehicle_driver_assignments(vehicle_id,assigned_at DESC);
