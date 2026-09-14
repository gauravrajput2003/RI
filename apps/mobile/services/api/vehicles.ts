import { api } from './client';
import { normalizeHistory, normalizeLocation, normalizeVehicles } from '../../features/vehicles/normalize';
import type { ApiEnvelope, Location, Vehicle } from '../../types/models';
export const getVehicles = async (cursor?: string, signal?: AbortSignal): Promise<ApiEnvelope<Vehicle[]>> => {
  const { data } = await api.get('/vehicles', { params: { limit: 50, cursor }, signal });
  return { success: true, data: normalizeVehicles(data.data), nextCursor: data.nextCursor };
};
export const getLatestLocation = async (id: string, signal?: AbortSignal) => {
  const { data } = await api.get('/vehicles/' + encodeURIComponent(id) + '/latest-location', { signal });
  return normalizeLocation(data.data);
};
export const getHistory = async (id: string, from: Date | string, to: Date | string, limit = 500, signal?: AbortSignal): Promise<Location[]> => {
  const fromIso = typeof from === 'string' ? from : from.toISOString();
  const toIso = typeof to === 'string' ? to : to.toISOString();
  const { data } = await api.get('/vehicles/' + encodeURIComponent(id) + '/history', {
    params: { from: fromIso, to: toIso, limit },
    signal,
  });
  return normalizeHistory(data.data);
};

