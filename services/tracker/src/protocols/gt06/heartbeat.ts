import {validGt06Frame} from './parser.js';
/** Client PDF §5.3.1.4. Clones can differ: always retain the raw byte as evidence. */
export function heartbeatRelayInfo(frame:Buffer){
 if(frame[3]!==0x13||!validGt06Frame(frame)||frame.length<15)return null;
 const raw=frame[4];
 return {terminalInfo:raw,relay_state_reported:(raw&0x80)!==0,gpsPositioned:(raw&0x40)!==0,alarmCode:(raw>>3)&7,externalPower:(raw&4)!==0,ignition:(raw&2)!==0,armed:(raw&1)!==0};
}
