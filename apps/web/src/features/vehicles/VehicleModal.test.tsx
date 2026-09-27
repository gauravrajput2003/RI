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
  await waitFor(()=>expect(Array.from(document.querySelectorAll('#vehicle-admins option')).some(option=>option.getAttribute('value')==='Admin A')).toBe(true));
  fireEvent.change(screen.getByLabelText('Admin'),{target:{value:'Admin A'}});
  await waitFor(()=>expect(mocks.get).toHaveBeenCalledWith('/vehicle-client-options',{params:{adminId:'admin-1'}}));
  await waitFor(()=>expect(Array.from(document.querySelectorAll('#vehicle-clients option')).some(option=>option.getAttribute('value')==='1234')).toBe(true));
  fireEvent.change(screen.getByLabelText('Client'),{target:{value:'1234'}});
  expect(Array.from(document.querySelectorAll('#sim-operators option')).map(option=>option.getAttribute('value'))).toEqual(['Jio','Airtel','VI']);
  fireEvent.change(screen.getByLabelText('Device Type'),{target:{value:'GT06'}});
  expect(screen.getByRole('checkbox',{name:'Ignition Wire Connected in power(+)'})).not.toBeDisabled();
  const door=screen.getByRole('checkbox',{name:'Door'});
  expect(door).not.toBeDisabled();
  fireEvent.click(door);
  expect(door).toBeChecked();
  fireEvent.change(screen.getByLabelText('Coin'),{target:{value:'12'}});
  const start=(screen.getByLabelText('Billing Start') as HTMLInputElement).value;
  const due=(screen.getByLabelText('Billing Due') as HTMLInputElement).value;
  expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(due).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(new Date(`${due}T00:00:00`).getFullYear()-new Date(`${start}T00:00:00`).getFullYear()).toBe(1);
});
