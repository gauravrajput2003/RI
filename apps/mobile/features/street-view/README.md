# Vehicle Street View

Entry points: Dashboard → vehicle → Street View; Vehicles → vehicle actions → Street View; Live Map → selected vehicle → Street View.

The sheet uses the existing authenticated `getLatestLocation(vehicleId, signal)` endpoint. Invalid/missing GPS, a different vehicle ID, failed authorization, offline state, and cancelled/session-changed requests cannot open a location. No phone location permission or cell-tower coordinates are used. A newer GPS fix in that same vehicle’s live cache may supersede the authorized API result; heartbeat receipt time does not refresh GPS age. Old (over ten minutes), missing-time, and future-time GPS fixes carry a warning. Every external-open action refreshes GPS again, with a synchronous duplicate-tap guard.

The external destination is Google’s documented universal Maps URL with `api=1`, `map_action=pano`, and the recorded GPS `viewpoint`. Android/iOS can open the installed Google Maps app or the browser. Google chooses the closest available panorama; this is historical imagery, not a live view. External URL opening provides no imagery-availability callback. The sheet explains this and keeps **View normal map** available. If opening the Street View URL itself fails, it attempts a normal Maps URL for the same GPS coordinates and reports that fallback. Failure of both URLs shows an error with retry.

No new dependency, Google API key, billing setup, native module, or native rebuild is required for this feature. Reload Expo for local testing; an existing distributed APK needs an app update to include the changed JavaScript.

Manual checks on physical Android and iPhone:

- Select two different real vehicles and verify each external destination against its GPS preview.
- Test installed Google Maps and browser-only devices, known imagery coverage and no coverage, offline mode, stale/invalid/missing GPS, close/back navigation, and rapid repeated taps.
- Return from Google Maps with no imagery and choose **View normal map**.
- Verify opening results on each target OS; successful `Linking.openURL` only confirms handoff, not that a panorama loaded.

Reference: [Google Maps URLs documentation](https://developers.google.com/maps/documentation/urls/get-started).
