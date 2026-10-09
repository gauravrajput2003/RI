import {beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({query:vi.fn(),lookup:vi.fn(),geocode:vi.fn(),warn:vi.fn(),env:{ADDRESS_SOURCE:'cell',OPENCELLID_API_KEY:'test',GEOAPIFY_API_KEY:'test',GT06_CELL_RADIO:'GSM'}}));
vi.mock('../../db/pool.js',()=>({query:mocks.query}));
vi.mock('../../config/env.js',()=>({env:mocks.env}));
vi.mock('../../lib/logger.js',()=>({logger:{warn:mocks.warn}}));
vi.mock('../geocoding/service.js',()=>({enrichAddresses:vi.fn(async rows=>rows)}));
vi.mock('../geocoding/provider.js',()=>({lookupAddress:mocks.geocode}));
vi.mock('./provider.js',async original=>({...await original<typeof import('./provider.js')>(),lookupCell:mocks.lookup}));
const cell={mcc:404,mnc:10,lac:100,cellId:200};
const row={id:'v',latitude:28.86777,longitude:76.5943,speed:10,gps_valid:true,protocol:'GT06',server_received_at:new Date().toISOString(),metadata:{cell},address:'GPS clinic'};
const hit={cell_key:'GSM:404:10:100:200',latitude:28.87,longitude:76.59,accuracy_m:1500,address:'Cell road',attribution:'OpenCellID',resolved_at:new Date(),expires_at:new Date(Date.now()+86400000)};
beforeEach(()=>{vi.resetModules();vi.clearAllMocks();Object.assign(mocks.env,{ADDRESS_SOURCE:'cell',OPENCELLID_API_KEY:'test',GEOAPIFY_API_KEY:'test',GT06_CELL_RADIO:'GSM'});mocks.query.mockResolvedValue({rows:[hit]});mocks.lookup.mockResolvedValue({latitude:28.87,longitude:76.59,accuracy_m:1500});mocks.geocode.mockResolvedValue({address:'Cell road'});});
describe('displayed cell addresses',()=>{
  it('keeps GPS coordinates/speed intact and distinguishes cell source',async()=>{
    const {displayedAddresses}=await import('./service.js');const [result]=await displayedAddresses([row]);
    expect(result).toMatchObject({latitude:row.latitude,longitude:row.longitude,speed:10,gps_address:'GPS clinic',address:'Cell area (approx.): Cell road',address_source:'cell',tower_status:'resolved'});
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
  it('never fabricates a cell from GPS or operator name',async()=>{
    const {displayedAddresses}=await import('./service.js');expect((await displayedAddresses([{...row,metadata:{sim_operator:'Jio'}}]))[0]).toMatchObject({address_source:'unavailable',tower_status:'missing_cell'});
    mocks.env.GT06_CELL_RADIO='';expect((await displayedAddresses([row]))[0]).toMatchObject({tower_status:'radio_required'});expect(mocks.lookup).not.toHaveBeenCalled();
  });
  it('expires live observations but evaluates historical cells at their recorded time',async()=>{
    const {displayedAddresses}=await import('./service.js');const old={...row,server_received_at:'2020-01-01T00:00:00Z'};
    expect((await displayedAddresses([old]))[0]).toMatchObject({tower_status:'stale',address_source:'unavailable'});
    expect((await displayedAddresses([old],true))[0]).toMatchObject({tower_status:'resolved',address_source:'cell'});
  });
  it('queues only changed cell keys and reverse geocodes cell coordinates, never GPS',async()=>{
    mocks.query.mockResolvedValue({rows:[]});const {displayedAddresses}=await import('./service.js');
    await displayedAddresses([row,row]);await vi.waitFor(()=>expect(mocks.geocode).toHaveBeenCalled());
    expect(mocks.lookup).toHaveBeenCalledTimes(1);expect(mocks.geocode.mock.calls[0].slice(0,2)).toEqual([28.87,76.59]);
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO cell_location_cache'),expect.any(Array));
    expect(mocks.query.mock.calls.some(([sql])=>String(sql).includes('UPDATE locations'))).toBe(false);
  });
  it('does not overwrite a cached estimate on provider failure or fall back to GPS',async()=>{
    mocks.query.mockResolvedValue({rows:[{...hit,expires_at:new Date(0)}]});mocks.lookup.mockRejectedValue(new Error('private-test-key'));
    const {displayedAddresses}=await import('./service.js');expect((await displayedAddresses([row]))[0]).toMatchObject({tower_status:'pending',address_source:'unavailable',latitude:row.latitude});
    await vi.waitFor(()=>expect(mocks.warn).toHaveBeenCalled());expect(mocks.query.mock.calls.some(([sql])=>String(sql).includes('INSERT'))).toBe(false);expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain('private-test-key');
  });
  it('preserves previous estimates on no-result and clears an address when estimate coordinates change',async()=>{
    mocks.query.mockResolvedValue({rows:[]});const {displayedAddresses}=await import('./service.js');await displayedAddresses([row]);
    await vi.waitFor(()=>expect(mocks.query.mock.calls.some(([sql])=>String(sql).includes('INSERT INTO'))).toBe(true));
    const call=mocks.query.mock.calls.find(([sql])=>String(sql).includes('INSERT INTO'))!;
    const {PGlite}=await import('@electric-sql/pglite');const {readFile}=await import('node:fs/promises');const db=new PGlite();
    try {
      const migration=await readFile(new URL('../../../../../database/migrations/022_cell_location_cache.sql',import.meta.url),'utf8');
      await db.exec(migration.split('CREATE INDEX')[0]);
      await db.query(call[0],call[1]);
      await db.query(call[0],['GSM:404:10:100:200',null,null,null,null,null,300,'not_found']);
      expect((await db.query('SELECT latitude,address,lookup_status FROM cell_location_cache')).rows[0]).toMatchObject({latitude:28.87,address:'Cell road',lookup_status:'not_found'});
      await db.query(call[0],['GSM:404:10:100:200',29,77,1500,null,'OpenCellID',3600,'resolved']);
      expect((await db.query('SELECT latitude,address FROM cell_location_cache')).rows[0]).toEqual({latitude:29,address:null});
    }finally{await db.close();}
  });
});
