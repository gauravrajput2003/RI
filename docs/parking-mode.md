# Parking Mode implementation

## Foreground popup, chime and voice

Parking movement and each server-generated reminder enter the same mobile foreground notification runtime as running/idle/stopped alerts. The popup and voice use simple English: “Warning! Vehicle [number] has moved more than [radius] metres from its parking place. Please check your vehicle now.” Neither the popup nor speech includes coordinates or audit timestamps, even if the radius is missing. Event history retains that detail. A bundled three-second siren plays before speech when Sound is enabled; Voice Assistance and Vibration remain independently controlled by existing settings. The siren uses the SDK-compatible `expo-audio` package, works in Expo Go, and stops on acknowledgement, backgrounding, logout, disabling Sound/alerts or runtime cleanup. Audio failure does not suppress speech or the visual alert.

A global red `ParkingAlertDialog` is mounted after the router and opens a separate native modal window above any RI screen or existing dialog. It stays until acknowledged or the vehicle is confirmed back inside; routine state banners cannot replace it. Acknowledgement stops the current alarm and speech without disabling parking or future server reminders. New reminders for that vehicle update the existing popup instead of stacking windows; warnings for other vehicles are retained in a bounded queue. Logout clears that queue. View vehicle on map opens the alert's exact vehicle. Duplicate socket/push deliveries retain event-ID deduplication. Reminders have distinct server event IDs, so every configured interval can alert again; no second phone reminder timer is created. This is an RI foreground dialog, not permission to draw over other apps.

Parking socket delivery discovers current owner/ancestor user rooms and rechecks live vehicle access, notification permission and vehicle mute settings. It no longer depends on a vehicle-room subscription captured before a newly added vehicle existed. Configuration changes use the same current-recipient discovery. Detection, fresh-GPS safeguards, interval timing and cancellation stay on the server.

Reload Metro after installing the new dependency. Expo Go supports the in-app popup, chime and speech only while RI is foregrounded. Installed builds need rebuilding to include `expo-audio`; background OS push still requires a registered token and native credentials. An Expo Go JavaScript update cannot enable background/lock-screen push.

The dashboard's existing Parking icon now opens the selected vehicle's persisted Parking Mode dialog. It supports enable/disable with confirmation, radii 20/30/40/50 metres, reminders at 1/2/5/10 minutes, saved activation/reference timestamps, boundary state, monitoring availability, reference-location map, event history and Live Map navigation. An enabled vehicle shows `Parking ON` on its card. No tracker command, parser change, dependency, dummy vehicle, synthetic production GPS fix or fabricated notification was added.

## Architecture and persistence

The inspected app uses Expo/React Native, the existing Leaflet WebView, authenticated Axios/TanStack Query, Express, PostgreSQL, Socket.IO and an existing five-second mobile alert/push sweep. GT06 and W15 already persist normalized GPS records in `locations`; Parking Mode reads those committed records instead of depending on the TCP-to-API callback or an open phone screen. This also recovers after a process restart or a missed realtime publication.

New forward migrations:

- `029_parking_mode.sql`: one current configuration/state per vehicle, a location processing cursor index, and a `parking` sequence namespace plus cancellation/error fields in the existing `mobile_push_outbox`. Existing state-notification outbox records keep source `state`; their sequence numbers do not conflict with parking sequences.
- `030_parking_reference_accuracy.sql`: stores reported uncertainty of the fixed reference separately from each later reading. Added as a forward migration after 029 was applied; no applied migration was edited. Unknown accuracy remains NULL.

Both migrations were applied to the configured database. They do not alter existing telemetry, assignments, Relay settings or the hardware-specific `parking_alarm_on_ignition` option. That installation checkbox is a different feature; it is not a backend 20–50 m GPS boundary.

`parking_modes` stores owner, vehicle, device and exact assignment IDs, enabled status, optimistic version, activation identity/time, fixed coordinates/GPS timestamp/available accuracy, radius, reminder interval, current boundary classification, consecutive-reading counts, last processed database cursor, last reliable GPS point/time/distance, quality state, movement identity/time, last alert and monotonic alert sequence, actor and timestamps.

Movement/reminder/re-entry history reuses `notification_history`. Configuration changes are recorded in existing `events`; phone delivery and failures use the existing push outbox. No duplicate event, notification, geofence-management or scheduler service was created. The existing general geofence configuration does not provide this vehicle-specific activation/cursor/reminder lifecycle.

## API and authorization

- `GET /api/v1/vehicles/:id/parking` returns current state/configuration, real GPS availability, selected registration, fixed map reference, own-tenant event history and phone push availability. No mode is enabled merely by reading it.
- `PUT /api/v1/vehicles/:id/parking` accepts only `{enabled, radius, repeatMinutes, expectedVersion, confirmed:true}`. Coordinates, tracker IDs, owner IDs and arbitrary commands are never accepted from the client.
- The GET response includes the last 20 parking notifications, so a separate history endpoint is unnecessary. Existing notification-history screens also retain the stored events.

