import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {createMemoryRouter,RouterProvider} from 'react-router-dom';
import {permissionDefinitions,permissionKeys,PERMISSIONS as P} from '../../../../../packages/shared-types/src/permissions';
import {PermissionsProvider,PermissionGuard} from '../../lib/permissions';
import {PermissionManagementPage} from '../../pages/PermissionManagementPage';
import {App} from '../../app/App';
vi.unmock('../../lib/permissions');
const state=vi.hoisted(()=>({role:'SUPER_ADMIN',permissions:[] as string[],draft:[] as string[],version:0,get:vi.fn(),put:vi.fn(),post:vi.fn()}));
vi.mock('../../lib/auth',()=>({claims:()=>({id:'signed-in',role:state.role}),getTokens:()=>({accessToken:'test-token',refreshToken:'refresh'}),setTokens:vi.fn()}));
vi.mock('../../services/api/client',()=>({api:state,errorMessage:(error:Error)=>error.message}));
vi.mock('socket.io-client',()=>({io:()=>({on:vi.fn(),disconnect:vi.fn()})}));
const admin={id:'admin-a',name:'Admin A',username:'admin.a',email:'a@test.local',mobile:'9876543210',active:true,created_at:'2026-01-01'};
beforeEach(()=>{
 vi.clearAllMocks();state.role='SUPER_ADMIN';state.permissions=[...permissionKeys];state.draft=[...permissionKeys];state.version=0;
 state.get.mockImplementation(async(path:string)=>({data:{data:
  path==='/auth/permissions'?{id:'signed-in',role:state.role,permissions:state.permissions}:
  path==='/super-admin/permissions/catalogue'?permissionDefinitions:
  path==='/super-admin/permissions/admins'?[admin]:
  path==='/super-admin/permissions/all'?{targets:[{id:admin.id,version:0},{id:'admin-b',version:0}]}:
  path.startsWith('/super-admin/permissions/')?{admin,permissions:state.draft,version:state.version}:
  path==='/account-summary'?{name:'Signed-in admin',email:'signed-in@test.local',coins:0}:[],
  ...(path==='/super-admin/permissions/admins'?{pagination:{page:1,pageSize:25,total:1}}:{})
 }}));
 state.put.mockImplementation(async(path:string,body:{permissions:string[];targets?:Array<{id:string;version:number}>})=>({data:{data:path.endsWith('/all')?{updated:body.targets!.length,targets:body.targets!.map(target=>({...target,version:target.version+1}))}:{admin,permissions:body.permissions,version:++state.version}}}));
});
afterEach(cleanup);
it('selects every Admin across pages and confirms bulk replacement before saving',async()=>{
 mount(<PermissionsProvider><PermissionGuard superAdminOnly><PermissionManagementPage/></PermissionGuard></PermissionsProvider>);
 fireEvent.click(await screen.findByRole('button',{name:'Bulk Apply'}));
 await screen.findByRole('dialog',{name:'Apply Permission Template'});fireEvent.click(screen.getByRole('button',{name:'Review template'}));await screen.findByText('2 existing Admin accounts · all pages');
 fireEvent.click(screen.getByRole('checkbox',{name:'Playback access'}));
 fireEvent.click(screen.getAllByRole('button',{name:'Save Changes'})[0]);
 expect(state.put).not.toHaveBeenCalled();
 expect(screen.getByText('Replace current permissions for all 2 existing Admin accounts with this selection?')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Apply permissions'}));
 await screen.findByText('Access updated successfully for 2 admins.');
 expect(state.put.mock.calls[0][0]).toBe('/super-admin/permissions/all');
 expect(state.put.mock.calls[0][1].targets).toHaveLength(2);
 expect(state.put.mock.calls[0][1].permissions).not.toContain(P.playbackView);
});
function mount(element:React.ReactNode,path='/super-admin/permissions'){
 const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
 const router=createMemoryRouter([{path:'*',element}],{initialEntries:[path]});
 render(<QueryClientProvider client={client}><RouterProvider router={router}/></QueryClientProvider>);
 return {client,router};
}
async function page(){const result=mount(<PermissionsProvider><PermissionGuard superAdminOnly><PermissionManagementPage/></PermissionGuard></PermissionsProvider>);await screen.findByRole('combobox',{name:'Select Admin'});fireEvent.click(screen.getByRole('combobox',{name:'Select Admin'}));fireEvent.click(await screen.findByRole('option',{name:'Admin A · a@test.local'}));await screen.findByRole('checkbox',{name:'Playback access'});return result}
it('shows the Super Admin control centre and blocks normal admins',async()=>{
 await page();expect(screen.getByRole('heading',{name:'Access Control'})).toBeInTheDocument();expect(screen.getAllByRole('button',{name:'Save Changes'})[0]).toBeDisabled();
 cleanup();state.role='ADMIN';mount(<PermissionsProvider><PermissionGuard superAdminOnly><PermissionManagementPage/></PermissionGuard></PermissionsProvider>);expect(await screen.findByRole('heading',{name:'Access denied'})).toBeInTheDocument();
});
it('derives mixed parent states, keeps module and action views consistent and saves changed keys',async()=>{
 await page();fireEvent.click(screen.getByRole('checkbox',{name:'Announcement access'}));
 expect(screen.getByRole('checkbox',{name:'Alerts'})).toHaveProperty('indeterminate',true);
 expect(screen.getAllByRole('button',{name:'Save Changes'})[0]).toBeEnabled();
 fireEvent.click(screen.getByRole('tab',{name:'Data & Actions'}));
 expect(screen.getByRole('checkbox',{name:'Announcement view'})).not.toBeChecked();expect(screen.getByRole('checkbox',{name:'Announcement add'})).not.toBeChecked();
 fireEvent.click(screen.getByRole('checkbox',{name:'Vehicle delete'}));fireEvent.click(screen.getAllByRole('button',{name:'Save Changes'})[0]);
 await screen.findByText('Permissions updated');
 const body=state.put.mock.calls[0][1];expect(body.version).toBe(0);expect(body.permissions).not.toContain(P.vehicleDelete);expect(body.permissions).not.toContain(P.announcementView);expect(screen.getAllByRole('button',{name:'Save Changes'})[0]).toBeDisabled();
});
it('confirms clearing and resetting, and neither action saves automatically',async()=>{
 state.draft=permissionKeys.filter(key=>key!==P.playbackView);await page();
 fireEvent.click(screen.getByRole('button',{name:'Clear All'}));expect(screen.getByText('Remove all workspace permissions from Admin A?')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Clear permissions'}));expect(screen.getByRole('checkbox',{name:'Dashboard access'})).not.toBeChecked();
 fireEvent.click(screen.getByRole('button',{name:'Reset'}));expect(screen.getByText("Reset Admin A's permissions to the default full-access configuration?")).toBeInTheDocument();fireEvent.click(screen.getAllByRole('button',{name:'Reset'})[1]);expect(screen.getByRole('checkbox',{name:'Playback access'})).toBeChecked();expect(state.put).not.toHaveBeenCalled();fireEvent.click(screen.getAllByRole('button',{name:'Save Changes'})[0]);await screen.findByText('Permissions updated');expect(state.put.mock.calls[0][1].permissions.sort()).toEqual([...permissionKeys].sort());
});
it('protects unsaved navigation and reports save failures without losing edits',async()=>{
 const {router}=await page();fireEvent.click(screen.getByRole('checkbox',{name:'Playback access'}));
 await router.navigate('/dashboard');await screen.findByText('You have unsaved permission changes.');fireEvent.click(screen.getByRole('button',{name:'Stay'}));expect(router.state.location.pathname).toBe('/super-admin/permissions');
 state.put.mockRejectedValueOnce(new Error('Offline'));fireEvent.click(screen.getAllByRole('button',{name:'Save Changes'})[0]);await screen.findByText('Unable to update permissions');expect(screen.getByRole('alert')).toHaveTextContent('Offline');expect(screen.getByRole('checkbox',{name:'Playback access'})).not.toBeChecked();
});
it('filters permissions locally and preserves drafts through accordion collapse and tab changes',async()=>{
 await page();fireEvent.click(screen.getByRole('checkbox',{name:'Announcement access'}));
 fireEvent.click(screen.getByRole('button',{name:'Collapse Alerts'}));
 expect(screen.queryByRole('checkbox',{name:'Announcement access'})).not.toBeInTheDocument();
 expect(screen.getByRole('checkbox',{name:'Alerts'})).toHaveProperty('indeterminate',true);
 fireEvent.click(screen.getByRole('button',{name:'Expand Alerts'}));
 expect(screen.getByRole('checkbox',{name:'Announcement access'})).not.toBeChecked();
 const calls=state.get.mock.calls.length;
 fireEvent.change(screen.getByRole('textbox',{name:'Search permissions'}),{target:{value:'announcement'}});
 expect(screen.getByRole('checkbox',{name:'Announcement access'})).not.toBeChecked();
 expect(screen.queryByRole('checkbox',{name:'Playback access'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('tab',{name:'Data & Actions'}));
 expect(screen.getByRole('checkbox',{name:'Announcement view'})).not.toBeChecked();
 expect(screen.queryByRole('checkbox',{name:'Vehicle view'})).not.toBeInTheDocument();
 expect(state.get.mock.calls.length).toBe(calls);expect(state.put).not.toHaveBeenCalled();
});
it('derives Full Access from actual grants and only shows the sticky save bar when dirty',async()=>{
 state.draft=permissionKeys.filter(key=>key!==P.playbackView);await page();
 expect(screen.getByRole('switch',{name:'Full Access'})).toHaveAttribute('aria-checked','false');
 expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('switch',{name:'Full Access'}));
 expect(screen.getByRole('switch',{name:'Full Access'})).toHaveAttribute('aria-checked','true');
 expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('checkbox',{name:'Playback access'}));
 expect(screen.getByRole('switch',{name:'Full Access'})).toHaveAttribute('aria-checked','false');
 expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
 expect(state.put).not.toHaveBeenCalled();
});
it('searches Admins through the existing server integration from the dropdown',async()=>{
 await page();fireEvent.click(screen.getByRole('combobox',{name:'Select Admin'}));
 fireEvent.change(screen.getByRole('textbox',{name:'Search Select Admin'}),{target:{value:'9876543210'}});
 await waitFor(()=>expect(state.get).toHaveBeenCalledWith('/super-admin/permissions/admins',{params:{search:'9876543210',page:1,pageSize:25}}));
 expect(state.put).not.toHaveBeenCalled();
});
it('guards the actual playback URL and removes its navigation link when denied',async()=>{
 state.role='ADMIN';state.permissions=[P.dashboardView,P.profileView];mount(<App/>,'/dashboard/playback');
 expect(await screen.findByRole('heading',{name:'Access denied'})).toBeInTheDocument();expect(screen.queryByRole('link',{name:'Playback'})).not.toBeInTheDocument();expect(screen.getByRole('link',{name:'Dashboard'})).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Alert'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Reports'})).not.toBeInTheDocument();
});
it('refreshes effective permissions on denial and revokes an already open route',async()=>{
 state.role='ADMIN';state.permissions=[P.playbackView];mount(<PermissionsProvider><PermissionGuard permission={P.playbackView}><h1>Protected playback</h1></PermissionGuard></PermissionsProvider>);
 await screen.findByRole('heading',{name:'Protected playback'});state.permissions=[];window.dispatchEvent(new Event('fleet-permissions'));await screen.findByRole('heading',{name:'Access denied'});await waitFor(()=>expect(screen.queryByRole('heading',{name:'Protected playback'})).not.toBeInTheDocument());
});
it('pauses automatic permission requests after rate limiting and supports an explicit retry',async()=>{
 const error=Object.assign(new Error('Too many requests; try again later'),{response:{status:429}});
 state.get.mockRejectedValueOnce(error);
 mount(<PermissionsProvider><h1>Workspace</h1></PermissionsProvider>);
 await screen.findByRole('heading',{name:'Unable to verify access'});
 expect(state.get).toHaveBeenCalledTimes(1);
 window.dispatchEvent(new Event('fleet-permissions'));
 expect(state.get).toHaveBeenCalledTimes(1);
 vi.useFakeTimers();
 try{await act(async()=>{await vi.advanceTimersByTimeAsync(30000)})}finally{vi.useRealTimers()}
 expect(state.get).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button',{name:'Retry'}));
 await screen.findByRole('heading',{name:'Workspace'});
 expect(state.get).toHaveBeenCalledTimes(2);
});
