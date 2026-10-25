import type {Socket} from 'node:net';
export interface TrackerBinding {imei:string;deviceId:string;connectionId:string;protocol:string;socket:Socket}
/** One socket per IMEI. Device UUID lookups always resolve through these same entries. */
export class TrackerSockets {
 private entries=new Map<string,TrackerBinding>();
 replace(binding:TrackerBinding){const previous=this.entries.get(binding.imei);this.entries.set(binding.imei,binding);if(previous&&previous.socket!==binding.socket)previous.socket.destroy();return previous;}
 remove(connectionId:string,socket?:Socket){for(const [imei,b] of this.entries)if(b.connectionId===connectionId&&(!socket||socket===b.socket)){this.entries.delete(imei);return b;}}
 get(imei:string){return this.entries.get(imei);}
 byDevice(id:string){return [...this.entries.values()].find(b=>b.deviceId===id);}
 byConnection(id:string){return [...this.entries.values()].find(b=>b.connectionId===id);}
 values(){return this.entries.values();}
}
