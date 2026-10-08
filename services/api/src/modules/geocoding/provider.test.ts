import {describe,it,expect,vi} from 'vitest';
import {coordinateKey,lookupAddress} from './provider.js';
describe('reverse geocoding provider',()=>{
  it('rejects missing, invalid and no-fix coordinates, preserving valid equator/meridian fixes',()=>{
    for(const [lat,lon,valid] of [[null,1,true],[NaN,1,true],[91,1,true],[1,181,true],[0,0,true],[28,76,false]]) expect(coordinateKey(lat,lon,valid)).toBeNull();
    expect(coordinateKey(0,76,true)).toBe('0.0000,76.0000');
    expect(coordinateKey(28.867806,76.594305)).toBe('28.8678,76.5943');
  });
  it('requests original coordinates and returns the formatted address with attribution',async()=>{
    const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({results:[{formatted:' Depot Road, Rohtak, India '}]})});
    const result=await lookupAddress(28.867806,76.594305,'test-key',fetcher);
    expect(result).toEqual({address:'Depot Road, Rohtak, India',attribution:expect.stringContaining('Geoapify')});
    const url=new URL(fetcher.mock.calls[0][0]);expect(url.searchParams.get('lat')).toBe('28.867806');expect(url.searchParams.get('format')).toBe('json');
  });
  it('handles no match and provider errors without exposing the key',async()=>{
    expect(await lookupAddress(28,76,'secret',vi.fn().mockResolvedValue({ok:true,json:async()=>({results:[]})}))).toBeNull();
    await expect(lookupAddress(28,76,'secret',vi.fn().mockResolvedValue({ok:false,status:429}))).rejects.toThrow('HTTP 429');
  });
});
