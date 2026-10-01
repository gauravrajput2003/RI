import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {AnnouncementsPage} from './AnnouncementPage';

const mocks=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),patch:vi.fn(),delete:vi.fn()}));
vi.mock('../services/api/client',()=>({api:mocks,errorMessage:()=> 'request failed'}));
const row={id:'notice-1',targetType:'CLIENT',targetLabel:'Client',admins:[],clients:['Acme Client'],adminIds:[],clientIds:['22222222-2222-4222-8222-222222222222'],selectedAdminId:'11111111-1111-4111-8111-111111111111',messageType:'TEXT',title:'Service notice',bodyHtml:'<p>Tracker maintenance</p>',startsAt:'2026-09-26T00:00:00Z',endsAt:'2026-09-27T00:00:00Z',active:true,dontShowAgain:true,createdAt:'2026-09-25T00:00:00Z',updatedAt:'2026-09-25T01:00:00Z',createdBy:'root'};
beforeEach(()=>{mocks.get.mockReset();mocks.post.mockReset();mocks.patch.mockReset();mocks.delete.mockReset();mocks.post.mockResolvedValue({data:{data:row}});mocks.get.mockImplementation(async(path:string,options?:{params?:Record<string,string>})=>path==='/announcements'?{data:{data:[row],pagination:{page:1,pageSize:25,total:1}}}:path==='/announcements/target-options'&&options?.params?.type==='CLIENT'?{data:{data:[{id:'22222222-2222-4222-8222-222222222222',label:'Acme Client'}]}}:{data:{data:[{id:'11111111-1111-4111-8111-111111111111',label:'Regional Admin'}]}})});afterEach(cleanup);
const renderPage=()=>render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><AnnouncementsPage/></QueryClientProvider>);

it('renders every requested announcement column and the admin/client target form',async()=>{
 renderPage();expect(await screen.findByText('Service notice')).toBeVisible();expect(screen.getAllByRole('columnheader').map(cell=>cell.textContent?.replace(/↕/g,''))).toEqual(['','SN','Announcement For','Admins','Clients','Message Title','Message Body','Start Date','End Date','Status','Created By','Added','Updated','Delete']);
 fireEvent.click(screen.getByRole('button',{name:'Add'}));expect(screen.getByRole('dialog',{name:'Add Announcement'})).toBeVisible();expect(screen.getByText('Admin List *')).toBeVisible();
 fireEvent.click(screen.getByRole('combobox',{name:'Announcement For'}));fireEvent.click(screen.getByRole('option',{name:'Client'}));expect(screen.getByRole('combobox',{name:'Admin List'})).toBeVisible();fireEvent.click(screen.getByRole('combobox',{name:'Admin List'}));fireEvent.click(await screen.findByRole('option',{name:'Regional Admin'}));
 expect(screen.getByText('Client List *')).toBeVisible();
});

it('opens an existing image announcement with its image and previews it',async()=>{
 const imageRow={...row,messageType:'IMAGE',bodyHtml:null,imageUrl:'https://res.cloudinary.com/test/image/upload/notice.png',imagePublicId:'fleet/announcements/admin/notice'};
 mocks.get.mockImplementation(async(path:string)=>path==='/announcements'?{data:{data:[imageRow],pagination:{page:1,pageSize:25,total:1}}}:{data:{data:[]}});
 renderPage();fireEvent.click(await screen.findByText('Service notice'));
 expect(screen.getByRole('dialog',{name:'Edit Announcement'})).toBeVisible();
 expect(screen.getByRole('combobox',{name:'Message Type'})).toHaveTextContent('IMAGE');
 expect(screen.queryByLabelText('Message Body')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Preview'}));
 expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(2);
 expect(screen.getAllByRole('img',{name:'Service notice'}).length).toBeGreaterThan(0);
});
