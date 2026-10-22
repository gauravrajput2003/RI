export interface LiveMapData {
 vehicleId:string;generatedAt:string;day:string;timeZone:string;
 todayKm:number|null;totalKm:number|null;todayRunningSeconds:number|null;todayIdleSeconds:number|null;todayStoppedSeconds:number|null;
 avgSpeed:number|null;maxSpeed:number|null;fromLastStopKm:number|null;fromLastStopSeconds:number|null;
 path:Array<Array<{latitude:number;longitude:number}>>;pathUnavailable:string|null;
}
