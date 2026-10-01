import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,expect,it,vi} from 'vitest';
import {VehicleModal} from './VehicleModal';

const mocks=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),put:vi.fn()}));
vi.mock('../../services/api/client',()=>({api:mocks,errorMessage:()=> 'API error'}));
afterEach(cleanup);

it('shows the requested fields, filters Clients by Admin, and fills a 12-month billing period',async()=>{
  mocks.get.mockImplementation((url:string,config?:{params?:{adminId?:string}})=>{
    if(url==='/vehicle-admin-options')return Promise.resolve({data:{data:[{id:'admin-1',name:'Admin A',email:'admin@test.local',username:'admin.a'}]}});
    if(url==='/vehicle-client-options'&&config?.params?.adminId==='admin-1')return Promise.resolve({data:{data:[{id:'client-1',name:'Client A',email:'client@test.local',username:'1234',owner_id:'admin-1',active:false}]}});
    return Promise.resolve({data:{data:[]}});
  });
  render(<QueryClientProvider client={new QueryClient()}><VehicleModal open vehicle={null} onClose={()=>undefined}/></QueryClientProvider>);
  expect(screen.getByLabelText('Vehicle Number')).toBeInTheDocument();
  expect(screen.getByLabelText('Device IMEI')).toBeInTheDocument();
  expect(screen.getByLabelText('Vehicle Alias')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('combobox',{name:'Admin'}));
  fireEvent.click(await screen.findByRole('option',{name:'Admin A'}));
  await waitFor(()=>expect(mocks.get).toHaveBeenCalledWith('/vehicle-client-options',{params:{adminId:'admin-1'}}));
  fireEvent.click(screen.getByRole('combobox',{name:'Client'}));
  fireEvent.click(await screen.findByRole('option',{name:'Client A'}));
  fireEvent.click(screen.getByRole('combobox',{name:'SIM Operator'}));
  expect(screen.getAllByRole('option').map(option=>option.textContent)).toEqual(['Jio','Airtel','VI']);
  fireEvent.click(screen.getByRole('combobox',{name:'SIM Operator'}));
  fireEvent.click(screen.getByRole('combobox',{name:'Device Type'}));
  fireEvent.click(screen.getByRole('option',{name:'GT06'}));
  expect(screen.getByRole('checkbox',{name:'Ignition Wire Connected in power(+)'})).not.toBeDisabled();
  const door=screen.getByRole('checkbox',{name:'Door'});
  expect(door).not.toBeDisabled();
  fireEvent.click(door);
  expect(door).toBeChecked();
  fireEvent.click(screen.getByRole('combobox',{name:'Coin'}));fireEvent.click(screen.getByRole('option',{name:'New Coin (12 Month)'}));
  const start=(screen.getByLabelText('Billing Start') as HTMLInputElement).value;
  const due=(screen.getByLabelText('Billing Due') as HTMLInputElement).value;
  expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(due).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(new Date(`${due}T00:00:00`).getFullYear()-new Date(`${start}T00:00:00`).getFullYear()).toBe(1);
});

it('loads, saves, and resets SIM and installation text',async()=>{
  mocks.get.mockResolvedValue({data:{data:[]}});
  mocks.put.mockResolvedValue({data:{data:{}}});
  const vehicle={id:'vehicle-1',admin_id:'admin-1',owner_id:'client-1',vehicle_number:'ABC123',coins:0,active:true,auto_renewal:false,door_configured:false,relay_configured:false,buzzer_configured:false,ignition_wiring:'UNKNOWN',ac_power_plus:false,parking_alarm_on_ignition:false,sim_info:'SIM 899110',gps_location:'Upper dashboard'} as import('../../types').ManagedVehicle;
  const cache=new QueryClient({defaultOptions:{queries:{retry:false}}});
  const view=(selected:typeof vehicle|null)=><QueryClientProvider client={cache}><VehicleModal open vehicle={selected} onClose={()=>undefined}/></QueryClientProvider>;
  const {rerender}=render(view(vehicle));
  expect(screen.getByLabelText('SIM Info')).toHaveValue('SIM 899110');
  expect(screen.getByLabelText('GPS Location')).toHaveValue('Upper dashboard');
  expect(screen.getByLabelText('GPS Location')).toHaveAttribute('type','text');
  fireEvent.change(screen.getByLabelText('SIM Info'),{target:{value:'SIM replacement'}});
  fireEvent.change(screen.getByLabelText('GPS Location'),{target:{value:'Lower panel'}});
  fireEvent.submit(screen.getByRole('button',{name:'Save changes'}).closest('form')!);
  await waitFor(()=>expect(mocks.put).toHaveBeenCalledWith('/fleet-vehicles/vehicle-1',expect.objectContaining({simInfo:'SIM replacement',gpsLocation:'Lower panel'})));
  rerender(view(null));
  expect(screen.getByLabelText('SIM Info')).toHaveValue('');
  expect(screen.getByLabelText('GPS Location')).toHaveValue('');
});

it('previews a vehicle including SIM and GPS installation data without saving',()=>{
 const vehicle={id:'vehicle-1',admin_id:'admin-1',owner_id:'client-1',vehicle_number:'ABC123',coins:0,active:true,auto_renewal:false,door_configured:false,relay_configured:false,buzzer_configured:false,ignition_wiring:'UNKNOWN',ac_power_plus:false,parking_alarm_on_ignition:false,sim_info:'SIM 899110',gps_location:'Upper dashboard'} as import('../../types').ManagedVehicle;
 const {container}=render(<QueryClientProvider client={new QueryClient()}><VehicleModal open readOnly vehicle={vehicle} onClose={()=>undefined}/></QueryClientProvider>);
 expect(screen.getByRole('dialog')).toHaveTextContent('Preview Vehicle');
 expect(screen.getByLabelText('SIM Info')).toHaveValue('SIM 899110');
 expect(screen.getByLabelText('GPS Location')).toBeDisabled();
 expect(screen.queryByRole('button',{name:'Save changes'})).not.toBeInTheDocument();
 mocks.put.mockClear();fireEvent.submit(container.querySelector('form')!);expect(mocks.put).not.toHaveBeenCalled();
});
