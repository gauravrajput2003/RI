export interface Cell {mcc:number;mnc:number;lac:number;cellId:number;radio:string|null}
export interface CellEstimate {latitude:number;longitude:number;accuracy_m:number|null}
const integer=(value:unknown,min:number,max:number):value is number=>typeof value==='number'&&Number.isInteger(value)&&value>=min&&value<=max;

/** Identifiers must come from telemetry, never from a SIM/operator or GPS. */
export function reportedCell(metadata:unknown,protocol:unknown,gt06Radio=''):Cell|null {
  if(!metadata||typeof metadata!=='object')return null;
  const raw=metadata as Record<string,unknown>;
  const c=(raw.cell&&typeof raw.cell==='object'?raw.cell:raw) as Record<string,unknown>;
  if(!integer(c.mcc,1,999)||!integer(c.mnc,0,999)||!integer(c.lac,1,65534)||!integer(c.cellId,1,0xffffff))return null;
  const supplied=typeof c.radio==='string'?c.radio.toUpperCase():'';
  const radio=['GSM','UMTS','LTE'].includes(supplied)?supplied:protocol==='GT06'&&gt06Radio?gt06Radio:null;
  if(radio==='GSM'&&c.cellId>65535)return null;
  return {mcc:c.mcc,mnc:c.mnc,lac:c.lac,cellId:c.cellId,radio};
}
export const cellKey=(cell:Cell)=>`${cell.radio}:${cell.mcc}:${cell.mnc}:${cell.lac}:${cell.cellId}`;

export async function lookupCell(cell:Cell,key:string,fetcher:typeof fetch=fetch):Promise<CellEstimate|null> {
  if(!cell.radio)throw new Error('Radio technology required');
  const url=new URL('https://opencellid.org/cell/get');
  url.search=new URLSearchParams({key,mcc:String(cell.mcc),mnc:String(cell.mnc),lac:String(cell.lac),cellid:String(cell.cellId),radio:cell.radio,format:'json'}).toString();
  const response=await fetcher(url,{signal:AbortSignal.timeout(3000)});
  if(!response.ok)throw new Error('Cell provider unavailable');
  const result=await response.json() as Record<string,unknown>;
  if(result.error){if(Number(result.code)===1)return null;throw new Error('Cell provider rejected request');}
  if(typeof result.lat!=='number'||typeof result.lon!=='number')return null;
  const latitude=result.lat,longitude=result.lon;
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180||(latitude===0&&longitude===0))return null;
  // Reject a provider's mismatched identifiers/radio rather than accepting an ambiguous cell.
  for(const [name,value] of Object.entries({mcc:cell.mcc,mnc:cell.mnc,lac:cell.lac,cellid:cell.cellId}))
    if(result[name]!==undefined&&Number(result[name])!==value)return null;
  if(result.radio!==undefined&&String(result.radio).toUpperCase()!==cell.radio)return null;
  return {latitude,longitude,accuracy_m:typeof result.range==='number'&&result.range>=0?result.range:null};
}
