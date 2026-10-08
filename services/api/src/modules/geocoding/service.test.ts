import {beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({query:vi.fn(),lookup:vi.fn(),env:{GEOAPIFY_API_KEY:'test'},warn:vi.fn()}));
vi.mock('../../db/pool.js',()=>({query:mocks.query}));
vi.mock('../../config/env.js',()=>({env:mocks.env}));
vi.mock('../../lib/logger.js',()=>({logger:{warn:mocks.warn}}));
vi.mock('./provider.js',async original=>({...await original<typeof import('./provider.js')>(),lookupAddress:mocks.lookup}));
const point={id:'vehicle',latitude:28.867806,longitude:76.594305,gps_valid:true,address:null};
beforeEach(()=>{vi.resetModules();vi.clearAllMocks();mocks.env.GEOAPIFY_API_KEY='test';mocks.query.mockResolvedValue({rows:[]});mocks.lookup.mockResolvedValue({address:'Rohtak',attribution:'Geoapify'});});
describe('address enrichment',()=>{
  it('returns cached addresses without provider calls',async()=>{
    mocks.query.mockResolvedValue({rows:[{coordinate_key:'28.8678,76.5943',address:'Rohtak',attribution:'Geoapify'}]});
    const {enrichAddresses}=await import('./service.js');expect((await enrichAddresses([point]))[0].address).toBe('Rohtak');expect(mocks.lookup).not.toHaveBeenCalled();
  });
  it('queues one lookup for repeated coordinates, caches and annotates only that vehicle',async()=>{
    const {enrichAddresses}=await import('./service.js');expect(await enrichAddresses([point,point])).toEqual([point,point]);
    await vi.waitFor(()=>expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE locations'),['vehicle',point.latitude,point.longitude,'Rohtak','Geoapify']));
    expect(mocks.lookup).toHaveBeenCalledTimes(1);expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO reverse_geocode_cache'),['28.8678,76.5943','Rohtak','Geoapify',2592000]);
  });
  it('does not request invalid fixes or request anything when unconfigured',async()=>{
    const {enrichAddresses}=await import('./service.js');await enrichAddresses([{...point,latitude:0,longitude:0}]);mocks.env.GEOAPIFY_API_KEY='';expect(await enrichAddresses([point])).toEqual([point]);expect(mocks.query).not.toHaveBeenCalled();expect(mocks.lookup).not.toHaveBeenCalled();
  });
  it('keeps GPS responses successful during provider and cache failure',async()=>{
    mocks.lookup.mockRejectedValue(new Error('secret-key'));const {enrichAddresses}=await import('./service.js');expect(await enrichAddresses([point])).toEqual([point]);
    await vi.waitFor(()=>expect(mocks.warn).toHaveBeenCalled());expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain('secret-key');
    mocks.query.mockRejectedValue(new Error('cache down'));expect(await enrichAddresses([point])).toEqual([point]);
  });
});
