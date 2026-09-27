import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {ReportPage} from './ReportPage';
import {PageFilterContext,usePageFilterDrawer} from '../features/shell/pageFilterContext';
const mocks=vi.hoisted(()=>({get:vi.fn()}));
vi.mock('../services/api/client',()=>({api:{get:mocks.get},errorMessage:()=> 'request failed'}));
beforeEach(()=>{mocks.get.mockReset();mocks.get.mockImplementation(async(path:string)=>path==='/reports/options'?{data:{data:[{id:'11111111-1111-4111-8111-111111111111',vehicle_number:'RI-01',alias:'Field unit'}]}}:{data:{data:[{id:'session-1',vehicleId:'11111111-1111-4111-8111-111111111111',vehicleNumber:'RI-01',startTime:'2026-09-18T00:00:00Z',endTime:'2026-09-18T00:10:00Z',durationSeconds:600,location:{latitude:28,longitude:76},address:null}],pagination:{page:1,pageSize:25,total:1}}})});
afterEach(cleanup);
function renderReport(){const controller={open:true,setOpen:vi.fn(),toggle:vi.fn(),close:vi.fn()};render(<MemoryRouter><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><PageFilterContext.Provider value={controller}><ReportPage kind="status"/></PageFilterContext.Provider></QueryClientProvider></MemoryRouter>)}
it('shows the status report and applies the selected vehicle and status filters',async()=>{renderReport();expect(screen.getByRole('columnheader',{name:/Status/})).toBeInTheDocument();await screen.findByRole('option',{name:'RI-01'});const selects=screen.getAllByRole('combobox');fireEvent.change(selects[0],{target:{value:'11111111-1111-4111-8111-111111111111'}});fireEvent.change(selects[1],{target:{value:'OVERSPEED'}});fireEvent.click(screen.getByRole('button',{name:'Search'}));await waitFor(()=>expect(mocks.get.mock.calls.some(call=>call[0]==='/reports/status'&&call[1]?.params.status==='OVERSPEED'&&call[1]?.params.vehicleId==='11111111-1111-4111-8111-111111111111')).toBe(true))});
it('sort controls trigger validated server sorting',async()=>{renderReport();const time=screen.getAllByRole('columnheader')[8];fireEvent.click(time.querySelector('button')!);await waitFor(()=>expect(mocks.get.mock.calls.some(call=>call[0]==='/reports/status'&&call[1]?.params.sort==='durationSeconds'&&call[1]?.params.order==='asc')).toBe(true))});

it('opens distance filters from the page filter control and requests the last 30 days',async()=>{
 mocks.get.mockImplementation(async(path:string)=>path==='/reports/options'?{data:{data:[{id:'11111111-1111-4111-8111-111111111111',vehicle_number:'RI-01',alias:null}]}}:{data:{data:[],dates:['2026-09-25','2026-09-26'],pagination:{page:1,pageSize:25,total:0}}});
 function DistanceWithPageFilter(){const drawer=usePageFilterDrawer();return <PageFilterContext.Provider value={drawer}><button onClick={drawer.toggle}>Page filters</button><ReportPage kind="distance"/></PageFilterContext.Provider>}
 render(<MemoryRouter><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><DistanceWithPageFilter/></QueryClientProvider></MemoryRouter>);
 expect(await screen.findByText('No data available in table')).toBeVisible();
 expect(screen.getAllByRole('columnheader').map(header=>header.textContent)).toEqual([expect.stringContaining('Vehicle'),expect.stringContaining('25-09-2026'),expect.stringContaining('26-09-2026')]);
 fireEvent.click(screen.getByRole('button',{name:'Page filters'}));
 expect(screen.getByRole('combobox',{name:'Vehicle Number'})).toBeVisible();
 fireEvent.change(screen.getByRole('combobox',{name:'Vehicle Number'}),{target:{value:'11111111-1111-4111-8111-111111111111'}});
 fireEvent.change(screen.getByRole('combobox',{name:'Date Range preset'}),{target:{value:'last30'}});
 fireEvent.click(screen.getByRole('button',{name:'Search'}));
 await waitFor(()=>expect(mocks.get.mock.calls.some(call=>call[0]==='/reports/distance'&&call[1]?.params.vehicleId==='11111111-1111-4111-8111-111111111111'&&Date.parse(call[1]?.params.end)-Date.parse(call[1]?.params.start)===30*86400000)).toBe(true));
});

