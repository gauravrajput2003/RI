import '@testing-library/jest-dom/vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {expect,it,vi} from 'vitest';
import {AddAdminModal} from './AddAdminModal';
const mocks=vi.hoisted(()=>({get:vi.fn(),post:vi.fn()}));
mocks.get.mockResolvedValue({data:{data:[]}});
vi.mock('../../services/api/client',()=>({api:{get:mocks.get,post:mocks.post},errorMessage:()=> 'error'}));
it('requires owner, username, password, name, and valid email before submitting',async()=>{render(<QueryClientProvider client={new QueryClient()}><AddAdminModal open onClose={()=>undefined}/></QueryClientProvider>);await screen.findByRole('option',{name:'Select authorized owner'});fireEvent.click(screen.getByRole('button',{name:'Save admin'}));expect(mocks.post).not.toHaveBeenCalled();expect(screen.getByLabelText('Owner')).toBeRequired();expect(screen.getByLabelText('Username')).toBeRequired();expect(screen.getByLabelText('Password')).toHaveAttribute('minLength','8');expect(screen.getByLabelText('Email')).toHaveAttribute('type','email')});
