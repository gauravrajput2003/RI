/** Database/configuration protocol key. New adapters do not require shared-type changes. */
export type DeviceProtocol = string;
export type DeviceState = 'ONLINE' | 'OFFLINE' | 'MOVING' | 'IDLE' | 'STOPPED' | 'UNKNOWN';
export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'USER';
export interface NormalizedLocation {
  deviceId: string | null; vehicleId: string | null; imei: string; protocol: DeviceProtocol;
  trackerTimestamp: Date | null; serverReceivedAt: Date; latitude: number | null; longitude: number | null;
  speed: number | null; course: number | null; ignition: boolean | null; satellites: number | null; gpsValid: boolean;
  batteryPercent: number | null; batteryVoltage: number | null; gsmSignal: number | null; odometer: number | null;
  ac: boolean | null; door: boolean | null; relay: boolean | null; metadata: Record<string, unknown>;
}
export interface DecodedMessage { type: 'login' | 'heartbeat' | 'location' | 'additional'; imei?: string; location?: NormalizedLocation; acknowledgement?: Uint8Array; metadata?: Record<string, unknown>; }
export interface DeviceIdentity { identityType: string; identityValue: string; protocol: DeviceProtocol; serverReceivedAt: Date; }
export interface NormalizedDeviceStatus { deviceId:string|null; protocol:DeviceProtocol; serverReceivedAt:Date; lastHeartbeatAt:Date|null; state:DeviceState; metadata:Record<string,unknown>; }
