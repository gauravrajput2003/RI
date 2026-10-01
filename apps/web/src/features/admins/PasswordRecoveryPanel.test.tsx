import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {PasswordRecoveryPanel} from './PasswordRecoveryPanel';
const mocks=vi.hoisted(()=>({role:'SUPER_ADMIN',patch:vi.fn(),post:vi.fn(),copy:vi.fn()}));
vi.mock('../../lib/auth',()=>({claims:()=>({role:mocks.role})}));
vi.mock('../../services/api/client',()=>({api:{patch:mocks.patch,post:mocks.post},errorMessage:()=> 'Reset failed'}));
beforeEach(()=>{mocks.role='SUPER_ADMIN';mocks.patch.mockReset().mockResolvedValue({});mocks.post.mockReset().mockResolvedValue({});mocks.copy.mockReset().mockResolvedValue(undefined);Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:mocks.copy}})});
afterEach(cleanup);
function show(kind:'admin'|'client'='admin'){return render(<QueryClientProvider client={new QueryClient({defaultOptions:{mutations:{retry:false}}})}><PasswordRecoveryPanel id="account-1" kind={kind}/></QueryClientProvider>)}
it.each(['admin','client'] as const)('resets a %s password before displaying it and supports copying',async kind=>{
  show(kind);expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Generate and reset password'}));
  const password=(await screen.findByLabelText('New password') as HTMLInputElement).value;
  expect(password).toMatch(/^[A-Za-z0-9_-]{20}$/);
  if(kind==='admin')expect(mocks.patch).toHaveBeenCalledWith('/admins/account-1',{password});
  else expect(mocks.post).toHaveBeenCalledWith('/clients/account-1/reset-password',{password,confirmPassword:password});
  fireEvent.click(screen.getByRole('button',{name:'Copy password'}));
  await waitFor(()=>expect(mocks.copy).toHaveBeenCalledWith(password));
  expect(await screen.findByRole('status')).toHaveTextContent('Password copied');
});
it.each(['ADMIN','CLIENT'])('hides password recovery from %s accounts',role=>{
  mocks.role=role;show();expect(screen.queryByRole('region',{name:'Password recovery'})).not.toBeInTheDocument();expect(mocks.patch).not.toHaveBeenCalled();
});
it('never displays or copies a password when resetting fails',async()=>{
  mocks.patch.mockRejectedValue(new Error('offline'));show();
  fireEvent.click(screen.getByRole('button',{name:'Generate and reset password'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Reset failed');
  expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Copy password'})).not.toBeInTheDocument();
});
it('offers manual copying if clipboard access fails',async()=>{
  mocks.copy.mockRejectedValue(new Error('denied'));show();
  fireEvent.click(screen.getByRole('button',{name:'Generate and reset password'}));await screen.findByLabelText('New password');
  fireEvent.click(screen.getByRole('button',{name:'Copy password'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('copy it manually');
});
