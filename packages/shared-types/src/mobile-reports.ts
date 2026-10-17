export type MobileReportKind='distance'|'travel-summary';
export interface MobileReportRow {
 id:string;date:string;pointCount:number;gpsPointCount:number;
 km:number|null;avgSpeed:number|null;maxSpeed:number|null;durationSeconds:number|null;
 runningSeconds:number|null;idleSeconds:number|null;stoppedSeconds:number|null;unreachableSeconds:number|null;halts:number|null;
 startTime:string|null;endTime:string|null;
 startLocation:{latitude:number;longitude:number}|null;endLocation:{latitude:number;longitude:number}|null;
 startAddress:string|null;endAddress:string|null;partial:boolean;
}
export interface MobileReport {
 kind:MobileReportKind;vehicle:{id:string;vehicleNumber:string;vehicleType:string|null};
 filters:{start:string;end:string;timeZone:string};rows:MobileReportRow[];
 generatedAt:string;snapshotId:string|null;
}
