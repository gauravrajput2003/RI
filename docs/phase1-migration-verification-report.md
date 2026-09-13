# Phase 1 database migration gate

Executed 2026-09-13. **Migration verification: PASS. Overall requested checks: FAIL.** The fresh-database migration, second run, schema inspection, API compatibility and cleanup all completed successfully. The subsequent API suite timed out in one existing test, and ESLint found one error in the new verification harness. Work stopped without retries, timeout changes, or failure workarounds, as requested.

## Isolated database and versions

- Temporary database: `fleet_migration_test_b316479ecb104142b88c0736e882e281`.
- Local PostgreSQL instance: localhost:5432, existing Docker PostgreSQL/PostGIS server.
- PostgreSQL: 16.4 (Debian 16.4-1.pgdg110+2).
- PostGIS: 3.4.3 e365945, verified through postgis_full_version() and spatial operations.
- Created using `CREATE DATABASE "fleet_migration_test_b316479ecb104142b88c0736e882e281" TEMPLATE template0`.
- Administration used the `postgres` maintenance database. No test connection or modification was made to `fleet`.
- Before migration, the temporary database had zero public tables and neither postgis nor pgcrypto installed. No application tables were manually created.

## Runner and migrations

Inspected services/api/src/db/migrate.ts and every SQL migration. The runner's fileURLToPath(new URL('../../../../database/migrations/', import.meta.url)) resolved on Windows to `D:\RI\database\migrations\`, matching the repository directory verified with realpath.

Discovered and applied:

1. `001_initial.sql` — applied_at 2026-09-13T10:04:05.975Z.
2. `002_current_device_state.sql` — applied_at 2026-09-13T10:04:07.336Z.

Both runs used the actual migration entry point, with DATABASE_URL set only to the temporary database in the test process/child environment:

`node --import tsx D:\RI\services\api\src\db\migrate.ts`

First working directory: D:\RI. Second working directory: D:\RI\services\api. Both exited successfully with no stderr. The SQL migrations themselves enabled PostGIS and pgcrypto; the harness did not install extensions manually.

Each migration was recorded exactly once. After the second run, migration names and applied_at values, column/default definitions, constraints, indexes, and relation OIDs were identical. There was no duplicate execution or schema recreation.

No migration-system defect was found, and the runner and SQL files were not changed. The runner has transaction rollback on errors but no separate down/rollback command; no rollback architecture was added.

## Schema checks: PASS

Created all 11 application tables plus the migration ledger:

- users
- groups
- devices
- vehicles
- vehicle_device_assignments
- vehicle_groups
- device_status
- locations
- events
- subscriptions
- refresh_tokens
- schema_migrations

PostGIS also created spatial_ref_sys.

Verified all 12 primary keys, 13 foreign keys including declared cascade actions, 5 declared unique constraints, the assignment chronology CHECK, 61 required NOT NULL columns, and both application enums.

Verified the 11 explicit indexes: devices_last_seen_at_idx, one_active_device_assignment, active_vehicle_assignment_idx, locations_device_time_idx, locations_vehicle_time_idx, locations_received_idx, locations_protocol_idx, locations_position_gist, events_vehicle_time_idx, refresh_tokens_user_idx, devices_identity_unique. This includes partial predicates, uniqueness, indexed columns/order, and the GiST method. No public indexes were invalid or unready.

PostGIS metadata confirmed locations.position and device_status.current_position are two-dimensional geography(Point,4326). Real point insertion and ST_SRID/ST_X/ST_Y roundtrips passed. Negative checks verified rejection of a wrong SRID and a LineString in a Point column. Other negative checks verified active-device-assignment uniqueness, foreign keys, required identity_value, and assignment chronology. Deliberately invalid statements were rolled back inside the temporary database.

## Application compatibility: PASS

Used the actual API application, authentication service, pg pools and resource repositories against the freshly migrated database. Verified real login, vehicle creation/detail/update/soft-delete, all five resource list queries, latest-location, and history. Fixture rows were inserted only after migrations had created all tables. Spatial test coordinates are schema-compatibility data, not a GPS protocol or physical-device claim.

No PGlite or mocked repositories were used for migration or application compatibility verification. The separately executed normal API suite retains its pre-existing PGlite and mocked unit tests. The earlier telemetry test was not rerun because its safety guard intentionally targets fleet; the fresh-database API compatibility exercise above was used instead without changing that guard.

## Cleanup: PASS

Closed application and inspection pools, dropped only the generated temporary database, then queried pg_database and verified that its name was absent. The existing fleet database remained present with its original OID 16384. No reset, drop, table mutation, or migration was run against fleet.

## Exact verification commands and results

Commands executed from D:\RI:

| Command | Result |
| --- | --- |
| `./node_modules/.bin/vitest.cmd run --config services/api/vitest.migrations.config.ts` | PASS: 1 file, 1 test, zero failures/skips; 7.01 seconds; start 15:34:02 |
| `./node_modules/.bin/vitest.cmd run --root services/api` | FAIL: 33 passed, 1 failed; 4 files passed, 1 failed; 26.21 seconds |
| `./node_modules/.bin/vitest.cmd run --root services/tracker` | PASS: 20 tests across 8 files; 5.35 seconds |
| `./node_modules/.bin/tsc.cmd --noEmit -p services/api/tsconfig.json` | PASS: exit 0 |
| `./node_modules/.bin/tsc.cmd --noEmit -p services/tracker/tsconfig.json` | PASS: exit 0 |
| `./node_modules/.bin/tsc.cmd --noEmit -p tests/tsconfig.json` | PASS: exit 0 |
| `./node_modules/.bin/eslint.cmd services/api/src services/api/test services/api/vitest.migrations.config.ts services/tracker/src services/tracker/test` | FAIL: exit 1, one no-unsafe-finally error |
| `git diff --check` | PASS: exit 0 |

API failure: services/api/src/middleware/rate-limits.test.ts, “normal API is capped at 300/minute without affecting telemetry”, exceeded its existing 5000 ms timeout (5033 ms reported). The test ran alongside other follow-up checks; resource contention was not diagnosed and is not asserted as the cause. No retry or timeout adjustment was made.

ESLint failure: services/api/test/migrations.integration.ts:43:92, `no-unsafe-finally`, because the cleanup-target guard throws inside a finally block. This is in the new verification harness, not the migration runner. It remains unfixed because the user explicitly requested stopping and reporting any failure. TypeScript checks passed. The migration execution and database cleanup completed before these follow-up failures.

## Every file changed in this pass

- services/api/test/migrations.integration.ts — new isolated real-database verification harness; currently has the lint error reported above.
- services/api/vitest.migrations.config.ts — opt-in test configuration, excluded from the normal API test file pattern.
- docs/phase1-migration-verification-report.md — this report.

No production code, SQL schema/migrations, authorization, tracker/protocol logic, mobile UI, or other unrelated files changed. No new dependencies were added.

Stopped after reporting the failures. No Phase 3, mobile work, physical-device testing, or unrelated fixes were started.
