# Mobile Nearby

**Updated behavior:** Both category icons now open the same external Google Maps search around the selected vehicle’s authenticated GPS, per the revised request. The first icon no longer navigates to the in-app OpenStreetMap results screen. The earlier implementation details below describe the retained in-app route, which is no longer entered from the category icons.

The inspected checkout had a `NearBy` dashboard action routed to the generic “not connected yet” notice. It contained no category modal, Nearby results screen, or two URL handlers. The attached screenshots were used to add those missing pieces rather than redirect both icons externally.

Entry points: Dashboard → vehicle → NearBy; Vehicles → vehicle actions → Nearby; Live Map → selected vehicle → Nearby. Existing vehicle action menus and map behavior are retained.

The centered category modal preserves the reference’s red header, ten-category order, icons, and two aligned action columns. The first icon calls `handleShowNearbyInApp`, which only navigates to `/(app)/nearby` with the selected vehicle ID/category. The arrow calls `handleOpenNearbyInGoogleMaps`, which fetches that vehicle’s GPS and opens Google’s universal Maps search URL with category and coordinates. That HTTPS URL supports the installed Google Maps app or the browser, without custom scheme permissions. Failed handoffs show an error. Stale external searches require acknowledgment of the recorded GPS time.

## In-app results

The existing bundled Leaflet/WebView map and OpenStreetMap tiles are reused. A blue V marker identifies the recorded vehicle GPS origin without inventing a vehicle activity state; separate red place markers correspond exactly to the displayed provider results. The rounded category title/close bar, recenter control, draggable/expandable white results sheet, distance/name sorting, text filter, 5/10 km radius selector, loading/empty/error/retry states, and real place actions are implemented. Closing returns to the prior screen. A web-preview boundary matches the app’s existing native-map screen convention; full Nearby maps are for Android/iOS.

Each card shows actual name, supplied address, category, and straight-line distance. **Details** loads supplied phone/opening hours lazily. **Call** appears only when a phone is returned. **Directions** uses the recorded vehicle GPS as origin and the actual place coordinates as destination. **Share** uses actual name/address and a map URL. No phone-location permission is requested. Complex opening schedules are shown verbatim; only the explicit `24/7` schedule is described as “Open 24 hours.” No time zone guesses or fabricated current opening states, ratings, review counts, or review snippets are shown.

## Provider and configuration

Reuse the existing **server-only `GEOAPIFY_API_KEY`** in the API deployment’s environment. Never use an `EXPO_PUBLIC_` or `VITE_` key. The key must permit Places and Place Details API requests from the backend. The mobile bundle receives normalized results only. No new dependencies, paid Google API, schema, telemetry, native module, or native rebuild is required. An installed standalone APK needs an app update to include the JavaScript; Expo users can reload.

Geoapify uses OpenStreetMap POIs. Its published Free plan allows commercial production use with attribution, 3,000 credits/day and up to 5 requests/second. Places requests with a maximum of 20 results cost one credit; a `details` request costs one additional credit. These share quota with the project’s existing geocoding. No subscription or billing upgrade is enabled by this change. Check the project quota before client rollout; coverage and business details vary by region. Required Geoapify/OpenStreetMap attribution links are shown with the results. Geoapify permits caching Places results.

| UI category | Geoapify category / query |
|---|---|
| ATM | `service.financial.atm` |
| Parking | `parking` |
| Hospitals | `healthcare.hospital` |
| CNG Pump | `service.vehicle.fuel` with supported `name=CNG` filter |
| Petrol Pump | `service.vehicle.fuel` |
| Charging Station | `service.vehicle.charging_station` |
| Service Points | `service.vehicle.repair` |
| Restaurants | `catering.restaurant` |
| Shopping Malls | `commercial.shopping_mall` |
| Police Stations | `service.police` |

CNG is not a dedicated supported Places category: name-based matches can omit CNG stations without CNG in the name. Petrol searches return general fuel stations, which may offer other fuels. Both limitations appear in the results UI; confirm fuel availability with the station. The provider does not supply Google-style ratings/reviews; unsupported rating/open-now filter chips are not fabricated.

## Security and request behavior

