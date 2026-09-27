import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,expect,it,vi,beforeEach} from 'vitest';
import {ClientPage} from './ClientPage';

const mocks=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),patch:vi.fn(),delete:vi.fn()}));
vi.mock('../services/api/client',()=>({api:mocks,errorMessage:()=> 'API error'}));
const active={id:'1',username:'active.client',name:'Active Client',mobile:null,email:'active@test.local',company:null,website:null,address:null,active:true,inactive_timeout_seconds:43200,owner_id:'a',owner_name:'Admin A',owner_email:'admin@test.local',owner_username:'admin.a',created_at:'2026-01-01',updated_at:'2026-01-01',vehicle_count:2};
const inactive={...active,id:'2',username:'inactive.client',active:false};
const renderPage=()=>render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ClientPage/></QueryClientProvider>);

beforeEach(()=>{vi.clearAllMocks();mocks.get.mockImplementation((url:string)=>url==='/clients'?Promise.resolve({data:{data:[active,inactive],pagination:{page:1,pageSize:25,total:2}}}):Promise.resolve({data:{data:[]}}));mocks.post.mockResolvedValue({data:{data:{}}});mocks.patch.mockResolvedValue({data:{data:{}}});mocks.delete.mockResolvedValue({})});
afterEach(cleanup);

it('renders server clients and only offers delete for inactive clients',async()=>{renderPage();expect(await screen.findByText('active.client')).toBeInTheDocument();expect(screen.getByText('inactive.client')).toBeInTheDocument();expect(screen.getAllByRole('button',{name:/Delete/})).toHaveLength(1);expect(screen.queryByText('2 clients')).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Upload client'})).not.toBeInTheDocument()});
it('opens add modal with backend owner options and never shows a stored password',async()=>{renderPage();await screen.findByText('active.client');fireEvent.click(screen.getAllByRole('button',{name:/Add client/i})[0]);expect(await screen.findByRole('dialog',{name:'Add client'})).toBeInTheDocument();expect(mocks.get).toHaveBeenCalledWith('/client-owners');expect(screen.getByLabelText('Password')).toHaveAttribute('type','password');expect(screen.queryByDisplayValue(/password/i)).not.toBeInTheDocument()});
it('opens edit modal without a password field and sends server search',async()=>{renderPage();await screen.findByText('active.client');fireEvent.click(screen.getByRole('button',{name:'Edit active.client'}));expect(await screen.findByRole('dialog',{name:'Edit client'})).toBeInTheDocument();expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();fireEvent.click(screen.getByLabelText('Close dialog'));fireEvent.change(screen.getByLabelText('Search clients'),{target:{value:'Acme'}});await waitFor(()=>expect(mocks.get).toHaveBeenCalledWith('/clients',expect.objectContaining({params:expect.objectContaining({search:'Acme'})}))) });
it('shows retry state for API errors',async()=>{mocks.get.mockRejectedValueOnce(new Error('offline'));renderPage();expect(await screen.findByText('Client list unavailable')).toBeInTheDocument();expect(screen.getByRole('button',{name:/retry/i})).toBeInTheDocument()});
