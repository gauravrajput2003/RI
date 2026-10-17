export interface DriverInput {name:string;mobile:string;licenceNumber:string}
export interface Driver {id:string;name:string;mobile:string;licence_number:string;created_at:string;assigned:boolean;vehicle_id:string|null;vehicle_number:string|null}
export interface VehicleDriver {assignmentId:string|null;assignedAt:string|null;driver:Driver|null}
export function validateDriver(input:DriverInput){
 const data={name:input.name.trim(),mobile:input.mobile.trim(),licenceNumber:input.licenceNumber.trim().toUpperCase().replace(/\s+/g,' ')};
 const errors:Partial<Record<keyof DriverInput,string>>={};
 if(!data.name||data.name.length>120||Array.from(data.name).some(character=>character.charCodeAt(0)<32||character.charCodeAt(0)===127))errors.name='Enter a name between 1 and 120 characters.';
 const digits=data.mobile.replace(/\D/g,'');
 if(!/^\+?[0-9 ()-]{7,20}$/.test(data.mobile)||digits.length<7||digits.length>15)errors.mobile='Enter a valid mobile number with 7–15 digits; an optional + country code is supported.';
 const licenceKey=data.licenceNumber.replace(/[^A-Z0-9]/g,'');
 if(!/^[A-Z0-9 /-]{5,40}$/.test(data.licenceNumber)||licenceKey.length<5||licenceKey.length>30)errors.licenceNumber='Enter a licence number with 5–30 letters/digits. Spaces, / and - are allowed.';
 if(!errors.mobile)data.mobile=(data.mobile.startsWith('+')?'+':'')+digits;
 return {data,errors,valid:Object.keys(errors).length===0};
}
