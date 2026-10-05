import '@testing-library/jest-dom/vitest';
import {vi} from 'vitest';
// Existing component regression tests render outside the authenticated shell.
// Permission-specific suites unmock this module and exercise the real provider.
vi.mock('../lib/permissions',async()=>{
 const actual=await vi.importActual<typeof import('../lib/permissions')>('../lib/permissions');
 const auth=await import('../lib/auth');
 return {...actual,usePermissions:()=>({role:auth.claims()?.role,ready:true,hasPermission:()=>true})};
});
