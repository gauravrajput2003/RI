import { describe, expect, it } from 'vitest';
import { capabilities, type MobileAccount } from './capabilities';
import { permissionKeys } from '../../../../packages/shared-types/src/permissions';
const account=(role:MobileAccount['role']):MobileAccount=>({id:'opaque',name:'Same name',email:'same@example.com',username:'same',mobile:null,avatarUrl:null,coins:'12.50',role,permissions:permissionKeys});
describe('mobile role matrix',()=>{
 it('keeps client edit, coin, notifications and share, without admin capabilities',()=>{expect(capabilities(account('CLIENT'))).toMatchObject({editVehicle:true,coins:true,notifications:true,share:true,addVehicle:false,announcements:false})});
 it('allows the admin actions only when effective grants allow them',()=>{expect(capabilities(account('ADMIN'))).toMatchObject({addVehicle:true,announcements:true,editVehicle:true});expect(capabilities({...account('ADMIN'),permissions:[]})).toMatchObject({addVehicle:false,announcements:false,editVehicle:false,share:false})});
 it('fails closed before an authoritative account is loaded',()=>{expect(Object.values(capabilities()).every(value=>!value)).toBe(true)});
});
