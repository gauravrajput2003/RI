import type { Location } from '../../types/models';
export interface Viewport { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }
export function hasPosition(point?: Location): point is Location & { latitude: number; longitude: number } {
  return point?.latitude != null && point.longitude != null && Number.isFinite(point.latitude) && Number.isFinite(point.longitude);
}
export function visibleIds(live: Record<string, Location>, region: Viewport | undefined, selected: string | null) {
  return Object.keys(live).filter(id => {
    const point = live[id];
    if (!hasPosition(point)) return false;
    const longitudeDistance = region ? Math.abs(((point.longitude - region.longitude + 540) % 360) - 180) : 0;
    return id === selected || !region || (Math.abs(point.latitude - region.latitude) <= region.latitudeDelta * .6 && longitudeDistance <= region.longitudeDelta * .6);
  });
}
export function followRegion(point: Location | undefined, follow: boolean, region?: Viewport): Viewport | null {
  return follow && hasPosition(point) ? {
    latitude: point.latitude, longitude: point.longitude,
    latitudeDelta: region?.latitudeDelta ?? .03, longitudeDelta: region?.longitudeDelta ?? .03,
  } : null;
}
