import type { Location } from '../../types/models';

export interface RouteStats {
  kmTravelled: number;
  totalRunningSeconds: number;
  totalStoppageSeconds: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  haltCount: number;
  halts: { latitude: number; longitude: number; haltIndex: number; durationSeconds: number }[];
}

/**
 * Calculates Haversine distance between two coordinates in kilometers.
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth's mean radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Parses DD/MM/YYYY and HH:MM or HH:MM:SS strings into a Date object.
 * Returns null if the input format or date values are invalid.
 */
export function parseDateTime(dateStr: string, timeStr: string): Date | null {
  const dateParts = dateStr.trim().split(/[/.-]/);
  if (dateParts.length !== 3) return null;
  const [dayStr, monthStr, yearStr] = dateParts;
  const day = parseInt(dayStr, 10);
  const month = parseInt(monthStr, 10);
  const year = parseInt(yearStr, 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1970 || year > 2100) return null;

  const timeParts = timeStr.trim().split(':');
  if (timeParts.length < 2 || timeParts.length > 3) return null;
  const hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1], 10);
  const seconds = timeParts.length === 3 ? parseInt(timeParts[2], 10) : 0;

  if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) return null;

  const date = new Date(year, month - 1, day, hours, minutes, seconds, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

export function formatDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

export function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function formatDateTime(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${d}-${m}-${y} ${h}:${min}:${s}`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Computes pure analytics from route points:
 * - Distance via Haversine
 * - Running vs Stoppage duration (speed > 1 km/h is running)
 * - Average and Max Speed
 * - Halt count & Halt locations
 */
export function calculateRouteStats(points: Location[]): RouteStats {
  const validPoints = points
    .filter(p => typeof p.latitude === 'number' && typeof p.longitude === 'number')
    .map(p => {
      const ts = p.tracker_timestamp || p.server_received_at;
      const timeMs = ts ? new Date(ts).getTime() : 0;
      return {
        latitude: p.latitude as number,
        longitude: p.longitude as number,
        speed: typeof p.speed === 'number' ? p.speed : 0,
        timeMs,
      };
    })
    .sort((a, b) => a.timeMs - b.timeMs);

  if (validPoints.length === 0) {
    return {
      kmTravelled: 0,
      totalRunningSeconds: 0,
      totalStoppageSeconds: 0,
      avgSpeedKmh: 0,
      maxSpeedKmh: 0,
      haltCount: 0,
      halts: [],
    };
  }

  let kmTravelled = 0;
  let totalRunningSeconds = 0;
  let totalStoppageSeconds = 0;
  let maxSpeedKmh = 0;
  let currentHaltSeconds = 0;
  let currentHaltPoint: { latitude: number; longitude: number } | null = null;
  const halts: { latitude: number; longitude: number; haltIndex: number; durationSeconds: number }[] = [];

  for (let i = 0; i < validPoints.length; i++) {
    const current = validPoints[i];
    if (current.speed > maxSpeedKmh) {
      maxSpeedKmh = current.speed;
    }

    if (i > 0) {
      const prev = validPoints[i - 1];
      const dist = haversineDistance(prev.latitude, prev.longitude, current.latitude, current.longitude);
      kmTravelled += dist;

      const deltaMs = Math.max(0, current.timeMs - prev.timeMs);
      const deltaSec = deltaMs / 1000;

      // Speed threshold: > 1 km/h is running, <= 1 km/h is stoppage
      const isRunning = current.speed > 1 || (dist > 0.05 && deltaSec > 0 && (dist / (deltaSec / 3600)) > 1);

      if (isRunning) {
        totalRunningSeconds += deltaSec;
        if (currentHaltPoint && currentHaltSeconds >= 10) {
          halts.push({
            latitude: currentHaltPoint.latitude,
            longitude: currentHaltPoint.longitude,
            haltIndex: halts.length + 1,
            durationSeconds: currentHaltSeconds,
          });
        }
        currentHaltPoint = null;
        currentHaltSeconds = 0;
      } else {
        totalStoppageSeconds += deltaSec;
        if (!currentHaltPoint) {
          currentHaltPoint = { latitude: current.latitude, longitude: current.longitude };
        }
        currentHaltSeconds += deltaSec;
      }
    }
  }

  if (currentHaltPoint && currentHaltSeconds >= 10) {
    halts.push({
      latitude: currentHaltPoint.latitude,
      longitude: currentHaltPoint.longitude,
      haltIndex: halts.length + 1,
      durationSeconds: currentHaltSeconds,
    });
  }

  const roundedKm = Math.round(kmTravelled * 100) / 100;
  const avgSpeedKmh = totalRunningSeconds > 0 ? Math.round((kmTravelled / (totalRunningSeconds / 3600))) : 0;

  return {
    kmTravelled: roundedKm,
    totalRunningSeconds: Math.round(totalRunningSeconds),
    totalStoppageSeconds: Math.round(totalStoppageSeconds),
    avgSpeedKmh,
    maxSpeedKmh: Math.round(maxSpeedKmh),
    haltCount: halts.length,
    halts,
  };
}

/**
 * Deterministic PRNG seeded by string
 */
function seededRandom(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * Generates a deterministic route history for demo vehicles.
 * Seeded by vehicleId, stable across renders and unit tests.
 */
export function generateDemoHistory(vehicleId: string, from: Date, to: Date): Location[] {
  const rng = seededRandom(vehicleId);
  const baseLat = 28.8950;
  const baseLon = 76.6050;

  const totalTimeMs = Math.max(3600000, to.getTime() - from.getTime());
  const pointCount = 35;
  const stepMs = totalTimeMs / pointCount;

  const points: Location[] = [];
  let currentLat = baseLat + (rng() - 0.5) * 0.02;
  let currentLon = baseLon + (rng() - 0.5) * 0.02;

  let isHalted = false;
  let haltStepsLeft = 0;

  for (let i = 0; i < pointCount; i++) {
    const pointTime = new Date(from.getTime() + i * stepMs);
    const ts = pointTime.toISOString();

    if (haltStepsLeft > 0) {
      haltStepsLeft--;
    } else {
      isHalted = rng() > 0.7;
      if (isHalted) {
        haltStepsLeft = 2 + Math.floor(rng() * 3);
      }
    }

    let speed = 0;
    let course = 0;

    if (!isHalted) {
      const dLat = (rng() - 0.48) * 0.008;
      const dLon = (rng() - 0.48) * 0.008;
      currentLat += dLat;
      currentLon += dLon;
      speed = Math.floor(25 + rng() * 45);
      course = Math.floor(rng() * 360);
    }

    points.push({
      id: `demo-loc-${vehicleId}-${i}`,
      vehicle_id: vehicleId,
      latitude: Math.round(currentLat * 100000) / 100000,
      longitude: Math.round(currentLon * 100000) / 100000,
      speed,
      course,
      ignition: speed > 0,
      satellites: 10 + Math.floor(rng() * 4),
      gps_valid: true,
      battery_percent: 85,
      gsm_signal: 4,
      server_received_at: ts,
      tracker_timestamp: ts,
      state: speed > 0 ? 'MOVING' : 'STOPPED',
    });
  }

  return points;
}
