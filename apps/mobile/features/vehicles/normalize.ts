import { z } from 'zod';
import type { Location, Vehicle } from '../../types/models';

const timestamp = z.string().refine(value => Number.isFinite(Date.parse(value)));
const numeric = z.union([z.number().finite(), z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number)]);
const nullableNumber = numeric.nullable().optional();
const activity = { state: z.enum(['ONLINE','OFFLINE','MOVING','IDLE','STOPPED']).optional(), last_seen_at: timestamp.nullable().optional(), status_checked_at: timestamp.optional(), offline_at: timestamp.nullable().optional() };
const locationSchema = z.object({
  ...activity,
  vehicle_id: z.string().optional(), tracker_timestamp: timestamp.nullable().optional(),
  server_received_at: timestamp, latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  speed: nullableNumber, course: nullableNumber, ignition: z.boolean().nullable().optional(),
  satellites: nullableNumber, gps_valid: z.boolean().nullable().optional(), battery_percent: nullableNumber,
  gsm_signal: nullableNumber,
});
export function normalizeLocation(input: unknown): Location | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const mapped = { ...raw };
  for (const [camel, snake] of Object.entries({ vehicleId:'vehicle_id', trackerTimestamp:'tracker_timestamp', serverReceivedAt:'server_received_at', gpsValid:'gps_valid', batteryPercent:'battery_percent', gsmSignal:'gsm_signal' })) {
    if (raw[camel] !== undefined) mapped[snake] = raw[camel];
  }
  const parsed = locationSchema.safeParse(mapped);
  return parsed.success ? parsed.data as Location : null;
}
export const vehicleSchema = z.object({
  ...activity,
  id: z.string(), vehicle_number: z.string(), alias: z.string().nullable().default(null),
  vehicle_type: z.string().nullable().default(null), odometer: numeric.nullable().default(null),
  active: z.boolean(), protocol: z.string().optional(),
});
export function normalizeVehicles(input: unknown): Vehicle[] {
  return z.array(vehicleSchema).parse(input);
}
export function normalizeHistory(input: unknown): Location[] {
  if (!Array.isArray(input)) return [];
  return input.map(normalizeLocation).filter((loc): loc is Location => loc !== null);
}


