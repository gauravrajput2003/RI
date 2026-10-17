# Mobile drivers and vehicle assignments

The inspected checkout contained the dashboard's Driver menu icon, routed to a generic placeholder. No driver table, assignment model, API, screens, or avatar asset existed. The new implementation uses the existing Expo Router, authenticated Axios client, TanStack Query, Express/Zod error handling, PostgreSQL transaction helper, and recursive user/vehicle ownership scope. No new package or service credential is required.

## Flow and UI

- Dashboard → vehicle → existing **Driver** icon opens the centered red-header Driver modal. Current assignment loads by the actual vehicle UUID. Name/mobile/licence appear when assigned; no old driver's details are shown for another selected vehicle.
- **⊕ Assign Driver** opens **Driver List** in vehicle-selection mode. Cards use the reference's white/shadow layout with driver avatar on the left and Name/Mobile on the right. A small check/border indicates selection; a red assignment confirmation is the only added control needed for this mode.
- The floating red **+** opens the same **Add Driver** form, with Name, Mobile, Licence Number and red SAVE in the reference order/style. Creation alone does not assign a driver. Saving returns to the list, invalidates cached data, and lists newest records first.
- Confirming an assignment returns to the prior vehicle screen. The preserved Driver modal remounts on focus and fetches the saved assignment. Reopening it always uses the vehicle's authenticated current-assignment API.
- Profile → **Driver List** provides standalone driver management. The existing dashboard vehicle action grid is unchanged. A local SVG driver avatar recreates the reference style using the already installed SVG library; no external image or new dependency is used.

Loading, empty, error/retry and read-only states are included. Field values are retained on save failure. Ref guards prevent same-frame duplicate submits; session checks and focus generations prevent late writes from navigating a different screen. Query keys include the authentication session and vehicle; requests use AbortSignals. Switching vehicles cancels obsolete assignment reads. Lists deduplicate pages by driver ID and refresh on focus, pull-to-refresh, creation and assignment.

## Validation and authorization

Both app and API use `validateDriver` from shared types. Name is trimmed, required, 1–120 characters, with control characters rejected. Mobile follows the project's optional-plus/space/parentheses/hyphen convention with 7–15 actual digits; stored mobile is canonical digits plus an optional leading +. No country is guessed. No licence registry/format validator previously existed: licence syntax accepts 5–30 letters/digits with spaces, slash or hyphen up to 40 displayed characters, uppercases/trims, and rejects unsupported characters. This is syntax validation, not registry verification.

Drivers belong to an account. Lists use the existing recursive ownership scope. Creating from a vehicle context derives the driver owner from the authorized vehicle on the server; the client cannot submit an owner ID. Contextual driver lists include drivers of that vehicle's owner. Standalone creation belongs to the signed-in account. Driver/vehicle owners must match for assignment, even when a parent Admin can see both. An owner-scoped normalized licence unique constraint prevents duplicate drivers. Identical retries return the existing persisted record; conflicting details return 409.

Read endpoints require existing vehicle-view or dashboard-view grants. Create/assign requires vehicle-edit grants for Admin accounts; Client/Super Admin behavior follows existing middleware and ownership rules. No new permission catalogue entries are invented. The modal/add controls respect the same capability checks. All routes are behind authentication; read responses are `no-store` and mutations additionally have a per-account 30/minute limiter. No driver details or phone numbers are explicitly logged.

## APIs and persistence

- `GET /api/v1/drivers?vehicleId=...&limit=50&cursor=...` — scoped keyset pagination (newest creation timestamp / UUID first).
- `POST /api/v1/drivers` — `{name,mobile,licenceNumber,vehicleId?}`; 201 on creation, 200 on identical retry, 409 on a conflicting licence.
- `GET /api/v1/vehicles/:id/driver` — `{assignmentId,assignedAt,driver}` or null fields when no current assignment.
- `PUT /api/v1/vehicles/:id/driver` — `{driverId,expectedAssignmentId}`; the latter is the assignment ID last read, or null when unassigned.

