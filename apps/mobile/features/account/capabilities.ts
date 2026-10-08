import { hasEffectivePermission, PERMISSIONS as P, type PermissionKey } from '../../../../packages/shared-types/src/permissions';
import type { Role } from '../../../../packages/shared-types/src/index';
export interface MobileAccount {
  id: string; role: Role; permissions: PermissionKey[]; name: string | null;
  username: string | null; email: string; mobile: string | null; avatarUrl: string | null; coins: string | null;
}
export function capabilities(account?: MobileAccount) {
  const allowed = (key: PermissionKey) => Boolean(account && (account.role !== 'ADMIN' || hasEffectivePermission(account.permissions, key)));
  const manager = account?.role === 'ADMIN' || account?.role === 'SUPER_ADMIN';
  return {
    vehicles: allowed(P.vehicleView), addVehicle: manager && allowed(P.vehicleAdd), editVehicle: allowed(P.vehicleEdit),
    announcements: manager && allowed(P.announcementView), addAnnouncement: manager && allowed(P.announcementAdd),
    editAnnouncement: manager && allowed(P.announcementEdit), deleteAnnouncement: manager && allowed(P.announcementDelete),
    notifications: allowed(P.notificationsView), share: allowed(P.vehicleView),
    coins: Boolean(account && account.role !== 'SUPER_ADMIN'), dashboard: allowed(P.dashboardView), playback: allowed(P.playbackView),
  };
}
