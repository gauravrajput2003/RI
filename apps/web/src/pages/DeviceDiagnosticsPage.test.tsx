import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {DeviceDiagnosticsPage} from './DeviceDiagnosticsPage';
const mocks=vi.hoisted(()=>({get:vi.fn(),role:'SUPER_ADMIN',allowed:false}));
vi.mock('../lib/auth',()=>({claims:()=>({id:'actor',role:mocks.role})}));
vi.mock('../services/api/client',()=>({api:{get:mocks.get},errorMessage:()=> 'request failed'}));
beforeEach(()=>{
  mocks.role='SUPER_ADMIN';mocks.allowed=false;mocks.get.mockReset();
  mocks.get.mockImplementation(async(path:string)=>path==='/account-summary'?{data:{data:{can_view_packet_health:mocks.allowed}}}:{data:{data:[{id:'device',imei:'GPS-12345',sim_number:'9876543210',vehicle_number:'DEEP-01',client_name:'Client B',admin_name:'Admin B',packet_health:'on-time',seconds_since_last_packet:5,expected_packet_interval_seconds:10,last_seen_at:'2026-09-17T12:00:00Z'}],pagination:{page:1,pageSize:25,total:1}}});
});
afterEach(cleanup);
function show(health=false){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><DeviceDiagnosticsPage health={health}/></QueryClientProvider>)}
it.each(['DEEP-01','GPS-12345','9876543210'])('uses one lookup search box for %s',async search=>{
  show();expect(await screen.findByText('GPS-12345')).toBeVisible();expect(screen.getByText('Admin B')).toBeVisible();
  fireEvent.change(screen.getByRole('textbox',{name:'Search devices'}),{target:{value:search}});
  await waitFor(()=>expect(mocks.get).toHaveBeenCalledWith('/web/device-lookup',{params:{search,page:1,pageSize:25}}));
});
it('does not request packet health when admin permission is disabled',async()=>{
  mocks.role='ADMIN';show(true);expect(await screen.findByText('Access unavailable')).toBeVisible();
  expect(mocks.get.mock.calls.some(call=>call[0]==='/web/packet-health')).toBe(false);
});
it('shows packet-health diagnostics when the admin has permission',async()=>{
  mocks.role='ADMIN';mocks.allowed=true;show(true);expect(await screen.findByText('on-time')).toBeVisible();
  expect(screen.getByRole('columnheader',{name:'Expected Interval (seconds)'})).toBeVisible();
});
