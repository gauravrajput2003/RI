import '@testing-library/jest-dom/vitest';
import {render,screen} from '@testing-library/react';
import {expect,it} from 'vitest';
import {VehicleIcon,vehicleIconAssetPath} from './VehicleIcon';

it('uses uploaded PNG artwork for supported vehicle types and statuses',()=>{
  const {rerender}=render(<VehicleIcon type="motor bike" state="RUNNING"/>);
  expect(screen.getByLabelText('Running bike').querySelector('img')).toHaveAttribute('src','/assets/vehicle-icons/vehicles/bike/running.png');
  rerender(<VehicleIcon type="Scooty" state="IDLE"/>);
  expect(screen.getByLabelText('Idle scooter').querySelector('img')).toHaveAttribute('src','/assets/vehicle-icons/vehicles/scooter/idle.png');
  rerender(<VehicleIcon type="Bus" state="STOPPED"/>);
  expect(screen.getByLabelText('Stopped bus').querySelector('img')).toHaveAttribute('src','/assets/vehicle-icons/vehicles/bus/stopped.png');
  rerender(<VehicleIcon type="Truck" state="RUNNING"/>);
  expect(screen.getByLabelText('Running truck').querySelector('img')).toHaveAttribute('src','/assets/vehicle-icons/vehicles/truck/running.png');
  expect(vehicleIconAssetPath('Sedan','OVERSPEED')).toBe('/assets/vehicle-icons/vehicles/car/running.png');
});

it('keeps an SVG fallback for vehicle artwork that has not been uploaded',()=>{
  render(<VehicleIcon type="delivery van" state="UNREACHABLE"/>);
  expect(screen.getByLabelText('No signal van').querySelector('svg')).toBeInTheDocument();
});
