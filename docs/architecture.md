# Architecture

The API and TCP tracker are independently deployable processes. Trackers speak only to the TCP service; decoders transform frames into `NormalizedLocation`, then persistence resolves the device and current vehicle assignment transactionally. REST controllers never inspect packet bytes.

The tracker keeps only per-socket framing state in memory. PostgreSQL remains authoritative for devices, assignments, locations, and status. Socket.IO consumers subscribe to `user:{id}` and `vehicle:{id}` rooms; a future shared pub/sub adapter can bridge service instances.

Pipeline: tracker → frame buffer → decoder registry → normalized location → validation/persistence → events/realtime publisher.
