type EndpointOptions = {
  apiUrl?: string;
  socketUrl?: string;
  webHostname?: string;
  expoHostUri?: string | null;
};

// Internal LAN APKs may use HTTP only to a private IPv4 address. Store builds
// and other preview profiles continue to require HTTPS.
export function secureBuildEndpoints(apiUrl:string|undefined,socketUrl:string|undefined,lanTest:boolean){
  return [apiUrl,socketUrl].every(value=>{
    if(!value)return false;
    try{
      const url=new URL(value);
      if(url.protocol==='https:')return true;
      if(!lanTest||url.protocol!=='http:')return false;
      const parts=url.hostname.split('.').map(Number);
      if(parts.length!==4||parts.some(part=>!Number.isInteger(part)||part<0||part>255))return false;
      return parts[0]===10||(parts[0]===172&&parts[1]>=16&&parts[1]<=31)||(parts[0]===192&&parts[1]===168);
    }catch{return false;}
  });
}

// Physical devices must use the computer running Metro, not the phone's localhost.
export function resolveEndpoints(options: EndpointOptions) {
  let hostname = options.webHostname || '10.0.2.2';
  if (!options.webHostname && options.expoHostUri) {
    try {
      hostname = new URL(`http://${options.expoHostUri}`).hostname;
    } catch {
      // Keep the Android emulator fallback when Metro has no usable host.
    }
  }
  const host = `http://${hostname}:3000`;
  return {
    apiUrl: options.apiUrl?.trim() || `${host}/api/v1`,
    socketUrl: options.socketUrl?.trim() || host,
  };
}
