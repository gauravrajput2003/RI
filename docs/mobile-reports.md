# Mobile Distance Report and Travel Summary

Implemented against the existing PostgreSQL history. No telemetry was seeded, corrected, deleted or otherwise changed for this work. Verification uses read-only database connections. No Git commit or push was made.

## Open and test

The bottom Report tab and a vehicle's Report action open the red Report menu. Choose Distance Report or Travel Summary. From the bottom tab, select a vehicle in the filter if no vehicle context is active. The existing Reports catalogue also links to these two working reports.

Restart `npm run dev:api` from `D:\RI` if the API is not already watching changes. Reload the mobile app. Existing APK/development builds must be rebuilt for the added `expo-sharing` and `expo-file-system` native modules. For the existing LAN preview profile:

```powershell
cd D:\RI\apps\mobile
npx eas-cli@latest build --platform android --profile preview-lan
```

Test HR12AU6674 with **13/10/2026 through 15/10/2026**. The current database also has HR12AX6674 history on **08/10/2026 and 09/10/2026**. These identifiers are verification findings, never production fallbacks. Selecting another authorized vehicle always queries its own ID.

Test a no-data day and a vehicle without history. They show the selected registration and inclusive dates, with no report cards or export snapshot. Errors and loading have distinct states. Individual unavailable fields display `—`; supported numeric zero remains zero. Export actions are disabled during loading, errors, empty data, and active exports.

Native device sharing and the final Android/iOS screenshot comparison still require a physical device or emulator. Production JavaScript bundles for both platforms were checked; that does not substitute for native share-sheet testing.

## Database and data flow

* `vehicles`: `id`, `vehicle_number`, `vehicle_type`, `owner_id` supply scoped identity and artwork type.
* `users.owner_id` and the existing recursive `user_scope` enforce account hierarchy. Authentication checks the persisted active user; existing Admin report permissions apply to reads and exports.
* `vehicle_device_assignments`: `vehicle_id`, `device_id`, `assigned_at`, `unassigned_at` link ingestion to the actual vehicle. Reporting uses the vehicle ID already stored on each historical location, so it does not relabel old fixes using a current device assignment.
* `devices`: protocol and identity establish the tracker association during ingestion.
* `locations`: `id`, `vehicle_id`, `device_id`, `tracker_timestamp`, `server_received_at`, `gps_valid`, `position`, `latitude`, `longitude`, `speed`, `ignition`, `metadata.address` supply every report value.

The actual path is TCP tracker -> protocol decode/normalization -> `services/tracker/src/db/repository.ts::persist` -> PostgreSQL `locations`. Persistence resolves the active assignment and commits first. The internal HTTP telemetry boundary then publishes to API/socket clients. Reports read the committed PostgreSQL records through authenticated API endpoints; the mobile app never aggregates an entire GPS history itself. No parser, ingestion or auth code was changed for reports.

## Calculation definitions

Reports are **daily observed-history summaries**, not fabricated ignition trips. Multiple days remain separate cards. Days without valid recorded GPS fixes are omitted. A day containing one GPS fix can show the supported speed/location fields while distance remains unavailable.

