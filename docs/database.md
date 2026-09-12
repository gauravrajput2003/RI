# Database

`locations` is the append-oriented telemetry table. It has time indexes by device and vehicle, a received-time index, protocol index, and a GiST PostGIS geography index. The point is stored as WGS84 geography, enabling `ST_DWithin` and geofence intersection queries later.

Devices are separate from vehicles. `vehicle_device_assignments` retains replacement history, with a partial unique index ensuring a device has only one active assignment.
