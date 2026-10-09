# Cellular area addresses

RI can display a serving-cell area estimate while keeping the vehicle's GPS
position, speed, distance, route and geofence calculations independent.
This does **not** establish that DoTrack uses cellular positioning. A screenshot
of a road address cannot establish its source, nor guarantee matching wording/PIN.

## What the repository and hardware evidence establish

- GT06 v1.8.1 PDF, sections 5.2/5.3 (PDF pages 13, 16–18): `0x12` has
  MCC (2 bytes), MNC (1 byte), LAC (2 bytes), Cell ID (3 bytes) at body offset 18.
  `0x16` has a length byte first (9), then the same identifiers at offset 19.
  The decoder now preserves these in `locations.metadata.cell` without changing
  the GPS decoder. Short GPS-only packets remain supported. `0x22` extensions
  are not interpreted as LBS without a verified variant specification.
- W15's existing `0x22` adapter preserves `mcc,mnc,lac,cellId` in metadata when
  its extension is present. That parser is unchanged. Its opaque `0x26` remains
  opaque; no radio or neighbouring-cell layout has been invented.
- Neither existing adapter reports radio technology, TAC, ECI, NCI or neighbours.
  The GT06 schema's one-byte MNC cannot represent every three-digit MNC; do not
  truncate a network code or guess it from the configured SIM operator.
- Before this change the test bike's saved GT06 rows contained no cell metadata.
  Raw frames were not archived, so those historical cells cannot be recovered.
  The checked-in full GT06 fixture contains MCC=404, MNC=96, LAC=1620,
  Cell ID=41271. This is fixture evidence, not proof of this bike's current cell.
- After the decoder update, a real authorized dashboard read for HR12AX6674
  returned MCC=404, MNC=192, LAC=1620, Cell ID=41273 and `radio=null`.
  Thus this hardware does transmit the four identifiers; modem technology and
  actual provider coverage remain unverified. Its display status was correctly
  `radio_required`, with GPS coordinates retained separately.
- `NormalizedLocation.metadata` already travels through TCP ingestion → location
  persistence → internal HTTP telemetry → Socket.IO. No transport schema change
  is required. SIM number/operator fields are account configuration, not cell IDs.

## Configuration

Apply `database/migrations/022_cell_location_cache.sql` using the existing runner:

```powershell
npm run migrate
```

Set these in root `.env` (never put keys in web/mobile env or chat):

```dotenv
ADDRESS_SOURCE=cell
OPENCELLID_API_KEY=
GT06_CELL_RADIO=
```

Retain the existing private `GEOAPIFY_API_KEY`: it reverse geocodes **resolved
cell coordinates** with `type=street`, not GPS coordinates, in cell mode.
Register a key at https://my.opencellid.org/ and configure it locally.
Only set `GT06_CELL_RADIO=GSM`, `UMTS` or `LTE` after verifying the actual modem
technology with the hardware supplier. This deployment-level setting is suitable
only when all GT06 devices use that verified technology. Leave blank in a mixed
or unknown deployment; use a verified per-device radio extension before enabling
mixed radios. W15 identifiers without an explicitly supported radio field remain
`radio_required`; the GT06 setting never applies to W15.

Restart the API after env changes, and keep the tracker receiver running to collect
new LBS packets. `ADDRESS_SOURCE=gps` restores the previous GPS-address policy.
The code default is GPS for compatibility; the local env selects cell mode.

## Resolution and fallback policy

- Cell identity is radio/MCC/MNC/LAC/Cell ID from one reported observation.
- OpenCellID GET `/cell/get` resolves that identity. Missing/unknown radios are
  deliberately not queried: an unspecified radio can return an ambiguous first match.
- Positive results cache for 30 days; no-result cache for 5 minutes; estimates
  without an address retry after one hour. Requests deduplicate by cell identity,
  queue at most 100 unique cells and run at most once per second per API process.
  Each provider call times out after 3 seconds; failure backs off for 60 seconds.
  This development worker is not a distributed quota scheduler. Multi-instance
  production deployments need a shared worker/quota budget. Provider daily limits
  still apply; repeated different cells can exhaust them.
- Changing cells uses a different cache key. Failures never update GPS records
  or overwrite an existing estimate with invented coordinates. A not-found refresh
  retains old estimate fields for diagnostics but does not display them as fresh.
- Live cell observations expire after 30 minutes without another cell packet.
  Heartbeats without LBS do not refresh the cell-observation time. The latest cell
  is scoped to the current device assignment and vehicle. A missing LBS extension
  does not erase a previously reported cell until that observation becomes stale.
- Historical playback/reports use identifiers stored on each historical packet,
  never the vehicle's current serving cell. Their resolution time is the time the
  provider was queried; it is not proof of the tower's position at the historical
  date. Historical packets without identifiers show unavailable, not a guessed cell.
