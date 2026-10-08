import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {ClientVehicleModal} from './ClientVehicleModal';

const mocks=vi.hoisted(()=>({get:vi.fn(),patch:vi.fn()}));
vi.mock('../../services/api/client',()=>({api:mocks,errorMessage:()=> 'Request rejected'}));
const vehicle={id:'target',vehicle_number:'VEHICLE-Y',vehicle_type:'Car',fleet_status:'STOPPED',speed:0,tracker_timestamp:null,server_received_at:null,device_id:'current',sim_number:'1234567',sim_operator:'Jio',sim_info:'SIM serial'};
const devices=[{id:'source-device',model:'Tracker model',sim_number:'7654321',sim_operator:'Airtel',sim_info:'Source SIM',vehicle_id:'source',vehicle_number:'VEHICLE-X'},{id:'spare-device',model:null,sim_number:null,sim_operator:null,sim_info:null,vehicle_id:null,vehicle_number:null}];
const show=()=>render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><ClientVehicleModal vehicleId="target" onClose={vi.fn()}/></QueryClientProvider>);
beforeEach(()=>{vi.clearAllMocks();mocks.get.mockImplementation(async(path:string)=>({data:{data:path==='/web/client-devices'?devices:vehicle}}));mocks.patch.mockResolvedValue({data:{success:true}})});
afterEach(cleanup);

it('lets the client save vehicle details and GPS installation location to the shared record',async()=>{
 show();fireEvent.click(await screen.findByRole('button',{name:'Edit vehicle'}));
 for(const [label,value] of [['Vehicle Number','CLIENT-123'],['Mileage','30'],['Overspeed','90'],['Odometer','0'],['Alias','TEST BIKE'],['GPS Location','Under the seat']])fireEvent.change(screen.getByLabelText(label),{target:{value}});
 fireEvent.change(screen.getByLabelText('Vehicle Type'),{target:{value:'Scooty'}});
 fireEvent.click(screen.getByRole('button',{name:'Save vehicle'}));
 await waitFor(()=>expect(mocks.patch).toHaveBeenCalledWith('/web/client-vehicles/target',{vehicleNumber:'CLIENT-123',vehicleType:'Scooty',mileage:30,overspeedLimit:90,odometer:0,alias:'TEST BIKE',gpsLocation:'Under the seat',remark:''}));
 await screen.findByRole('button',{name:'Edit vehicle'});
});

it('shows client details and SIM fields without device registration or admin controls',async()=>{
 show();await screen.findByRole('button',{name:'Change tracker'});
 expect(screen.getByText('1234567')).toBeVisible();
 for(const field of ['IMEI','Device Type','Protocol','Coins','Billing','Admin','Client','Relay'])expect(screen.queryByText(field,{exact:false})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Edit SIM info'}));
 expect(screen.getByLabelText('SIM Number')).toHaveValue('1234567');
 expect(screen.getByLabelText('SIM Operator')).toHaveValue('Jio');
 expect(screen.getByLabelText('SIM Info')).toHaveValue('SIM serial');
 expect(screen.getAllByRole('textbox')).toHaveLength(2);
 fireEvent.change(screen.getByLabelText('SIM Number'),{target:{value:'111222333'}});
 fireEvent.change(screen.getByLabelText('SIM Operator'),{target:{value:'VI'}});
 fireEvent.change(screen.getByLabelText('SIM Info'),{target:{value:'new SIM serial'}});
 fireEvent.click(screen.getByRole('button',{name:'Save SIM info'}));
 await waitFor(()=>expect(mocks.patch).toHaveBeenCalledWith('/web/client-devices/current/sim',{simNumber:'111222333',simOperator:'VI',simInfo:'new SIM serial'}));
 expect(await screen.findByRole('button',{name:'Change tracker'})).toBeVisible();
});
it('requires explicit source-vehicle confirmation before moving an assigned tracker',async()=>{
 show();fireEvent.click(await screen.findByRole('button',{name:'Change tracker'}));
 const picker=await screen.findByLabelText('Choose tracker');
 await screen.findByRole('option',{name:/On VEHICLE-X/});
 fireEvent.change(picker,{target:{value:'source-device'}});
 expect(screen.getByRole('button',{name:'Save tracker'})).toBeDisabled();
 expect(screen.getByText(/current tracker.*will become unassigned/)).toBeVisible();
 fireEvent.click(screen.getByRole('checkbox',{name:/Move this tracker from VEHICLE-X to VEHICLE-Y/}));
 fireEvent.click(screen.getByRole('button',{name:'Save tracker'}));
 await waitFor(()=>expect(mocks.patch).toHaveBeenCalledWith('/web/client-vehicles/target/device',{deviceId:'source-device',moveFromVehicleId:'source'}));
 await screen.findByRole('button',{name:'Change tracker'});
});
it('assigns an unassigned device directly and resets confirmation when selection changes',async()=>{
 show();fireEvent.click(await screen.findByRole('button',{name:'Change tracker'}));
 const picker=await screen.findByLabelText('Choose tracker');await screen.findByRole('option',{name:/On VEHICLE-X/});
 fireEvent.change(picker,{target:{value:'source-device'}});
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.change(picker,{target:{value:'spare-device'}});
 expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
 fireEvent.change(picker,{target:{value:'source-device'}});
 expect(screen.getByRole('checkbox')).not.toBeChecked();
 expect(screen.getByRole('button',{name:'Save tracker'})).toBeDisabled();
 fireEvent.change(picker,{target:{value:'spare-device'}});
 fireEvent.click(screen.getByRole('button',{name:'Save tracker'}));
 await waitFor(()=>expect(mocks.patch).toHaveBeenCalledWith('/web/client-vehicles/target/device',{deviceId:'spare-device'}));
 await screen.findByRole('button',{name:'Change tracker'});
});
it('keeps failed edits visible and handles devices missing or unavailable',async()=>{
 mocks.patch.mockRejectedValue(new Error('denied'));show();
 fireEvent.click(await screen.findByRole('button',{name:'Edit SIM info'}));
 fireEvent.click(screen.getByRole('button',{name:'Save SIM info'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Request rejected');
 expect(screen.getByLabelText('SIM Number')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
 mocks.get.mockImplementation(async(path:string)=>({data:{data:path==='/web/client-devices'?[]:vehicle}}));
 fireEvent.click(screen.getByRole('button',{name:'Change tracker'}));
 expect(await screen.findByText(/No registered trackers/)).toBeVisible();
 expect(screen.getByRole('button',{name:'Save tracker'})).toBeDisabled();
});
