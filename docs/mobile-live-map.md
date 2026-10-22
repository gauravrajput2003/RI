# Mobile Live Map implementation and verification

The Live Map now renders the selected registration, actual GPS observation time, status, independent map controls, and the complete reference-style bottom panel. Existing Leaflet/WebView/OpenStreetMap infrastructure, top-view vehicle SVGs, socket lifecycle, selected-vehicle store, sharing sheet, playback and notification routes are retained. No dependencies, migrations, protocol changes, ingestion changes, commits or pushes were added.

## Layout

The old screen had only a generic count/follow panel; the requested metric panel was absent. `LiveMapPanel.tsx` supplies address, themed speed gauge, Today/Total Km, four paired metric rows and all three bottom actions. The panel starts collapsed each time Live Map gains focus: only the address and first row (speed gauge, Today Km and Total Km) are visible. Swipe up on that summary to reveal all metric rows and actions; swipe down to collapse. Tapping the summary also toggles it for accessibility. Horizontal map gestures are not captured by the summary.

The panel overlays the map and is measured at runtime. On normal phone sizes it is an intrinsic-height view, **not a vertically scrolling container**. This avoids the unbounded-scroll/overflow problem. Under 600 logical pixels of available content height, rows become compact. Under 490 logical pixels, only the expanded details become height-bounded and scrollable; the address and first row remain available for the collapse gesture. Lower rows are not silently clipped. Bottom safe-area insets keep actions above the system navigation area. Text scaling is bounded for the compact gauge/address to preserve layout.

The application-wide connection banner is hidden only on the map route, where the map header supplies state/GPS time and an explicit offline-cache indicator. Other screens retain their banner.

The measured panel height is sent to Leaflet as camera padding, so recentering places the vehicle in the exposed map area rather than underneath the panel. Expansion and collapse recenter the vehicle when Auto Center is enabled, while preserving a manually panned camera when it is disabled. Map attribution is moved above the overlay. Existing zoom controls remain accessible below the north-up indicator. Pan disables auto-centering; selecting a vehicle or pressing recenter restores it. The map remains mounted as data and status change. This vehicle-specific screen renders only the selected vehicle; other cached fleet GPS fixes never become markers, even when nearby or unreachable. Without a valid selected fix, no other vehicle is substituted. Missing vehicle types use the same car display default as the dashboard, and EVCar/Jeep aliases use the car SVG.

## Status and freshness

Backend `deviceActivity` already uses `NO_SIGNAL_TIMEOUT_MINUTES` (30 by default) and returns OFFLINE at or beyond that last-communication deadline, including heartbeats. No conflicting frontend offline timer was added. Existing shared runtime refreshes the fleet every 30 seconds while online; the newest server `status_checked_at` wins between vehicle and socket/API observations.

Shared marker, path and gauge palette:

| Backend state | Theme |
|---|---|
| MOVING / RUNNING / OVERSPEED | Green `#22c55e` |
| IDLE | Yellow `#eab308` |
| STOPPED | Red `#ef4444` |
| OFFLINE / UNREACHABLE | Blue `#3b82f6` |

There is also a neutral gray **Status unavailable** display for fresh communication whose motion/ignition classification is unknown. It is not silently classified as stopped, idle or no-signal. The shared fallback timeout changed from ten to thirty minutes, uses the existing 5 km/h movement threshold, and requires explicit ignition evidence for idle/stopped. Recognized backend states remain authoritative.

When the phone itself loses connectivity, cached observations are labelled as offline cache; the client does not pretend it knows about heartbeats it could not receive. An unreachable vehicle retains its last valid map coordinates and recorded GPS timestamp, but its current-speed gauge is unavailable. Coordinate-follow effects do not run for status-only packets or unchanged coordinates; there is no generated movement.

The latest-location API now returns the persisted `course` field, which was previously omitted and prevented ordinary API-loaded markers from using their recorded heading.

## Real metrics and path

New authenticated endpoint: `GET /api/v1/vehicles/:id/live-map`, authorized by the existing dashboard/vehicle view permissions and recursive vehicle ownership scope. Foreign vehicle IDs return 404. The response has `Cache-Control: no-store`.

The endpoint reuses `mobileHistorySql`, `mobileDailyRows` and the production playback distance query. Today uses Asia/Kolkata midnight to the actual observation time. The server caps source records at 250,000 and refuses oversized summaries explicitly. The mobile query is keyed by session, selected vehicle and India calendar date. It follows the existing selected-vehicle API refresh and socket observations, throttling invalidations to at most once per five seconds instead of creating a second polling/subscription loop. Selected GPS polling and metrics are disabled when the map loses focus.

* **Speed:** newest authoritative current speed; explicit null is preserved. An old moving fix is not used as a current-speed substitute after the server reports unreachable.
* **Address:** existing address/attribution on the selected latest-location observation; unavailable addresses stay unavailable. Existing approximate cell-area labels remain explicitly approximate if that is the configured address source.
* **Today Km / average / maximum speed:** existing valid-fix, device-partitioned PostGIS/playback rules. Invalid coordinates, `(0,0)`, impossible jumps and stationary jitter cannot fabricate a route distance. One fix cannot establish a traveled distance.
* **Today Running / Idle / Stop:** observed-history calculation shared with mobile reports. Unknown ignition and observation gaps leave unreliable complete totals null. No missing interval becomes a stopped duration.
* **Total Km:** configured authoritative `vehicles.odometer` in kilometres; if absent it remains null. Neither today's distance nor the screenshot's odometer is substituted.
* **From Last Stop:** most recent actual, valid GPS stop observation with ignition off and speed at/below the configured movement threshold, constrained to a current device assignment. Route distance comes from the same playback query from that observation onward. Duration is the observed elapsed time to the latest recorded fix, matching the existing dashboard meaning; it is not claimed to be engine-running time. No reliable stop, multiple contributing devices, a range older than 31 days, or excessive history leaves these fields unavailable.

