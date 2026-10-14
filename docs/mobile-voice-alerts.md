# Vehicle voice alerts and phone push setup

## Implemented behavior

Enable **Settings → Alert Notification → Voice Assistance**. **Test voice** reads
an explicit test phrase without generating a vehicle event. Real transitions use
the vehicle's saved registration number, not its IMEI.

- Started: current device state becomes MOVING.
- Idle: current device state becomes IDLE.
- Stopped: current device state becomes STOPPED.
- Initial login/current-state snapshots, reconnections, repeated packets, stale
  events, muted vehicles and revoked logins do not produce new voice announcements.
- A server poll observes committed current state every five seconds. An event is
  persisted in notification history and a push outbox; socket and push use the same
  event ID. Popup and voice deduplication are separate and persisted on the phone.
- Foreground: one in-app banner and serialized speech of the actual plate.
- Android closed/background: a bundled spoken state sound is played by the OS.
  A separate high-priority data push also attempts full-plate TTS through a
  background task. Doze/OEM restrictions/force-stop can prevent that task.
- iPhone closed/background: the local VehicleVoice Expo module prepares three CAF
  files per authorized vehicle in Library/Sounds while the app is open. The push
  references that actual vehicle's sound file, so iOS can speak the plate without
  running background JavaScript. New/renamed vehicles require foreground voice
  preparation; until then the push uses a generic spoken state sound.
- Voice Assistance controls speech; Sound controls the ordinary notification
  tone. Android vibration channels follow the switch. iOS background vibration,
  silent mode, Focus and volume are controlled by the phone. No critical-alert
  entitlement or hidden permanent audio service is used.

The API and tracker must remain running and reachable. A closed phone app does
not keep a switched-off development laptop receiving tracker packets.

## Android: Firebase and EAS credentials

Current application ID: **com.example.fleettracker**.
EAS project ID: **5ac0ec99-50ce-4d78-b243-c7272a664fd4**.

1. Open https://console.firebase.google.com/ and select/create the project's
   Firebase project. Firebase Cloud Messaging does not require upgrading to Blaze.
2. Project settings → General → Your apps → Add app → Android. Enter the exact
   application ID above. Register the app and download **google-services.json**.
3. Put that client configuration at `D:\RI\apps\mobile\google-services.json`.
   The app config detects it for local native builds. It is NOT the private FCM
   service-account key.
4. Project settings → Service accounts → Generate new private key. Keep this JSON
   outside source control. Use a service account allowed to send FCM v1 messages
   in this same Firebase project. Check that the Firebase Cloud Messaging API v1
   is enabled under Project settings → Cloud Messaging.
5. From VS Code PowerShell:

   ```powershell
   cd D:\RI\apps\mobile
   npx eas-cli@latest login
   npx eas-cli@latest credentials -p android
   ```

   Select the application's **Push Notifications (FCM V1)** / **Manage your Google
   Service Account Key for Push Notifications (FCM V1)** option, then upload the
   private service-account JSON. Do not paste its private key into chat or app code.
6. Make the client google-services.json available to EAS as a secret file variable:

   ```powershell
   npx eas-cli@latest env:create --environment preview --name GOOGLE_SERVICES_JSON --type file --visibility secret --value ./google-services.json
   ```

   Repeat for the production environment when building for release. The app config
   uses `GOOGLE_SERVICES_JSON` when EAS supplies that file path. If the variable
   already exists, update it instead of creating another one.
7. Build a new APK containing the notification channels, speech packages and sounds:

   ```powershell
   npx eas-cli@latest build --platform android --profile preview
   ```

   Android's native directory is checked in. The `eas-build-post-install` hook
   applies config plugins without cleaning that directory, using the EAS secret
   file to install Firebase configuration and bundled notification sounds. For a
   local native build after saving the client JSON, run `npx expo prebuild
   --platform android --no-install` first.

## iPhone: Apple APNs and a new native build

Apple push credentials require an enrolled Apple Developer Program account.
An Apple login by itself is insufficient. The current bundle ID is
**com.example.fleettracker**; keep it consistent across EAS, Apple and the app.

```powershell
cd D:\RI\apps\mobile
npx eas-cli@latest credentials -p ios
```

Select this application and configure a Push Notifications/APNs authentication
key. EAS can generate/manage it after you sign into the appropriate Apple team.
For an internal physical-iPhone build, register the phone and create the build:

```powershell
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile preview
```

Apple membership/enrollment or payment must be handled by the account owner.
This Windows workspace cannot compile or device-test the Swift module locally;
its Expo autolinking and the iOS JavaScript bundle are checked separately.

## Physical-phone acceptance check

### Same-Wi-Fi Android test

The `preview-lan` APK profile inherits the preview Firebase secret and points to
`http://10.244.133.175:3000/api/v1` (socket origin: `http://10.244.133.175:3000`).
This was the laptop's Wi-Fi IPv4 address when configured; verify it with
`ipconfig` before building and update both URLs in `apps/mobile/eas.json` if it
changes. The separate LAN profile permits private-address HTTP on Android.
Other installed real-data profiles require HTTPS.

Keep the phone and laptop on the same Wi-Fi. Start `npm run dev:api` from
`D:\RI`, then open `http://10.244.133.175:3000/health/ready` in the phone's browser.
Continue only when it returns `status: ready`; firewall or router client
isolation must be resolved if the phone cannot reach it. Keep the tracker and
ngrok TCP tunnel running for real tracker events.

Build from `D:\RI\apps\mobile` with:

```powershell
npx eas-cli@latest build --platform android --profile preview-lan
```

This APK connects only while the laptop is reachable at that Wi-Fi address.
It is an internal Android test, not the iPhone or public release configuration.

1. Install the new build. Configure a reachable `EXPO_PUBLIC_API_URL` and
   `EXPO_PUBLIC_SOCKET_URL` for that build; `localhost` on a phone means the phone.
2. Sign in as the owning client. Allow phone notification permission. Turn Alert
   Notification and Voice Assistance on. Keep the app open until Settings reports
   push enabled; iPhone must finish preparing full vehicle-number voice files.
3. Use Test voice, then perform real started → idle → stopped transitions. Verify
   one banner/announcement per event and the correct registration number.
4. Lock the screen / leave the app and repeat. Check the OS push and audio, then
   check the API's push receipts. An accepted Expo ticket is not proof of delivery.
5. Turn voice off, then master alerts off; test per-vehicle mute and logout. Check
   that a different client's vehicles never appear or speak.
6. A browser preview and Expo Go can exercise foreground speech/popups only.
   They cannot validate this installed app's closed-phone delivery or iPhone CAF
   preparation. Silent mode, Focus, OS permission and volume still apply.

## Official references

- https://docs.expo.dev/push-notifications/fcm-credentials/
- https://docs.expo.dev/push-notifications/push-notifications-setup/
- https://docs.expo.dev/push-notifications/sending-notifications/
- https://developer.apple.com/documentation/usernotifications/unnotificationsound