* Observation time is `COALESCE(tracker_timestamp, server_received_at)`.
* Calendar days use `Asia/Kolkata`, matching the existing fleet dashboard. UI ranges are inclusive calendar dates, transmitted as `[start, next-day end)` instants. This Week starts Monday and ends today; Last Week is the previous complete Monday–Sunday. Month presets handle real month lengths and leap years. Custom ranges are at most 31 days, cannot be reversed and cannot extend past today in the UI.
* Distance uses the existing playback/dashboard PostGIS rules: valid GPS, present geography, legal coordinates, excluding `(0,0)`. Consecutive fixes are partitioned by device and calendar day. A segment needs positive elapsed time and implied speed <=200 km/h. Sub-10m jitter is omitted unless either adjacent recorded speed exceeds the configured movement threshold. Device changes, invalid fixes, equal timestamps and jumps cannot silently add arbitrary distance. An observed eligible stationary pair can support a genuine zero; fewer than two comparable fixes cannot.
* Average speed is the arithmetic mean of finite, nonnegative speeds at valid GPS fixes, as in playback. Maximum is the maximum of those same readings. This is a sample average, not distance divided by elapsed time.
* Total Duration is the observed telemetry span within the day, for a single device. It is **not driving time** and does not fill the rest of a calendar day. With one timestamp or multiple devices it is unavailable. A no-fix telemetry packet can precede the first valid GPS fix, so this span can differ from the difference between the displayed GPS endpoint times.
* Movement uses `MOVEMENT_THRESHOLD_KPH` (currently 5). Known state intervals are bounded by the configured offline timeout (currently 600 seconds). Unknown ignition at a stationary fix cannot become idle or stopped. Invalid GPS cannot supply a trustworthy motion classification. Long gaps leave complete running/idle/stopped totals and halt counts unavailable rather than reporting partial totals as complete.
* Unreachable duration sums only observed same-device gaps beyond `NO_SIGNAL_TIMEOUT_MINUTES` (currently 30 minutes), between recorded packets in the same day. It follows the existing historical no-signal rule. It does not extrapolate before the first packet or after the last, and is not an inferred stopped duration. When the two timeouts differ, the intervening interval is unknown rather than assigned a false state.
* Halts use observed stopped-state sessions, following the existing stop-session definition. If incomplete state evidence makes the count unreliable it is unavailable.
* Start/end times and GPS coordinates come from the first/last actual valid fixes in each daily summary. They are not asserted to be engine trip boundaries.
* Addresses use actual persisted `locations.metadata.address` at those endpoints. There is no invented address, current-location substitution, cell-area substitution or background geocoding write during this report query. Absent historical addresses stay unavailable.

## Verified persisted data (16 October 2026)

The verification script selects a bike dynamically by actual valid history and latest observation, not a hardcoded registration or UUID. It selected **HR12AU6674**, protocol GT06. It found:

| India date | Stored packets | Valid GPS fixes | Distance km | Avg km/h | Max km/h | Observed duration | Historical no-signal duration |
|---|---:|---:|---:|---:|---:|---|---|
| 13/10/2026 | 2 | 1 | unavailable | 0 | 0 | 00:01:28 | 00:00:00 |
| 14/10/2026 | 270 | 265 | 78.87373956244001 | 14.147169811320754 | 52 | 16:00:15 | 05:50:23 |
| 15/10/2026 | 90 | 90 | 59.81939831901002 | 24.288888888888888 | 65 | 13:47:07 | 08:31:58 |

14 October GPS boundaries, in India time: **06:52:53–22:53:08**. Start GPS **28.867715555555556, 76.59425777777778**; end GPS **28.86778222222222, 76.59430222222223**.

15 October GPS boundaries, in India time: **09:04:08–22:51:15**. Start GPS **28.867717777777777, 76.59415111111112**; end GPS **28.867764444444443, 76.59425777777778**.

13 October has a single valid fix at **22:35:21 India time**, so start and end GPS are the same actual observation. Its preceding no-fix packet cannot support a running duration or distance.

Ignition is absent in all selected-bike location records. Endpoint addresses are absent. Idle, stopped and halts therefore remain unavailable. Complete running duration is also unavailable because of invalid fixes and/or observation gaps. These blanks are an honest property of the source data, not unfinished fake report values.

Raw API snapshots and verification evidence are under `artifacts/mobile-reports/`. API distance was checked independently against the production playback query. GPS counts, average/maximum speeds, observed durations, endpoint coordinates/times and no-signal durations were compared with the stored records and SQL calculations. A historical empty date was verified as an empty result without an export snapshot.

## API, bounds and exports

New authenticated endpoints:

* `GET /api/v1/reports/mobile/distance`
* `GET /api/v1/reports/mobile/travel-summary`
* `POST /api/v1/reports/mobile/distance/export`
* `POST /api/v1/reports/mobile/travel-summary/export`

