import type {Server,Socket} from 'socket.io';
import {socketPrincipal} from './socket-auth.js';
import {createRoomAuthorizer,type SocketPrincipal,type VehicleAuthorizer} from './authorization.js';

type Authenticator=(socket:Socket)=>SocketPrincipal;
const authorizers = new WeakMap<Server, VehicleAuthorizer>();
export function configureSockets(io:Server,authorizer:VehicleAuthorizer,authenticate:Authenticator=socketPrincipal){
  authorizers.set(io, authorizer);
  const rooms=createRoomAuthorizer(authorizer);
  io.use((socket,next)=>{try{const principal=authenticate(socket);socket.data.principal=principal;if(authorizer.isActiveUser){void authorizer.isActiveUser(principal.id).then(async active=>{if(principal.sid&&authorizer.isActiveSession)active=active&&await authorizer.isActiveSession(principal.id,principal.sid);return next(active?undefined:new Error('UNAUTHORIZED'))}).catch(()=>next(new Error('UNAUTHORIZED')))}else next()}catch{next(new Error('UNAUTHORIZED'))}});
  io.on('connection',async socket=>{
    const principal=socket.data.principal as SocketPrincipal;
    socket.on('vehicle:subscribe',async(vehicleId:unknown,done?: (result:{ok:boolean})=>void)=>{
      try {
        if(!await sessionAllowed(authorizer,principal)||typeof vehicleId!=='string'||!await rooms.canJoin(principal,vehicleId)){if(typeof done==='function')done({ok:false});return}
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
      if(principal && await sessionAllowed(authorizer,principal)&&await authorizer.canAccessVehicle(principal.id,vehicleId)){
        socket.emit('vehicle:location',payload);
      } else { await socket.leave(`vehicle:${vehicleId}`); }
    } catch { await socket.leave(`vehicle:${vehicleId}`); }
  }
}
export async function publishVehicleNotification(io:Server,vehicleId:string,payload:Record<string,unknown>):Promise<void>{
  const authorizer=authorizers.get(io);if(!authorizer)return;
  // Parking must also reach sessions opened before the vehicle was registered.
  // Candidate user rooms are current; authorization is still checked per socket.
  for(const socket of await vehicleCandidates(io,authorizer,vehicleId,String(payload.eventType).startsWith('PARKING_'))){
    const principal=socket.data.principal as SocketPrincipal|undefined;
    try{if(principal&&await sessionAllowed(authorizer,principal)&&await authorizer.canAccessVehicle(principal.id,vehicleId)){if(!authorizer.canReceiveNotifications||await authorizer.canReceiveNotifications(principal.id,vehicleId))socket.emit('notification:new',payload)}else await socket.leave(`vehicle:${vehicleId}`)}catch{await socket.leave(`vehicle:${vehicleId}`)}
  }
}
export async function publishUserNotification(io:Server,userId:string,payload:Record<string,unknown>):Promise<void>{const authorizer=authorizers.get(io);if(!authorizer)return;if(authorizer.canReceiveNotifications&&!await authorizer.canReceiveNotifications(userId))return;for(const socket of await io.in(`user:${userId}`).fetchSockets()){if(await sessionAllowed(authorizer,socket.data.principal))socket.emit('notification:new',payload)}}

export async function publishVehicleParking(io:Server,vehicleId:string,payload:Record<string,unknown>){
 const authorizer=authorizers.get(io);if(!authorizer)return;
 for(const socket of await vehicleCandidates(io,authorizer,vehicleId,true)){
  const principal=socket.data.principal as SocketPrincipal|undefined;
  if(principal&&await sessionAllowed(authorizer,principal)&&await authorizer.canAccessVehicle(principal.id,vehicleId))socket.emit('parking:changed',payload);
  else await socket.leave(`vehicle:${vehicleId}`);
 }
}

async function vehicleCandidates(io:Server,authorizer:VehicleAuthorizer,vehicleId:string,discover:boolean){
 if(!discover)return io.in(`vehicle:${vehicleId}`).fetchSockets();
 if(!authorizer.vehicleRecipientIds)return io.fetchSockets();
 const ids=await authorizer.vehicleRecipientIds(vehicleId);
 return ids.length?io.in(ids.map(id=>`user:${id}`)).fetchSockets():[];
}

async function sessionAllowed(authorizer:VehicleAuthorizer,principal:SocketPrincipal|undefined){
 return Boolean(principal&&(!principal.exp||principal.exp*1000>Date.now())&&(!principal.sid||!authorizer.isActiveSession||await authorizer.isActiveSession(principal.id,principal.sid)));
}
