# PHASE 2 HARDENING REPORT

Verified on 2026-09-11 in D:/RI (Windows, Node 22.13.1).

Overall Phase 2: **PARTIAL**. The requested local mobile hardening implementation and executable checks are complete. Native app builds, installed-device behavior, and device performance have not been verified. An existing backend authorization concern outside the mobile integrations also needs review before production exposure. Successful Hermes exports are not APK/AAB/IPA builds. No Phase 3 work, PostgreSQL/PostGIS startup, migrations, Redis, or cloud builds were performed.

## Results

| Area | Result | Evidence / limit |
| --- | --- | --- |
| Expo SDK 57 | PASS — local compatibility and bundles | Expo 57.0.22, React Native 0.86.3, React 19.2.3; compatible module family in package.json and lockfile. |
| Offline detection | PASS — automated | Actual runtime tested through NetInfo/AppState boundary adapters; offline banner, exact latest-received age, no realtime claim while disconnected. Native radio transitions still need device QA. |
| Persistent cache | PASS — automated | Versioned, session-isolated, whitelisted snapshots; bounded to 2,000 vehicles and 1,000,000 UTF-16 code units, 24-hour load TTL; corrupt/future schemas ignored. |
| Authentication tests | PASS | 11 tests exercise the real Zustand auth store and Axios interceptors, mocking only HTTP/storage boundaries. |
| Socket lifecycle tests | PASS — automated | 5 transport tests plus 2 actual runtime integration tests; real native Socket.IO reconnection still needs device QA. |
| Map follow tests | PASS — automated | 3 pure viewport/follow tests and rendered map-handler integration; native map gestures still need device QA. |
| Map performance | PARTIAL | Viewport culling, stable map instance, independent marker subscriptions, O(1) title lookup, selected marker retention and antimeridian handling verified. Dense native viewports have not been profiled. |
| Large-fleet list performance | PARTIAL | Render test proves a vehicle A update does not rerender row B; memoized/virtualized rows, debounced search and cursor pagination implemented. Native FPS/memory at large fleet sizes has not been measured. |
| Rate limiting | PASS — scoped checks | Existing limiter family retained, store injection seam added; real middleware/mounting tests cover auth, API, history and telemetry bypass. Single-process in-memory limits only. |
| Security | PARTIAL | Mobile checks pass: SecureStore-only credentials, fail-closed auth, session-guarded refresh/responses, query/socket/live/cache cleanup, whitelist persistence, HTTPS production guard, iOS ATS restrictions and Android backups disabled. Existing generic backend resource reads lack owner filtering; see remaining action 5. No production penetration test performed. |
| TypeScript | PASS | Workspace recursive typecheck; final mobile TypeScript 6.0.3 check after changes. |
| Lint | PASS | Workspace recursive lint; final mobile/API lint after changes. |
| Tests | PASS | Latest mobile run: 29 tests / 8 files. API: 9 tests / 4 files. Tracker: 20 tests / 8 files. Three shared packages have no tests; these are not counted as test coverage. |
| Expo config | PASS | Public config parsing and Android/iOS native configuration introspection exit 0. |
| Expo diagnostics | PASS | Final Expo Doctor 1.20.4 run: 21/21 checks passed. |
| Dependency validation | PASS | Expo install --check: dependencies up to date. Pinned pnpm frozen/offline install: lockfile up to date. Final installation has no peer mismatch warnings. |
| Android | NOT VERIFIED — native build/device | Android Hermes export succeeds (1,759 modules, approximately 4.3 MB). No JDK, Android SDK, adb or Gradle available on this host. No APK/AAB built or installed. |
| iOS | NOT VERIFIED — native build/device | iOS Hermes export succeeds (1,662 modules, approximately 4.1 MB). Windows has no Xcode; no configured/authorized EAS signing workflow was used. No IPA built or installed. |

## Exact remaining actions for PARTIAL / NOT VERIFIED

