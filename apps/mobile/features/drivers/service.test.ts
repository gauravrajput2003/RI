import {beforeEach,expect,it,vi} from 'vitest';
import {getDrivers,getVehicleDriver,saveDriver,setVehicleDriver} from './service';
const mock=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),put:vi.fn(),online:vi.fn(),session:'session' as string|null}));
vi.mock('../../services/api/client',()=>({api:{get:mock.get,post:mock.post,put:mock.put}}));
vi.mock('../../services/api/mobile',()=>({requireOnline:mock.online}));
vi.mock('../../store/authStore',()=>({useAuthStore:{getState:()=>({sessionKey:mock.session})}}));
const input={name:'Driver',mobile:'9876543210',licenceNumber:'DL123456'};
beforeEach(()=>{vi.resetAllMocks();mock.session='session';mock.get.mockResolvedValue({data:{data:[],nextCursor:null}});mock.post.mockResolvedValue({data:{data:{id:'driver'}}});mock.put.mockResolvedValue({data:{data:{assignmentId:'assignment'}}});});
it('uses existing authenticated API paths, selected vehicle ID, pagination and assignment version',async()=>{
 const signal=new AbortController().signal;await getDrivers('vehicle','cursor',signal);expect(mock.get).toHaveBeenCalledWith('/drivers',{params:{vehicleId:'vehicle',cursor:'cursor',limit:50},signal});
 await getVehicleDriver('vehicle',signal);expect(mock.get).toHaveBeenCalledWith('/vehicles/vehicle/driver',{signal});
 await saveDriver(input,'vehicle');expect(mock.post).toHaveBeenCalledWith('/drivers',{...input,vehicleId:'vehicle'});
 await setVehicleDriver('vehicle','driver','previous');expect(mock.put).toHaveBeenCalledWith('/vehicles/vehicle/driver',{driverId:'driver',expectedAssignmentId:'previous'});
});
it('fails offline and discards results after logout without reporting a false success',async()=>{
 mock.online.mockImplementationOnce(()=>{throw new Error('Offline')});await expect(saveDriver(input)).rejects.toThrow('Offline');expect(mock.post).not.toHaveBeenCalled();
 mock.post.mockImplementationOnce(async()=>{mock.session=null;return {data:{data:{id:'driver'}}}});await expect(saveDriver(input)).rejects.toThrow('session changed');
 mock.session=null;await expect(setVehicleDriver('vehicle','driver',null)).rejects.toThrow('Sign in');expect(mock.put).not.toHaveBeenCalled();
});
