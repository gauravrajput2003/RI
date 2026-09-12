import { memo, useCallback } from 'react';
import { router } from 'expo-router';
import { useLatestLocation } from '../features/vehicles/queries';
import { useLiveVehicleStore } from '../store/liveVehicleStore';
import type { Vehicle } from '../types/models';
import { VehicleCard } from './VehicleCard';
export const LiveVehicleRow = memo(function LiveVehicleRow({ vehicle }: { vehicle: Vehicle }) {
  useLatestLocation(vehicle.id);
  const live = useLiveVehicleStore(state => state.byVehicleId[vehicle.id]);
  const open = useCallback(() => router.push({ pathname: '/(app)/vehicle/[vehicleId]', params: { vehicleId: vehicle.id } }), [vehicle.id]);
  return <VehicleCard vehicle={vehicle} live={live} onPress={open} />;
});
