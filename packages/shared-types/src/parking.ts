export const PARKING_RADII=[20,30,40,50] as const;
export const PARKING_INTERVALS=[1,2,5,10] as const;
export interface ParkingInput {enabled:boolean;radius:number;repeatMinutes:number;expectedVersion:number|null}
export interface ParkingMode {
 vehicleId:string;vehicleNumber:string;enabled:boolean;version:number|null;
 radius:number;repeatMinutes:number;activatedAt:string|null;referenceAt:string|null;
 reference:{latitude:number;longitude:number}|null;
 boundaryState:'inside'|'outside'|'unknown';lastEvaluatedAt:string|null;distanceMeters:number|null;
 pushAvailable?:boolean;monitoring:boolean;message:string;canEnable:boolean;
 history:Array<{id:string;eventType:string;message:string;occurredAt:string;metadata:Record<string,unknown>}>;
}
