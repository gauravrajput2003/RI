# Super Admin Permission Management — implementation report

Implemented on 2026-10-05. No commit or push was performed. Existing mobile artwork, client vehicle changes, and pending migration 017 were preserved.

## 1. Existing authorization architecture

The API uses JWT authentication, active user accounts, SUPER_ADMIN/ADMIN/CLIENT/USER roles, and recursive `users.owner_id` ownership scopes. Ordinary admin management additionally limits writes to supported child relationships. Resource SQL enforces ownership. Socket.IO checks vehicle ownership at subscription and delivery. The former per-admin exception was `can_view_packet_health`. Web routes and navigation previously depended primarily on roles.

## 2. Selected permission architecture

Per-Admin, persisted allow lists supplement existing role and ownership checks. SUPER_ADMIN remains unrestricted. CLIENT and USER retain existing role and ownership behavior. A denied permission produces HTTP 403 before route validation or resource SQL. Missing grants deny access. No permission or trusted role state is taken from a stale JWT; authentication reloads the active account and role from the database.

Parent navigation groups are derived from allowed child routes. Actions require their resource's View grant. Independent module controls do not silently grant access to other modules.

## 3. Modified files for this feature

- `packages/shared-types/src/index.ts`
- `services/api/src/middleware/auth.ts`
- `services/api/src/routes/api.ts`, `routes/diagnostics.ts`
- `services/api/src/modules/admins/repository.ts`, `modules/vehicles/diagnostics.ts`
- `services/api/src/realtime/authorization.ts`, `vehicle-authorizer.ts`, `socket-server.ts`, `socket-notification.test.ts`
- `services/api/src/server.ts`
- `services/api/src/routes/authorization.test.ts`, `super-admin.integration.test.ts`, `alerts.integration.test.ts`, `reports.integration.test.ts`
- `services/api/test/migrations.integration.ts`
- `apps/web/src/app/App.tsx`, `main.tsx`, `services/api/client.ts`, `test/setup.ts`
- `apps/web/src/layouts/AppShell.tsx`, `AppShell.test.tsx`, `SidebarProfile.tsx`
- `apps/web/src/features/admins/AddAdminModal.tsx`, `AddAdminModal.test.tsx`, `CoinManagementPanel.tsx`
- `apps/web/src/features/dashboard/SelectedVehicleSummary.tsx`
- `apps/web/src/pages/AdminPage.tsx`, `ClientPage.tsx`, `VehiclePage.tsx`, `GeofencePage.tsx`, `AlertPages.tsx`, `AnnouncementPage.tsx`

Some files already contained unrelated user work. This list describes permission integration, not the whole workspace diff.

## 4. New files

- `packages/shared-types/src/permissions.ts`
- `database/migrations/018_admin_permissions.sql`
- `services/api/src/modules/authorization/permissions.ts`
- `services/api/src/middleware/permissions.ts`
- `services/api/src/routes/permissions.ts`, `permissions.integration.test.ts`
- `apps/web/src/lib/permissions.tsx`
- `apps/web/src/features/permissions/navigation.tsx`, `PermissionAction.tsx`, `permissions.css`, `permissions.test.tsx`
- `apps/web/src/pages/PermissionManagementPage.tsx`
- This report.

## 5. Database migration

Migration 018 adds the permission catalogue, normalized Admin grants, immutable application audit records, and an optimistic concurrency version on users. Composite keys prevent duplicate grants; foreign keys enforce valid accounts and catalogue entries. A validation trigger permits grant targets only for Admin accounts. A new-Admin trigger initializes full access, including packet health. Existing Admins receive full access except packet health, where an existing explicit grant or denial is preserved. Existing migrations were not rewritten.

## 6–8. Canonical registry, modules, and CRUD

`packages/shared-types/src/permissions.ts` defines keys, display names, groups, resources, actions, and existing route paths. API and web use this registry. A database integration test verifies exact catalogue parity with migration 018.

| Resource | Actions |
| --- | --- |
| Dashboard, Playback | View |
| Vehicle, Admin, Client, Geofence | View / Add / Edit / Delete |
| Configure Alert, Announcement | View / Add / Edit / Delete |
| Notification history | View |
| Distance, AC, Packet, Travel Summary, Daily Trip Summary reports | Individual View |
| Status, Idle, Running, Stoppage, Overspeed, Unreachable reports | Individual View |
| Coin distribution | View / Add |
| Packet health | View |
| Device, Event, Group, Subscription existing API resources | View |
| Account profile | View / Edit |

Only existing operations have grants. Unsupported operations appear as dashes in the action matrix. Read-only API resources and account operations appear in that matrix without invented sidebar pages. Report exports use the corresponding report View permission.