No existing assignment policy was present. The implemented policy is one active driver per vehicle and one active vehicle per driver. Busy drivers cannot silently move between vehicles. Replacing a vehicle's driver ends its prior assignment and inserts a history row in one transaction. Partial unique indexes, vehicle/driver row locks and expected-assignment checks protect concurrent requests. Repeating the same current assignment is idempotent. An explicit unassign/edit/delete operation was not requested and is not introduced.

If vehicle ownership changes, former-owner driver details and foreign vehicle details are hidden. The new owner can deliberately replace an old assignment with an accessible driver using the opaque assignment version; history remains intact.

Migration **027_driver_management.sql** adds `drivers` and `vehicle_driver_assignments`, foreign keys, history timestamps, owner/licence uniqueness and the two active-assignment unique indexes. Previous migrations are untouched. It was applied to the configured **local** database through the existing runner after verifying it was the only pending migration. Apply it to other deployments with the normal migration command before deploying these endpoints:

```powershell
cd D:\RI
.\scripts\pnpm.ps1 --filter @fleet/api migrate
```

The runner is forward-only and wraps DDL in a transaction. Tests verify DDL rollback and data/constraint integrity. For a code rollback, leave these additive tables and their records in place; dropping them would destroy driver/assignment history and is not done automatically.

## Verification and manual checks

Automated tests cover normalized creation/identical retries, authorization, scopes, pagination, read-only permissions, assignment reload and reassignment history, competing assignments, busy drivers, ownership transfers, foreign keys/unique constraints, migration rollback, form errors/value retention, double taps, selection, API paths, session changes and vehicle-switch cancellation. Test data and provider/network substitutes exist only in tests, never in production responses.

On a physical phone, reload Expo and test Dashboard → Driver → Assign Driver → + → create → select → ASSIGN DRIVER → return/reopen. Also check Profile → Driver List, cancellation/back navigation, failed requests, a different vehicle, an already-busy driver, and re-login persistence. Native modal transitions, keyboard behavior and visual spacing still need phone review. Existing standalone APKs need an app update; no new native module/rebuild configuration is required. No commit/push is performed.

## Files changed for Driver management

- `database/migrations/027_driver_management.sql`
- `packages/shared-types/src/drivers.ts`
- `packages/shared-types/src/index.ts`
- `services/api/src/modules/drivers/repository.ts`
- `services/api/src/modules/drivers/drivers.integration.test.ts`
- `services/api/src/routes/drivers.ts`
- `services/api/src/routes/api.ts`
- `services/api/src/middleware/permissions.ts`
- `apps/mobile/app/(app)/drivers.tsx`
- `apps/mobile/app/(app)/add-driver.tsx`
- `apps/mobile/app/(app)/index.tsx`
- `apps/mobile/app/(app)/_layout.tsx`
- `apps/mobile/app/(app)/profile.tsx`
- `apps/mobile/components/fleet/DriverSheet.tsx`
- `apps/mobile/features/drivers/DriverUI.tsx`
- `apps/mobile/features/drivers/AddDriverView.tsx`
- `apps/mobile/features/drivers/DriverListView.tsx`
- `apps/mobile/features/drivers/service.ts`
- `apps/mobile/features/drivers/queries.ts`
- `apps/mobile/features/drivers/service.test.ts`
- `apps/mobile/test/drivers.test.tsx`
- `apps/mobile/test/driver-entry.test.tsx`
- `docs/mobile-drivers.md`

## Completed checks

- Mobile: 44 test files / 167 tests passed.
- API: 30 test files / 271 tests passed, using one worker with 120-second setup and 30-second test timeouts for PostgreSQL/WASM integration tests on this machine.
- Mobile TypeScript, API TypeScript build, and mobile/API/shared-types ESLint passed.
- Expo Android and iOS production bundle exports passed.
- The configured local database reports no pending migrations and the `drivers` table is present.
- No production driver records were inserted by implementation/tests; database integration tests use isolated PGlite instances.
- Native phone visuals, keyboard/modal transitions and re-login behavior still need the physical-device checks above. No commit or push was performed.
