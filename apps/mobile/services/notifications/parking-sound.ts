let generation=0;
let finishCurrent:(()=>void)|undefined;
export function stopParkingAlarm(){generation++;finishCurrent?.();}

/** Foreground-only media siren, supported by Expo Go; no push module needed. */
export async function playParkingAlarm(){
 stopParkingAlarm();const expected=generation;
 const audio=await import('expo-audio');
 if(expected!==generation)return;
 await audio.setAudioModeAsync({playsInSilentMode:false,shouldPlayInBackground:false,interruptionMode:'duckOthers'});
 if(expected!==generation)return;
 // Metro resolves bundled native audio assets through require.
 // eslint-disable-next-line @typescript-eslint/no-require-imports
 const player=audio.createAudioPlayer(require('../../assets/parking-alarm.wav'));
 await new Promise<void>(resolve=>{
  let finished=false,subscription:{remove():void}|undefined;
  const finish=()=>{if(finished)return;finished=true;clearTimeout(timeout);try{subscription?.remove();player.release();}finally{if(finishCurrent===finish)finishCurrent=undefined;resolve();}};
  const timeout=setTimeout(finish,4500);finishCurrent=finish;
  try{subscription=player.addListener('playbackStatusUpdate',status=>{if(status.didJustFinish)finish();});player.play();}catch{finish();}
 });
}
