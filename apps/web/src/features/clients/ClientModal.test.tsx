import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,expect,it,vi} from 'vitest';
import {ClientModal} from './ClientModal';
const mocks=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),patch:vi.fn()}));
mocks.get.mockResolvedValue({data:{data:[{id:'admin-1',name:'Admin A',username:'admin.a',email:'admin@test.local'}]}});
vi.mock('../../services/api/client',()=>({api:mocks,errorMessage:()=> 'error'}));
afterEach(cleanup);
it('loads authorized admins and requires secure create fields',async()=>{const {container}=render(<QueryClientProvider client={new QueryClient()}><ClientModal open client={null} onClose={()=>undefined}/></QueryClientProvider>);fireEvent.click(screen.getByRole('combobox',{name:'Owner'}));expect(await screen.findByRole('option',{name:'Admin A'})).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Save client'}));expect(mocks.post).not.toHaveBeenCalled();expect(container.querySelector('.searchable-select-required')).toBeRequired();expect(screen.getByLabelText('Username')).toBeRequired();expect(screen.getByLabelText('Password')).toHaveAttribute('minLength','8');expect(screen.getByLabelText('Email')).toHaveAttribute('type','email')});

it('previews client details without passwords, editable inputs, or save controls',()=>{
 const client={id:'client-1',owner_id:'admin-1',owner_name:'Admin A',owner_email:'admin@test.local',username:'client.user',name:'Client User',email:'client@test.local',inactive_timeout_seconds:43200,active:true} as import('../../types').Client;
 const {container}=render(<QueryClientProvider client={new QueryClient()}><ClientModal open readOnly client={client} onClose={()=>undefined}/></QueryClientProvider>);
 expect(screen.getByRole('dialog')).toHaveTextContent('Preview client');
 expect(screen.getByLabelText('Owner')).toHaveValue('Admin A');
 expect(screen.getByLabelText('Name')).toBeDisabled();
 expect(screen.queryByRole('button',{name:'Save changes'})).not.toBeInTheDocument();
 expect(container.querySelector('input[type="password"]')).toBeNull();
 fireEvent.submit(container.querySelector('form')!);expect(mocks.patch).not.toHaveBeenCalled();
});
