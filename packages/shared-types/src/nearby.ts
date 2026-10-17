export const nearbyCategoryIds = ['atm','parking','hospitals','cng','petrol','charging','service','restaurants','malls','police'] as const;
export type NearbyCategory = typeof nearbyCategoryIds[number];
export const nearbyCategories: Record<NearbyCategory,{label:string;icon:string;query:string;provider:string;name?:string}> = {
 atm:{label:'ATM',icon:'🏧',query:'ATM',provider:'service.financial.atm'},
 parking:{label:'Parking',icon:'🅿️',query:'parking',provider:'parking'},
 hospitals:{label:'Hospitals',icon:'🏥',query:'hospitals',provider:'healthcare.hospital'},
 cng:{label:'CNG Pump',icon:'⛽',query:'CNG pump',provider:'service.vehicle.fuel',name:'CNG'},
 petrol:{label:'Petrol Pump',icon:'⛽',query:'petrol pump',provider:'service.vehicle.fuel'},
 charging:{label:'Charging Station',icon:'🔌',query:'EV charging station',provider:'service.vehicle.charging_station'},
 service:{label:'Service Points',icon:'🛠️',query:'vehicle repair',provider:'service.vehicle.repair'},
 restaurants:{label:'Restaurants',icon:'🍽️',query:'restaurants',provider:'catering.restaurant'},
 malls:{label:'Shopping Malls',icon:'🛍️',query:'shopping malls',provider:'commercial.shopping_mall'},
 police:{label:'Police Stations',icon:'📍',query:'police station',provider:'service.police'},
};
export interface NearbyCenter {latitude:number;longitude:number;recordedAt:string|null;stale:boolean;timeUncertain:boolean}
export interface NearbyPlace {
 id:string;name:string;latitude:number;longitude:number;address:string|null;type:string;distanceMeters:number;
 phone:string|null;openingHours:string|null;
}
export interface NearbyResult {category:NearbyCategory;center:NearbyCenter;places:NearbyPlace[];radius:number;attribution:string;limitation:string|null}
