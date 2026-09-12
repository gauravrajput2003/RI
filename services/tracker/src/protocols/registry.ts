import { Gt06Decoder } from './gt06/decoder.js';
import { W15Decoder } from './w15/decoder.js';
import { ProtocolRegistry } from './protocol-registry.js';
export const protocolRegistry=new ProtocolRegistry();
protocolRegistry.register(new Gt06Decoder());
protocolRegistry.register(new W15Decoder());