## 9–10. Backend middleware and protected APIs

Central middleware runs after authentication and before API routers. It covers endpoint aliases, selector dependencies, HEAD reads, and CRUD verbs. An unmatched Admin request fails closed. Existing route role checks and ownership SQL remain in force.

Protected endpoints under `/api/v1` include:

- `/dashboard/vehicles`, `/playback`, `/vehicles/:id/history`, `/vehicles/:id/latest-location`
- `/vehicles`, `/fleet-vehicles` and individual vehicle CRUD
- `/admins`, `/clients`, `/clients/:id/reset-password`
- Existing admin/client/vehicle owner and device option selectors
- `/geofences`, `/alerts`, `/alerts/:id/status`, alert events and mapping selectors
- `/announcements`, image operations and dismissal; `/notifications`
- `/reports/options` and each existing report route separately
- Coin report routes, `/coin-flow`, `/coin-sales`, `/coin-grants`
- `/web/packet-health`, `/devices`, `/events`, `/groups`, `/subscriptions`
- `/account-summary`, `/account-avatar`

Coin allocation through Admin creation/editing also requires Coin Distribution Add. The legacy packet-health checkbox writes the canonical grant, advances its version, and audits changes; ordinary Admins cannot use it to escalate privileges.

Permission APIs:

- `GET /auth/permissions`: current account role and effective permissions; authenticated bootstrap remains available after all grants are removed.
- `GET /super-admin/permissions/catalogue`
- `GET /super-admin/permissions/admins`: scoped search and pagination
- `GET /super-admin/permissions/:id`
- `PUT /super-admin/permissions/:id`: complete allowed-key list plus expected version

Management endpoints require SUPER_ADMIN. Unknown keys, non-Admin targets, contradictory action/view combinations, and stale saves are rejected. Writes are transactional and scope checked.

## 11. Frontend route protection

All existing dashboard, playback, vehicle, admin, client, geofence, alert, announcement, notification, report, coin, and packet-health routes use registry-backed guards, retaining their role restrictions. Denied routes render a 403 Access Denied panel. The new `/super-admin/permissions` route is SUPER_ADMIN-only. Permission loading precedes protected page rendering; verification failure fails closed with Retry.

## 12. Sidebar filtering

Links use a shared permission-aware navigation component. Dashboard, Reports, Vehicle Reports, and Alert parent groups disappear when no permitted children remain. The permission control centre is visible only to SUPER_ADMIN. Packet Health uses its canonical grant. Sidebar profile and announcement queries are gated.

## 13. Button/action filtering and control centre

Existing module controls are hidden or disabled for denied actions, including create/edit/delete, account status editing, alert status, announcement editing, coin allocation, avatar editing, and dashboard playback links. Open editors close or stop rendering when their grant is revoked. Admin deactivation now uses the existing DELETE endpoint so Delete and Edit are independently enforced.

The management page provides searchable paginated Admin selection, account information, module groups with mixed parent states, and a CRUD matrix. It supports Select All, confirmed Clear All, confirmed Reset to Default, Cancel, Save, unsaved-change warnings, loading/success/error feedback, and conflict reload. Clear/Reset only update the draft until Save. Enabling an action enables its View; disabling View removes dependent actions.

## 14. Session and refresh behavior

API enforcement reads current database grants on every request, so revocation does not wait for token expiry. The web loads grants at bootstrap and refetches every 10 seconds, on focus/reconnect, and immediately following an API 403. Changed Admin grants cancel outstanding queries and remove old data caches. The visible UI can take up to the next refresh interval to update; the backend already denies new forbidden calls. Responses containing effective grants are marked no-store.

Socket delivery rechecks current permissions and account state. Vehicle telemetry requires Dashboard or Vehicle View plus ownership. Notifications additionally require Notifications View. Revoking notifications preserves separately permitted telemetry access.

## 15. Audit logging

Each permission save records actor, target Admin, old/new allowed keys, and timestamp in `permission_change_audit`, within the same transaction. Concurrent stale saves return 409 without changing grants or writing an audit entry. Audit records remain backend data; no extra audit page was invented.

## 16. Added tests

- 60 API integration cases use production routes and SQL with PGlite: catalogue parity, defaults, role spoofing, SUPER_ADMIN exclusivity, persistence across login, isolated Admin grants, audit, reset, stale writes, module/CRUD/report denials, ownership, coin escalation, and packet backfill.
- 6 web tests use the actual permission provider and cover role access, mixed parents, module/action consistency, saving, confirmed bulk operations, failed saves, unsaved navigation, direct route denial, sidebar filtering, and immediate refresh revocation.
- Socket notification regression now awaits subscription acknowledgement and verifies current notification revocation while retaining authorized telemetry.
- Existing integration fixtures now include the permission migration and use persisted account roles.
- The real PostgreSQL migration gate includes all current migrations and new schema tables/keys.

