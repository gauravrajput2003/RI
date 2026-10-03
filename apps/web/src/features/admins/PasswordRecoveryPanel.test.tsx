import '@testing-library/jest-dom/vitest';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {PasswordRecoveryPanel} from './PasswordRecoveryPanel';
const mocks=vi.hoisted(()=>({role:'SUPER_ADMIN',post:vi.fn(),copy:vi.fn()}));
vi.mock('../../lib/auth',()=>({claims:()=>({role:mocks.role})}));
vi.mock('../../services/api/client',()=>({api:{post:mocks.post},errorMessage:()=> 'Confirmation failed'}));
beforeEach(()=>{mocks.role='SUPER_ADMIN';mocks.post.mockReset().mockResolvedValue({data:{data:{password:'recoverable-password'}}});mocks.copy.mockReset().mockResolvedValue(undefined);Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:mocks.copy}})});
afterEach(cleanup);
it.each(['admin','client'] as const)('requires super-admin confirmation to reveal and copy a %s password',async kind=>{
 render(<PasswordRecoveryPanel id="account-1" kind={kind}/>);
 expect(screen.queryByLabelText('Account password')).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Verify and preview'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Super-admin password'),{target:{value:'root-password'}});
 fireEvent.click(screen.getByRole('button',{name:'Verify and preview'}));
 expect(await screen.findByLabelText('Account password')).toHaveValue('recoverable-password');
 expect(mocks.post).toHaveBeenCalledWith('/users/account-1/password-recovery',{superAdminPassword:'root-password',action:'REVEAL'});
 fireEvent.click(screen.getByRole('button',{name:'Copy password'}));await waitFor(()=>expect(mocks.copy).toHaveBeenCalledWith('recoverable-password'));
});
it.each(['ADMIN','CLIENT'])('never renders passwords for %s',role=>{mocks.role=role;render(<PasswordRecoveryPanel id="a" kind="admin" initialPassword="secret"/>);expect(screen.queryByRole('region')).not.toBeInTheDocument();expect(mocks.post).not.toHaveBeenCalled()});
it('does not reveal credentials on failed confirmation',async()=>{mocks.post.mockRejectedValue(new Error('bad password'));render(<PasswordRecoveryPanel id="a" kind="admin"/>);fireEvent.change(screen.getByLabelText('Super-admin password'),{target:{value:'wrong'}});fireEvent.click(screen.getByRole('button',{name:'Verify and preview'}));expect(await screen.findByRole('alert')).toHaveTextContent('Confirmation failed');expect(screen.queryByLabelText('Account password')).not.toBeInTheDocument()});
it('requires confirmation for a legacy password reset and uses the protected endpoint',async()=>{render(<PasswordRecoveryPanel id="a" kind="client" initialPassword={null}/>);expect(screen.getByRole('button',{name:'Generate and reset password'})).toBeDisabled();fireEvent.change(screen.getByLabelText('Super-admin password'),{target:{value:'root-password'}});fireEvent.click(screen.getByRole('button',{name:'Generate and reset password'}));await screen.findByLabelText('Account password');expect(mocks.post).toHaveBeenCalledWith('/users/a/password-recovery',{superAdminPassword:'root-password',action:'RESET'})});
it('offers manual copying if clipboard access fails',async()=>{mocks.copy.mockRejectedValue(new Error('denied'));render(<PasswordRecoveryPanel id="a" kind="admin" initialPassword="secret"/>);fireEvent.click(screen.getByRole('button',{name:'Copy password'}));expect(await screen.findByRole('alert')).toHaveTextContent('copy it manually')});

it('does not reopen a preview when confirmation completes after closing it',async()=>{
 let resolve!:(value:unknown)=>void;const verified=vi.fn();mocks.post.mockImplementation(()=>new Promise(done=>{resolve=done}));
 const {unmount}=render(<PasswordRecoveryPanel id="a" kind="admin" onVerified={verified}/>);
 fireEvent.change(screen.getByLabelText('Super-admin password'),{target:{value:'root-password'}});fireEvent.click(screen.getByRole('button',{name:'Verify and preview'}));unmount();
 await act(async()=>{resolve({data:{data:{password:'secret'}}})});expect(verified).not.toHaveBeenCalled();
});
