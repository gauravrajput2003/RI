export type ExportValue=string|number|boolean|null|undefined;

const text=(value:ExportValue)=>value==null?'Unavailable':String(value);
const csvCell=(value:ExportValue)=>`"${text(value).replaceAll('"','""')}"`;
const html=(value:ExportValue)=>text(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

export function downloadCsv(filename:string,headers:string[],rows:ExportValue[][]){
 const content=[headers,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob(['\ufeff',content],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');
 link.href=url;link.download=filename;link.click();URL.revokeObjectURL(url);
}

export function printTable(title:string,headers:string[],rows:ExportValue[][]){
 const target=window.open('','_blank','width=1100,height=760');
 if(!target)return;
 target.opener=null;
 const head=headers.map(value=>`<th>${html(value)}</th>`).join(''),body=rows.map(row=>`<tr>${row.map(value=>`<td>${html(value)}</td>`).join('')}</tr>`).join('');
 target.document.write(`<!doctype html><html><head><title>${html(title)}</title><style>body{font:12px Arial,sans-serif;padding:24px;color:#18364d}h1{font-size:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd6de;padding:7px;text-align:left}th{background:#0a416c;color:#fff}@media print{body{padding:0}}</style></head><body><h1>${html(title)}</h1><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`);
 target.document.close();target.focus();target.print();
}
