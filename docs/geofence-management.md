# Geofence management implementation report

Implemented September 22, 2026. Changes are uncommitted. The fleet database was not migrated or populated during this task; database verification and browser QA used disposable local databases that were removed afterward.

## Behavior

The existing application now exposes `/geofences` through its sidebar. The page includes a searchable, paginated table beside a Leaflet map, with a responsive form above it. It supports creating, selecting, editing and deleting geofences; vehicle-only multi-assignment; polygon, rectangle, circle and point drawing; draggable geometry handles; radius input; map zoom/fullscreen; street/satellite layers; and table fullscreen. Rectangle and circle creation use a single press-drag-release gesture. Drawing modes temporarily take priority over map navigation, while normal panning and zooming return when drawing finishes. Polygon closes from its first vertex or the Finish action, and marker placement takes one click. Changing layers retains the drawing. Table fullscreen keeps the map mounted and preserves the query, editor, selection and geometry state. Geometry replacement, clear, close and deletion require confirmation. Saves prevent duplicate submissions and preserve form data on errors.

The vehicle picker queries authorized vehicles only, searches on the server, pages through 50 options at a time, and supports Deselect All and Select All Results. The latter explicitly fetches matching pages only when requested, up to the documented 1,000-vehicle assignment limit. No fixture or fallback rows are used in the application.

The category list, stable stored identifiers, semantic Lucide icon keys and icon colors are centralized in the shared types package. One category component resolves those definitions for the form dropdown, selected value and table rows, so every existing category has the same icon everywhere. The existing API client, token refresh, React Query, account hierarchy, state panels, table, formatting, icons and application shell are reused. No new runtime dependency was added.

## Files created

- `packages/shared-types/src/geofences.ts`: category definitions and API geometry/input/result types.
- `database/migrations/006_geofence_management.sql`: geofence schema, assignment relation and indexes.
- `services/api/src/modules/geofences/validation.ts`: strict request and shape validation.
- `services/api/src/modules/geofences/repository.ts`: scoped queries and transactional writes.
- `services/api/src/modules/geofences/validation.test.ts`: 16 validation tests.
- `services/api/src/routes/geofences.ts`: authenticated REST routes.
- `services/api/test/geofences.integration.ts`: real PostGIS and API assertions used by the migration gate.
- `services/api/test/geofence-browser-server.ts`: optional isolated browser QA server; disposable database, test-only accounts/vehicles, loopback listeners and automatic cleanup.
- `apps/web/src/pages/GeofencePage.tsx`: management page and vehicle picker.
- `apps/web/src/pages/GeofencePage.test.tsx`: nine page/workflow tests.
- `apps/web/src/features/geofences/GeofenceCategory.tsx`: centralized category icon, badge and accessible dropdown rendering.
- `apps/web/src/features/geofences/GeofenceMap.tsx`: Leaflet drawing, editing, selection, layer and viewport controls.
- `apps/web/src/features/geofences/GeofenceMap.test.tsx`: ten drawing/editing/navigation/layer/fit tests.
- `apps/web/src/features/geofences/geofences.css`: responsive layout and map styles, including a scoped correction for the existing global SVG icon dimensions.
- `docs/geofence-management.md`: this report.

## Files modified

- `packages/shared-types/src/index.ts`: exports the new shared definitions.
- `services/api/src/routes/api.ts`: mounts geofence routes after authentication.
- `services/api/test/migrations.integration.ts`: includes migration 006 and executes geofence integration assertions.
- `apps/web/src/app/App.tsx`: lazy-loaded geofence route.
- `apps/web/src/layouts/AppShell.tsx`: enables the Geofence navigation item.

Existing migrations, tracker listeners/parsers, telemetry ingestion, mobile application and current-state processing were not changed.

## Database and authorization

Migration: `006_geofence_management.sql`.

New tables:

