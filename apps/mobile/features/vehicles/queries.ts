import { useEffect, useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getHistory, getLatestLocation, getVehicles } from '../../services/api/vehicles';
import { useLiveVehicleStore } from '../../store/liveVehicleStore';
export const vehicleKeys = {
  all: ['vehicles'] as const,
  list: ['vehicles','list'] as const,
  latest: (id: string) => ['vehicles','latest',id] as const,
  history: (id: string, from?: string, to?: string) => ['vehicles','history',id,from,to] as const,
};
export function useVehicles() {
  const query = useInfiniteQuery({
    queryKey: vehicleKeys.list, initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => getVehicles(pageParam, signal),
    getNextPageParam: (last, _pages, lastParam) => last.nextCursor && last.nextCursor !== lastParam ? last.nextCursor : undefined,
    staleTime: 60_000, gcTime: 30 * 60_000, retry: 1,
    refetchOnWindowFocus: false, refetchOnReconnect: false,
  });
  const data = useMemo(() => query.data ? ({
    success: true, data: [...new Map(query.data.pages.flatMap(page => page.data).map(vehicle => [vehicle.id, vehicle])).values()],
  }) : undefined, [query.data]);
  return { ...query, data };
}
export function useLatestLocation(vehicleId: string) {
  const query = useQuery({
    queryKey: vehicleKeys.latest(vehicleId), queryFn: ({ signal }) => getLatestLocation(vehicleId, signal),
    staleTime: 30_000, enabled: Boolean(vehicleId), retry: 1,
    refetchOnReconnect: false, refetchOnWindowFocus: false,
  });
  useEffect(() => { if (query.data) useLiveVehicleStore.getState().upsert(vehicleId, query.data); }, [vehicleId, query.data]);
  return query;
}
export function useHistory(vehicleId: string, from: Date | null, to: Date | null, enabled = false) {
  const fromIso = from?.toISOString();
  const toIso = to?.toISOString();
  return useQuery({
    queryKey: vehicleKeys.history(vehicleId, fromIso, toIso),
    queryFn: ({ signal }) => getHistory(vehicleId, fromIso!, toIso!, 500, signal),
    enabled: Boolean(enabled && vehicleId && fromIso && toIso),
    staleTime: 60_000,
    retry: 1,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });
}

