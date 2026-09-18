import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import {afterEach,expect,it} from 'vitest';
import {AppShell} from './AppShell';
afterEach(cleanup);
it('toggles the Dashboard and Playback child navigation',()=>{render(<MemoryRouter initialEntries={['/dashboard']}><Routes><Route element={<AppShell/>}><Route path="/dashboard" element={<div>Dashboard page</div>}/></Route></Routes></MemoryRouter>);const toggle=screen.getByRole('button',{name:'Dashboard'});expect(toggle).toHaveAttribute('aria-expanded','true');expect(screen.getByRole('link',{name:'Playback'})).toBeVisible();fireEvent.click(toggle);expect(toggle).toHaveAttribute('aria-expanded','false');expect(screen.queryByRole('link',{name:'Playback'})).not.toBeInTheDocument();fireEvent.click(toggle);expect(screen.getByRole('link',{name:'Playback'})).toBeVisible()});
