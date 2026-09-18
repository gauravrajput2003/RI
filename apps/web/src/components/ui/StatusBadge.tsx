import type {FleetStatus} from '../../types';
export function StatusBadge({status}:{status:FleetStatus|string}){return <span className={`status-badge status-${status.toLowerCase()}`}><i/>{status[0]+status.slice(1).toLowerCase()}</span>}
