import {expect,it,vi} from 'vitest';
import {nearbyCategories,nearbyCategoryIds} from '@fleet/shared-types';
import {parseDetails,parsePlaces,providerRequest} from './provider.js';
const feature=(extra:Record<string,unknown>={})=>({properties:{place_id:'a',name:'Actual provider name',lat:28.91,lon:76.61,formatted:'Provider address',...extra}});
it('maps ten categories to appropriate providers and narrows CNG by supported name filter',()=>{
 expect(nearbyCategoryIds).toHaveLength(10);expect(nearbyCategories.atm.provider).toBe('service.financial.atm');expect(nearbyCategories.hospitals.provider).toBe('healthcare.hospital');expect(nearbyCategories.cng.name).toBe('CNG');expect(new Set(Object.values(nearbyCategories).map(v=>v.provider)).size).toBe(9);
});
it('deduplicates valid places, filters bad/outside-radius positions and invents no details',()=>{
 const rows=parsePlaces({features:[feature(),feature(),feature({place_id:'b',lat:91}),feature({place_id:'c',lat:40}),feature({place_id:'d',lon:'76'}),feature({place_id:null})]},'hospitals',28.9,76.6,5000);
 expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({id:'a',name:'Actual provider name',address:'Provider address',phone:null,openingHours:null});expect(rows[0].distanceMeters).toBeGreaterThan(0);expect(rows[0]).not.toHaveProperty('rating');
 expect(parsePlaces({features:[]},'atm',28.9,76.6,5000)).toEqual([]);expect(()=>parsePlaces({},'atm',28.9,76.6,5000)).toThrow('invalid response');
});
it('reads supplied details for the matching place without replacing its coordinates',()=>{
 const place=parsePlaces({features:[feature()]},'atm',28.9,76.6,5000)[0];
 expect(parseDetails({features:[feature({lat:50,contact:{phone:'+91 1234567890'},opening_hours:'24/7'})]},place)).toMatchObject({latitude:28.91,phone:'+91 1234567890',openingHours:'24/7'});
 expect(parseDetails({features:[feature({place_id:'other',contact:{phone:'fake'}})]},place)).toEqual(place);
 expect(parseDetails({features:[{properties:{feature_type:'details',contact:{phone:'1234567890'},opening_hours:'24/7'}}]},place)).toMatchObject({phone:'1234567890',openingHours:'24/7'});
});
it('bounds provider requests, uses the fixed upstream and sanitizes failures',async()=>{
 const fetcher=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({features:[]})});
 await providerRequest('places',{categories:'healthcare.hospital'},'test-key',fetcher);const url=fetcher.mock.calls[0][0] as URL;
 expect(url.origin).toBe('https://api.geoapify.com');expect(url.searchParams.get('apiKey')).toBe('test-key');expect(fetcher.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
 fetcher.mockResolvedValueOnce({ok:false,status:429});await expect(providerRequest('places',{},'test-key',fetcher)).rejects.toMatchObject({status:429});
 fetcher.mockRejectedValueOnce(new Error('url with test-key'));await expect(providerRequest('places',{},'test-key',fetcher)).rejects.toThrow('could not be reached');
 await expect(providerRequest('places',{},'',fetcher)).rejects.toMatchObject({status:503});
});
