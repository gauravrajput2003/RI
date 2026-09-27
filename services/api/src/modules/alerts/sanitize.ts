const allowedSimple=new Set(['p','br','strong','b','em','i','u','ul','ol','li','blockquote','h1','h2','h3','h4']);
const escape=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
export function sanitizeAnnouncementHtml(input:string){
 let output='',cursor=0;
 for(const match of input.matchAll(/<[^>]*>/g)){
  output+=escape(input.slice(cursor,match.index));cursor=(match.index??0)+match[0].length;
  const token=match[0],parsed=token.match(/^<\s*(\/?)\s*([a-z0-9]+)([^>]*)>$/i);
  if(!parsed){output+=escape(token);continue}
  const closing=Boolean(parsed[1]),name=parsed[2].toLowerCase(),attributes=parsed[3];
  if(allowedSimple.has(name)){output+=name==='br'?'<br>':`<${closing?'/':''}${name}>`;continue}
  if(name==='a'){
   if(closing){output+='</a>';continue}
   const href=attributes.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2]??'';
   if(/^(https?:|mailto:)/i.test(href))output+=`<a href="${escape(href)}" rel="noopener noreferrer">`;
  }
 }
 output+=escape(input.slice(cursor));
 return output.trim();
}
export const htmlText=(html:string)=>html.replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/\s+/g,' ').trim();

