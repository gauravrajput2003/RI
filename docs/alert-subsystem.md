# Alert subsystem

The API is authoritative. The web app only configures rules and reads persisted notifications.

## Event sources

| Event | Authoritative source | Trigger |
| --- | --- | --- |
| Vehicle Running | Existing `device_status.state` | State becomes `MOVING` |
| Vehicle Idle | Existing `device_status.state` | State becomes `IDLE` |
| Vehicle Stopped | Existing `device_status.state` | State becomes `STOPPED` |
| Vehicle Overspeed | Normalized telemetry `speed` and `vehicles.overspeed_limit` | Speed crosses above the configured limit |
| Vehicle Unreachable | `devices.last_seen_at` and `NO_SIGNAL_TIMEOUT_MINUTES` | The existing no-signal window expires |
| Vehicle Online | Committed telemetry after an unreachable state | The next valid packet is persisted |
| AC On / Off | Normalized `locations.ac` with a supported device capability | Boolean state changes |
| Door Opened / Closed | Normalized `locations.door` with configured/supported door telemetry | Boolean state changes |
| Geofence In / Out | Existing PostGIS geofence geometry and assignment | Position changes between outside and inside |
| Subscription Expired / Renewed | `subscriptions.status` and `subscriptions.ends_at` | Expiry state changes |

Vehicle lifecycle, parking violation, and main-supply events are not registered because the current application has no committed normalized event source for them. They should be added to the registry only after a durable source exists.

## Processing and deduplication

Committed tracker locations are published to the API after tracker persistence. The API derives candidates from the existing state, stores the latest event state, and writes history only when a boolean condition changes to active. A transition counter forms the deterministic unique key:

`alert configuration + subject + event type + transition number`

The 60-second unreachable and subscription sweeps use the same state tables and deduplication rule. Repeated telemetry or repeated sweeps therefore do not create duplicate notifications. Geofence membership is stored per vehicle/geofence and evaluated with PostGIS.

## Authorization and realtime delivery

Alert configuration, mappings, history, and announcements are scoped on every database query through the recursive user hierarchy. Realtime vehicle notifications reuse the existing authorized Socket.IO vehicle rooms and recheck access before each delivery. Subscription notifications use authenticated user rooms. No alert uses a global broadcast.

Announcements are active only inside their server-evaluated date window. HTML is reduced to a strict allowlist before persistence. A `dont_show_again` announcement is hidden using a persistent `(announcement_id,user_id)` dismissal record.
