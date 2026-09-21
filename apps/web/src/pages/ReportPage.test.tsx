import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {ReportPage} from './ReportPage';
const mocks=vi.hoisted(()=>({get:vi.fn()}));
vi.mock('../services/api/client',()=>({api:{get:mocks.get},errorMessage:()=> 'request failed'}));
beforeEach(()=>{mocks.get.mockReset();mocks.get.mockImplementation(async(path:string)=>path==='/reports/options'?{data:{data:[{id:'11111111-1111-4111-8111-111111111111',vehicle_number:'RI-01',alias:'Field unit'}]}}:{data:{data:[{id:'session-1',vehicleId:'11111111-1111-4111-8111-111111111111',vehicleNumber:'RI-01',startTime:'2026-09-18T00:00:00Z',endTime:'2026-09-18T00:10:00Z',durationSeconds:600,location:{latitude:28,longitude:76},address:null}],pagination:{page:1,pageSize:25,total:1}}})});
afterEach(cleanup);
function renderReport(){render(<MemoryRouter><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ReportPage kind="status"/></QueryClientProvider></MemoryRouter>)}
it('renders the premium status report and applies real status filters',async()=>{renderReport();expect(screen.getByRole('heading',{name:'Status Report'})).toBeInTheDocument();expect(await screen.findByText('RI-01')).toBeInTheDocument();const selects=screen.getAllByRole('combobox');fireEvent.change(selects[1],{target:{value:'OVERSPEED'}});fireEvent.click(screen.getByRole('button',{name:/apply filters/i}));await waitFor(()=>expect(mocks.get.mock.calls.some(call=>call[0]==='/reports/status'&&call[1]?.params.status==='OVERSPEED')).toBe(true))});
it('sort controls trigger validated server sorting',async()=>{renderReport();await screen.findByText('RI-01');fireEvent.click(screen.getByRole('button',{name:/duration/i}));await waitFor(()=>expect(mocks.get.mock.calls.some(call=>call[0]==='/reports/status'&&call[1]?.params.sort==='durationSeconds'&&call[1]?.params.order==='asc')).toBe(true))});
