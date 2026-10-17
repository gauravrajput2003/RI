import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import type {MobileReport,MobileReportRow} from '@fleet/shared-types';
export const reportTitle=(report:MobileReport)=>report.kind==='distance'?'Distance Report':'Travel Summary Report';
export const reportColumns=(kind:MobileReport['kind']):Array<[string,keyof MobileReportRow]>=>(kind==='distance'?
 [['Report date','date'],['Avg speed (km/h)','avgSpeed'],['Max speed (km/h)','maxSpeed'],['Distance (km)','km'],['Duration (seconds)','durationSeconds']]:
 [['Report date','date'],['Distance (km)','km'],['Running (seconds)','runningSeconds'],['Idle (seconds)','idleSeconds'],['Stopped (seconds)','stoppedSeconds'],['Unreachable (seconds)','unreachableSeconds'],['Halts','halts'],['Start time','startTime'],['End time','endTime'],['Avg speed (km/h)','avgSpeed'],['Max speed (km/h)','maxSpeed'],['Start GPS','startLocation'],['End GPS','endLocation'],['Start address','startAddress'],['End address','endAddress']]);
export function exportValue(value:MobileReportRow[keyof MobileReportRow]):string|number|null {
 if(value==null)return null;if(typeof value==='object')return `${value.latitude}, ${value.longitude}`;
 return typeof value==='number'?Number(value.toFixed(2)):String(value);
}
export async function exportMobileReport(report:MobileReport,format:'pdf'|'xlsx'):Promise<Buffer>{
 if(!report.rows.length)throw new Error('No report data available for the selected period.');
 const columns=reportColumns(report.kind);
 if(format==='xlsx'){
  const workbook=new ExcelJS.Workbook();workbook.creator='RI GPS';
  const filters=workbook.addWorksheet('Applied filters');
  filters.addRows([['Report',reportTitle(report)],['Vehicle',report.vehicle.vehicleNumber],['Vehicle ID',report.vehicle.id],['From (inclusive)',report.filters.start],['To (exclusive)',report.filters.end],['Time zone',report.filters.timeZone],['Generated at',report.generatedAt],['Semantics','Daily observed history; first/last GPS fixes are not inferred ignition trip boundaries.'],['Missing values','Blank cells mean unavailable. Genuine zeros are numeric 0.']]);
  filters.getColumn(1).width=24;filters.getColumn(2).width=100;
  const sheet=workbook.addWorksheet('Report');sheet.columns=columns.map(([header,key])=>({header,key,width:key.includes('Address')?55:24}));
  for(const row of report.rows)sheet.addRow(Object.fromEntries(columns.map(([,key])=>[key,exportValue(row[key])])));
  sheet.views=[{state:'frozen',ySplit:1}];sheet.getRow(1).font={bold:true};
  sheet.eachRow(row=>{row.alignment={vertical:'top',wrapText:true}});
  return Buffer.from(await workbook.xlsx.writeBuffer());
 }
 return new Promise((resolve,reject)=>{
  const doc=new PDFDocument({size:'A4',margin:42}),chunks:Buffer[]=[];
  doc.on('data',chunk=>chunks.push(chunk));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);
  doc.fontSize(18).text(`${report.vehicle.vehicleNumber} ${reportTitle(report)}`);
  doc.fontSize(9).text(`From: ${report.filters.start}\nTo (exclusive): ${report.filters.end}\nTime zone: ${report.filters.timeZone}\nGenerated: ${report.generatedAt}`);
  doc.moveDown().text('Daily observed history. First/last GPS fixes are not inferred ignition trip boundaries. Unavailable fields are shown as a dash. Durations are seconds.');
  for(const row of report.rows){
   if(doc.y>550)doc.addPage();doc.moveDown().fontSize(13).fillColor('#ed0508').text(row.date);doc.fillColor('#111').fontSize(10);
   for(const [label,key] of columns){if(key==='date')continue;doc.text(`${label}: ${exportValue(row[key])??'—'}`)}
  }
  doc.end();
 });
}
