# Protocols

Each decoder implements `ProtocolDecoder` and produces only normalized data. Missing sensor values remain `null`; no inferred battery percentage is emitted.

GT06 supports login (`0x01`), heartbeat (`0x13`), and GPS (`0x12`/`0x22`) plus acknowledgements. W15 has isolated login (`0x01`), status (`0x13`), location (`0x22`), and additional (`0x26`) paths.

The repository started empty and contains no real device captures. Before deploying W15, place verified captured frames under `services/tracker/test/fixtures` and adjust only `protocols/w15/decoder.ts`; the checksum/frame envelope and exact field mapping must be verified against those captures. This prevents treating an unverified `0x26` value as battery percent.

To add a protocol, create a decoder folder, implement `ProtocolDecoder`, register it, add fixtures/parser tests, and do not alter API or schema code.
