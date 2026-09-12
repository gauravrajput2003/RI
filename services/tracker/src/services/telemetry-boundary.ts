import type { NormalizedLocation } from '@fleet/shared-types';
/** Future Redis/HTTP adapter plugs in here; protocol decoders never know API or Socket.IO. */
export interface TelemetryBoundary {publishLocation(location:NormalizedLocation):Promise<void>}
