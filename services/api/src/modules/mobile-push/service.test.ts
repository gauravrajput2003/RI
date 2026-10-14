import {describe,it,expect,vi} from 'vitest';
vi.mock('../../db/pool.js',()=>({query:vi.fn(),transaction:vi.fn()}));
vi.mock('../authorization/permissions.js',()=>({hasPermissionForUser:vi.fn()}));
vi.mock('../../lib/logger.js',()=>({logger:{warn:vi.fn()}}));
import {stateAlert,pushMessages} from './service.js';
describe('mobile vehicle push messages',()=>{
 it('uses actual registration numbers and only supported state transitions',()=>{
  expect(stateAlert('MOVING','AB12CD3456')).toEqual({message:'Vehicle AB12CD3456 has started.',eventType:'VEHICLE_RUNNING'});
  expect(stateAlert('IDLE','XY01')).toMatchObject({message:'Vehicle XY01 is idle.'});
  expect(stateAlert('STOPPED','XY01')).toMatchObject({message:'Vehicle XY01 has stopped.'});
  expect(stateAlert('UNREACHABLE','XY01')).toBeNull();
 });
 it('keeps OS push reliable and separates Android headless voice without iOS background promises',()=>{
  const device={expo_token:'ExponentPushToken[test]',platform:'android',sound:false,vibration:false,voice:true,user_id:'owner'};
  const messages=pushMessages(device,{id:'event',message:'Vehicle stopped'});
  expect(messages).toHaveLength(2);
  expect(messages[0]).toMatchObject({body:'Vehicle stopped',channelId:'vehicle-voice-running-quiet',sound:'vehicle-running.wav',ttl:300,data:{id:'event',userId:'owner'}});
  expect(messages[1]).toMatchObject({data:{voiceOnly:true,id:'event'}});
  expect(messages[1]).not.toHaveProperty('body');
  expect(pushMessages({...device,platform:'ios'},{id:'event'})).toHaveLength(1);
  expect(pushMessages({...device,voice:false},{id:'event'})).toHaveLength(1);
 });
 it('uses an actual prepared iPhone vehicle sound without substituting another registration',()=>{
  const device={expo_token:'ExpoPushToken[test]',platform:'ios',sound:true,vibration:true,voice:true,user_id:'owner',voice_vehicles:['bike-id']};
  const payload={vehicleId:'bike-id',vehicleNumber:'AB12 CD3456',eventType:'VEHICLE_STOPPED'};
  expect(pushMessages(device,payload)[0].sound).toBe('vehicle-bike-id-ab12cd3456-vehicle_stopped.caf');
  expect(pushMessages({...device,voice_vehicles:[]},payload)[0].sound).toBe('vehicle-stopped.wav');
 });
});
