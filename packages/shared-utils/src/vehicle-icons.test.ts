import {describe,expect,it} from 'vitest';
import {normalizeVehicleType,vehicleAppearance,vehicleStateAppearance,vehicleRasterAsset} from './index.js';

describe('shared vehicle appearance',()=>{
  it('normalizes common persisted vehicle labels deterministically',()=>{
    expect(normalizeVehicleType('Motor Bike')).toBe('bike');
    expect(normalizeVehicleType('Scooty')).toBe('scooter');
    expect(normalizeVehicleType('EV-Scooter')).toBe('scooter');
    expect(normalizeVehicleType('cargo-truck')).toBe('truck');
    expect(normalizeVehicleType('Mini_Bus')).toBe('bus');
    expect(normalizeVehicleType('Sedan')).toBe('car');
    expect(vehicleAppearance('scooter','RUNNING')).toMatchObject({type:'scooter',icon:'two-wheeler',label:'Running'});
  });
  it('keeps operational colors independent of vehicle type',()=>{
    expect(vehicleStateAppearance('MOVING')).toMatchObject({key:'running',color:'#168a55'});
    expect(vehicleStateAppearance('ONLINE')).toMatchObject({key:'new',label:'Online (motion unknown)'});
    expect(vehicleStateAppearance('IDLE')).toMatchObject({key:'idle',color:'#ad7e00'});
    expect(vehicleRasterAsset('Bike','IDLE')).toEqual({type:'bike',state:'idle'});
    expect(vehicleStateAppearance('UNREACHABLE')).toMatchObject({key:'unreachable',color:'#607584'});
  });
});
