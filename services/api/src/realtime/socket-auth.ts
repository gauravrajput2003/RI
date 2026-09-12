import jwt from 'jsonwebtoken';import type {Socket}from 'socket.io';import type {Role}from '@fleet/shared-types';import type {SocketPrincipal}from './authorization.js';
export function createSocketPrincipalReader(secret:string){return(socket:Socket):SocketPrincipal=>{const token=socket.handshake.auth?.token;if(typeof token!=='string')throw new Error('Authentication required');const payload=jwt.verify(token,secret) as {id?:string;role?:Role};if(typeof payload.id!=='string'||typeof payload.role!=='string')throw new Error('Invalid token');return{id:payload.id,role:payload.role}}}
/** App startup validates configuration; lazy access keeps socket transport tests dependency-free. */
export const socketPrincipal=(socket:Socket)=>createSocketPrincipalReader(process.env.JWT_SECRET??'')(socket);
