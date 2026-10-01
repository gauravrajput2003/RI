import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,expect,it,vi} from 'vitest';
import {AddAdminModal} from './AddAdminModal';
import type {Admin} from '../../types';
const mocks=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),patch:vi.fn()}));
mocks.get.mockResolvedValue({data:{data:[]}});
vi.mock('../../lib/auth',()=>({claims:()=>({role:'SUPER_ADMIN'})}));
vi.mock('../../services/api/client',()=>({api:{get:mocks.get,post:mocks.post,patch:mocks.patch},errorMessage:()=> 'error'}));
afterEach(()=>{cleanup();mocks.patch.mockClear();mocks.post.mockClear()});
it('requires owner, username, password, name, and valid email before submitting',async()=>{const {container}=render(<QueryClientProvider client={new QueryClient()}><AddAdminModal open onClose={()=>undefined}/></QueryClientProvider>);expect(await screen.findByRole('combobox',{name:'Owner'})).toHaveTextContent('Select authorized owner');fireEvent.click(screen.getByRole('button',{name:'Save admin'}));expect(mocks.post).not.toHaveBeenCalled();expect(container.querySelector('.searchable-select-required')).toBeRequired();expect(screen.getByLabelText('Username')).toBeRequired();expect(screen.getByLabelText('Password')).toHaveAttribute('minLength','8');expect(screen.getByLabelText('Email')).toHaveAttribute('type','email')});
it('requires a password when editing and sends it with the updated admin details',async()=>{
  const admin={id:'admin-id',owner_id:'owner-id',owner_name:'Owner',owner_email:'owner@test.local',username:'admin.user',name:'Admin User',mobile:'9876543210',email:'admin@test.local',company:'Fleet',website:null,address:null,coins:'2.00',active:true} as Admin;
  mocks.patch.mockResolvedValue({data:{data:{}}});
  render(<QueryClientProvider client={new QueryClient()}><AddAdminModal open admin={admin} onClose={()=>undefined}/></QueryClientProvider>);
  expect(screen.getByLabelText('Username')).toHaveValue('admin.user');
  expect(screen.getByLabelText('Password')).toBeRequired();
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
  expect(mocks.patch).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Password'),{target:{value:'new-admin-password'}});
  fireEvent.change(screen.getByLabelText('Name'),{target:{value:'Updated Admin'}});
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
  await waitFor(()=>expect(mocks.patch).toHaveBeenCalledWith('/admins/admin-id',expect.objectContaining({name:'Updated Admin',username:'admin.user',coins:2})));
  expect(mocks.patch.mock.calls[0][1]).toHaveProperty('password','new-admin-password');
});

it('previews admin data without editable controls, passwords, or a save action',()=>{
 const admin={id:'admin-id',owner_id:'owner-id',owner_name:'Owner',username:'admin.user',name:'Admin User',email:'admin@test.local',coins:2,active:true,can_view_packet_health:true} as Admin;
 const {container}=render(<QueryClientProvider client={new QueryClient()}><AddAdminModal open readOnly admin={admin} onClose={()=>undefined}/></QueryClientProvider>);
 expect(screen.getByRole('dialog')).toHaveTextContent('Preview admin');
 expect(screen.getByLabelText('Name')).toBeDisabled();
 expect(screen.getByLabelText('Can view packet health')).toBeChecked();
 expect(screen.queryByRole('button',{name:'Save changes'})).not.toBeInTheDocument();
 expect(container.querySelector('input[type="password"]')).toBeNull();
 fireEvent.submit(container.querySelector('form')!);
 expect(mocks.patch).not.toHaveBeenCalled();
});

it('lets the super-admin grant packet-health access from admin editing',async()=>{
 const admin={id:'admin-id',owner_id:'owner-id',owner_name:'Owner',username:'admin.user',name:'Admin User',email:'admin@test.local',coins:2,active:true,can_view_packet_health:false} as Admin;
 mocks.patch.mockResolvedValue({data:{data:{}}});
 render(<QueryClientProvider client={new QueryClient()}><AddAdminModal open admin={admin} onClose={()=>undefined}/></QueryClientProvider>);
 fireEvent.change(screen.getByLabelText('Password'),{target:{value:'new-admin-password'}});
 fireEvent.click(screen.getByLabelText('Can view packet health'));
 fireEvent.submit(screen.getByRole('button',{name:'Save changes'}).closest('form')!);
 await waitFor(()=>expect(mocks.patch).toHaveBeenCalledWith('/admins/admin-id',expect.objectContaining({canViewPacketHealth:true})));
});

it('shows and hides the entered password without submitting and resets visibility on reopening',()=>{
 const view=(open:boolean)=><QueryClientProvider client={new QueryClient()}><AddAdminModal open={open} onClose={()=>undefined}/></QueryClientProvider>;
 const {rerender}=render(view(true));
 fireEvent.change(screen.getByLabelText('Password'),{target:{value:'typed-password'}});
 expect(screen.getByLabelText('Password')).toHaveAttribute('type','password');
 fireEvent.click(screen.getByRole('button',{name:'Show password'}));
 expect(screen.getByLabelText('Password')).toHaveAttribute('type','text');
 expect(screen.getByLabelText('Password')).toHaveValue('typed-password');
 expect(mocks.post).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Hide password'}));
 expect(screen.getByLabelText('Password')).toHaveAttribute('type','password');
 fireEvent.click(screen.getByRole('button',{name:'Show password'}));
 rerender(view(false));rerender(view(true));
 expect(screen.getByLabelText('Password')).toHaveAttribute('type','password');
 expect(screen.getByLabelText('Password')).toHaveValue('');
});