- `geofences`: UUID identity, creator's `owner_id`, name, stable category key, original shape type, SRID 4326 PostGIS geometry, optional circle radius in meters, timestamps and `deleted_at`.
- `geofence_vehicle_assignments`: UUID identity, foreign keys, creation timestamp and unique `(geofence_id, vehicle_id)` constraint.

Indexes cover geometry with GiST, active owner/creation listing and assignment lookup by vehicle. Foreign keys use restricted deletion. Soft deletion retains the geofence and its current assignment records; no event or telemetry history is removed. Assignment replacement during editing is transactional; this module does not introduce an assignment audit log.

The existing recursive `userScopeCte` determines access. A geofence belongs to its authenticated creator and is visible to that creator and authorized ancestors. Assigning a vehicle does not itself grant the vehicle owner access to someone else's geofence. Every selected vehicle is independently checked against the actor's hierarchy in the transaction, with shared row locks during assignment. Updates/deletes lock a scoped geofence row. Reads also verify current vehicle ownership; a fence containing a vehicle transferred outside the actor's hierarchy becomes unavailable to that actor, preventing stale assignment information from leaking. No owner or tenant field is accepted from the browser.

Routes use existing authentication, API rate limits and sanitized error handling. Inputs are validated with Zod, SQL is parameterized, and PostGIS validates polygon topology. Cross-account identifiers return 404 for geofence access and 403 for unauthorized assignments.

## Geometry

- Point: PostGIS `Point`.
- Polygon: valid, closed single-ring PostGIS `Polygon`.
- Rectangle: four axis-aligned edges stored as a `Polygon`, while `shape_type=RECTANGLE` preserves editor semantics.
- Circle: center stored as `Point`, with the actual positive `radius_meters` stored separately. No degrees-as-meters approximation or tessellated polygon is stored.

Leaflet calculates drawing distances in meters with its spherical Earth model. Circle viewport bounds and radius handles use spherical calculations. A future event evaluator should use geodesic distance semantics, such as `ST_DWithin(center::geography, position::geography, radius_meters)`, rather than Cartesian degree distances. This task does not add an entry/exit event engine.

## API

