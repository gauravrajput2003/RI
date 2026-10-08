# Vehicle address lookup

1. Create a project and API key at https://myprojects.geoapify.com/.
2. Set `GEOAPIFY_API_KEY=your_key` in the root `.env` (or API service environment).
   Keep it server-only; never use `VITE_` or `EXPO_PUBLIC_` for this key.
3. Run `pnpm --filter @fleet/api migrate` and restart the API once.
4. Open the vehicle dashboard or mobile dashboard. A missing address starts a
   background lookup. The next refresh shows the cached address (normally within
   15 seconds for a small fleet). Existing valid coordinates work too.

Geoapify receives latitude/longitude only, not IMEI, user or vehicle identifiers.
Results include Geoapify/OpenStreetMap attribution. Cached nearby coordinates
(four decimal places, roughly 11 metres) are reused for 30 days. No-result entries
are retried after five minutes. Failures pause requests for one minute. One API
process sends at most one provider request per second with a 100-item queue and
three-second timeout. GPS ingestion and dashboard reads never wait for a provider
response. Keep one API process for this limiter; a multi-instance deployment needs
a shared worker/limiter. Monitor the provider project's quota for your fleet size.

Addresses are approximate map labels, not evidence of a precise street entrance.
Null, out-of-range, explicitly invalid and 0,0 fixes are ignored. No fake address
is substituted. With no key the existing GPS application continues normally.

Reference: https://apidocs.geoapify.com/docs/geocoding/reverse-geocoding/
