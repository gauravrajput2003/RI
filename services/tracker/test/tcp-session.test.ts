import net,{type Socket} from 'node:net';
import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import type {Logger} from 'pino';
import {attachTrackerSocket} from '../src/transport/tcp-session.js';
import {protocolRegistry} from '../src/protocols/registry.js';
import {framingRegistry} from '../src/protocols/framing/framing-registry.js';
import {ack} from '../src/protocols/gt06/acknowledgements.js';
import {crc16X25} from '../src/protocols/gt06/parser.js';
const fixture=(name:string)=>Buffer.from(readFileSync(new URL(`./fixtures/gt06/${name}.hex`,import.meta.url),'utf8').trim(),'hex');
const until=async(check:()=>boolean)=>{const deadline=Date.now()+3000;while(!check()){if(Date.now()>deadline)throw new Error('Timed out waiting for TCP event');await new Promise(resolve=>setTimeout(resolve,5));}};
it('echoes exact login/heartbeat serial+CRC and ACKs while relay binding or location persistence is blocked',async()=>{
 let releaseBind!:()=>void,releasePersist!:()=>void,peer:Socket|undefined;
 const bindWait=new Promise<void>(resolve=>{releaseBind=resolve;}),persistWait=new Promise<null>(resolve=>{releasePersist=()=>resolve(null);});
 const commands={bind:vi.fn(()=>bindWait),receive:vi.fn(async()=>false),unbind:vi.fn(async()=>{})};
 const persist=vi.fn(()=>persistWait),logs:unknown[][]=[],log=vi.fn((...args:unknown[])=>{logs.push(args);}),logger={info:log,warn:log} as unknown as Logger;
 const server=net.createServer(socket=>{peer=socket;attachTrackerSocket(socket,{registry:protocolRegistry,framing:framingRegistry,resolver:{find:async()=>({id:'device',protocol:'GT06',identityType:'IMEI',identityValue:'864943046906604'})},commands,logger,timeoutMs:300000,persist,heartbeat:async()=>{},telemetry:{enqueue:()=>{}}});});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const client=net.connect((server.address() as net.AddressInfo).port,'127.0.0.1');let received=Buffer.alloc(0);client.on('data',chunk=>{received=Buffer.concat([received,chunk]);});
 try{
  client.write(fixture('login'));await until(()=>received.length>=10);
  expect(received.subarray(0,10).toString('hex')).toBe('78780501001f20230d0a');expect(commands.bind).toHaveBeenCalledOnce();
  client.write(fixture('heartbeat'));await until(()=>received.length>=20);
  expect(received.subarray(10,20).toString('hex')).toBe('787805130020d97a0d0a');
  releaseBind();client.write(fixture('location'));await until(()=>persist.mock.calls.length===1);
  client.write(fixture('heartbeat'));await until(()=>received.length>=30);expect(received.subarray(20,30).toString('hex')).toBe('787805130020d97a0d0a');
  expect(logs.some(row=>row[1]==='tracker control ACK sent')).toBe(true);
  releasePersist();const unknown=ack(0x99,1);client.write(unknown);
  await until(()=>logs.some(row=>(row[0] as {hex?:string}).hex===unknown.toString('hex')&&row[1]==='tracker frame rejected'));
 }finally{releaseBind();releasePersist();client.destroy();peer?.destroy();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
it('logs an explicit idle-timeout close reason and cleans up the same socket',async()=>{
 const logs:unknown[][]=[],log=vi.fn((...args:unknown[])=>{logs.push(args);}),unbind=vi.fn(async()=>{});
 const server=net.createServer(socket=>attachTrackerSocket(socket,{registry:protocolRegistry,framing:framingRegistry,resolver:{find:async()=>null},commands:{bind:async()=>{},receive:async()=>false,unbind},logger:{info:log,warn:log} as unknown as Logger,timeoutMs:30,persist:async()=>null,heartbeat:async()=>{},telemetry:{enqueue:()=>{}}}));
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const client=net.connect((server.address() as net.AddressInfo).port,'127.0.0.1');
 try{await until(()=>unbind.mock.calls.length===1);expect(logs.some(row=>row[1]==='tracker socket closed'&&(row[0] as {reason:string}).reason==='idle_timeout')).toBe(true);}
 finally{client.destroy();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
it('ACKs login, heartbeat, alarm and recording before slow registration, but never ACKs 0x12/18/94',async()=>{
 let release!:()=>void,peer:Socket|undefined;const resolverWait=new Promise<null>(resolve=>{release=()=>resolve(null);});
 const logs:unknown[][]=[],log=vi.fn((...args:unknown[])=>{logs.push(args);});
 const bind=vi.fn(async()=>{}),persist=vi.fn(async()=>null);
 const server=net.createServer(socket=>{peer=socket;attachTrackerSocket(socket,{registry:protocolRegistry,framing:framingRegistry,resolver:{find:()=>resolverWait},commands:{bind,receive:async()=>false,unbind:async()=>{}},logger:{info:log,warn:log} as unknown as Logger,timeoutMs:300000,persist,heartbeat:async()=>{},telemetry:{enqueue:()=>{}}});});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const client=net.connect((server.address() as net.AddressInfo).port,'127.0.0.1');let received=Buffer.alloc(0);client.on('data',chunk=>{received=Buffer.concat([received,chunk]);});
 const packet=(type:number,body:Buffer,extended=false)=>{const length=body.length+5,payload=Buffer.from(extended?[length>>8,length&255,type,...body,0,5]:[length,type,...body,0,5]),crc=crc16X25(payload);return Buffer.from([extended?0x79:0x78,extended?0x79:0x78,...payload,crc>>8,crc&255,13,10]);};
 try{
  client.write(Buffer.concat([fixture('login'),fixture('heartbeat'),packet(0x16,Buffer.alloc(32)),fixture('location'),packet(0x18,Buffer.alloc(4)),packet(0x94,Buffer.alloc(4),true),packet(0x8d,Buffer.alloc(9),true)]));
  await until(()=>received.length>=42);
  expect(received.length).toBe(42);expect(received.subarray(0,10).toString('hex')).toBe('78780501001f20230d0a');expect(received.subarray(10,20).toString('hex')).toBe('787805130020d97a0d0a');
  expect(received.subarray(20,30).equals(ack(0x16,5))).toBe(true);expect(received.subarray(30,35).toString('hex')).toBe('797900068d');expect(received[35]).toBe(0);
  expect(bind).not.toHaveBeenCalled();expect(persist).not.toHaveBeenCalled();expect(client.destroyed).toBe(false);
  const acks=logs.filter(row=>row[1]==='tracker control ACK sent');expect(acks).toHaveLength(4);expect(acks.every(row=>(row[0] as {ackLatencyMs:number}).ackLatencyMs<1000)).toBe(true);
  release();await until(()=>logs.some(row=>(row[0] as {reason?:string}).reason==='UNKNOWN_DEVICE'));expect(client.destroyed).toBe(false);expect(bind).not.toHaveBeenCalled();
 }finally{release();client.destroy();peer?.destroy();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
