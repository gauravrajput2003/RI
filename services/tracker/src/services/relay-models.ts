import {redactRelayText,type RelayModels} from '@fleet/shared-types';
export {parseRelayModels,relayModelCommand} from '@fleet/shared-types';
export type {RelayModel,RelayModels} from '@fleet/shared-types';

/** Custom text may contain credentials even without a password placeholder. Mask ALL its bytes. */
export function relayWireEvidence(frame:Buffer,text:string,model:string|null){
 if(!model)return {hex:frame.toString('hex'),text,redacted:false};
 const contentEnd=9+Buffer.byteLength(text,'ascii');
 return {hex:frame.subarray(0,9).toString('hex')+'**'.repeat(contentEnd-9)+frame.subarray(contentEnd,-4).toString('hex')+'****0d0a',text:'[configured model command redacted]',redacted:true};
}
export function redactRelayReply(models:RelayModels,text:string,hex:string){
 const secrets=new Set<string>();
 for(const model of Object.values(models)){
  if(model.password)secrets.add(model.password);
  for(const command of [model.lock,model.unlock]){const embedded=command.match(/^(?:DYD|HFYD),([^#{}]+)#$/i)?.[1];if(embedded)secrets.add(embedded);}
  secrets.add(model.lock.replaceAll('{password}',model.password??''));secrets.add(model.unlock.replaceAll('{password}',model.password??''));
 }
 for(const secret of [...secrets].sort((a,b)=>b.length-a.length)){
  text=text.split(secret).join('[redacted]');
  for(const bytes of [Buffer.from(secret,'ascii'),Buffer.from(secret,'utf16le').swap16()])hex=hex.split(bytes.toString('hex')).join('**'.repeat(bytes.length));
 }
 text=redactRelayText(models,text);
 if(hex.includes('**')&&hex.endsWith('0d0a'))hex=hex.slice(0,-8)+'****0d0a';
 return {text,hex};
}
