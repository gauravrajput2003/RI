import {beforeEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({latest:vi.fn(),find:vi.fn(),provider:vi.fn()}));
vi.mock('../vehicles/repository.js',()=>({latestLocation:mock.latest,findVehicle:mock.find}));
vi.mock('../../config/env.js',()=>({env:{GEOAPIFY_API_KEY:'test-key'}}));
vi.mock('./provider.js',async original=>({...await original<typeof import('./provider.js')>(),providerRequest:mock.provider}));
const point={vehicle_id:'own',latitude:28.9,longitude:76.6,gps_valid:true,tracker_timestamp:new Date().toISOString(),server_received_at:new Date().toISOString()};
beforeEach(()=>{vi.resetModules();vi.clearAllMocks();mock.latest.mockResolvedValue({rows:[point]});mock.find.mockResolvedValue({rows:[{id:'own'}]});mock.provider.mockResolvedValue({features:[{properties:{place_id:'place',lat:28.901,lon:76.601,name:'Provider hospital'}}]});});
it('derives own GPS, caches/coalesces requests, but reauthorizes before each cache read',async()=>{
 const {nearbySearch}=await import('./service.js');const [a,b]=await Promise.all([nearbySearch('actor','own','hospitals',5000),nearbySearch('actor','own','hospitals',5000)]);
 expect(a).toEqual(b);expect(a.center).toMatchObject({latitude:28.9,longitude:76.6,stale:false});expect(mock.latest).toHaveBeenCalledWith('own','actor');expect(mock.provider).toHaveBeenCalledTimes(1);
 expect(mock.provider.mock.calls[0][1]).toMatchObject({categories:'healthcare.hospital',filter:'circle:76.6,28.9,5000'});
 mock.latest.mockResolvedValue({rows:[]});await expect(nearbySearch('other','own','hospitals',5000)).rejects.toMatchObject({status:422});expect(mock.provider).toHaveBeenCalledTimes(1);
});
it('rejects cell-only/bad/mismatched GPS and detects stale/future time independently of receipt',async()=>{
 const {vehicleCenter}=await import('./service.js');for(const p of [undefined,{...point,gps_valid:false},{...point,latitude:NaN},{...point,vehicle_id:'other'}])expect(()=>vehicleCenter(p,'own')).toThrow('valid recorded GPS');
 expect(vehicleCenter({...point,tracker_timestamp:'2007-02-28T01:00:00Z'},'own').stale).toBe(true);expect(vehicleCenter({...point,tracker_timestamp:null},'own').timeUncertain).toBe(true);
 expect(vehicleCenter({...point,tracker_timestamp:'2099-01-01T00:00:00Z'},'own').timeUncertain).toBe(true);
});
it('details require an unexpired result from the same user and vehicle, plus current ownership',async()=>{
 const {nearbySearch,nearbyDetails}=await import('./service.js');await nearbySearch('actor','own','hospitals',5000);
 await expect(nearbyDetails('other','own','hospitals','place')).rejects.toMatchObject({status:404});
 mock.provider.mockResolvedValue({features:[{properties:{place_id:'place',contact:{phone:'1234567890'},opening_hours:'24/7'}}]});
 expect(await nearbyDetails('actor','own','hospitals','place')).toMatchObject({phone:'1234567890',openingHours:'24/7'});
 mock.find.mockResolvedValue({rows:[]});await expect(nearbyDetails('actor','own','hospitals','place')).rejects.toMatchObject({status:404});
});
