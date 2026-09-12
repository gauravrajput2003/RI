# Testing the mobile app and web preview

## Login credentials

An explicitly requested, database-free **development demo** is now enabled in D:/RI/apps/mobile/.env with EXPO_PUBLIC_DEMO_MODE=true. Sign in with **gaurav@gmail.com / 123456**. Restart Expo with --clear and reopen the app after enabling/changing this flag.

The demo uses local sample vehicles and a clearly labeled simulated GPS stream. It makes no backend HTTP/Socket.IO connections, writes no demo credentials to SecureStore, and resets on reload. Dashboard, list/search, vehicle details, native map selection/follow, and logout can be explored. Browser maps show the existing native-map availability notice. Reports/notifications/other unsupported backend features are not invented. Native map tiles may still require internet; a custom Android development build still needs its Maps key.

Demo mode requires both the explicit flag and a development runtime. Production app configuration/runtime reject it. Before integrating a real backend, set EXPO_PUBLIC_DEMO_MODE=false (or remove it), configure real API/socket URLs, restart Expo, and use a real provisioned account. The server's authentication routes were not modified and will not accept these demo credentials automatically.

There is no seeded **real backend** account in this repository. The real login endpoint verifies an active row in the backend users table using bcrypt. QR scanning launches the frontend; it does not create an account, start the API, or start a database.

At the time of this check, http://127.0.0.1:3000/health/live refused connections on the development PC. No database was started and no account was inserted/reset during this fix. Use an account provisioned by the operator of your existing development backend. If there is no development backend yet, that setup needs explicit approval before proceeding under the current no-database-infrastructure constraint.

The automated tests use fixtures, not real login credentials. Do not try the browser-fixture email/password in the running application.

## Phone connectivity

The default 10.0.2.2 address is only for an Android emulator, not a physical phone. For a phone on the same Wi-Fi as your development PC, put the PC's LAN address in D:/RI/apps/mobile/.env. During this check the PC's Wi-Fi address was 192.168.50.175; confirm it has not changed:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.50.175:3000/api/v1
EXPO_PUBLIC_SOCKET_URL=http://192.168.50.175:3000
```

These addresses work only after the API is running, listening on an accessible interface, and reachable through the development PC's firewall. For browser testing on the PC, localhost can also be used. The API must allow the browser's Expo origin in CORS_ORIGINS. Release builds require real HTTPS URLs. Never put passwords, JWTs or server secrets in EXPO_PUBLIC variables.

After changing environment or Tailwind configuration, stop your Expo process and restart it from D:/RI:

```powershell
.\scripts\pnpm.ps1 --filter @fleet/mobile run start --clear
```

Reload the browser or reopen the QR link on the phone. Clearing Metro's cache is important for replacing the old media-mode CSS. The explicitly enabled local demo requires no migrations, Docker or database setup; it is separate from real backend authentication.

## Web compatibility correction

- D:/RI/apps/mobile/tailwind.config.cjs uses darkMode: 'class'. This matches NativeWind's browser color-scheme observer and fixes the media-mode exception.
- D:/RI/apps/mobile/app/(app)/map.tsx is a platform-resolved route. The native implementation is D:/RI/apps/mobile/features/map/LiveMap.tsx; the browser loads LiveMap.web.tsx, which never imports react-native-maps. The browser shows an explicit map-availability notice and a Vehicles link. A full interactive web map was not added or claimed; Android/iOS retain the interactive native map.
- SecureStore has no browser implementation. D:/RI/apps/mobile/services/storage/tokens.web.ts uses memory-only credentials; reloading signs out. Web snapshots are also memory-only, preventing orphaned GPS data in browser storage. Android/iOS still use SecureStore and the existing persistent snapshot cache.
- D:/RI/apps/mobile/components/LiveVehicleRow.tsx now uses typed pathname/params navigation, which remains valid after Expo generates its route types.

## Verification

The real Expo web app was opened in headless Chrome using D:/RI/scripts/web-preview-smoke.cjs. API and Socket.IO responses were intercepted with isolated fixtures; no real backend account/database was touched. The test verified login, the compiled class-mode CSS flag, the map tab fallback, absence of JWTs in browser storage, sign-out on reload, and zero uncaught browser errors. This is not a real-backend end-to-end test or a native-device test.

The smoke script accepts PLAYWRIGHT_MODULE when Playwright is provided by an external tooling runtime and WEB_PREVIEW_URL for the local Expo server (default http://localhost:8091). It is not part of the application bundle and does not add a production dependency.
