import {describe,it,expect} from 'vitest';
import {resolveGpsTimestamp} from '../src/protocols/gt06/timestamp.js';
import {readFileSync} from 'node:fs';
import {Gt06Decoder} from '../src/protocols/gt06/decoder.js';

describe('GT06 GPS week rollover',()=>{
  it('uses the corrected event time during actual frame decoding',()=>{
    const frame=Buffer.from(readFileSync(new URL('./fixtures/gt06/location.hex',import.meta.url),'utf8').trim(),'hex');
    const original=new Date('2006-12-28T16:42:14Z');
    const corrected=new Date(+original+1024*7*86400000);
    const location=new Gt06Decoder().decode(frame,new Date(+corrected+2000)).location!;
    expect(location.trackerTimestamp).toEqual(corrected);
    expect(location.metadata).toMatchObject({gpsTimestampCorrection:{originalTimestamp:original.toISOString()}});
    expect(location.speed).toBe(24);
    expect(location.latitude).toBeCloseTo(28.879542,5);
  });
  it('corrects the reported epoch while retaining the actual upload delay',()=>{
    const raw=new Date('2007-02-28T01:22:53Z');
    const result=resolveGpsTimestamp(raw,new Date('2026-10-14T05:02:31.452Z'));
    expect(result.timestamp?.toISOString()).toBe('2026-10-14T01:22:53.000Z');
    expect(result.metadata).toMatchObject({gpsTimestampCorrection:{originalTimestamp:raw.toISOString(),offsetWeeks:1024}});
    expect(raw.toISOString()).toBe('2007-02-28T01:22:53.000Z');
  });
  it('leaves correct dates and genuinely old history unchanged',()=>{
    const receipt=new Date('2026-10-14T05:02:31Z');
    for(const value of ['2026-10-14T05:02:30Z','2026-10-09T03:51:30Z','2006-12-28T16:42:14Z']) {
      const raw=new Date(value);
      expect(resolveGpsTimestamp(raw,receipt)).toEqual({timestamp:raw,metadata:{}});
    }
  });
  it('rejects a rollover candidate in the future or beyond the upload window',()=>{
    const raw=new Date('2007-02-28T01:22:53Z');
    for(const receipt of ['2026-10-14T01:20:00Z','2026-10-22T01:22:53Z']) {
      expect(resolveGpsTimestamp(raw,new Date(receipt))).toEqual({timestamp:raw,metadata:{}});
    }
    expect(resolveGpsTimestamp(null,new Date())).toEqual({timestamp:null,metadata:{}});
  });
});