1. Android: [app.config.ts](D:/RI/apps/mobile/app.config.ts), [app.json](D:/RI/apps/mobile/app.json), [eas.json](D:/RI/apps/mobile/eas.json), and [environment example](D:/RI/apps/mobile/.env.example). Supply the real application ID, restricted Android Google Maps key, HTTPS API/socket URLs, and signing/project configuration. Use a machine with the required Android SDK/JDK or an explicitly authorized EAS project. Build and install the development client, then run the device checklist below. The current application ID is still com.example.fleettracker; no credentials or IDs were invented.
2. iOS: the same configuration files. Supply the real bundle ID, HTTPS endpoints and signing configuration; use macOS/Xcode or an explicitly authorized EAS project. Build/install and run the checklist. iOS uses Apple Maps; no Google Maps key is required for the current provider.
3. Dense map performance: [map.tsx](D:/RI/apps/mobile/app/(app)/map.tsx) and [viewport.ts](D:/RI/apps/mobile/features/map/viewport.ts). Profile dense 1,000/10,000-vehicle datasets on representative native devices. The current react-native-maps API has no built-in clustering interface; no new clustering dependency was introduced without native compatibility/performance validation. Viewport scanning remains O(n), and many colocated visible markers can still overload the native renderer. Clustering/spatial indexing is the next scalability enhancement if profiling requires it. No arbitrary 500-marker cap was reintroduced.
4. Large-fleet list performance: [vehicles.tsx](D:/RI/apps/mobile/app/(app)/vehicles.tsx) and [LiveVehicleRow.tsx](D:/RI/apps/mobile/components/LiveVehicleRow.tsx). Measure scrolling FPS, memory and latest-state request volume on devices with large, paginated fleets. Render isolation is proven; device-level throughput is not. Search intentionally applies to loaded pages, and the UI says so.
5. Existing backend authorization: [routes/api.ts](D:/RI/services/api/src/routes/api.ts), the loop defining GET /devices, /events, /groups and /subscriptions. These authenticated handlers execute generic SELECT queries without an owner/tenant predicate. The mobile app does not call them, and this pass did not redesign their contracts. Before exposing them in production, review each resource's ownership relationship, enforce tenant scoping, and add cross-account denial tests. This finding prevents an overall security PASS; it does not require starting databases or Phase 3 now.

## What changed

- SDK family, Metro and Babel: [package.json](D:/RI/apps/mobile/package.json), [pnpm-lock.yaml](D:/RI/pnpm-lock.yaml), [babel.config.cjs](D:/RI/apps/mobile/babel.config.cjs), [metro.config.cjs](D:/RI/apps/mobile/metro.config.cjs), and [tailwind.config.cjs](D:/RI/apps/mobile/tailwind.config.cjs). NativeWind uses its matching CSS interop 0.2.6 runtime. Native export exposed two dependencies hidden by ordinary typechecks: the Babel JSX plugin and generated CSS-interop runtime imports. Both are explicitly declared. React Native's Metro peer is explicitly 0.86.3, not the incompatible auto-selected 0.87.1. No force, ignored-peer checks, exclusions or blanket hoisting were used.
- Package-manager repair: this repository pins pnpm 9.15.4; the global shim was 11.19.0 and disagreed with the existing virtual-store metadata. The system npm shim was also broken, and bundled Corepack failed signature verification. [scripts/pnpm.ps1](D:/RI/scripts/pnpm.ps1) resolves the Node installation's npm CLI and invokes the exact repository pin. It was tested and returns 9.15.4. Global package-manager settings and the repository were not deleted or recreated.
- Authentication: [session.ts](D:/RI/apps/mobile/features/auth/session.ts), [create-client.ts](D:/RI/apps/mobile/services/api/create-client.ts), [auth-actions.ts](D:/RI/apps/mobile/services/api/auth-actions.ts). Single-flight refresh is shared by REST 401s and unauthorized socket handshakes. Original requests retry once; delayed old-token 401s reuse the rotated token. An executable race test caught and drove the fix for a refresh completing after an account switch. Late successful responses from old sessions are discarded. SecureStore writes are serialized; device-storage failure clears memory and displays a retryable credential warning.
- Session/network lifecycle: [runtime.ts](D:/RI/apps/mobile/services/runtime.ts), [session lifecycle](D:/RI/apps/mobile/services/session/lifecycle.ts), [socket lifecycle](D:/RI/apps/mobile/services/socket/lifecycle.ts). One session-owned transport, guarded callbacks, listener cleanup, background/offline disconnect and foreground/network reconnect. Logout/account changes synchronously stop the transport, cancel/clear queries, clear live data/selection, and remove the prior session snapshot. Authenticated routes wait for their own session's cache load before rendering.
- Cache: [snapshot.ts](D:/RI/apps/mobile/services/cache/snapshot.ts). SecureStore owns the session identity and credentials; AsyncStorage holds only vehicle/current-location snapshots. Saves happen when data changes, at most on the 30-second interval plus background/teardown flushes, not per GPS event. Writes/removals are serialized. History, tokens, metadata and unknown fields are excluded. Old credential storage without the new versioned envelope requires signing in again.
- Data boundary: [normalize.ts](D:/RI/apps/mobile/features/vehicles/normalize.ts) accepts the existing snake_case REST/camelCase socket formats and PostgreSQL numeric strings, validates coordinates/timestamps and preserves unsupported values as unavailable. The live store rejects older receipts and preserves known fields across partial/status packets.
- Map/list: granular subscriptions and stable component identity. Manual onPanDrag disables follow; programmatic region completion does not. Selecting a marker or pressing Follow intentionally re-enables following. REST latest-location queries are keyed per vehicle and reused between mounted consumers. There is no GPS polling and no fleet invalidation on location events. Reconnection invalidates only active latest-state queries. Fleet pages are loaded explicitly in batches of 50.

