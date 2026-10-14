# Mobile OpenStreetMap

Android and iPhone live tracking and playback now render Leaflet inside
react-native-webview. Leaflet 1.9.4 JavaScript/CSS are bundled locally (license in
apps/mobile/features/map/leaflet-LICENSE.txt); no remote JavaScript/CDN is loaded.
Only map tiles are fetched from https://tile.openstreetmap.org. No Google Maps
API key or Maps billing account is needed.

Vehicle selection, follow/pan controls, playback route, start/end/halt markers and
route fitting are retained. Marker positions update existing Leaflet markers;
unchanged playback lines are not resent on each playback frame. The WebView gets
coordinates and display labels, never login tokens. Labels are escaped before
display. External attribution links open outside the map.

The public OSM raster tile service is best effort, requires internet, and has no
availability guarantee. Attribution remains visible, requests use an identifying
RI application User-Agent, caching is enabled, and the app does no bulk downloads
or offline prefetching. Before broad fleet deployment choose a tile provider that
allows the expected traffic or self-host tiles. Free/open map data does not mean
unlimited free tile hosting: https://operations.osmfoundation.org/policies/tiles/

For Expo Go, restart Metro after dependency installation:

```powershell
cd D:\RI\apps\mobile
npx expo start --go --lan --clear
```

Close/reopen Expo Go and scan the new QR. For the installed Android app a new APK
is required because react-native-webview is a new native dependency:

```powershell
npx eas-cli@latest build --platform android --profile preview-lan
```

The phone needs internet for tiles as well as access to the laptop API over Wi-Fi.
Existing APKs and already-uploaded builds still contain the old Google map.
