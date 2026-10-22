# Vehicle Lock / Unlock: guarded unsupported implementation

The dashboard's existing red Lock icon opens `RelaySheet` for the selected vehicle. The dashboard grid and other actions are preserved. The dialog reads the actual registration, vehicle type and existing `vehicles.relay_configured` setting from the authenticated API. It includes separate Lock Vehicle / Unlock Vehicle controls, refresh, loading/error/offline states, confirmation text, duplicate-tap protection and recent request results.

**Physical locking is not enabled for any current adapter.** Both GT06 and W15 implement packet decoding and upstream packet acknowledgements only. `ProtocolAdapter`, `ProtocolRegistry`, `DeviceProtocolResolver`, connection contexts and `server.ts` have no verified model/firmware-specific relay command encoder, downstream dispatch mechanism, command serial/result correlation, or relay-result parser. A login/GPS/heartbeat acknowledgement is not a relay acknowledgement. The GT06 heartbeat's `oilElectricityConnected` bit is not treated as proof of a physical locked state.

The supplied wiring image and the protocol family name do not establish command syntax, relay polarity or safe operating restrictions. No guessed GT06 text commands, W15 commands, TCP socket access, speculative transport, raw command API or GPS parser changes were added. The shared `relayProtocolSupport` function explicitly returns unsupported even if a persisted device capability says `SUPPORTED`. The checkbox alone cannot enable dispatch.

## API, permissions and persistence

- `GET /api/v1/vehicles/:id/relay`: scoped vehicle/configuration, current adapter limitation, unknown relay state, last 20 audited attempts and a server-generated UUID for retry idempotency. No IMEI, credentials, internal device ID or command payload is returned.
- `POST /api/v1/vehicles/:id/relay/commands`: strict `{action: "lock" | "unlock", idempotencyKey: UUID, confirmed: true}` body. Requires authentication, recursive vehicle ownership and, for restricted Admin accounts, existing `vehicle.edit` permission. Client owners follow the existing vehicle-edit authorization convention. Reads use `vehicle.view` or `dashboard.view` for Admins. Forged vehicle IDs return 404; raw-command/owner/device fields are rejected.
- All current requests return HTTP 409 with `success:false` and an audited `rejected` result. No pending/sent/succeeded result is fabricated. Inactive vehicles, relay disabled, missing/multiple/inactive/foreign-owner assignments and unsupported adapters fail closed. A vehicle-row lock serializes owned requests; a unique actor/vehicle/idempotency key deduplicates retries and rejects conflicting action reuse. A partial unique index disallows competing pending/sent rows. Writes are limited to ten requests per authenticated user per minute.
- The UI never calls HTTP completion a confirmed physical result and never optimistically changes relay state. Both controls are disabled for current hardware. Phone-offline, loading, stale/error responses, missing account permission and demo mode also block submission. Existing account session handling and online checks are reused.

New forward migration `028_vehicle_relay_commands.sql` adds audit storage only. It reuses the existing Relay checkbox and does not modify vehicle settings, device assignments or GPS history. Records contain actor, vehicle, assigned device/protocol, requested action, retry key, status, timestamps and result explanation. The schema reserves the requested lifecycle statuses for future verified support; **a dispatcher, ACK lifecycle and timeout worker are not implemented or claimed**. Current code writes only actual rejected requests.

The migration was applied to the configured database on 22 October 2026. There is no automatic destructive rollback. If reverting application code, leave the audit table intact; deleting it would discard request history. Use a reviewed forward migration for any future schema adjustment.

## Safety limitation and what remains

There is no verified relay-capable model in this checkout. Consequently a stationary vehicle cannot be allowed to send a command either. Moving, stale, GPS-invalid, unknown-speed and disconnected vehicles cannot reach dispatch because **all** adapter dispatch is denied. There is deliberately no guessed safe-speed threshold or freshness threshold pretending to make unsupported hardware safe.

Before enabling a real model, obtain its exact model/firmware protocol manual and installation/polarity confirmation. Implement and test its safe operating restrictions, fresh assigned-device GPS/speed/ignition validation, active connection identity/reconnect handling, authenticated inter-service command routing, adapter encoder, correlated positive/negative acknowledgements, deadlines and persisted results. Revalidate assignment and safety immediately before sending, including after any queue delay. A receipt-only acknowledgement must never establish Locked/Unlocked. Keep unknown physical state until authoritative device-specific evidence exists.

No positive/negative relay ACK, real dispatch, restore command, disconnected-transport or timeout lifecycle is claimed as tested: there is no verified implementation to exercise. This is the explicitly requested safe unsupported-device path, not completion of physical relay control.

## Real database inspection

`services/api/scripts/verify-relay.ts` uses read-only queries to inspect persisted vehicles, Relay settings, current assignments, protocol/model/capability metadata and available packet times. Once migrated, it exercises the production scoped read service under read-only database transactions. It never submits a command or seeds records. Evidence is `artifacts/relay/verification.json`.

All eight persisted vehicles currently have `relay_configured=false`. Assigned trackers are GT06 with no model recorded and no declared relay capability. The actual bikes HR12AU6674 and HR12AX6674 are among these records. The scoped read returns `RELAY_DISABLED`, `state:unknown`, `canLock:false`, `canUnlock:false`. Enabling the checkbox later would still return `RELAY_UNSUPPORTED`; it cannot activate guessed hardware control.

Repeat inspection with:

```powershell
cd D:\RI
.\scripts\pnpm.ps1 --filter @fleet/api exec tsx scripts/verify-relay.ts
```

## Verification

Isolated PGlite fixtures test real Express authentication/permission/scoping middleware and production SQL against the new migration. They cover persisted configuration, unknown state, unsupported GT06/W15/unknown adapters despite provisioned capability, owner and permission isolation, wrong/multiple/missing/inactive assignments, inactive vehicles, concurrent idempotent retries, conflicting key reuse, confirmation/body validation and pending-command conflict handling. Pending rows are isolated test fixtures only.

Mobile tests cover selected vehicle identity/type, disabled and unsupported controls, loading/API errors, offline and view-only clients, confirmation, duplicate taps and unconfirmed/error results. A UI-only enabled-capability fixture exercises confirmation handling; production never enables these capabilities. The dashboard integration verifies Lock and Driver receive the selected vehicle independently. No tests connect to real tracker hardware.

All 48 mobile test files / 193 tests passed. All 75 targeted API tests passed across the final serial run and authorization rerun: six relay, eight driver, thirteen report, and forty-eight authorization tests. Initial concurrent runs hit test timeouts; the existing authorization suite passed with a 20-second per-test allowance (its password-processing case takes about six seconds on this machine). API TypeScript build, mobile TypeScript, targeted API/mobile/shared ESLint, git diff whitespace checks, and Android/iOS production JavaScript exports passed. Physical Android/iOS visual checks remain manual. Restart the API and reload Expo; no dependency or native module was added. A standalone app needs its usual JavaScript update/rebuild.

## Files for this feature

- Mobile: `app/(app)/index.tsx`, `components/fleet/RelaySheet.tsx`, `features/relay/queries.ts`, `test/relay.test.tsx`, `test/driver-entry.test.tsx`.
- API: `src/modules/vehicles/relay.ts`, `relay.integration.test.ts`, `src/routes/relay.ts`, `src/routes/api.ts`, `src/middleware/permissions.ts`, `scripts/verify-relay.ts`.
- Shared: `packages/shared-types/src/relay.ts`, `index.ts`.
- Database/documentation: migration 028, this document and read-only verification evidence. No commits or pushes were made.
