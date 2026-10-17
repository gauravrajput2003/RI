import type {MobileReport} from '../../../../packages/shared-types/src/mobile-reports';
import {getReportFile} from './service';
export async function shareReport(report:MobileReport,format:'pdf'|'xlsx'){
 const [{File,Paths},Sharing]=await Promise.all([import('expo-file-system'),import('expo-sharing')]);
 if(!await Sharing.isAvailableAsync())throw new Error('File sharing is unavailable on this device.');
 const result=await getReportFile(report,format),file=new File(Paths.cache,`${Date.now()}-${result.fileName}`);
 try{
  file.create({overwrite:true});file.write(result.base64,{encoding:'base64'});
  if(!file.exists||file.size===0)throw new Error('The report file could not be saved.');
  await Sharing.shareAsync(file.uri,{mimeType:result.mimeType,dialogTitle:'Download Report',UTI:format==='pdf'?'com.adobe.pdf':'org.openxmlformats.spreadsheetml.sheet'});
 }catch(cause){if(file.exists)file.delete();throw cause}
}
