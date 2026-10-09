import {describe,it,expect,vi} from 'vitest';
import {reportedCell,lookupCell,cellKey} from './provider.js';
describe('cell identifiers and OpenCellID contract (not live coverage)',()=>{
  it('requires reported identifiers and a known radio, not a SIM brand',()=>{
    expect(reportedCell({sim_operator:'Airtel'},'GT06')).toBeNull();
    expect(reportedCell({cell:{mcc:404,mnc:10,lac:100,cellId:200}},'GT06')?.radio).toBeNull();
    expect(reportedCell({cell:{mcc:404,mnc:10,lac:100,cellId:200}},'GT06','GSM')?.radio).toBe('GSM');
    expect(reportedCell({mcc:404,mnc:10,lac:65535,cellId:200},'W15')).toBeNull();
  });
  it.each([{mcc:404,mnc:10,lac:100,cellId:200,radio:'GSM'}, {mcc:405,mnc:840,lac:100,cellId:123456,radio:'LTE'}])('uses the same resolver for network $mcc/$mnc',async cell=>{
    const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({lat:28.87,lon:76.59,mcc:cell.mcc,mnc:cell.mnc,lac:cell.lac,cellid:cell.cellId,radio:cell.radio,range:1500})));
    expect(await lookupCell(cell,'private-test-key',fetcher)).toEqual({latitude:28.87,longitude:76.59,accuracy_m:1500});
    const url=fetcher.mock.calls[0][0] as URL;expect(url.hostname).toBe('opencellid.org');expect(url.searchParams.get('mnc')).toBe(String(cell.mnc));
    expect(cellKey(cell)).not.toBe(cellKey({...cell,cellId:cell.cellId+1}));
  });
  it('rejects no-result, wrong cells, unknown radio and rate limits',async()=>{
    const cell={mcc:404,mnc:10,lac:100,cellId:200,radio:'GSM'};
    expect(await lookupCell(cell,'test',vi.fn().mockResolvedValue(new Response('{"error":"Cell not found","code":1}')))).toBeNull();
    expect(await lookupCell(cell,'test',vi.fn().mockResolvedValue(new Response('{"lat":28,"lon":76,"radio":"LTE"}')))).toBeNull();
    await expect(lookupCell({...cell,radio:null},'test')).rejects.toThrow('Radio');
    await expect(lookupCell(cell,'test',vi.fn().mockResolvedValue(new Response('',{status:429})))).rejects.toThrow('unavailable');
  });
});
