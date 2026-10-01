import '@testing-library/jest-dom/vitest';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {AppShell} from './AppShell';
import {PageFilterDrawer} from '../features/shell/PageFilterDrawer';
const mocks=vi.hoisted(()=>({role:'ADMIN',allowed:false}));
vi.mock('../lib/auth',()=>({claims:()=>({id:'actor',role:mocks.role}),getTokens:()=>null,setTokens:vi.fn()}));
beforeEach(()=>{mocks.role='ADMIN';mocks.allowed=false});
vi.mock('socket.io-client',()=>({io:()=>({on:vi.fn(),disconnect:vi.fn()})}));
vi.mock('../services/api/client',()=>({api:{get:vi.fn(async(url:string)=>url==='/account-summary'?{data:{data:{name:'RI Operator',email:'operator@test.local',coins:12,can_view_packet_health:mocks.allowed}}}:{data:{data:[]}}),post:vi.fn()}}));
afterEach(cleanup);
it('toggles the Dashboard and Playback child navigation',()=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard']}><Routes><Route element={<AppShell/>}><Route path="/dashboard" element={<><div>Dashboard page</div><PageFilterDrawer title="Client"><label>Client<input placeholder="Select Client"/></label></PageFilterDrawer></>}/></Route></Routes></MemoryRouter></QueryClientProvider>);
 for(const name of ['Coins','Enter fullscreen','Sign out','Page filters'])expect(screen.getByRole('button',{name})).toBeVisible();
 expect(screen.queryByLabelText('Client filters')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Page filters'}));expect(screen.getByLabelText('Client filters')).toBeVisible();
 const toggle=screen.getByRole('button',{name:'Dashboard'});expect(toggle).toHaveAttribute('aria-expanded','true');expect(screen.getByRole('link',{name:'Playback'})).toBeVisible();fireEvent.click(toggle);expect(toggle).toHaveAttribute('aria-expanded','false');expect(screen.queryByRole('link',{name:'Playback'})).not.toBeInTheDocument();fireEvent.click(toggle);expect(screen.getByRole('link',{name:'Playback'})).toBeVisible();
});

it('hides packet-health navigation from an admin without permission',async()=>{
 render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><AppShell/></MemoryRouter></QueryClientProvider>);
 await screen.findByText('RI Operator');
 expect(screen.queryByRole('link',{name:'Packet Health'})).not.toBeInTheDocument();
 expect(screen.queryByRole('link',{name:'GPS / SIM Lookup'})).not.toBeInTheDocument();
});
it('shows packet-health navigation when an admin has a grant',async()=>{
 mocks.allowed=true;
 render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><AppShell/></MemoryRouter></QueryClientProvider>);
 await waitFor(()=>expect(screen.getByRole('link',{name:'Packet Health'})).toBeVisible());
 expect(screen.queryByRole('link',{name:'GPS / SIM Lookup'})).not.toBeInTheDocument();
});
