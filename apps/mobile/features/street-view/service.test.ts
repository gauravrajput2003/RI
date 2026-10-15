import {beforeEach,expect,it,vi} from 'vitest';
import type {Location} from '../../types/models';
import {googleLocationUrl,loadStreetPosition,openGoogleLocation,selectStreetPosition,validGps} from './service';
const mock=vi.hoisted(()=>({latest:vi.fn(),open:vi.fn(),online:vi.fn(),session:'session' as string|null,live:{} as Record<string,Location>}));
vi.mock('react-native',()=>({Linking:{openURL:mock.open}}));
vi.mock('../../services/api/vehicles',()=>({getLatestLocation:mock.latest}));
vi.mock('../../services/api/mobile',()=>({requireOnline:mock.online}));
vi.mock('../../store/authStore',()=>({useAuthStore:{getState:()=>({sessionKey:mock.session})}}));
vi.mock('../../store/liveVehicleStore',()=>({useLiveVehicleStore:{getState:()=>({byVehicleId:mock.live})}}));
const now=Date.parse('2026-10-14T10:00:00Z');
const fix=(extra:Partial<Location>={}):Location=>({vehicle_id:'own',latitude:28.9,longitude:76.6,gps_valid:true,tracker_timestamp:'2026-10-14T09:59:00Z',server_received_at:'2026-10-14T10:00:00Z',...extra});
beforeEach(()=>{vi.resetAllMocks();mock.session='session';mock.live={};mock.latest.mockResolvedValue(fix());mock.open.mockResolvedValue(undefined)});
it('accepts GPS independently of tower-based address and validates ranges/identity',()=>{
 expect(validGps('own',fix({address_source:'cell'}))).toBe(true);
 for(const point of [fix({latitude:NaN}),fix({longitude:Infinity}),fix({latitude:91}),fix({longitude:-181}),fix({latitude:0,longitude:0}),fix({gps_valid:false}),fix({vehicle_id:'other'})])expect(validGps('own',point)).toBe(false);
 expect(()=>selectStreetPosition('own',fix({vehicle_id:'other'}))).toThrow('selected vehicle');
 expect(()=>selectStreetPosition('own',null,fix())).toThrow('No valid');
});
it('uses GPS time, not receipt/heartbeat time, for freshness and newer socket fixes',()=>{
 expect(selectStreetPosition('own',fix(),fix({tracker_timestamp:'2007-02-28T01:00:00Z'}),now).stale).toBe(false);
 expect(selectStreetPosition('own',fix(),fix({latitude:29,tracker_timestamp:'2026-10-14T10:00:00Z'}),now).latitude).toBe(29);
 expect(selectStreetPosition('own',fix({tracker_timestamp:'2007-02-28T01:00:00Z'}),undefined,now).stale).toBe(true);
 for(const timestamp of [null,'invalid','2026-10-15T00:00:00Z'])expect(selectStreetPosition('own',fix({tracker_timestamp:timestamp}),undefined,now).timeUncertain).toBe(true);
});
it('loads selected ID through authenticated API and never uses cache on failure',async()=>{
 const signal=new AbortController().signal;
 await loadStreetPosition('own',signal);expect(mock.latest).toHaveBeenCalledWith('own',signal);
 mock.live.own=fix();mock.latest.mockRejectedValue(new Error('Forbidden'));
 await expect(loadStreetPosition('own',signal)).rejects.toThrow('Forbidden');
 mock.latest.mockReset();mock.online.mockImplementation(()=>{throw new Error('offline')});
 await expect(loadStreetPosition('own',signal)).rejects.toThrow('offline');expect(mock.latest).not.toHaveBeenCalled();
});
it('rejects results after logout or cancellation',async()=>{
 mock.latest.mockImplementation(async()=>{mock.session=null;return fix()});
 await expect(loadStreetPosition('own',new AbortController().signal)).rejects.toThrow('session');
 mock.session='session';mock.latest.mockResolvedValue(fix());const controller=new AbortController();controller.abort();
 await expect(loadStreetPosition('own',controller.signal)).rejects.toThrow('session');
});
it('creates supported Google URLs for the exact GPS, with no key or phone position',async()=>{
 const point=selectStreetPosition('own',fix(),undefined,now);
 expect(googleLocationUrl(point,'street')).toBe('https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=28.9%2C76.6');
 expect(googleLocationUrl(point,'map')).toContain('query=28.9%2C76.6');
 expect(mock.open).not.toHaveBeenCalled();await expect(openGoogleLocation(point,'street')).resolves.toBe('street');
 expect(mock.open).toHaveBeenCalledOnce();
});
it('falls back to the same GPS on a normal map only when URL opening fails',async()=>{
 const point=selectStreetPosition('own',fix(),undefined,now);
 mock.open.mockRejectedValueOnce(new Error('No handler'));
 await expect(openGoogleLocation(point,'street')).resolves.toBe('map');expect(mock.open.mock.calls[1][0]).toBe(googleLocationUrl(point,'map'));
 mock.open.mockRejectedValue(new Error('No handler'));
 await expect(openGoogleLocation(point,'street')).rejects.toThrow('Could not open');
});
