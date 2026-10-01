import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {ConfigureAlertsPage,NotificationsPage} from './AlertPages';

const mocks=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),patch:vi.fn(),delete:vi.fn()}));
vi.mock('../services/api/client',()=>({api:mocks,errorMessage:()=> 'request failed'}));
beforeEach(()=>{mocks.get.mockReset();mocks.get.mockImplementation(async(path:string)=>path==='/alerts/events'?{data:{data:[{type:'VEHICLE_IDLE',label:'Vehicle is Idle!',source:'vehicle'}]}}:{data:{data:[],pagination:{page:1,pageSize:25,total:0}}})});
afterEach(cleanup);
const renderPage=(page:React.ReactNode)=>render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>{page}</QueryClientProvider>);

it('shows the reference alert columns and the searchable Add Alert form',async()=>{
 renderPage(<ConfigureAlertsPage/>);
 expect(await screen.findByText('No data available in table')).toBeVisible();
 expect(screen.getAllByRole('columnheader').map(cell=>cell.textContent?.replace(/↕/g,''))).toEqual(['','Name','Mapping Type','Mapped Value','Created_At','Last_Update']);
 fireEvent.click(screen.getByRole('button',{name:'Add Alert'}));
 expect(screen.getByRole('dialog',{name:'Add Alert'})).toBeVisible();
 await waitFor(()=>expect(screen.getByRole('combobox',{name:'Select Event'})).toBeEnabled());
 fireEvent.click(screen.getByRole('combobox',{name:'Select Event'}));
 expect(screen.getByRole('textbox',{name:'Search Select Event'})).toBeVisible();
 expect(await screen.findByRole('option',{name:'Vehicle is Idle!'})).toBeVisible();
});

it('shows the reference notification table and export actions when empty',async()=>{
 renderPage(<NotificationsPage/>);
 expect(await screen.findByText('No data available in table')).toBeVisible();
 expect(screen.getAllByRole('columnheader').map(cell=>cell.textContent?.replace(/↕/g,''))).toEqual(['Vehicle','Type','Location','Message','Address','Time']);
 expect(screen.getByRole('button',{name:'PDF'})).toBeEnabled();
 expect(screen.getByRole('button',{name:'Excel'})).toBeEnabled();
});
