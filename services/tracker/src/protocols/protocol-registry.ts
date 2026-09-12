import type { ProtocolAdapter } from '@fleet/protocol-types';

export class ProtocolRegistry {
  private readonly adapters = new Map<string, ProtocolAdapter>();
  register(adapter: ProtocolAdapter): void { if (this.adapters.has(adapter.protocol)) throw new Error(`Duplicate protocol adapter: ${adapter.protocol}`); this.adapters.set(adapter.protocol, adapter); }
  get(protocol: string): ProtocolAdapter | undefined { return this.adapters.get(protocol); }
  candidates(data: Buffer): ProtocolAdapter[] { return [...this.adapters.values()].filter(adapter => adapter.matches(data)); }
  /** A configured device protocol always wins; ambiguous signatures are never guessed. */
  identify(data: Buffer, configuredProtocol?: string): ProtocolAdapter | undefined { if(configuredProtocol) return this.get(configuredProtocol); const candidates=this.candidates(data); return candidates.length===1?candidates[0]:undefined; }
}
