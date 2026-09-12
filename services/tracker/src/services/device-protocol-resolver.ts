export interface RegisteredDevice {id:string;protocol:string;identityType:string;identityValue:string}
export interface DeviceProtocolResolver {find(identityType:string,identityValue:string):Promise<RegisteredDevice|null>}
/** Resolver is called only after identity/login, then its result belongs to one connection context. */