All routes use existing authentication, recursive vehicle ownership scope and permission enforcement. Restricted Admins need vehicle/dashboard view to read and `vehicle.edit` to change Parking Mode. Client owners retain the existing scoped edit convention. Foreign IDs return 404. Writes are limited to 20 per authenticated user per minute.

A vehicle-row lock and parking-row lock serialize saves. Repeating an already-applied enable/configuration or disable is a no-op, preserving the original reference. Conflicting edits return `PARKING_CHANGED`. Mobile confirmation retains the version/options that were actually confirmed, rather than adopting another user's intervening changes. The UI blocks simultaneous taps, offline writes, view-only clients, loading/errors and demo mode.

## Exact GPS detection policy

Defaults are configurable in the API environment:

| Setting | Default | Allowed range |
|---|---:|---:|
| `PARKING_GPS_MAX_AGE_SECONDS` | 120 | 30–600 |
| `PARKING_CONSECUTIVE_READINGS` | 3 | 2–10 |
| `PARKING_HYSTERESIS_METERS` | 5 | 2–10 |

Activation requires one active tracker belonging to the vehicle's current owner and its exact current assignment. The most recent stored assigned-device GPS record must have a valid fix, finite in-range coordinates (excluding the project's invalid `(0,0)` sentinel), a GPS timestamp and receipt timestamp no older than 120 seconds, no timestamp more than 30 seconds in the future, and fresh tracker communication. An invalid newest record is not concealed by falling back to an older position. If speed is reported it must be finite, nonnegative and at most 200 km/h; speed is not required to infer movement. Reported accuracy must be finite, nonnegative and no larger than the selected radius. Zero latitude, longitude, speed and accuracy remain valid individually.

The server captures this actual GPS point at activation. It starts inside because the reference is the captured position itself; there is no separate client-supplied proposed centre. Opening the sheet or repeating Enable never recentres it. Explicitly disabling and enabling again captures a new fresh reference.

The worker processes up to 500 new stored packets per vehicle/sweep in `(server_received_at,id)` order. It persists this cursor atomically with classification and notifications. Stale/invalid/imprecise records reset consecutive counters, pause delivery eligibility and never imply movement. Duplicate or non-increasing GPS timestamps do not count as separate evidence. A long GPS gap resets qualification counts.

Distance uses the existing tested Haversine metres utility, not latitude/longitude degrees. It rounds to the nearest metre. Let `a` be the sum of available reference and current GPS accuracy; unreported accuracy is not represented as a measured zero. The policy uses its fixed tolerance/consecutive checks when accuracy is unavailable:

- An outside reading requires `distance - a > radius + 5 m`.
- An inside reading requires `distance + a < radius - 5 m` (bounded below at zero).
- The uncertainty band retains the last confirmed inside/outside state and resets qualifying counters.
- Three consecutive distinct qualifying outside fixes establish an excursion and one `PARKING_MOVEMENT` event.
- Three consecutive qualifying inside fixes establish re-entry, record `PARKING_RETURNED`, stop reminders and cancel queued excursion pushes. Re-entry is stored and delivered in-app; it does not create a phone push.
- Leaving again requires three new qualifying fixes and creates a new movement identity/event.

The original centre never follows the vehicle. Radius/interval changes preserve it, increment the configuration version, cancel old queued deliveries and reset classification to unknown until new readings qualify. A radius smaller than the saved reference accuracy is rejected; a better reference requires explicit disable/re-enable.

These safeguards reduce isolated jitter; they cannot promise a genuine 20 m hardware accuracy when the tracker does not report accuracy. The confirmation margin deliberately favors avoiding false alerts over exact-boundary sensitivity.

## Repeat alerts, delivery and cancellation

The existing five-second API alert sweep runs Parking Mode independently of mobile timers. Vehicle and parking row locks plus `FOR UPDATE SKIP LOCKED`, persisted sequence/cursors and unique notification/outbox keys prevent concurrent workers from creating the same interval's alert twice. Each due sweep produces at most one reminder; missed intervals are not backfilled in a burst.

After an excursion, reminders use the selected interval from the last created alert. They require the mode still enabled, the same owner/assignment, active vehicle/device, fresh reliable GPS and a qualified outside streak. No new fix is required for every reminder while the last qualified evidence is still fresh, but offline/stale GPS pauses reminders. After an extended gap, one fresh point cannot resume reminders: the outside streak must qualify again. Missing telemetry never creates a movement event or a claim of realtime monitoring. The UI displays paused monitoring and the last evaluated timestamp.

Configuration and movement changes publish the existing authorized vehicle-room Socket.IO patterns. Mobile invalidates session-scoped parking/fleet queries on `parking:changed`; the existing foreground alert runtime accepts parking notifications and handles deduplication, banners and voice preferences. Clicking a parking banner or the modal's Live Map link selects that exact vehicle.

