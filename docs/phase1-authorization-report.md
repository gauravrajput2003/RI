# Phase 1 resource authorization verification

Result: **IDOR PASS for the implemented resource endpoints and tested ownership transitions.** Executed on 2026-09-13. This is not a declaration that all authentication lifecycle or production deployment security is complete. No Phase 3, mobile UI, ownership schema, or role architecture changes were made.

## Follow-up authorization audit after PostgreSQL integration

Re-inspected the current schema, all mounted API endpoints, authentication services, resource SQL, and Socket.IO access checks. No additional cross-account IDOR vulnerability was found in the current implementation. The fixes described below were already present before this follow-up; this pass changes only `services/api/src/routes/authorization.test.ts` and this report. Authentication behavior, production authorization code, tracker/protocol/telemetry logic, schema, and migrations remain unchanged in this pass.

Added 12 authorization test cases, increasing the authorization suite from 13 to 25:

- Two cases log in as the separately persisted users through the real login service and use the issued access tokens to verify own/foreign resources and all five lists.
- Two cases combine conflicting parent/device/location/user query IDs with historical locations on a device also used by a foreign vehicle. Owned history returns only the owned vehicle's row; foreign nested routes return 404 even when the query supplies an owned ID. Foreign and nonexistent history return the same error response.
- Two cases invoke vehicle detail/latest/history repositories directly, without route middleware, and prove the SQL itself filters foreign ownership.
- One case traverses every cursor page with multiple vehicles in each account and verifies complete, exclusive ownership scope.
- Four cases verify that unsupported device/event/group/subscription detail GET/PATCH/DELETE paths cannot expose resources.
- One additional positive mutation case extends create/update/delete ownership verification to the second account, including persisted ownership and soft-delete assertions.

The final complete API run passed 34 tests across 5 files. Verification is complete for the implemented resource endpoints and tested ownership model; this is not an unrestricted security guarantee. The separate existing authentication lifecycle gaps listed below remain outside this requested scope.

## Findings and ownership model

Reviewed both database migrations, every API route/middleware/service/repository, application mounts, Socket.IO authentication/authorization/publication, and tracker persistence/current-state merging.

There are no customer or organization membership tables. Customers in this verification are separate rows in `users`. The actual access relationships are:

- Vehicles: `vehicles.owner_id -> users.id`.
- Groups: `groups.owner_id -> users.id`. `vehicle_groups` categorizes vehicles; it does not represent a user access grant.
- Subscriptions: `subscriptions.user_id -> users.id`.
- Devices: `vehicle_device_assignments.device_id -> devices.id`, joined through `vehicle_id -> vehicles.id`, with `unassigned_at IS NULL`.
- Events: `events.vehicle_id -> vehicles.id -> owner_id`. A current device assignment does not confer access to that device's historical events. Events with null vehicle IDs have no unambiguous customer owner and are excluded.
- Locations: `locations.vehicle_id -> vehicles.id -> owner_id`. Latest location also requires the current device assignment and a location received during that assignment.
- Roles do not confer cross-owner access in the existing implementation; no role bypass was added.

Previously confirmed vulnerabilities, already fixed before this follow-up:

1. `/devices`, `/events`, `/groups`, and `/subscriptions` used unrestricted table reads after authentication. Every authenticated user could receive other customers' rows without even changing an ID. Replaced these reads with parameterized SQL predicates using the relationships above, applied before LIMIT. Request-supplied ownership filters cannot override the authenticated user.
2. Latest location joined an owned vehicle to device-wide cached state. Reassigning a device could disclose the previous vehicle's coordinates. Tracker merge logic retains omitted fields, so checking only the cache timestamp is insufficient. Latest location now selects the newest recorded location for the authorized vehicle/current assignment. It does not read cached coordinates. The response retains the existing field names; fields absent from the recorded location remain null instead of inheriting another vehicle's data.
3. Socket rooms checked ownership only at connection/subscription. A connected previous owner could continue receiving telemetry following an ownership change. Publication now rechecks each recipient through the existing SQL authorizer, removes unauthorized room membership, and fails closed on authorization errors. The internal telemetry handler awaits publication. Initial-room and subscription database errors are handled without granting access.

Vehicle history already filtered ownership and returned no foreign rows. Foreign/nonexistent vehicle history now returns `404 VEHICLE_NOT_FOUND`, matching vehicle detail/write semantics; an owned vehicle with no matching history still returns an empty list.

## Complete endpoint audit

All paths below are under `/api/v1` unless stated otherwise. These controls are on the server; none depend on React/mobile filtering.

