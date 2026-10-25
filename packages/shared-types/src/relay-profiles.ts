import type {RelayAction} from './relay.js';
export interface RelayModel {lock:string;unlock:string;password?:string;lockSuccess:string;unlockSuccess:string;languageField?:boolean}
export type RelayModels=Record<string,RelayModel>;
/** Only operator-supplied templates; no built-in candidate/password list. */
export function parseRelayModels(raw='{}'):RelayModels{
 let value:unknown;try{value=JSON.parse(raw);}catch{throw new Error('GT06_RELAY_MODELS must be valid JSON');}
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('GT06_RELAY_MODELS must be a model object');
 for(const [model,entry] of Object.entries(value)){
  const item=entry as RelayModel;
  if(!/^[A-Za-z0-9_-]{1,64}$/.test(model)||!item||typeof item!=='object'||Array.isArray(item))throw new Error('Invalid relay model');
  if(item.password!==undefined&&(typeof item.password!=='string'||!/^\d{1,16}$/.test(item.password)))throw new Error('Invalid configured relay password');
  if(item.languageField!==undefined&&typeof item.languageField!=='boolean')throw new Error('Invalid relay language field setting');
  for(const action of ['lock','unlock'] as const){
   const command=item[action];
   if(typeof command!=='string'||(command.includes('{password}')&&!item.password))throw new Error('Missing relay command/password');
   const resolved=command.replaceAll('{password}',item.password??'');
   if(!/^[\x20-\x7e]{1,240}#$/.test(resolved)||/[{}]/.test(resolved))throw new Error('Invalid relay command');
   const success=item[`${action}Success`];
   if(typeof success!=='string'||!success.trim()||success!==success.trim()||success.length>240)throw new Error('Exact success text required');
   if(item.password&&success.includes(item.password))throw new Error('Success text must not contain a device password');
  }
 }
 return value as RelayModels;
}
export function relayModelCommand(models:RelayModels,model:string|null,action:RelayAction){
 const config=model&&Object.hasOwn(models,model)?models[model]:undefined;
 if(model&&!config)throw new Error('No relay command configuration for model');
 if(config)return {text:config[action].replaceAll('{password}',config.password??''),success:config[`${action}Success`],languageField:config.languageField!==false};
 // Preserve the explicitly selected Concox v1.8.1 format. Client PDF requires false.
 return {text:action==='lock'?'DYD#':'HFYD#',success:action==='lock'?'DYD=Success!':'HFYD=Success!',languageField:true};
}
export function relayProfileCanonical(profile:RelayModel){return JSON.stringify([profile.lock,profile.unlock,profile.password??null,profile.lockSuccess,profile.unlockSuccess,profile.languageField!==false]);}
export function relayProfileFormat(profile:RelayModel,action:RelayAction='unlock'){const command=profile[action];return {languageField:profile.languageField!==false,hasPassword:command.includes('{password}')||/^(?:DYD|HFYD),[^#]+#$/i.test(command)};}
export function validateProbeProfiles(models:RelayModels,names:string[]){
 if(!names.length||names.length>8||new Set(names).size!==names.length)throw new Error('Supply 1 to 8 distinct explicit profile names');
 for(const name of names){
  if(!/^[A-Za-z0-9_-]{1,64}$/.test(name)||!Object.hasOwn(models,name))throw new Error('A requested probe profile is not configured');
  if(!/^HFYD(?:,|#)/i.test(models[name].unlock))throw new Error('Probe profiles may only send HFYD restore commands');
 }
 return names;
}
export function redactRelayText(models:RelayModels,text:string,replacement='[redacted]'){
 const secrets=new Set<string>();
 for(const profile of Object.values(models)){
  if(profile.password)secrets.add(profile.password);
  for(const command of [profile.lock,profile.unlock]){const embedded=command.match(/^(?:DYD|HFYD),([^#{}]+)#$/i)?.[1];if(embedded)secrets.add(embedded);}
 }
 for(const secret of [...secrets].sort((a,b)=>b.length-a.length))text=text.split(secret).join(replacement);
 return text;
}
