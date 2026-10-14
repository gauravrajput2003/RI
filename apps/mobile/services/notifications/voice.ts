import * as Speech from 'expo-speech';
import {createVoiceQueue} from './events';
export const voiceQueue=createVoiceQueue((text,done)=>{
 let finished=false;
 const finish=()=>{if(!finished){finished=true;clearTimeout(timer);done();}};
 const timer=setTimeout(finish,20000);
 Speech.speak(text,{language:'en-IN',rate:0.9,onDone:finish,onStopped:finish,onError:finish});
});
export function stopVoice(){voiceQueue.clear();void Speech.stop();}