Background/closed-app delivery reuses Expo push devices, notification preferences, authenticated phone sessions, the existing outbox, retry/backoff and receipt checks. Parking messages use existing generic alert channels/default sound instead of referencing nonexistent parking voice files. Recipients must still own/ancestor-scope the vehicle, be active, have an active phone session, notification permission and vehicle view/manage permission. Preferences and ownership are rechecked at delivery, so stale room membership or an old token is not a permanent authorization grant.

Disable/update and each socket/push delivery lock the same vehicle/parking rows in the same order. A disabling save waits for an already-started send to finish. After it commits, new sends cannot start; queued unsent parking pushes are cancelled. Re-entry, reassignment, owner changes, stale GPS, inactive vehicles and version changes also invalidate queued sends. Previously accepted OS push messages cannot be recalled and may still arrive. Provider delivery is at-least-once; the existing event ID protects foreground handling from duplicate processing. A ticket acceptance is not claimed as proof that a person received it.

Transport/ticket failures increment persisted attempts, record `last_error` and schedule retry. Receipt errors and cancellation reasons are persisted. Historical movement events remain true historical records even if the phone notification was cancelled or delivery failed.

## Tracker compatibility

Backend detection works with GT06 or W15 only when their actual persisted GPS meets the policy. It sends no `MOVING` configuration command. The supplied [GT06F manual, page 15](https://www.manualslib.com/manual/1889252/Concox-Gt06f.html?page=15) describes a model-specific displacement radius of 100–1000 m, which does not establish 20–50 m support or compatibility with every GT06 2G firmware. Tracker-side alarm support is not assumed.

## Real database verification and deployment

`services/api/scripts/verify-parking.ts` performs read-only persisted vehicle/state checks. Evidence: `artifacts/parking/verification.json`. It did not activate a mode, create GPS packets, trigger alerts or send a real notification.

At verification time no current vehicle had a fresh qualifying GPS fix; the actual bikes HR12AU6674 and HR12AX6674 correctly returned OFF, `canEnable:false`, no reference and a fresh-GPS-required explanation. There were zero parking configurations/events. Eleven phone registrations existed but **zero enabled Expo push tokens**, so real background push delivery is not currently established.

Keep the API running for server-side detection/reminders. Restart the API to load new code, reload Expo, and wait for fresh real GPS before enabling Parking Mode. Enable vehicle notifications and register a native phone build with working Expo/APNs/FCM credentials for background alerts. The modal reports unavailable phone push instead of promising background delivery. Expo Go/foreground-only behavior follows the existing notification runtime. No new native dependency was added; standalone apps need their usual JavaScript update/rebuild.

## Tests and changed files

Automated GPS/phone fixtures are isolated from the real database. Tests cover captured current assigned GPS, all four radii and intervals, jitter/accuracy/duplicate timestamps/invalid or stale data, actual zero values, repeats, return/new excursions, gap recovery, disabled and stale delivery cancellation, duplicate saves/concurrent sweeps, persisted-state recovery, optimistic conflicts, permissions/IDOR/body validation and simulated delivery failures. Mobile tests cover saved configuration/map, confirmation and options, duplicate taps, disable, stale/offline/view-only/loading/error states and selected dashboard actions. Real push and physical phone interaction were not performed.

Main files:

- Shared: `packages/shared-types/src/parking.ts`, `index.ts`.
- Database: forward migrations 029 and 030.
- API: `modules/parking/service.ts`, `policy.ts`, `delivery.ts`, `parking.integration.test.ts`; `routes/parking.ts`, `api.ts`; permission middleware, environment schema, vehicle repository, mobile-push service, realtime publisher, server scheduler and `scripts/verify-parking.ts`.
- Mobile: `components/fleet/ParkingSheet.tsx`, `BikeCard.tsx`, dashboard route, `features/parking/queries.ts`, vehicle normalization/model, socket/runtime notification handling, parking banner navigation and tests.
- Existing API database-fixture suites now load the new forward migrations with the push schema they extend. Other notification behavior is retained.

No commits or pushes were made by the agent. Final check results are recorded in the task response and `artifacts/*parking*.log`.

Verification results: 49 mobile test files / 199 tests passed. Across targeted API runs, 99 unique tests passed (17 parking, 8 mobile-push, 48 authorization, 12 mobile API, 13 reports and 1 socket notification). The pristine real PostgreSQL/PostGIS migration gate passed after its outdated pre-019 schema manifest was updated; it verifies all migrations, second-run idempotency, production API compatibility and isolated-database cleanup without changing the existing fleet database. API build, mobile TypeScript, targeted lint, whitespace checks and Android/iOS JavaScript exports passed.

Commands used include `pnpm --filter @fleet/mobile test`, `pnpm --filter @fleet/mobile typecheck`, `pnpm --filter @fleet/mobile bundle:check`, `pnpm --filter @fleet/api build`, targeted API `vitest run` commands with one worker and explicit timeouts, targeted ESLint, and `pnpm --filter @fleet/api exec vitest run --config vitest.migrations.config.ts`, through the repository's PowerShell wrapper. An initial migration-gate run failed only because its expected catalogue stopped at migration 018; the updated gate ran successfully against a pristine real database.
