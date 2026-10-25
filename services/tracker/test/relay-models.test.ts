import {expect,it} from 'vitest';
import {parseRelayModels,relayModelCommand,relayWireEvidence} from '../src/services/relay-models.js';
import {encodeRelay} from '../src/protocols/gt06/commands.js';
it('uses only explicit model configuration and never invents or falls back to passwords',()=>{
 const models=parseRelayModels(JSON.stringify({S106:{lock:'DYD,{password}#',unlock:'HFYD,{password}#',password:'123456',lockSuccess:'DYD=Success!',unlockSuccess:'HFYD=Success!'}}));
 expect(relayModelCommand(models,'S106','lock').text).toBe('DYD,123456#');
 expect(relayModelCommand(models,'S106','unlock').text).toBe('HFYD,123456#');
 expect(()=>relayModelCommand(models,'OTHER','lock')).toThrow('No relay command configuration');
 expect(()=>parseRelayModels(JSON.stringify({S106:{lock:'DYD,{password}#',unlock:'HFYD#',lockSuccess:'OK',unlockSuccess:'OK'}}))).toThrow('password');
 const text=relayModelCommand(models,'S106','lock').text,frame=encodeRelay('lock',1,{text}),evidence=relayWireEvidence(frame,text,'S106');
 expect(evidence.redacted).toBe(true);expect(JSON.stringify(evidence)).not.toContain('123456');expect(evidence.hex).not.toContain(Buffer.from('123456').toString('hex'));
 expect(relayWireEvidence(encodeRelay('lock',1),'DYD#',null).redacted).toBe(false);
});
it('accepts explicit passwordless profiles and rejects malformed startup configuration',()=>{
 const profiles=parseRelayModels(JSON.stringify({PDF:{lock:'DYD#',unlock:'HFYD#',languageField:false,lockSuccess:'DYD=Success!',unlockSuccess:'HFYD=Success!'}}));
 expect(relayModelCommand(profiles,'PDF','unlock')).toMatchObject({text:'HFYD#',languageField:false});
 for(const raw of ['{secret invalid JSON','[]','{"profile":null}','{"profile":{"lock":"DYD,{password}#"}}'])expect(()=>parseRelayModels(raw)).toThrow();
});
