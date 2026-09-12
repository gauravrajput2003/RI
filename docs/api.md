# API

All responses use `{ success, data }` or `{ success: false, error: { code, message } }`.

Public: `POST /api/v1/auth/login`, `/refresh`, `/logout`; health endpoints are `/health`, `/health/live`, `/health/ready`.

Authenticated: `GET,POST /api/v1/vehicles`; `GET,PATCH,DELETE /api/v1/vehicles/:id`; `GET /api/v1/vehicles/:id/latest-location`; `GET /api/v1/vehicles/:id/history?from=&to=&limit=`; and paginated `GET /api/v1/devices`, `/events`, `/groups`, `/subscriptions`.

Socket.IO rooms are `user:{userId}` and `vehicle:{vehicleId}`. The planned location event is `vehicle:location` with a normalized payload, emitted only after a successful committed insert. The current independently deployed API/tracker boundary needs a shared pub/sub adapter (Redis later) to deliver cross-process events.
