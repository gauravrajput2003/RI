export const bcdImei=(data:Buffer)=>[...data].map(x=>`${x>>4}${x&15}`).join('').replace(/^0/,''); export const coordinate=(raw:number)=>raw/30000/60;
