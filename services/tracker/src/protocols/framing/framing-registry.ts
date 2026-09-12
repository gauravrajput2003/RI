import {gt06FamilyFramer,type FrameResult}from './gt06-family-framer.js';
export interface ProtocolFamilyFramer {name:string;matches(data:Buffer):boolean;extract(data:Buffer):FrameResult}
export class FramingRegistry {constructor(private readonly framers:ProtocolFamilyFramer[]){}identify(data:Buffer):ProtocolFamilyFramer|undefined{const matches=this.framers.filter(framer=>framer.matches(data));return matches.length===1?matches[0]:undefined}}
export const framingRegistry=new FramingRegistry([{name:'gt06-family',matches:data=>data.length>=2&&data[0]===0x78&&data[1]===0x78,extract:gt06FamilyFramer.extract}]);