| Endpoint | Authentication | Server authorization / foreign ID or list behavior |
| --- | --- | --- |
| GET /vehicles | Access JWT | owner_id predicate, including cursor queries; foreign rows excluded |
| POST /vehicles | Access JWT | owner_id assigned from verified token; body cannot choose another owner |
| GET /vehicles/:id | Access JWT | id + owner_id; foreign/missing returns 404 VEHICLE_NOT_FOUND |
| PATCH /vehicles/:id | Access JWT | atomic id + owner_id update; ownership not editable; foreign returns 404 |
| DELETE /vehicles/:id | Access JWT | atomic id + owner_id soft deletion; foreign returns 404 |
| GET /vehicles/:id/latest-location | Access JWT | owned vehicle + current device assignment + recorded vehicle location; foreign/no location returns 404 LOCATION_NOT_FOUND |
| GET /vehicles/:id/history | Access JWT | vehicle ownership check plus ownership predicate in history SQL; foreign returns 404 |
| GET /devices | Access JWT | active assignment to owned vehicle; unassigned/foreign devices excluded |
| GET /events | Access JWT | recorded vehicle belongs to authenticated owner; foreign/unattributable events excluded |
| GET /groups | Access JWT | owner_id predicate; foreign groups excluded |
| GET /subscriptions | Access JWT | user_id predicate; foreign subscriptions excluded |
| Socket.IO connection / vehicle:subscribe / vehicle:location | Access JWT at connection | owned active vehicles only; server-generated initial rooms, checked subscriptions, checked delivery, no handshake userId override |
| POST /auth/login | Credentials | active user lookup and password verification; no resource ID selector |
| POST /auth/refresh | Verified refresh token + stored unrevoked token hash | account resolved through refresh_tokens.user_id; no user/customer ID parameter |
| POST /auth/logout | Possession of refresh token | revokes matching token hash only; no user/customer ID selector |
| POST /internal/v1/telemetry/location | Internal tracker secret | trusted ingestion boundary; customer access JWT alone cannot publish; recipient ownership checked before delivery |
| GET /health, /health/live, /health/ready | Public | status only; no customer resources returned |

There are no implemented generic device/event/group/subscription detail or mutation routes. Unknown routes are not alternate resource readers. List owner/user/vehicle/id query parameters are not access grants. The four generic lists retain their existing limit-only behavior (their previously accepted cursor remains unused).

## Automated verification

`services/api/src/routes/authorization.test.ts` now has 25 tests covering both customers' successful own-vehicle access and denied cross-customer detail/latest/history/PATCH/DELETE; all five list endpoints with both customers persisted; issued login tokens; forged owner/user/resource query parameters and cursor traversal; missing/invalid JWTs; creation ownership; both customers' own updates/deletion; role/group non-bypass; unassigned devices/unattributable events; reassigned-device historical events and stale/partially updated coordinates; direct repository isolation; unsupported resource paths; actual Socket.IO delivery isolation and revocation using the production SQL authorizer.

Test database: isolated PGlite PostgreSQL engine with real tables, foreign keys, fixtures, and production SQL. Only the pool adapter is replaced, not repositories or authorization decisions. Migrations are read from the repository; PostGIS/pgcrypto extension declarations and the spatial index are omitted, and spatial column types use PostgreSQL point in this test harness. This verifies ownership SQL, not PostGIS installation, spatial indexes, or deployed PostgreSQL integration. No live application database was changed.

Executed final API suite:

`./node_modules/.bin/vitest.cmd run --root services/api`

- 5 test files passed; 34 tests passed; 0 failed; 0 skipped.
- Resource authorization suite: 25 passed (12 additional cases in this follow-up).
- Existing socket unit tests: 2 passed.
- Existing socket integration tests: 2 passed.
- Existing internal telemetry tests: 2 passed.
- Existing rate-limit tests: 3 passed.
- Final run started at 15:23:53; duration 12.89 seconds (Vitest output).

`./node_modules/.bin/tsc.cmd --noEmit -p services/api/tsconfig.json`: exit 0.

`./node_modules/.bin/eslint.cmd services/api/src`: exit 0.

`git diff --check`: exit 0.

## Exact files changed across the authorization work

This follow-up changed only the authorization test and report. The remaining files below contain the earlier authorization fixes and were not edited during the follow-up.

- services/api/src/routes/api.ts
- services/api/src/modules/resources/repository.ts (new)
- services/api/src/modules/vehicles/repository.ts
- services/api/src/realtime/socket-server.ts
- services/api/src/realtime/internal-telemetry-route.ts
- services/api/src/routes/authorization.test.ts (new)
- services/api/package.json (test database dev dependency)
- pnpm-lock.yaml
- docs/phase1-authorization-report.md (this report)

## Remaining gaps and limits

No remaining cross-customer IDOR was identified in the implemented endpoints under the persisted ownership model and executed scenarios. No customer IDs, vehicle IDs, or user IDs are hardcoded in production authorization; test fixtures generate IDs.

Separate existing authentication lifecycle gaps remain: REST JWT middleware does not recheck users.active, refresh does not filter users.active, and established sockets do not revalidate token expiry/revocation. Deactivating an account therefore does not immediately revoke all its access. These are not cross-customer ID substitution, and were not redesigned in this resource-authorization patch.

Vehicle ownership transfers confer access to that vehicle's recorded history under the existing owner_id model; the schema has no historical customer ownership ledger. Device-only events remain hidden because the schema has no authoritative customer relationship for them. Broader sharing/admin visibility would require an explicit product permission model, which this patch does not invent.

Latest location now queries recorded locations instead of the device cache, and socket publication performs ownership queries per candidate recipient. Production performance and deployment-specific adapter behavior have not been load-tested. The test database is not a live PostGIS deployment. The internal tracker secret remains a privileged ingestion credential.
