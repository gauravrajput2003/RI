export interface AddressResult { address: string; attribution: string }

// A rounded cache key groups GPS jitter within roughly 11 metres. Requests still
// use the original coordinates; invalid/no-fix points must never be geocoded.
export function coordinateKey(latitude: unknown, longitude: unknown, valid?: unknown): string | null {
  if (valid === false || typeof latitude !== 'number' || typeof longitude !== 'number'
    || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || Math.abs(latitude) > 90 || Math.abs(longitude) > 180
    || (latitude === 0 && longitude === 0)) return null;
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

export async function lookupAddress(latitude: number, longitude: number, key: string, fetcher: typeof fetch = fetch): Promise<AddressResult | null> {
  const url = new URL('https://api.geoapify.com/v1/geocode/reverse');
  url.search = new URLSearchParams({lat:String(latitude),lon:String(longitude),format:'json',lang:'en',apiKey:key}).toString();
  const response = await fetcher(url, {signal:AbortSignal.timeout(3000)});
  if (!response.ok) throw new Error(`Geocoding provider returned HTTP ${response.status}`);
  const body = await response.json() as {results?: {formatted?: unknown}[]};
  const address = body.results?.[0]?.formatted;
  return typeof address === 'string' && address.trim()
    ? {address:address.trim().slice(0,2000),attribution:'Powered by Geoapify | © OpenStreetMap contributors'} : null;
}
