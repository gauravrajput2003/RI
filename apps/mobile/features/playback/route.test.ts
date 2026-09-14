import { describe, expect, it } from 'vitest';
import {
  haversineDistance,
  parseDateTime,
  formatDate,
  formatTime,
  formatDateTime,
  formatDuration,
  calculateRouteStats,
  generateDemoHistory,
} from './route';
import type { Location } from '../../types/models';

describe('route utilities and math', () => {
  it('computes haversine distance correctly', () => {
    // Distance between Delhi (28.6139, 77.2090) and Rohtak (28.8955, 76.6066) ~ 66 km
    const dist = haversineDistance(28.6139, 77.2090, 28.8955, 76.6066);
    expect(dist).toBeGreaterThan(60);
    expect(dist).toBeLessThan(75);

    // Identical coords is 0
    expect(haversineDistance(28.6139, 77.2090, 28.6139, 77.2090)).toBe(0);
  });

  it('parses valid DD/MM/YYYY and HH:MM inputs', () => {
    const d1 = parseDateTime('13/09/2026', '00:00');
    expect(d1).not.toBeNull();
    expect(d1?.getFullYear()).toBe(2026);
    expect(d1?.getMonth()).toBe(8); // September is 8
    expect(d1?.getDate()).toBe(13);
    expect(d1?.getHours()).toBe(0);
    expect(d1?.getMinutes()).toBe(0);

    const d2 = parseDateTime('13-09-2026', '23:59:59');
    expect(d2).not.toBeNull();
    expect(d2?.getHours()).toBe(23);
    expect(d2?.getMinutes()).toBe(59);
    expect(d2?.getSeconds()).toBe(59);
  });

  it('rejects invalid dates or times', () => {
    expect(parseDateTime('32/09/2026', '00:00')).toBeNull();
    expect(parseDateTime('13/13/2026', '00:00')).toBeNull();
    expect(parseDateTime('invalid', '00:00')).toBeNull();
    expect(parseDateTime('13/09/2026', '25:00')).toBeNull();
    expect(parseDateTime('13/09/2026', '12:65')).toBeNull();
    expect(parseDateTime('13/09/2026', 'not-a-time')).toBeNull();
  });

  it('formats dates, times and durations properly', () => {
    const d = new Date(2026, 8, 13, 14, 35, 10);
    expect(formatDate(d)).toBe('13/09/2026');
    expect(formatTime(d)).toBe('14:35');
    expect(formatDateTime(d)).toBe('13-09-2026 14:35:10');

    expect(formatDuration(0)).toBe('0:00:00');
    expect(formatDuration(32)).toBe('0:00:32');
    expect(formatDuration(12051)).toBe('3:20:51');
  });

  it('calculates route stats accurately for moving and stoppage segments', () => {
    const t0 = new Date('2026-09-13T10:00:00Z').getTime();
    const points: Location[] = [
      {
        latitude: 28.8950,
        longitude: 76.6050,
        speed: 40,
        tracker_timestamp: new Date(t0).toISOString(),
        server_received_at: new Date(t0).toISOString(),
      },
      {
        latitude: 28.9050,
        longitude: 76.6050,
        speed: 50,
        tracker_timestamp: new Date(t0 + 60000).toISOString(),
        server_received_at: new Date(t0 + 60000).toISOString(),
      },
      {
        latitude: 28.9050,
        longitude: 76.6050,
        speed: 0,
        tracker_timestamp: new Date(t0 + 120000).toISOString(),
        server_received_at: new Date(t0 + 120000).toISOString(),
      },
      {
        latitude: 28.9050,
        longitude: 76.6050,
        speed: 0,
        tracker_timestamp: new Date(t0 + 180000).toISOString(),
        server_received_at: new Date(t0 + 180000).toISOString(),
      },
    ];

    const stats = calculateRouteStats(points);
    expect(stats.kmTravelled).toBeGreaterThan(1);
    expect(stats.maxSpeedKmh).toBe(50);
    expect(stats.totalRunningSeconds).toBe(60);
    expect(stats.totalStoppageSeconds).toBe(120);
    expect(stats.haltCount).toBe(1);
    expect(stats.halts.length).toBe(1);
  });

  it('produces empty stats for empty points list', () => {
    const stats = calculateRouteStats([]);
    expect(stats.kmTravelled).toBe(0);
    expect(stats.totalRunningSeconds).toBe(0);
    expect(stats.totalStoppageSeconds).toBe(0);
    expect(stats.haltCount).toBe(0);
  });

  it('generates deterministic demo history seeded by vehicle id', () => {
    const from = new Date('2026-09-13T00:00:00Z');
    const to = new Date('2026-09-13T23:59:59Z');

    const history1 = generateDemoHistory('demo-bike', from, to);
    const history2 = generateDemoHistory('demo-bike', from, to);
    const history3 = generateDemoHistory('demo-car', from, to);

    expect(history1.length).toBe(35);
    expect(history1).toEqual(history2); // Stable across runs
    expect(history1[0].latitude).not.toEqual(history3[0].latitude); // Seeded differently

    const stats = calculateRouteStats(history1);
    expect(stats.kmTravelled).toBeGreaterThan(0);
    expect(stats.maxSpeedKmh).toBeGreaterThan(0);
    expect(stats.totalRunningSeconds).toBeGreaterThan(0);
  });
});
