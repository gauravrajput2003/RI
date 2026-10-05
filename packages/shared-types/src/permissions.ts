/** Canonical catalogue of existing features; parent groups are derived, never persisted. */
export const permissionRegistry = {
  "dashboardView": {
    "key": "dashboard.view",
    "label": "Dashboard",
    "group": "Dashboard",
    "resource": "dashboard",
    "action": "view",
    "path": "/dashboard"
  },
  "playbackView": {
    "key": "playback.view",
    "label": "Playback",
    "group": "Dashboard",
    "resource": "playback",
    "action": "view",
    "path": "/dashboard/playback"
  },
  "vehicleView": {
    "key": "vehicle.view",
    "label": "Vehicle",
    "group": "Vehicle",
    "resource": "vehicle",
    "action": "view",
    "path": "/vehicles"
  },
  "vehicleAdd": {
    "key": "vehicle.add",
    "label": "Vehicle",
    "group": "Vehicle",
    "resource": "vehicle",
    "action": "add"
  },
  "vehicleEdit": {
    "key": "vehicle.edit",
    "label": "Vehicle",
    "group": "Vehicle",
    "resource": "vehicle",
    "action": "edit"
  },
  "vehicleDelete": {
    "key": "vehicle.delete",
    "label": "Vehicle",
    "group": "Vehicle",
    "resource": "vehicle",
    "action": "delete"
  },
  "adminView": {
    "key": "admin.view",
    "label": "Admin",
    "group": "Admin",
    "resource": "admin",
    "action": "view",
    "path": "/admin"
  },
  "adminAdd": {
    "key": "admin.add",
    "label": "Admin",
    "group": "Admin",
    "resource": "admin",
    "action": "add"
  },
  "adminEdit": {
    "key": "admin.edit",
    "label": "Admin",
    "group": "Admin",
    "resource": "admin",
    "action": "edit"
  },
  "adminDelete": {
    "key": "admin.delete",
    "label": "Admin",
    "group": "Admin",
    "resource": "admin",
    "action": "delete"
  },
  "clientView": {
    "key": "client.view",
    "label": "Client",
    "group": "Client",
    "resource": "client",
    "action": "view",
    "path": "/clients"
  },
  "clientAdd": {
    "key": "client.add",
    "label": "Client",
    "group": "Client",
    "resource": "client",
    "action": "add"
  },
  "clientEdit": {
    "key": "client.edit",
    "label": "Client",
    "group": "Client",
    "resource": "client",
    "action": "edit"
  },
  "clientDelete": {
    "key": "client.delete",
    "label": "Client",
    "group": "Client",
    "resource": "client",
    "action": "delete"
  },
  "geofenceView": {
    "key": "geofence.view",
    "label": "Geofence",
    "group": "Geofence",
    "resource": "geofence",
    "action": "view",
    "path": "/geofences"
  },
  "geofenceAdd": {
    "key": "geofence.add",
    "label": "Geofence",
    "group": "Geofence",
    "resource": "geofence",
    "action": "add"
  },
  "geofenceEdit": {
    "key": "geofence.edit",
    "label": "Geofence",
    "group": "Geofence",
    "resource": "geofence",
    "action": "edit"
  },
  "geofenceDelete": {
    "key": "geofence.delete",
    "label": "Geofence",
    "group": "Geofence",
    "resource": "geofence",
    "action": "delete"
  },
  "alertView": {
    "key": "alert.view",
    "label": "Configure Alert",
    "group": "Alerts",
    "resource": "alert",
    "action": "view",
    "path": "/alerts"
  },
  "alertAdd": {
    "key": "alert.add",
    "label": "Configure Alert",
    "group": "Alerts",
    "resource": "alert",
    "action": "add"
  },
  "alertEdit": {
    "key": "alert.edit",
    "label": "Configure Alert",
    "group": "Alerts",
    "resource": "alert",
    "action": "edit"
  },
  "alertDelete": {
    "key": "alert.delete",
    "label": "Configure Alert",
    "group": "Alerts",
    "resource": "alert",
    "action": "delete"
  },
  "announcementView": {
    "key": "announcement.view",
    "label": "Announcement",
    "group": "Alerts",
    "resource": "announcement",
    "action": "view",
    "path": "/alerts/announcements"
  },
  "announcementAdd": {
    "key": "announcement.add",
    "label": "Announcement",
    "group": "Alerts",
    "resource": "announcement",
    "action": "add"
  },
  "announcementEdit": {
    "key": "announcement.edit",
    "label": "Announcement",
    "group": "Alerts",
    "resource": "announcement",
    "action": "edit"
  },
  "announcementDelete": {
    "key": "announcement.delete",
    "label": "Announcement",
    "group": "Alerts",
    "resource": "announcement",
    "action": "delete"
  },
  "notificationsView": {
    "key": "notifications.view",
    "label": "Notifications History",
    "group": "Alerts",
    "resource": "notifications",
    "action": "view",
    "path": "/alerts/notifications"
  },
  "reportDistance": {
    "key": "reports.distance.view",
    "label": "Distance Report",
    "group": "Reports",
    "resource": "reports.distance",
    "action": "view",
    "path": "/reports/distance"
  },
  "reportAc": {
    "key": "reports.ac.view",
    "label": "AC Report",
    "group": "Reports",
    "resource": "reports.ac",
    "action": "view",
    "path": "/reports/ac"
  },
  "reportPacket": {
    "key": "reports.packet.view",
    "label": "Packet Report",
    "group": "Reports",
    "resource": "reports.packet",
    "action": "view",
    "path": "/reports/packet"
  },
  "reportTravelSummary": {
    "key": "reports.travel-summary.view",
    "label": "Travel Summary",
    "group": "Reports",
    "resource": "reports.travel-summary",
    "action": "view",
    "path": "/reports/travel-summary"
  },
  "reportDailyTripSummary": {
    "key": "reports.daily-trip-summary.view",
    "label": "Daily Trip Summary",
    "group": "Reports",
    "resource": "reports.daily-trip-summary",
    "action": "view",
    "path": "/reports/daily-trip-summary"
  },
  "reportStatus": {
    "key": "reports.status.view",
    "label": "Status Report",
    "group": "Reports",
    "resource": "reports.status",
    "action": "view",
    "path": "/reports/status"
  },
  "reportIdle": {
    "key": "reports.idle.view",
    "label": "Idle Report",
    "group": "Reports",
    "resource": "reports.idle",
    "action": "view",
    "path": "/reports/idle"
  },
  "reportRunning": {
    "key": "reports.running.view",
    "label": "Running Report",
    "group": "Reports",
    "resource": "reports.running",
    "action": "view",
    "path": "/reports/running"
  },
  "reportStoppage": {
    "key": "reports.stoppage.view",
    "label": "Stoppage Report",
    "group": "Reports",
    "resource": "reports.stoppage",
    "action": "view",
    "path": "/reports/stoppage"
  },
  "reportOverspeed": {
    "key": "reports.overspeed.view",
    "label": "Overspeed Report",
    "group": "Reports",
    "resource": "reports.overspeed",
    "action": "view",
    "path": "/reports/overspeed"
  },
  "reportUnreachable": {
    "key": "reports.unreachable.view",
    "label": "Unreachable Report",
    "group": "Reports",
    "resource": "reports.unreachable",
    "action": "view",
    "path": "/reports/unreachable"
  },
  "coinDistributionView": {
    "key": "coin_distribution.view",
    "label": "Coin Distribution",
    "group": "Coin Distribution",
    "resource": "coin_distribution",
    "action": "view",
    "path": "/reports/coin-distribution"
  },
  "coinDistributionAdd": {
    "key": "coin_distribution.add",
    "label": "Coin Distribution",
    "group": "Coin Distribution",
    "resource": "coin_distribution",
    "action": "add"
  },
  "packetHealthView": {
    "key": "packet_health.view",
    "label": "Packet Health",
    "group": "Diagnostics",
    "resource": "packet_health",
    "action": "view",
    "path": "/admin/packet-health"
  },
  "deviceView": {
    "key": "device.view",
    "label": "Device",
    "group": "API resources",
    "resource": "device",
    "action": "view"
  },
  "eventView": {
    "key": "event.view",
    "label": "Event",
    "group": "API resources",
    "resource": "event",
    "action": "view"
  },
  "groupView": {
    "key": "group.view",
    "label": "Group",
    "group": "API resources",
    "resource": "group",
    "action": "view"
  },
  "subscriptionView": {
    "key": "subscription.view",
    "label": "Subscription",
    "group": "API resources",
    "resource": "subscription",
    "action": "view"
  },
  "profileView": {
    "key": "profile.view",
    "label": "Account profile",
    "group": "Account",
    "resource": "profile",
    "action": "view"
  },
  "profileEdit": {
    "key": "profile.edit",
    "label": "Account profile",
    "group": "Account",
    "resource": "profile",
    "action": "edit"
  }
} as const;
export const PERMISSIONS = Object.fromEntries(Object.entries(permissionRegistry).map(([name,definition]) => [name,definition.key])) as {[N in keyof typeof permissionRegistry]: typeof permissionRegistry[N]['key']};
export type PermissionKey = typeof permissionRegistry[keyof typeof permissionRegistry]['key'];
export type PermissionDefinition = {key:PermissionKey;label:string;group:string;resource:string;action:'view'|'add'|'edit'|'delete';path?:string};
export const permissionDefinitions: readonly PermissionDefinition[] = Object.values(permissionRegistry);
export const permissionKeys = permissionDefinitions.map(item => item.key);
export const routePermissions = Object.fromEntries(permissionDefinitions.filter(item => item.path).map(item => [item.path!,item.key])) as Record<string,PermissionKey>;
export const viewPermission = (key:PermissionKey):PermissionKey | undefined => {
  const definition = permissionDefinitions.find(item => item.key === key)!;
  return permissionDefinitions.find(item => item.resource === definition.resource && item.action === 'view')?.key;
};
export function hasEffectivePermission(keys:readonly string[], key:PermissionKey) {
  const view = viewPermission(key);
  return keys.includes(key) && (!view || keys.includes(view));
}