it.each([
 ['ac',['SN','Status','Start Time','End Time','Duration','Start Location','End Location','Start Address','End Address']],
 ['packet',['SN','Range','Km','Duration','Packet Count','First Packet','First Location','First Address','Last Packet','Last Location','Last Address','MAX Speed','AVG Speed']],
 ['travel-summary',['SN','Vehicle','Km','Running','Trip Count','Idle','Idle Count','Stop','Stop Count','Unreachable','Unreached Count','MAX Speed','AVG Speed']],
 ['daily-trip-summary',['SN','Vehicle','Km','Running','Idle','Stop','Unreachable','Start Location','Start Address','End Location','End Address','MAX Speed','AVG Speed']],
] as const)('shows the requested %s columns and common filters',(kind,expected)=>{
 mocks.get.mockImplementation(async(path:string)=>path==='/reports/options'?{data:{data:[]}}:{data:{data:[],pagination:{page:1,pageSize:25,total:0}}});
 const controller={open:true,setOpen:vi.fn(),toggle:vi.fn(),close:vi.fn()};
 render(<MemoryRouter><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><PageFilterContext.Provider value={controller}><ReportPage kind={kind}/></PageFilterContext.Provider></QueryClientProvider></MemoryRouter>);
 expect(screen.getAllByRole('columnheader').map(header=>header.textContent?.replace(/[↕↑↓]/g,''))).toEqual(expected);
 expect(screen.getByRole('combobox',{name:'Vehicle Number'})).toBeVisible();
 expect(kind==='daily-trip-summary'?screen.getByLabelText('Report date'):screen.getByRole('combobox',{name:'Date Range preset'})).toBeVisible();
 expect(screen.getByRole('button',{name:'PDF'}).querySelector('img')?.getAttribute('src')).toBe('/assets/export/pdf.png');
 expect(screen.getByRole('button',{name:'Excel'}).querySelector('img')?.getAttribute('src')).toBe('/assets/export/xls.png');
});

it.each([
 ['status',['Status','Start Time','End Time','Start Point','Start Address','End Address','End Point','Km','Time']],
 ['idle',['SN','Start Time','End Time','Duration','Location','Address']],
 ['running',['SN','Start Time','End Time','Duration','Km','Start Location','Start Address','End Address','End Location','MAX Speed','AVG Speed']],
 ['stoppage',['SN','Start Time','End Time','Duration','Location','Address','Km From Last','Duration From Last']],
 ['overspeed',['SN','Start Time','End Time','Duration','Km','Start Location','Start Address','End Address','End Location','MAX Speed','AVG Speed']],
 ['unreachable',['SN','Start Time','End Time','Duration','Start Location','Start Address','End Address','End Location']],
] as const)('shows the requested %s columns, filters, and export icons',(kind,expected)=>{
 mocks.get.mockImplementation(async(path:string)=>path==='/reports/options'?{data:{data:[]}}:{data:{data:[],pagination:{page:1,pageSize:25,total:0}}});
 const controller={open:true,setOpen:vi.fn(),toggle:vi.fn(),close:vi.fn()};
 render(<MemoryRouter><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><PageFilterContext.Provider value={controller}><ReportPage kind={kind}/></PageFilterContext.Provider></QueryClientProvider></MemoryRouter>);
 expect(screen.getAllByRole('columnheader').map(header=>header.textContent?.replace(/[↕↑↓]/g,''))).toEqual(expected);
 expect(screen.getByRole('combobox',{name:'Vehicle Number'})).toBeVisible();
 expect(screen.getByRole('combobox',{name:'Date Range preset'})).toBeVisible();
 if(kind==='status')expect(screen.getByRole('combobox',{name:'Status'})).toBeVisible();
 expect(screen.getByRole('button',{name:'PDF'}).querySelector('img')?.getAttribute('src')).toBe('/assets/export/pdf.png');
 expect(screen.getByRole('button',{name:'Excel'}).querySelector('img')?.getAttribute('src')).toBe('/assets/export/xls.png');
});
