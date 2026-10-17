import {beforeEach,expect,it,vi} from 'vitest';
import {handleOpenNearbyInGoogleMaps,handleShowNearbyInApp,loadNearby,nearbyCategoryIds,nearbyGoogleUrl,placeAction,type NearbyPlace} from './service';
const mock=vi.hoisted(()=>({open:vi.fn(),share:vi.fn(),get:vi.fn(),gps:vi.fn(),online:vi.fn(),session:'session'}));
vi.mock('react-native',()=>({Linking:{openURL:mock.open},Share:{share:mock.share}}));
vi.mock('../../services/api/client',()=>({api:{get:mock.get}}));
vi.mock('../../services/api/mobile',()=>({requireOnline:mock.online}));
vi.mock('../street-view/service',()=>({loadStreetPosition:mock.gps}));
vi.mock('../../store/authStore',()=>({useAuthStore:{getState:()=>({sessionKey:mock.session})}}));
const center={latitude:28.9,longitude:76.6,recordedAt:'2026-10-16T10:00:00Z',stale:false,timeUncertain:false};
const place:NearbyPlace={id:'p',name:'Provider name',latitude:28.91,longitude:76.61,address:'Provider road',type:'Hospitals',distanceMeters:1000,phone:'+91 1234567890',openingHours:null};
beforeEach(()=>{vi.resetAllMocks();mock.session='session';mock.gps.mockResolvedValue(center);mock.get.mockResolvedValue({data:{data:{center,places:[]}}});mock.open.mockResolvedValue(undefined)});
it('all ten first-icon handlers navigate internally with the selected ID and never open any URL',()=>{
 const navigate=vi.fn();for(const category of nearbyCategoryIds)handleShowNearbyInApp(category,{id:'selected',vehicle_number:'OWN'},navigate);
 expect(navigate).toHaveBeenCalledTimes(10);expect(navigate).toHaveBeenCalledWith({vehicleId:'selected',vehicleNumber:'OWN',category:'hospitals'});expect(mock.open).not.toHaveBeenCalled();expect(mock.gps).not.toHaveBeenCalled();
});
it('external Hospitals/ATM use authenticated selected-vehicle GPS and distinct supported queries',async()=>{
 const signal=new AbortController().signal,review=vi.fn();for(const category of ['hospitals','atm'] as const)await handleOpenNearbyInGoogleMaps(category,'selected',signal,review);
 expect(mock.gps).toHaveBeenCalledWith('selected',signal);expect(mock.open.mock.calls[0][0]).toBe(nearbyGoogleUrl('hospitals',center));expect(mock.open.mock.calls[1][0]).toContain('ATM%20near%2028.9%2C76.6');expect(review).not.toHaveBeenCalled();
});
it('rejects missing GPS, declines stale fixes and reports external failure',async()=>{
 const signal=new AbortController().signal;mock.gps.mockRejectedValueOnce(new Error('No GPS'));await expect(handleOpenNearbyInGoogleMaps('atm','selected',signal,vi.fn())).rejects.toThrow('No GPS');expect(mock.open).not.toHaveBeenCalled();
 mock.gps.mockResolvedValueOnce({...center,stale:true});await handleOpenNearbyInGoogleMaps('atm','selected',signal,async()=>false);expect(mock.open).not.toHaveBeenCalled();
 mock.open.mockRejectedValue(new Error('No handler'));await expect(handleOpenNearbyInGoogleMaps('atm','selected',signal,vi.fn())).rejects.toThrow('Could not open');
});
it('in-app provider request sends vehicle ID/category/radius, never phone coordinates, and rejects obsolete sessions',async()=>{
 const signal=new AbortController().signal;await loadNearby('selected','atm',5000,signal);expect(mock.get).toHaveBeenCalledWith('/vehicles/selected/nearby',{params:{category:'atm',radius:5000},signal});
 mock.get.mockImplementation(async()=>{mock.session='changed';return {data:{data:{}}}});await expect(loadNearby('selected','atm',5000,signal)).rejects.toThrow('session');
});
it('Directions, Call and Share use returned place fields, and directions originate at vehicle GPS',async()=>{
 await placeAction('directions',place,center);expect(mock.open.mock.calls[0][0]).toContain('origin=28.9%2C76.6&destination=28.91%2C76.61');
 await placeAction('call',place,center);expect(mock.open).toHaveBeenCalledWith('tel:+911234567890');
 await placeAction('share',place,center);expect(mock.share.mock.calls[0][0].message).toContain('Provider name\nProvider road\nhttps://www.google.com/maps/search/');
 await expect(placeAction('call',{...place,phone:null},center)).rejects.toThrow('No usable');
});
