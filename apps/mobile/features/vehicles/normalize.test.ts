import { describe, expect, it } from 'vitest';
import { normalizeLocation, normalizeVehicles } from './normalize';
describe('real REST and realtime boundaries', () => {
  it('accepts PostgreSQL numeric strings and nullable unsupported metrics', () => {
    expect(normalizeVehicles([{ id: 'a', vehicle_number: 'A', active: true, odometer: '123.5' }])[0].odometer).toBe(123.5);
    expect(normalizeLocation({ server_received_at: '2026-09-11T00:00:00Z', speed: '0.00', gps_valid: null })?.speed).toBe(0);
  });
  it('maps camelCase events and rejects malformed coordinates or missing timestamps', () => {
    expect(normalizeLocation({ vehicleId: 'a', serverReceivedAt: '2026-09-11T00:00:00Z', gpsValid: false, batteryPercent: 0 })?.battery_percent).toBe(0);
    expect(normalizeLocation({ latitude: 1, longitude: 1 })).toBeNull();
    expect(normalizeLocation({ latitude: 100, longitude: 1, serverReceivedAt: '2026-09-11T00:00:00Z' })).toBeNull();
  });
});
