import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,expect,it,vi} from 'vitest';
import {SidebarProfile} from './SidebarProfile';
import type {AccountSummary} from '../types';

const mocks=vi.hoisted(()=>({post:vi.fn()}));
vi.mock('../services/api/client',()=>({api:mocks,errorMessage:()=> 'Upload failed'}));
afterEach(cleanup);

it('shows the signed-in account and updates only its profile photo',async()=>{
 const account={id:'user-a',name:'Aarav Sharma',username:'aarav',mobile:'9253010101',email:'aarav@example.com',avatarUrl:null,coins:0};
 const cache=new QueryClient();cache.setQueryData(['account-summary','user-a'],account);
 mocks.post.mockResolvedValue({data:{data:{avatarUrl:'https://res.cloudinary.com/example/image/upload/avatar.jpg'}}});
 const view=render(<QueryClientProvider client={cache}><SidebarProfile account={account} userId="user-a" role="ADMIN"/></QueryClientProvider>);
 expect(screen.getByText('Aarav Sharma')).toBeVisible();expect(screen.getByText('Admin')).toBeVisible();expect(screen.getByText('9253010101')).toBeVisible();expect(screen.getByText('aarav@example.com')).toBeVisible();
 fireEvent.change(screen.getByLabelText('Choose profile photo'),{target:{files:[new File(['photo'],'avatar.png',{type:'image/png'})]}});
 await waitFor(()=>expect(cache.getQueryData(['account-summary','user-a'])).toMatchObject({avatarUrl:'https://res.cloudinary.com/example/image/upload/avatar.jpg'}));
 view.rerender(<QueryClientProvider client={cache}><SidebarProfile account={cache.getQueryData<AccountSummary>(['account-summary','user-a'])} userId="user-a"/></QueryClientProvider>);
 expect(screen.getByRole('img',{name:'Your profile'})).toHaveAttribute('src','https://res.cloudinary.com/example/image/upload/avatar.jpg');
 expect(mocks.post).toHaveBeenCalledWith('/account-avatar',expect.objectContaining({dataUri:expect.stringMatching(/^data:image\/png;base64,/)}));
 expect(cache.getQueryData(['account-summary','user-a'])).toMatchObject({avatarUrl:'https://res.cloudinary.com/example/image/upload/avatar.jpg'});
 view.unmount();
});
