# Web sidebar verification — 23 October 2026

- Removed exactly TEST-VEH-001, TEST-VEH-002 and TEST-VEH-003 from the configured database, along with their three geofence-vehicle links. Existing geofences were retained. All other vehicle dependencies were checked empty before removal. Six vehicles remain.
- Recovery rows: `test-vehicle-removal-2026-10-23.json`.
- Desktop sidebar is fixed below the 58 px header and fills the remaining viewport. Collapsed width is 72 px; expanded width is 236 px. Navigation retains its own vertical scrolling, with scroll chaining contained.
- Existing AppShell navigation regression tests: 4 passed.
- Browser checks used `sidebar-scroll-check.html`, an isolated layout fixture loading the current production stylesheets; no signed-in browser session was available.
- Desktop viewport approximately 1281 × 721: after scrolling both the document and menu, sidebar top remained 58 px and bottom remained at the viewport bottom (within 1 px rounding tolerance).
- Collapsed desktop: sidebar width and main content offset both measured 72 px; full-height positioning retained.
- Fresh mobile viewport 390 × 844: drawer opens as a 300 px overlay; main content retains a 0 px left offset. Temporary viewport overrides were reset.
- No mobile app code changed.
