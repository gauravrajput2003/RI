import '@testing-library/jest-dom/vitest';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
import {AppShell} from './AppShell';
import {PageFilterDrawer} from '../features/shell/PageFilterDrawer';
vi.mock('socket.io-client',()=>({io:()=>({on:vi.fn(),disconnect:vi.fn()})}));
vi.mock('../services/api/client',()=>({api:{get:vi.fn(async(url:string)=>url==='/account-summary'?{data:{data:{name:'RI Operator',email:'operator@test.local',coins:12}}}:{data:{data:[]}}),post:vi.fn()}}));
afterEach(cleanup);
it('toggles the Dashboard and Playback child navigation',()=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard']}><Routes><Route element={<AppShell/>}><Route path="/dashboard" element={<><div>Dashboard page</div><PageFilterDrawer title="Client"><label>Client<input placeholder="Select Client"/></label></PageFilterDrawer></>}/></Route></Routes></MemoryRouter></QueryClientProvider>);
 for(const name of ['Coins','Enter fullscreen','Sign out','Page filters'])expect(screen.getByRole('button',{name})).toBeVisible();
 expect(screen.queryByLabelText('Client filters')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Page filters'}));expect(screen.getByLabelText('Client filters')).toBeVisible();
 const toggle=screen.getByRole('button',{name:'Dashboard'});expect(toggle).toHaveAttribute('aria-expanded','true');expect(screen.getByRole('link',{name:'Playback'})).toBeVisible();fireEvent.click(toggle);expect(toggle).toHaveAttribute('aria-expanded','false');expect(screen.queryByRole('link',{name:'Playback'})).not.toBeInTheDocument();fireEvent.click(toggle);expect(screen.getByRole('link',{name:'Playback'})).toBeVisible();
});
