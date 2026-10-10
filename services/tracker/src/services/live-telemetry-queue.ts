import type {NormalizedLocation} from '@fleet/shared-types';
import type {TelemetryBoundary} from './telemetry-boundary.js';

/** Database persistence is complete before enqueue. This is best-effort live
 * delivery, not a durable outbox: clients can recover saved positions via REST.
 * A serial, bounded worker prevents API latency from blocking tracker ACKs or
 * creating unbounded concurrent requests during an API outage. */
export class LiveTelemetryQueue {
  private readonly pending:NormalizedLocation[]=[];
  private running=false;
  private readonly waiters:Array<()=>void>=[];
  constructor(private readonly publisher:TelemetryBoundary,
    private readonly failed:(error:unknown,location:NormalizedLocation)=>void,
    private readonly overflow:(location:NormalizedLocation)=>void,
    private readonly capacity=100){}

  enqueue(location:NormalizedLocation):void {
    if(this.pending.length>=this.capacity){const dropped=this.pending.shift()!;this.overflow(dropped)}
    this.pending.push(location);
    if(!this.running){this.running=true;void this.drain()}
  }
  idle():Promise<void>{return this.running?new Promise(resolve=>this.waiters.push(resolve)):Promise.resolve()}
  private async drain():Promise<void>{
    try{
      while(this.pending.length){const location=this.pending.shift()!;
        try{await this.publisher.publishLocation(location)}catch(error){this.failed(error,location)}
      }
    }finally{this.running=false;for(const resolve of this.waiters.splice(0))resolve()}
  }
}