GET requires `vehicleId`, `start`, `end`, and optional `timeZone`. Existing `/reports/options` supplies searchable authorized vehicle choices, with up to 100 matches per search. Reports are bounded to 31 days and 250,000 source packets; exceeding the packet bound fails explicitly, never returns a silently truncated report. Existing vehicle/time indexes are used; no new table or migration was required.

Each nonempty response includes an opaque snapshot ID. The process retains at most 200 snapshots for 15 minutes. Export validates the same authenticated actor, report kind and fresh vehicle authorization. It serializes the **stored response snapshot**, not caller-supplied report rows and not a fresh query with potentially changed telemetry. A restart/expiry/eviction prompts the user to refresh. Empty reports cannot obtain an export snapshot. Exports are limited to 10/minute/account.

PDFKit produces a genuine PDF. ExcelJS produces a genuine `.xlsx` workbook with numeric metrics, empty unavailable cells, a report sheet and applied-filter metadata. Both include vehicle, report kind, date instants and timezone. PDF values and screen/export numeric formatting use the same actual metrics rounded for display. The mobile app writes decoded bytes through Expo FileSystem and invokes Expo Sharing, reporting failures and preventing duplicate export taps. Successfully shared files remain in the OS-managed cache so receiving apps can finish reading them; incomplete files are removed on errors.

The real exported workbooks were reopened and **every data cell** was compared with the API snapshot; filter metadata was checked. Both real PDFs were reopened and their text checked against real values and filters. PDF pages were rendered and visually inspected. Sample exports in this evidence directory are actual data, not production sample responses.

Reused assets: `apps/web/public/assets/export/pdf.png`, `xls.png`, existing per-type vehicle PNGs via `VehicleIcon`, the existing vector icon library, native date picker, system fonts, and fleet bottom tabs. Native dependencies added: Expo-compatible `expo-file-system` and `expo-sharing`. Server-only dependencies added: `pdfkit`, `exceljs`, and PDFKit TypeScript definitions. No extra map/icon library or environment key was added.

## Checks

Automated fixtures are confined to test files and isolated PGlite databases, clearly separate from the read-only real-database verification script.

* Mobile: 46 files / 183 tests passed, including date boundaries, filters, empty/partial/loading/error states, menu choices, selected vehicle IDs and export snapshot/double-tap behavior.
* Targeted API reports, calculations and permissions: 79 tests passed, including scoped SQL, no data, validation, authentication, cross-account snapshot rejection and real PDF/XLSX byte signatures.
* Mobile TypeScript and targeted ESLint passed.
* API TypeScript build passed.
* Android and iOS production JavaScript export passed.
* Full API regression: 31 files / 279 tests passed.
* Targeted API and mobile ESLint passed.
* `git diff --check` passed.

Repeat real verification (read-only, using configured local DB credentials without printing them):

```powershell
cd D:\RI
.\scripts\pnpm.ps1 --filter @fleet/api exec tsx scripts/verify-mobile-reports.ts
```

## Files changed for reports

Mobile: `app/(app)/report.tsx`, `reports.tsx`, `_layout.tsx`, `index.tsx`; `components/fleet/ReportSheet.tsx`; `features/reports/{ReportView,ReportFilter,ReportCards}.tsx`, `dates.ts`, `dates.test.ts`, `service.ts`, `export.ts`; `test/reports.test.tsx`; `app.config.ts`; `package.json`.

Shared: `packages/shared-types/src/mobile-reports.ts`, `index.ts`.

API: `src/modules/reports/{mobile,mobile-calculations,mobile-calculations.test,mobile-export}.ts`; `src/routes/mobile-reports.ts`, `reports.ts`, `reports.integration.test.ts`; `src/middleware/permissions.ts`; `scripts/verify-mobile-reports.ts`; `package.json`.

Workspace: `pnpm-lock.yaml`, this document, real verification outputs under `artifacts/mobile-reports/`. Unrelated pre-existing Driver/Nearby changes were preserved.