## Backend boundaries (not fabricated)

- The real supported mobile calls remain login/refresh/logout, vehicle listing, and per-vehicle latest location. The history route exists, but no playback/report UI or large history cache was added.
- Reports, notifications, forgot-password, settings and profile contracts are absent; no pretend endpoints or fake data were created. The profile screen explicitly says profile data is unavailable.
- [socket-server.ts](D:/RI/services/api/src/realtime/socket-server.ts) emits vehicle:location, not a separate vehicle:status event. The mobile status listener is tested as an integration boundary, not claimed as an end-to-end backend feature. Status values remain last-known values from latest-state REST responses or a payload carrying a real state; the client does not invent movement/online status from missing fields.
- There is no bulk fleet-latest-state endpoint. Fresh latest states are fetched for mounted rows/details and selected/initial map vehicles; the map also uses received socket events and cached positions. It does not claim that every fleet vehicle has a fresh position immediately on cold start. Dashboard counts explicitly describe loaded, last-known states and include Unknown.
- The existing [rate-limits.ts](D:/RI/services/api/src/middleware/rate-limits.ts) is still the only limiter family: auth 20/15 minutes, general API 300/minute, history 30/minute, currently per IP. Login and refresh share the auth limiter. Password reset/report protection must be attached when those routes actually exist. Internal telemetry is mounted before REST limits; individual Socket.IO vehicle updates do not pass through them. A fresh Store can be injected for each limiter later; no Redis was added. Multi-instance/global limits and trusted-proxy deployment configuration require deployment-specific review.

## Reproduce local validation

From D:/RI in PowerShell (the launcher may need access to the npm cache):

```powershell
.\scripts\pnpm.ps1 --version
.\scripts\pnpm.ps1 install --frozen-lockfile --offline
.\scripts\pnpm.ps1 -r typecheck
.\scripts\pnpm.ps1 -r lint
.\scripts\pnpm.ps1 -r test
.\scripts\pnpm.ps1 --filter @fleet/mobile run config:check
.\scripts\pnpm.ps1 --filter @fleet/mobile run native-config:check
.\scripts\pnpm.ps1 --filter @fleet/mobile run deps:check
.\scripts\pnpm.ps1 --filter @fleet/mobile run doctor --verbose
.\scripts\pnpm.ps1 --filter @fleet/mobile run bundle:check
```

Use `run doctor`: plain `pnpm doctor` is pnpm's own unrelated command. Native exports live in the ignored [metadata.json](D:/RI/apps/mobile/.expo-export/metadata.json) output tree. These diagnostic artifacts were not deployed. Real HTTPS EXPO_PUBLIC_API_URL / EXPO_PUBLIC_SOCKET_URL must be set before producing a runnable production build; the app rejects missing/insecure production endpoints.

Expo initially hit EPERM writing its cache/project metadata; checks were rerun with permission, not marked successful from a silent or hanging process. A cached diagnostic result also missed newer SDK patches; the final online compatibility check drove the patch/TypeScript updates. The final online Doctor result is 21/21. Existing test tooling prints Vite CJS and react-test-renderer deprecation warnings; these are visible, test-only limitations, not native-device proof.

## Native acceptance checklist

- Real login success/failure; expire access tokens and verify one refresh across simultaneous requests and socket reconnect.
- Airplane mode: offline banner, advancing last-update age, preserved last-known vehicles, no realtime claim. Kill/reopen offline, then restore network; check targeted latest-state resync without repeated fleet-wide requests.
- Logout and switch accounts while refresh, snapshot load and API requests are pending; verify no old rows, markers, queries or persisted session snapshot reappears.
- Background/foreground repeatedly; verify one socket, no duplicate events, and cleanup on sign-out.
- Select a marker, receive updates, manually pan, then re-enable Follow; verify there is no fighting the user's gestures and no map remount.
- Profile dense-map rendering and large-list scrolling/memory; repeat under slow/lossy network conditions.

SDK migration baseline: [official Expo SDK 57 release](https://expo.dev/changelog/sdk-57). Exact installed compatibility was checked against Expo's live dependency validation and the committed lockfile.
