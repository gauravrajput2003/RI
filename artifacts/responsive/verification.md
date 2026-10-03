# Responsive verification

Checked in the Codex in-app browser against an isolated Vite preview and a synthetic API. No real account records or passwords were changed.

| Requested viewport | Navigation | Dashboard default | Admin rows | Add admin form | Body overflow |
| --- | --- | --- | --- | --- | --- |
| 375px | Drawer; link and backdrop close | List with map switch | Label/value cards | Full-screen, one column | None |
| 768px | Drawer, including after desktop collapse | List with map switch | Horizontal table scroll | Two columns | None |
| 1024px | Fixed sidebar | Table/map split | Horizontal table scroll | Two columns | None |
| 1440px | Fixed sidebar with 72px collapsed mode | Table/map split | Horizontal table scroll | Four columns | None |

The browser's CSS width rounded to 1441 at the requested 1440 viewport. Phone and tablet map switches preserve the mounted map. Selecting a vehicle while the map is hidden, reopening it, and navigating away were verified after fixing Leaflet's zero-size viewport and removed-map cleanup errors.

Additional phone checks: dashboard filters fit the viewport and close; expanded vehicle details use a scrollable near-full sheet; map details fit within the map; playback has one calendar month with previous/next controls; all eight playback metrics remain horizontally scrollable; Add client uses a full-screen one-column form. Icon-button and map zoom targets measured at least 44px, allowing fractional-pixel rendering tolerance. Vehicle and client page shells also showed no body overflow; their fixture lists were empty. Alert, report, geofence, and diagnostics layouts were audited in source and covered by existing component tests, not all visually exercised with populated data.

Validation: full web suite 92 tests passed; final hidden-map regression test passed; TypeScript project check and production Vite build passed. Every table is rendered through DataTable or ClassicReportView and has a table-scroll wrapper. Tables with eight or more columns retain all fields and actions in phone cards; sorting controls remain available.

Screenshots: admin-phone.png, client-phone.png, playback-calendar-phone.png, dashboard-map-phone.png, dashboard-desktop.png.

RI_CLAUDE_HANDOFF.md was not present in the repository; implementation followed the supplied pasted requirements and existing components.
