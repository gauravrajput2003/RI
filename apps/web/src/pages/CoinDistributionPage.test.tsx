import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {CoinDistributionPage} from './CoinDistributionPage';
import {PageFilterContext} from '../features/shell/pageFilterContext';

const mocks=vi.hoisted(()=>({get:vi.fn(),close:vi.fn()}));
vi.mock('../services/api/client',()=>({api:{get:mocks.get},errorMessage:()=> 'request failed'}));

beforeEach(()=>{mocks.get.mockReset();mocks.close.mockReset();mocks.get.mockImplementation(async(path:string)=>path==='/reports/coin-admins'?{data:{data:[{id:'11111111-1111-4111-8111-111111111111',label:'regional'}]}}:{data:{data:[{id:'tx-1',username:'root',counterParty:'regional',amount:'12.00',type:'DISTRIBUTED',transactionTime:'2026-09-15T12:00:00Z'}],pagination:{page:1,pageSize:25,total:1}}})});
afterEach(cleanup);

it('renders the coin ledger and applies the admin and date filters to the backend',async()=>{
 const controller={open:true,setOpen:vi.fn(),toggle:vi.fn(),close:mocks.close};
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><PageFilterContext.Provider value={controller}><CoinDistributionPage/></PageFilterContext.Provider></QueryClientProvider>);
 expect(await screen.findByText('root')).toBeVisible();
 expect(screen.getAllByRole('columnheader').map(cell=>cell.textContent?.replace('↕',''))).toEqual(['SN','Username','Counter Party','Amount','Type','Transaction Time']);
 expect(screen.getByText('Distributed')).toBeVisible();
 expect(screen.getByRole('button',{name:'PDF'})).toBeEnabled();expect(screen.getByRole('button',{name:'Excel'})).toBeEnabled();
 fireEvent.click(screen.getByRole('combobox',{name:'Admin'}));fireEvent.click(await screen.findByRole('option',{name:'regional'}));
 fireEvent.change(screen.getByLabelText('Date range start'),{target:{value:'2026-09-15T00:00'}});
 fireEvent.change(screen.getByLabelText('Date range end'),{target:{value:'2026-09-16T00:00'}});
 fireEvent.click(screen.getByRole('button',{name:'Search'}));
 await waitFor(()=>expect(mocks.get.mock.calls.some(call=>call[0]==='/reports/coin-distribution'&&call[1]?.params.adminId==='11111111-1111-4111-8111-111111111111'&&String(call[1]?.params.start).startsWith('2026-09-'))).toBe(true));
 expect(mocks.close).toHaveBeenCalled();
});

it('keeps the report columns visible when there are no transactions',async()=>{
 mocks.get.mockImplementation(async(path:string)=>path==='/reports/coin-admins'?{data:{data:[]}}:{data:{data:[],pagination:{page:1,pageSize:25,total:0}}});
 const controller={open:true,setOpen:vi.fn(),toggle:vi.fn(),close:mocks.close};
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><PageFilterContext.Provider value={controller}><CoinDistributionPage/></PageFilterContext.Provider></QueryClientProvider>);
 expect(await screen.findByText('No data available in table')).toBeVisible();
 expect(screen.getAllByRole('columnheader')).toHaveLength(6);
 expect(screen.getByText('Showing 0 to 0 of 0 entries')).toBeVisible();
});