All paths use `/api/v1`:

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/geofences` | Scoped list with `search`, `page`, `pageSize` |
| GET | `/geofences/vehicle-options` | Scoped vehicle-number search and pagination |
| GET | `/geofences/:id` | Scoped record and geometry |
| POST | `/geofences` | Create with validated complete editor payload |
| PATCH | `/geofences/:id` | Replace editable fields using the complete editor payload |
| DELETE | `/geofences/:id` | Soft-delete, retaining the record and assignments |

Editor payload: `name`, `categoryKey`, `shapeType`, `geometry` (GeoJSON), `radiusMeters` (null for non-circles), and `vehicleIds`. Geometry coordinate order is longitude, latitude. Ownership and assignment type are not client-supplied fields. The API supports only vehicle assignment.

The list searches name, category label derived from its key, and assigned vehicle number. Search is debounced by 300 ms in the UI. Counts remain correct on empty/out-of-range pages. Results are ordered deterministically by creation timestamp and ID. Geometry and vehicle summaries are serialized only for the requested page. The UI renders 25 persisted shapes at a time, plus a selected shape when needed.

## Verification and exact commands

Commands below used installed repository tools directly, avoiding a package-manager download. Relative command paths are relative to the stated working directory.

| Working directory | Command | Final result |
| --- | --- | --- |
| Repository root | `node node_modules/typescript/bin/tsc --noEmit -p services/api/tsconfig.json` | Passed |
| Repository root | `node node_modules/typescript/bin/tsc -b apps/web --pretty false` | Passed |
| Repository root | `node node_modules/typescript/bin/tsc --noEmit -p packages/shared-types/tsconfig.json` | Passed |
| Repository root | `node node_modules/eslint/bin/eslint.js services/api/src apps/web/src packages/shared-types/src` | Failed on the existing unused `row` argument in `apps/web/src/pages/ReportPage.tsx:63`; no new-file failures |
| Repository root | `node node_modules/eslint/bin/eslint.js services/api/src/modules/geofences services/api/src/routes/geofences.ts apps/web/src/features/geofences apps/web/src/pages/GeofencePage.tsx apps/web/src/pages/GeofencePage.test.tsx packages/shared-types/src` | Passed |
| `services/api` | `node ../../node_modules/vitest/vitest.mjs run` | Initial run: 74 passed, one existing client-management test exceeded its 5-second timeout under concurrent test load |
| `services/api` | `node ../../node_modules/vitest/vitest.mjs run --fileParallelism false --testTimeout 15000` | **75/75 passed**, eight files |
| `apps/web` | `node node_modules/vitest/vitest.mjs run --config vitest.config.ts --fileParallelism false` | **39/39 passed**, 13 files |
| `services/api` | `node ../../node_modules/vitest/vitest.mjs run src/modules/geofences/validation.test.ts --fileParallelism false` | **16/16 passed** |
| `services/api` | `node ../../node_modules/vitest/vitest.mjs run --config vitest.migrations.config.ts` | **1/1 migration gate passed**, including geofence API/PostGIS assertions |
| `apps/web` | `node node_modules/vite/bin/vite.js build` | Passed; 1,799 modules |
| Repository root | `git diff --check` | Passed |

An initial `tsc -b apps/web/tsconfig.app.json --pretty false` run also passed after correcting a test-only option. Targeted geofence tests were run during development before the final complete web suite. Initial Vitest/Vite invocations were blocked by sandbox EPERM errors while writing temporary configuration; successful runs used approved execution outside that sandbox. No package dependency was installed.

The real migration gate ran against PostgreSQL 16.4 / PostGIS 3.4.3. It verified migration-runner idempotency, schema integrity, all shape round-trips, circle metadata, rectangle normalization, the GiST index, recursive scope, unauthorized reads/updates/deletes, foreign vehicle assignment, transactional rollback, invalid category/geometry/radius, duplicate assignments, search, pagination, ownership transfer and retained soft-deleted records. Both test databases were dropped by their gate cleanup; the fleet database was not reset or modified.

Browser QA used `node --import tsx services/api/test/geofence-browser-server.ts`, the actual web application, actual API authentication and an isolated PostGIS database. Confirmed: all 54 categories have SVG icons; dropdown and table icons match; direct rectangle and circle press-drag-release; no map movement during those drawing gestures; normal map panning after drawing; polygon/marker behavior through component coverage; edit mode; Street/Satellite switching without lost geometry or form state; table fullscreen with the map and geometry still mounted; vehicle assignment; create success; persisted row and map geometry after reload; and zero browser console warnings/errors. The temporary QA processes were stopped after verification. Responsive desktop layout was visually inspected in the browser.

## Deployment and remaining limits

Apply the normal migration runner before using this feature against an existing application database:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\pnpm.ps1 migrate
```

Then start/restart the API and web app normally. No migration was applied to the existing fleet database during implementation; no commit or push was performed.

- PDF/Excel controls remain explicitly disabled because the repository has no working export backend for these tables.
- Maximum 1,000 assigned vehicles, 999 polygon vertices plus the closing vertex, and circle radius up to 1,000,000 meters. Single-ring polygons only; polygon holes and multipart regions are not supported.
- The existing generic table has no sorting interface; this page uses deterministic creation order. Search and pagination are server-side.
- Street tiles use the existing OpenStreetMap source. Satellite uses Esri World Imagery with attribution; tile availability depends on external services. Tile errors are surfaced without discarding geometry.
- Map editing uses pointer drawing and draggable handles, with keyboard-accessible toolbar/form controls. There is no coordinate-entry editor or keyboard-only vertex drawing.
- Editing sends the complete editable payload to PATCH. Concurrent editors follow the application's existing last-write-wins convention.
- Entry/exit alert evaluation, group assignment, export generation and an assignment-history subsystem are outside this management module.
- Repository-wide lint remains blocked by the pre-existing ReportPage unused argument; it was left unchanged to preserve task scope.
