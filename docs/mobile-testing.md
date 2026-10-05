# Testing the mobile app and web preview

## Shared web and mobile accounts

Mobile now uses the real backend by default. The local `apps/mobile/.env` has `EXPO_PUBLIC_DEMO_MODE=false` and points API and Socket.IO to this PC's current Wi-Fi address, `192.168.110.175:3000`. Keep the phone on the same Wi-Fi. Update both URLs if the PC's address changes; Android emulators can use `10.0.2.2`, and local browser previews can use `localhost`.

The web and mobile apps must point to the same API/database. An admin creates an active client on the web with a username and password, then creates/assigns vehicles to that client. Mobile accepts that username (or email) and the same password. It calls `/api/v1/auth/login` with `identifier` and `/api/v1/vehicles` using the returned token. The API scopes the inventory to the logged-in account. An empty account shows no vehicles; it does not fall back to sample data.

The mobile dashboard refreshes the fleet every 30 seconds while active and online, when returning to the foreground, and on pull-to-refresh. Web additions and vehicle type changes therefore appear without signing in again. GPS updates use the existing authenticated Socket.IO connection.

Both apps use the PNG files in `apps/web/public/assets/vehicle-icons/vehicles` for bikes, scooters, cars, buses, and trucks. Mobile bundles these exact files through static imports, so images remain available offline. Vehicle type and tracker state choose the artwork; vans retain a generic icon until van artwork is supplied.

The API must be running and reachable from the phone. Browser previews also require their Expo origin in `CORS_ORIGINS`. Production requires HTTPS API and socket URLs. There are no new seeded accounts; use a client created through the web admin interface.

Restart Expo after changing the environment:

```powershell
.\scripts\pnpm.ps1 --filter @fleet/mobile run start --clear
```

Demo mode remains available as an explicit development option using `EXPO_PUBLIC_DEMO_MODE=true`; it uses isolated sample data rather than web-created clients.

## Web compatibility correction

- D:/RI/apps/mobile/tailwind.config.cjs uses darkMode: 'class'. This matches NativeWind's browser color-scheme observer and fixes the media-mode exception.
- D:/RI/apps/mobile/app/(app)/map.tsx is a platform-resolved route. The native implementation is D:/RI/apps/mobile/features/map/LiveMap.tsx; the browser loads LiveMap.web.tsx, which never imports react-native-maps. The browser shows an explicit map-availability notice and a Vehicles link. A full interactive web map was not added or claimed; Android/iOS retain the interactive native map.
- SecureStore has no browser implementation. D:/RI/apps/mobile/services/storage/tokens.web.ts uses memory-only credentials; reloading signs out. Web snapshots are also memory-only, preventing orphaned GPS data in browser storage. Android/iOS still use SecureStore and the existing persistent snapshot cache.
- D:/RI/apps/mobile/components/LiveVehicleRow.tsx now uses typed pathname/params navigation, which remains valid after Expo generates its route types.

## Verification

The real Expo web app was opened in headless Chrome using D:/RI/scripts/web-preview-smoke.cjs. API and Socket.IO responses were intercepted with isolated fixtures; no real backend account/database was touched. The test verified login, the compiled class-mode CSS flag, the map tab fallback, absence of JWTs in browser storage, sign-out on reload, and zero uncaught browser errors. This is not a real-backend end-to-end test or a native-device test.

The smoke script accepts PLAYWRIGHT_MODULE when Playwright is provided by an external tooling runtime and WEB_PREVIEW_URL for the local Expo server (default http://localhost:8091). It is not part of the application bundle and does not add a production dependency.
