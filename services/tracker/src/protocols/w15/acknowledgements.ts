export const ack=(type:number,serial:number)=>Buffer.from([0x78,0x78,0x05,type,serial>>8,serial&255,0,0,0x0d,0x0a]);
