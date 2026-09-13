export const reportCatalog = [
  { id: 'distance', title: 'Distance Report', icon: '📍', color: '#f8c72f', symbol: 'file-document' },
  { id: 'travel', title: 'Travel Summary', icon: '🗺️', color: '#ddd', symbol: 'map-marker-path' },
  { id: 'idle', title: 'Idle Report', icon: '⌛', color: '#ffc400', symbol: 'timer-sand' },
  { id: 'stoppage', title: 'Stoppage Report', icon: '🛑', color: '#ff5066', symbol: 'stop-circle-outline' },
  { id: 'running', title: 'Running Report', icon: '🛞', color: '#ff7717', symbol: 'steering' },
  { id: 'overspeed', title: 'Overspeed Report', icon: '⚡', color: '#009bc8', symbol: 'speedometer' },
  { id: 'ignition', title: 'Ignition Report', icon: '🚦', color: '#3c5b6d', symbol: 'traffic-light' },
  { id: 'alerts', title: 'Alert Report', icon: '☎️', color: '#229deb', symbol: 'phone-alert' },
] as const;
export function searchReports(search: string) {
  return reportCatalog.filter(report => report.title.toLowerCase().includes(search.trim().toLowerCase()));
}
