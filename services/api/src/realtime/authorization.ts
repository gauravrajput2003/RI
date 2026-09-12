import type { Role } from '@fleet/shared-types';
export interface SocketPrincipal { id:string; role:Role }
export interface VehicleAuthorizer { canAccessVehicle(userId:string,vehicleId:string):Promise<boolean>; authorizedVehicleIds(userId:string):Promise<string[]> }
export function createRoomAuthorizer(authorizer:VehicleAuthorizer){return {async initialRooms(principal:SocketPrincipal){return (await authorizer.authorizedVehicleIds(principal.id)).map(id=>`vehicle:${id}`)},async canJoin(principal:SocketPrincipal,vehicleId:string){return authorizer.canAccessVehicle(principal.id,vehicleId)}}}
