import type {MobileReport,MobileReportKind} from '../../../../packages/shared-types/src/mobile-reports';
import {api} from '../../services/api/client';
import {config} from '../../constants/config';
export interface ReportOption {id:string;vehicle_number:string;alias:string|null}
const realOnly=()=>{if(config.demoMode)throw new Error('Reports require a live backend session. Disable demo mode to retrieve actual GPS history.')};
export async function getReport(kind:MobileReportKind,params:{vehicleId:string;start:string;end:string;timeZone:string},signal?:AbortSignal){realOnly();return(await api.get<{data:MobileReport}>(`/reports/mobile/${kind}`,{params,signal,timeout:30_000})).data.data}
export async function reportOptions(search:string,signal?:AbortSignal){realOnly();return(await api.get<{data:ReportOption[]}>('/reports/options',{params:{search},signal})).data.data}
export async function getReportFile(report:MobileReport,format:'pdf'|'xlsx'){
 realOnly();if(!report.rows.length||!report.snapshotId)throw new Error('No report data available for the selected period.');
 return(await api.post<{data:{fileName:string;mimeType:string;base64:string}}>(`/reports/mobile/${report.kind}/export`,{snapshotId:report.snapshotId,format},{timeout:60_000})).data.data;
}
