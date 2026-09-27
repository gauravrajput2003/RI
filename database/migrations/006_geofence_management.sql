CREATE TABLE geofences (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
 category_key text NOT NULL,
 shape_type text NOT NULL CHECK (shape_type IN ('POINT','POLYGON','RECTANGLE','CIRCLE')),
 geometry geometry(Geometry,4326) NOT NULL,
 radius_meters double precision,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz,
 CHECK (ST_IsValid(geometry) AND NOT ST_IsEmpty(geometry)),
 CHECK ((shape_type IN ('POINT','CIRCLE') AND GeometryType(geometry)='POINT') OR
        (shape_type IN ('POLYGON','RECTANGLE') AND GeometryType(geometry)='POLYGON')),
 CHECK ((shape_type='CIRCLE' AND radius_meters IS NOT NULL AND radius_meters > 0 AND radius_meters <= 1000000) OR
        (shape_type<>'CIRCLE' AND radius_meters IS NULL))
);
CREATE INDEX geofences_geometry_gist ON geofences USING GIST (geometry);
CREATE INDEX geofences_owner_created_idx ON geofences (owner_id,created_at DESC) WHERE deleted_at IS NULL;
CREATE TABLE geofence_vehicle_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 geofence_id uuid NOT NULL REFERENCES geofences(id) ON DELETE RESTRICT,
 vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (geofence_id,vehicle_id)
);
CREATE INDEX geofence_assignments_vehicle_idx ON geofence_vehicle_assignments(vehicle_id);
