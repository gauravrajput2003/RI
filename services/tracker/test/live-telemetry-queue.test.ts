import {describe,it,expect,vi} from 'vitest';
import type {NormalizedLocation} from '@fleet/shared-types';
import {LiveTelemetryQueue} from '../src/services/live-telemetry-queue.js';
const sample=(imei:string)=>({imei} as NormalizedLocation);
describe('live delivery independently of tracker ingestion',()=>{
  it('returns immediately while the API is hung and preserves delivery order',async()=>{
    let release!:()=>void;
    const blocked=new Promise<void>(resolve=>{release=resolve});
    const publish=vi.fn().mockImplementationOnce(()=>blocked).mockResolvedValue(undefined);
    const queue=new LiveTelemetryQueue({publishLocation:publish},vi.fn(),vi.fn());
    expect(queue.enqueue(sample('a'))).toBeUndefined();
    queue.enqueue(sample('b'));
    expect(publish).toHaveBeenCalledTimes(1);
    release();await queue.idle();
    expect(publish.mock.calls.map(call=>call[0].imei)).toEqual(['a','b']);
  });
  it('continues after an API failure without throwing into packet processing',async()=>{
    const error=new Error('API stopped');const failed=vi.fn();
    const publish=vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined);
    const queue=new LiveTelemetryQueue({publishLocation:publish},failed,vi.fn());
    queue.enqueue(sample('a'));queue.enqueue(sample('b'));await queue.idle();
    expect(failed).toHaveBeenCalledWith(error,sample('a'));
    expect(publish).toHaveBeenCalledTimes(2);
  });
  it('bounds buffered updates during an outage, keeping the newest saved updates',async()=>{
    let release!:()=>void;const blocked=new Promise<void>(resolve=>{release=resolve});
    const publish=vi.fn().mockImplementationOnce(()=>blocked).mockResolvedValue(undefined);const overflow=vi.fn();
    const queue=new LiveTelemetryQueue({publishLocation:publish},vi.fn(),overflow,2);
    for(const id of ['a','b','c','d'])queue.enqueue(sample(id));
    expect(overflow).toHaveBeenCalledWith(sample('b'));
    release();await queue.idle();
    expect(publish.mock.calls.map(call=>call[0].imei)).toEqual(['a','c','d']);
  });
});
