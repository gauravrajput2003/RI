import { api } from './client';
import { normalizeLocation, normalizeVehicles } from '../../features/vehicles/normalize';
import type { ApiEnvelope, Vehicle } from '../../types/models';
export const getVehicles = async (cursor?: string, signal?: AbortSignal): Promise<ApiEnvelope<Vehicle[]>> => {
  const { data } = await api.get('/vehicles', { params: { limit: 50, cursor }, signal });
  return { success: true, data: normalizeVehicles(data.data), nextCursor: data.nextCursor };
};
export const getLatestLocation = async (id: string, signal?: AbortSignal) => {
  const { data } = await api.get('/vehicles/' + encodeURIComponent(id) + '/latest-location', { signal });
  return normalizeLocation(data.data);
};