- `address` contains `Cell area (approx.): ...` only on successful resolution.
  Otherwise it explicitly says `Cell area unavailable (...)` with reasons including
  missing cell, stale, radio required, unconfigured, pending, not found or address
  unavailable. GPS addresses are never silently substituted in cell mode.
- `gps_address` retains an already stored GPS address separately. `address_source`,
  `tower_status`, `tower_cell`, `tower_observed_at` and `tower_location` carry source,
  identities, observation time, separate estimate coordinates, provider radius
  and resolution time. A stale diagnostic estimate must not be mapped as GPS.
- GPS pins/routes and GPS-derived calculations remain unchanged. One shared policy
  service feeds dashboard, latest location, history, playback and report addresses.

## Provider suitability, cost and attribution (checked October 9, 2026)

OpenCellID documents 1,000 request credits per user/day; larger/commercial plans
require contacting the provider. No paid subscription is created by this code.
Coverage varies by area, operator and technology; some valid cells have no record.
Importantly, its API documentation says coordinates for MCC 404–406 are rounded
to **two decimal places**, approximately kilometre-scale. Thus the reverse-geocoded
street/PIN can be a nearby area's label, not the exact tower address or vehicle
address. Do not promise the client street-level precision with this provider.
The returned `range` is preserved but does not remove that rounding limitation.

API results are CC BY-SA 4.0. UI credits link OpenCellID and that license; API
attribution includes both URLs; report address text retains credits for exports.
Geoapify/OpenStreetMap attribution also applies to the derived area address.
Comply with ShareAlike obligations when distributing adapted cell datasets.

Sources:
- https://wiki.opencellid.org/docs/api/cell-position
- https://wiki.opencellid.org/docs/api/errors
- https://wiki.opencellid.org/docs/getting-started/access-and-limits
- https://wiki.opencellid.org/docs/getting-started/coverage
- https://wiki.opencellid.org/docs/attribution

## Live acceptance test

1. Verify model/radio and configure the private key. Confirm a **new real packet**
   has all identifiers; fixtures and a SIM's brand do not establish this.
2. Check `tower_cell` and observation time in the authorized dashboard/latest API.
3. Wait for the background lookup and refresh (dashboard polls every 15 seconds).
4. Verify `address_source=cell`, `tower_status=resolved` and provider resolution
   time. Compare `tower_location` with GPS coordinates without replacing either.
5. Travel into another serving cell and verify its identity/cache key changes.
6. Repeat with actual Jio and Airtel hardware/network observations. Automated
   provider-contract tests do not establish real-network coverage.
7. Remove the key / simulate missing identifiers / wait 30 minutes without cell
   data. Verify explicit unavailable states and unchanged GPS routes/distances.

Live Jio/Airtel provider coverage cannot be certified until the observed cell's
radio technology is verified and a valid provider key is configured.

## Implementation files

- `services/tracker/src/protocols/gt06/decoder.ts`: documented LBS extraction;
  `services/tracker/test/gt06-status.test.ts`: GPS/LBS layout compatibility.
- `services/api/src/modules/cellular/provider.ts` and `service.ts` (and their
  tests): validation, OpenCellID requests, cache worker and display policy.
- `database/migrations/022_cell_location_cache.sql`: independent cell cache and
  indexed current-serving-cell lookups; no historical migration edits.
- `services/api/src/config/env.ts`, `.env.example`, local `.env`: backend-only
  provider configuration and display source. Local credentials are not committed.
- `services/api/src/modules/geocoding/provider.ts`: optional street-level lookup
  used on resolved cell coordinates; existing GPS geocoding remains available.
- `services/api/src/modules/dashboard/repository.ts`,
  `services/api/src/modules/vehicles/repository.ts`, `services/api/src/server.ts`:
  scoped latest cell reads, centralized policy and realtime publishing.
- `services/api/src/modules/playback/repository.ts`,
  `services/api/src/modules/reports/{repository,service,calculations}.ts`:
  historical address source and exported report credits; GPS calculations retained.
- Web `AddressAttribution.tsx`, `DashboardPage.tsx`, `PlaybackPage.tsx`, types:
  source credits, independent cell/GPS realtime merges and playback address.
- Mobile `BikeCard.tsx`, `PlaybackView.tsx`, `normalize.ts`, `liveVehicleStore.ts`,
  models: same display policy, credits and independent cell/GPS update handling.
- API authorization/report integration tests and web/mobile address tests verify
  cell-mode scope, changed cells and preserved GPS position/history.

## Validation result

153 distinct relevant tests passed across API, tracker, web and mobile. This
includes PostgreSQL/WASM cache-upsert, ownership, historical playback/report,
geofence validation, protocol parsing and source-policy regressions. All four
projects passed type checks and lint; API/tracker/web production builds passed;
Expo Android JavaScript/Hermes export passed (this is not an installed native APK).
The local migration applied successfully. The running authorized dashboard HTTP
endpoint returned 200 with `address_source=unavailable` and
`tower_status=radio_required` for the real bike. No live OpenCellID resolution,
actual Jio/Airtel coverage or phone visual verification is claimed.