Today Path contains only coordinates read from PostgreSQL. Rejected jumps, invalid GPS rows and device switches break the displayed polyline. More than 5,000 source packets suppress the display path with an explanation and a playback suggestion; metrics are still calculated from the bounded full source set. No interpolated/fake coordinates are created.

The displayed path is themed with the **current vehicle status**. It is not presented as historical segment-by-segment engine-state classification, which sparse ignition history cannot support. Settings explains this distinction. Leaflet now calls `setStyle` for an existing polyline when its theme changes; previously color updates only moved its geometry.

## Controls

* Target/recenter: in-app camera only, selected valid GPS coordinates, restores Auto Center.
* Arrow: selected vehicle GPS is the destination. It tries the native Google Maps scheme, then the universal Google Maps directions URL/browser fallback. It does not request phone location, does not supply the phone as destination, validates coordinates, prevents duplicate taps and reports URL-opening failures. Universal URL behavior follows [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started).
* Settings: Today Path and Auto Center are functional. Existing Nearby and Street View actions remain accessible here.
* Play Back, Share and Notification use the selected vehicle ID and retain their existing routes/authorization flows.

**Map layers:** Street uses OpenStreetMap; Satellite now switches to the same Esri World Imagery tiles used by the React web dashboard, with source attribution. Switching replaces only the base tile layer, preserving the camera, selected marker and path. No Google key or native dependency is required. Traffic remains disabled because there is no configured traffic feed. Satellite tiles require internet access and imagery availability varies by location.

## Actual database verification — 22 October 2026

`services/api/scripts/verify-live-map.ts` uses read-only PostgreSQL connections, dynamically selects a bike with real history, calls the authenticated production endpoint, and compares its metrics to playback SQL and its geometry to stored coordinates. Credentials/tokens are never written to the evidence file. No telemetry is seeded or modified.

This database selected **HR12AU6674**. There are **no recorded GPS fixes for 22 October** in this database, so today's metrics and path are correctly unavailable. Its configured odometer is also absent, so Total Km is unavailable. No reliable stop/ignition history is invented to fill From Last Stop or state durations.

The same production service was separately exercised for the bike's actual historical day **15 October 2026**: distance **59.81939831901002 km**, average speed **24.288888888888888 km/h**, maximum **65 km/h**. Every returned polyline coordinate was found in the stored GPS records. This historical verification is not a fallback response for today's app screen.

Evidence: `artifacts/live-map/verification.json`. Repeat with:

```powershell
cd D:\RI
.\scripts\pnpm.ps1 --filter @fleet/api exec tsx scripts/verify-live-map.ts
```

## Verification and manual checks

Automated fixtures are isolated tests, separate from read-only real-database verification. Tests cover collapsed initial render, upward/downward summary swipes, tap expansion/collapse, collapse on route refocus, horizontal/small gesture rejection, all metric/action rows after expansion, no normal-height scroll container, marker updates without remounting, map pan/follow/recenter, selected-vehicle navigation, native/browser URL fallback, invalid destinations, polyline recoloring and camera padding. API tests cover scoped reads, missing-day null metrics, real history aggregation, path validity and existing heartbeat/ignition transitions.

Verification results: all 47 mobile test files / 186 tests passed; 85 targeted API tests passed; 5 shared utility tests and 2 web marker tests passed. Mobile TypeScript, API TypeScript build, targeted mobile/API ESLint and `git diff --check` passed. Android and iOS production JavaScript bundles exported successfully.

A physical Android/iOS device was not controlled in this environment. Final visual spacing, system navigation-bar fit, Google Maps app launching and sharing still need a device check. The extremely small-screen layout intentionally allows scrolling instead of clipping.

Restart the API if it is not watching source changes and reload Expo. No newly installed native dependency requires a rebuild for these changes; a standalone APK still needs its normal rebuild/update to receive changed JavaScript.

## Files changed

Mobile: `app/(app)/_layout.tsx`; `features/map/LiveMap.tsx`, `LiveMapPanel.tsx`, `live-data.ts`, `navigation.ts`, `navigation.test.ts`, `LeafletMap.tsx`, `leaflet-document.ts`, `leaflet-document.test.ts`; `features/vehicles/queries.ts`; `test/render.test.tsx`.

Shared: `packages/shared-types/src/live-map.ts`, `index.ts`; `packages/shared-utils/src/vehicleIcons.ts`, `vehicleIcons.test.ts`. Web marker declarations/tests were aligned with the shared thirty-minute fallback and neutral unknown state: `apps/web/src/utils/vehicleIcons.d.ts`, `vehicleIcons.test.ts`.

API: `src/modules/vehicles/live-map.ts`, `live-map.test.ts`, `repository.ts`; `src/modules/playback/repository.ts`; `src/routes/api.ts`, `reports.integration.test.ts`; `src/middleware/permissions.ts`; `scripts/verify-live-map.ts`.

Documentation/evidence: this document and `artifacts/live-map/verification.json`.
