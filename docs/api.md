# API

All responses use `{ success, data }` or `{ success: false, error: { code, message } }`.

Public: `POST /api/v1/auth/login`, `/refresh`, `/logout`; health endpoints are `/health`, `/health/live`, `/health/ready`.

Authenticated: `GET,POST /api/v1/vehicles`; `GET,PATCH,DELETE /api/v1/vehicles/:id`; `GET /api/v1/vehicles/:id/latest-location`; `GET /api/v1/vehicles/:id/history?from=&to=&limit=`; and paginated `GET /api/v1/devices`, `/events`, `/groups`, `/subscriptions`.

Web admin endpoints:

- `GET /api/v1/dashboard/vehicles?status=&search=&page=&pageSize=` returns authorized fleet rows, server-derived status counts, and pagination.
- `GET /api/v1/playback?vehicleId=&start=&end=&limit=` returns chronological authorized location points for a range of at most 31 days.
- `GET /api/v1/admins`, `POST /api/v1/admins`, and `PATCH /api/v1/admins/:id` list, create, and activate/deactivate admins within the authenticated ownership tree.
- `GET /api/v1/admin-owners` and `GET /api/v1/client-options` provide authorized filter/form options.
- `GET /api/v1/clients?search=&page=&pageSize=&active=`, `GET /api/v1/clients/:id`, `POST /api/v1/clients`, `PATCH /api/v1/clients/:id`, and `DELETE /api/v1/clients/:id` manage clients inside the authenticated admin hierarchy. Deletion requires an inactive client with no dependent records.
- `GET /api/v1/client-owners` returns authorized active Admin owners; `POST /api/v1/clients/:id/reset-password` securely replaces a client password and revokes its refresh tokens.
- `GET /api/v1/fleet-vehicles` returns the authorized, server-filtered Vehicle Management list with real status counts; `GET /api/v1/fleet-vehicles/:id`, `POST /api/v1/fleet-vehicles`, and `PUT /api/v1/fleet-vehicles/:id` provide scoped detail, transactional creation, and transactional editing/device reassignment.
- `GET /api/v1/vehicle-admin-options` and `/vehicle-client-options?adminId=` provide the dependent authorized Admin → Client options. Vehicle create/update accepts `deviceImei`, `deviceProtocol` (`GT06` or `W15`), `simNumber`, and `simOperator` (`Jio`, `Airtel`, or `VI`) and registers or updates that Client-owned device in the same transaction. Device capability metadata controls which static hardware configuration fields may be enabled; these endpoints do not issue remote device commands.
- `GET /api/v1/reports/options` returns authorized vehicle choices. `GET /api/v1/reports/distance`, `/ac`, `/packet`, `/travel-summary`, `/daily-trip-summary`, `/status`, `/idle`, `/running`, `/stoppage`, `/overspeed`, and `/unreachable` accept normalized half-open `start`/`end` timestamps, an IANA `timeZone`, scoped vehicle/search/pagination filters, and validated `sort`/`order` values. Packet reports also accept `intervalHours`; Status Report accepts a normalized status.

Fleet, playback, admin, client, owner-option, and Socket.IO room authorization resolve from the authenticated user through the persisted `users.owner_id` hierarchy. Request-supplied owner, client, and vehicle identifiers never expand that scope.

Socket.IO rooms are `user:{userId}` and `vehicle:{vehicleId}`. The planned location event is `vehicle:location` with a normalized payload, emitted only after a successful committed insert. The current independently deployed API/tracker boundary needs a shared pub/sub adapter (Redis later) to deliver cross-process events.
