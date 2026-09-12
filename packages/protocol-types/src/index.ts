import type { DecodedMessage, DeviceProtocol } from '@fleet/shared-types';
/** Protocol-specific framing and parsing adapter; core TCP handling remains protocol agnostic. */
export interface ProtocolAdapter { readonly protocol: DeviceProtocol; matches(data: Buffer): boolean; decode(frame: Buffer, receivedAt: Date): DecodedMessage; }
export type ProtocolDecoder = ProtocolAdapter;