## 17. Regression results

API: **186 tests / 17 files passed** with two workers. Web: **110 tests / 26 files passed**. Tracker: **20 tests / 8 files passed**. Mobile and shared-utils suites passed in the workspace run; shared-utils has 2 tests. Shared-types and protocol-types currently have no tests.

The initial highly parallel workspace run hit an API worker exit and rate-limit timeout under resource contention, plus a socket test publishing before asynchronous room initialization completed. Subscription acknowledgement fixed the socket race. The complete API rerun with bounded workers passed, including rate limits. No production timeout or rate-limit settings were weakened.

## 18–20. TypeScript, ESLint, and build

Workspace TypeScript: passed. Workspace ESLint: passed. Workspace production build: passed, including web, API, and tracker. A final API type/lint check after the socket test change also passed. `git diff --check` passed.

## 21. Migration result

All 19 SQL migration files, including both existing 011 files, migrated successfully on a fresh disposable PostgreSQL 16.4/PostGIS 3.4.3 database. The runner was rerun from both supported working directories; schema catalogs and relation identities stayed unchanged. Real login, vehicle CRUD, lists, latest/history, geofence ownership/CRUD and spatial round trips passed. The disposable database was removed; configured `fleet` database identity was unchanged.

At initial delivery, migration 018 was not installed on the application database. The subsequent missing-column report was resolved by verifying the local `fleet` target and affected Admin, then transactionally applying **only migration 018** using `services/api/src/db/activate-admin-permissions.ts`. Activation succeeded. The exact previously failing endpoint returned HTTP 200 with 46 grants. Unrelated pending migration 017 (`017_device_sim_info.sql`) remains untouched. The activation script validates the local fleet target and baseline and is safe to rerun.

## 22. Limitations

- Browser visual inspection was unavailable: the browser Node runtime failed to initialize kernel assets with Windows error 3. DOM behavior is tested, but no manual browser screenshot verification is claimed.
- Permission migration 018 is active locally. Unrelated migration 017 remains pending.
- Permissions apply to Admin accounts, preserving the requested existing Client/User role and ownership rules.
- Future API endpoints and modules must receive a registry entry/policy as appropriate. Future catalogue additions must explicitly choose a backfill policy for existing Admins.
- Workspace build does not produce a native Android/iOS release; mobile regression/type checks passed.

To review after migration activation: sign in as SUPER_ADMIN, open Permission Management, select an Admin, change grants and Save. Sign in as that Admin; test navigation, direct URLs, and API calls. Reset to Default restores full access only after Save.

## Follow-up: All admins

The selector now includes **All admins**, with a separate **Select all admins** button. Selection covers every existing Admin in the ownership hierarchy across all pages, including inactive accounts. Super Admin and Client accounts are excluded. The bulk template starts with full access and clearly explains that saving replaces existing grants with the chosen selection. Saving requires a confirmation showing the actual account count.

`GET /api/v1/super-admin/permissions/all` returns all target IDs and current versions. `PUT` on that route applies the selected keys in one transaction with an audit row per Admin. A stale version, missing target, newly added account, or duplicate target rejects the whole write with 409; there are no partial saves. Reload updates the target snapshot. New accounts created later retain normal full-access defaults.

Follow-up checks: **62 permission API tests passed**, **7 permission UI tests passed**, web/API TypeScript and changed-file ESLint passed, and the workspace production build passed. The live all-admin endpoint returned HTTP 200 with **5 Admins**. Live checks were read-only; no existing Admin grants were bulk changed during verification.

## Follow-up: Permission refresh rate limiting

The application previously applied the 20-attempt/15-minute credential limiter to every `/auth` route. Routine `/auth/permissions` polling exhausted that limit and displayed “Unable to verify access.” The credential limiter now covers login, refresh, and logout; authenticated permission reads remain covered by the normal 300-request/minute API limit and existing authentication. Credential and history limits are unchanged.

On a 429, the web permission provider stops retries, interval polling, focus/reconnect refreshes, and denial-triggered refreshes. An explicit Retry can restore normal polling after a successful response. Concurrent refresh events reuse the pending request.

The rate-limit regression verifies 25 permission reads do not consume the login budget and permission reads remain available after that budget is exhausted. All 3 rate-limit tests and all 8 permission UI tests passed. Live verification made 25 consecutive authenticated permission reads; all returned HTTP 200.