`GET /api/v1/vehicles/:id/nearby?category=...&radius=5000` is mounted behind existing authentication and dashboard/vehicle-view permissions. It derives coordinates from the existing ownership- and assignment-scoped `latestLocation` repository. Client-supplied coordinates are rejected. GPS must be valid, finite, in range and nonzero, attributed to the selected vehicle. Staleness is based on tracker GPS time, not a recent heartbeat or cellular address. Missing/future timestamps are marked uncertain.

`GET /api/v1/vehicles/:id/nearby/details?category=...&placeId=...` rechecks current vehicle ownership and only accepts a place from that principal/vehicle/category’s recent search. Search and details caches last five minutes and are bounded to 200 entries; in-flight requests are coalesced. The provider origin is fixed, radius capped at 10 km, output capped at 20 unique validated places, and fetch timeout eight seconds. Search/details share a 30-request/minute per-account limiter, plus the existing API limiter; the process additionally caps nearby upstream starts at four/second and four in-flight requests. For a multi-process deployment, use a shared limiter/cache store so limits apply across instances. Provider errors are sanitized to avoid leaking credential-bearing request URLs. API responses use `Cache-Control: no-store`.

Mobile actions have synchronous duplicate-tap guards. Closing, navigating away, switching category/vehicle/radius, or changing authentication cancels obsolete requests. Old results cannot overwrite current results. No fake provider responses exist outside tests.

## Testing on a phone

Restart the API after adding its new routes, then reload Expo. Confirm Hospitals and ATM in-app results, their two distinct icon behaviors, marker/card correspondence, pan/zoom/recenter, sheet drag, Details/Call/Directions/Share, empty and error states, stale/invalid GPS, back navigation, and rapid category switching. Check both installed Google Maps and browser-only devices. Provider keys/quotas, actual local POI coverage, external app handoffs and native gestures require physical-device testing; automated tests mock providers and native UI boundaries.

Sources: [Places API categories, radius/proximity/name and caching](https://apidocs.geoapify.com/docs/places/), [Place Details fields/pricing](https://apidocs.geoapify.com/docs/place-details/), [Geoapify pricing and attribution](https://www.geoapify.com/pricing/), [terms](https://www.geoapify.com/terms-and-conditions/), [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started).

## Files changed

- `.env.example`
- `apps/mobile/app/(app)/_layout.tsx`
- `apps/mobile/app/(app)/index.tsx`
- `apps/mobile/app/(app)/nearby.tsx`
- `apps/mobile/components/fleet/NearbySheet.tsx`
- `apps/mobile/components/fleet/VehicleActions.tsx`
- `apps/mobile/features/map/LiveMap.tsx`
- `apps/mobile/features/nearby/NearbyView.tsx`
- `apps/mobile/features/nearby/NearbyView.web.tsx`
- `apps/mobile/features/nearby/service.test.ts`
- `apps/mobile/features/nearby/service.ts`
- `apps/mobile/test/mobile-actions.test.tsx`
- `apps/mobile/test/nearby.test.tsx`
- `apps/mobile/test/render.test.tsx`
- `docs/mobile-nearby.md`
- `packages/shared-types/src/index.ts`
- `packages/shared-types/src/nearby.ts`
- `services/api/src/middleware/permissions.ts`
- `services/api/src/modules/nearby/provider.test.ts`
- `services/api/src/modules/nearby/provider.ts`
- `services/api/src/modules/nearby/service.test.ts`
- `services/api/src/modules/nearby/service.ts`
- `services/api/src/routes/api.ts`
- `services/api/src/routes/authorization.test.ts`
- `services/api/src/routes/nearby.ts`
- `services/api/src/routes/permissions.integration.test.ts`

Test setup repairs: the authorization GPS fixture now includes its spatial point, and the permissions integration fixture loads the existing state-since migration. These changes align fixtures with current production SQL; no production schema or telemetry behavior was changed.

## Validation completed

- Mobile: 41 files, 158 tests passed.
- API: 29 files, 263 tests passed. Database suites ran with `vitest run --maxWorkers=1 --minWorkers=1 --hookTimeout=120000 --testTimeout=30000` to avoid local CPU/memory contention and slow bcrypt/WASM setup timeouts.
- Mobile/API TypeScript and ESLint passed.
- API TypeScript build and Expo Android/iOS production bundle exports passed.
- `git diff --check` passed. No commit or push was performed.
- Providers and native UI boundaries are mocked in automated tests. No live POI lookup or physical-phone handoff/gesture test was performed during this change.
