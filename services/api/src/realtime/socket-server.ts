import type {Server,Socket} from 'socket.io';
import {socketPrincipal} from './socket-auth.js';
import {createRoomAuthorizer,type SocketPrincipal,type VehicleAuthorizer} from './authorization.js';

type Authenticator=(socket:Socket)=>SocketPrincipal;
const authorizers = new WeakMap<Server, VehicleAuthorizer>();
export function configureSockets(io:Server,authorizer:VehicleAuthorizer,authenticate:Authenticator=socketPrincipal){
  authorizers.set(io, authorizer);
  const rooms=createRoomAuthorizer(authorizer);
  io.use((socket,next)=>{try{socket.data.principal=authenticate(socket);next()}catch{next(new Error('UNAUTHORIZED'))}});
  io.on('connection',async socket=>{
    const principal=socket.data.principal as SocketPrincipal;
    socket.on('vehicle:subscribe',async(vehicleId:unknown,done?: (result:{ok:boolean})=>void)=>{
      try {
        if(typeof vehicleId!=='string'||!await rooms.canJoin(principal,vehicleId)){if(typeof done==='function')done({ok:false});return}
        await socket.join(`vehicle:${vehicleId}`);
        if(typeof done==='function')done({ok:true});
      } catch { if(typeof done==='function')done({ok:false}); }
    });
    try {
      await socket.join(`user:${principal.id}`);
      for(const room of await rooms.initialRooms(principal))await socket.join(room);
    } catch { socket.disconnect(true); }
  });
}
export async function publishVehicleLocation(io:Server,vehicleId:string,payload:Record<string,unknown>):Promise<void>{
  const authorizer=authorizers.get(io);
  if(!authorizer)return;
  // Membership is a delivery candidate, not a permanent permission grant.
  for(const socket of await io.in(`vehicle:${vehicleId}`).fetchSockets()){
    const principal=socket.data.principal as SocketPrincipal|undefined;
    try {
      if(principal && await authorizer.canAccessVehicle(principal.id,vehicleId)){
        socket.emit('vehicle:location',payload);
      } else { await socket.leave(`vehicle:${vehicleId}`); }
    } catch { await socket.leave(`vehicle:${vehicleId}`); }
  }
}
