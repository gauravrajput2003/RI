export const bcdImei=(data:Buffer)=>[...data].map(byte=>`${byte>>4}${byte&0x0f}`).join('').replace(/^0/,'');
export const gt06Coordinate=(raw:number)=>raw/30000/60;
export function parseDate(data:Buffer):Date|null{if(data.length<6)return null;const value=new Date(Date.UTC(2000+data[0],data[1]-1,data[2],data[3],data[4],data[5]));return Number.isNaN(value.valueOf())?null:value}
export function crc16X25(data:Buffer):number{let crc=0xffff;for(const byte of data){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc&1)?(crc>>>1)^0x8408:crc>>>1}return(crc^0xffff)&0xffff}
export function validGt06Frame(frame:Buffer):boolean{return frame.length>=10&&frame[0]===0x78&&frame[1]===0x78&&frame[2]+5===frame.length&&frame.at(-2)===0x0d&&frame.at(-1)===0x0a&&crc16X25(frame.subarray(2,-4))===frame.readUInt16BE(frame.length-4)}
