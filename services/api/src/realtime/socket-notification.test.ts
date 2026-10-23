import {afterEach,describe,expect,it,vi} from 'vitest';
import {createServer,type Server as HttpServer} from 'node:http';
import {Server} from 'socket.io';
import {io,type Socket} from 'socket.io-client';
import {configureSockets,publishVehicleNotification,publishUserNotification,publishVehicleLocation,publishVehicleParking} from './socket-server.js';

let http:HttpServer|undefined,server:Server|undefined,sockets:Socket[]=[];
afterEach(async()=>{for(const socket of sockets)socket.close();sockets=[];await server?.close();await new Promise<void>(resolve=>http?.close(()=>resolve()))});
describe('realtime alert isolation',()=>{
 it('delivers parking movement and repeated reminders to sessions connected before vehicle registration',async()=>{
  let vehicleRegistered=false,notificationsAllowed=true;
  http=createServer();server=new Server(http);
  configureSockets(server,{
   canAccessVehicle:async(user,vehicle)=>vehicleRegistered&&user==='allowed'&&vehicle==='new-bike',
   authorizedVehicleIds:async()=>[],
   // Include a denied candidate deliberately to verify the per-socket check.
   vehicleRecipientIds:async()=>['allowed','denied'],
   canReceiveNotifications:async user=>user==='allowed'&&notificationsAllowed,
  },socket=>({id:String(socket.handshake.auth.id),role:'USER'}));
  await new Promise<void>(resolve=>http!.listen(0,resolve));const port=(http.address() as {port:number}).port;
  const allowed=io(`http://127.0.0.1:${port}`,{auth:{id:'allowed'}}),denied=io(`http://127.0.0.1:${port}`,{auth:{id:'denied'}});sockets.push(allowed,denied);
  await Promise.all(sockets.map(socket=>new Promise<void>(resolve=>socket.on('connect',resolve))));
  const received:unknown[]=[];allowed.on('notification:new',event=>received.push(event));denied.on('notification:new',()=>received.push('leaked'));
  vehicleRegistered=true;
  await publishVehicleNotification(server,'new-bike',{id:'movement',eventType:'PARKING_MOVEMENT'});
  await expect.poll(()=>received).toEqual([{id:'movement',eventType:'PARKING_MOVEMENT'}]);
  await publishVehicleNotification(server,'new-bike',{id:'reminder',eventType:'PARKING_REMINDER'});
  await expect.poll(()=>received).toHaveLength(2);
  const changed:unknown[]=[];allowed.on('parking:changed',event=>changed.push(event));
  await publishVehicleParking(server,'new-bike',{enabled:true});await expect.poll(()=>changed).toEqual([{enabled:true}]);
  notificationsAllowed=false;await publishVehicleNotification(server,'new-bike',{id:'muted',eventType:'PARKING_REMINDER'});
  vehicleRegistered=false;await publishVehicleNotification(server,'new-bike',{id:'revoked',eventType:'PARKING_REMINDER'});
  expect(received).toHaveLength(2);
 });
 it('checks current vehicle and notification access at delivery while retaining telemetry access',async()=>{
  let notificationsAllowed=true;
  http=createServer();server=new Server(http);
  configureSockets(server,{
   canAccessVehicle:async(user,vehicle)=>user==='allowed'&&vehicle==='vehicle-a',
   authorizedVehicleIds:async user=>user==='allowed'?['vehicle-a']:[],
   canReceiveNotifications:async user=>user==='allowed'&&notificationsAllowed,
  },socket=>({id:String(socket.handshake.auth.id),role:'USER'}));
  await new Promise<void>(resolve=>http!.listen(0,resolve));
  const port=(http.address() as {port:number}).port;
  const allowed=io(`http://127.0.0.1:${port}`,{auth:{id:'allowed'}}),denied=io(`http://127.0.0.1:${port}`,{auth:{id:'denied'}});
  sockets.push(allowed,denied);
  await Promise.all(sockets.map(socket=>new Promise<void>(resolve=>socket.on('connect',resolve))));
  // Connection acknowledgement precedes asynchronous room initialization.
  await new Promise<void>(resolve=>allowed.emit('vehicle:subscribe','vehicle-a',(result:{ok:boolean})=>{expect(result.ok).toBe(true);resolve()}));
  const received:string[]=[];
  allowed.on('notification:new',payload=>received.push(`allowed:${payload.message}`));
  denied.on('notification:new',payload=>received.push(`denied:${payload.message}`));
  await publishVehicleNotification(server,'vehicle-a',{message:'private'});
  await expect.poll(()=>received).toEqual(['allowed:private']);
  const socket=(await server.in('vehicle:vehicle-a').fetchSockets())[0];
  const emit=vi.spyOn(socket,'emit');notificationsAllowed=false;
  await publishVehicleNotification(server,'vehicle-a',{message:'revoked'});
  await publishUserNotification(server,'allowed',{message:'revoked'});
  expect(emit).not.toHaveBeenCalled();
  const telemetry:unknown[]=[];allowed.on('vehicle:location',payload=>telemetry.push(payload));
  await publishVehicleLocation(server,'vehicle-a',{speed:20});
  await expect.poll(()=>telemetry).toEqual([{speed:20}]);
  expect(received).toEqual(['allowed:private']);
  const parking:unknown[]=[];allowed.on('parking:changed',payload=>parking.push(payload));denied.on('parking:changed',()=>parking.push('leaked'));
  await publishVehicleParking(server,'vehicle-a',{vehicleId:'vehicle-a',enabled:true});
  await expect.poll(()=>parking).toEqual([{vehicleId:'vehicle-a',enabled:true}]);
 });
});
