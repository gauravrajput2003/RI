# Client GT06 PDF follow-up — investigation and implementation

Investigation before patching: client manual GT06-Protocol-230225.pdf was extracted and its command/response/recording tables visually checked (physical pages 26–28, plus sections 3 and 5). §6.1 omits command language bytes; §6.2 includes them only in replies. Existing optional languageField:false encoding already matched the public six-zero golden command, but the default remained the Concox language-bearing format. Neither default passwords nor the firmware's preferred form could be established without an explicit device probe.

Other confirmed gaps: control-ack.ts required adapter agreement for unknown devices, so ambiguous GT06/W15 signatures delayed/suppressed login ACKs. tcp-session.ts acknowledged alarms only after persistence and sent a 0x12 response the client PDF forbids. Unknown devices were quarantined without receipt ACKs. No signed per-request profile override, restore-only sequential runner or heartbeat relay-state persistence existed.

Plan: keep location decoder/persistence/timestamp and safety checks unchanged; share strict profile validation; add API-scoped signed restore overrides and redacted command evidence; implement a dry-run-first sequential operator tool with abort/cancellation; persist secondary heartbeat evidence separately; correct receipt ACK policy and test exact manual vectors.

Implemented files:

- packages/shared-types/src/relay-profiles.ts, relay.ts, index.ts: shared profile validation, canonical signature input, format metadata, credential redaction and optional probe audit field.
- services/tracker/src/services/relay-models.ts, relay-dispatcher.ts: shared configuration, signed profile guard, format logging, per-request overrides and secondary heartbeat evidence.
- services/tracker/src/protocols/gt06/commands.ts, heartbeat.ts: exact reply language/serial parsing and isolated raw terminal-bit interpretation.
- services/tracker/src/transport/control-ack.ts, tcp-session.ts; src/config/env.ts; src/server.ts: immediate receipt ACK policy, metrics, redaction and startup configuration validation.
- services/api/src/modules/vehicles/relay.ts, relay-probe-runner.ts; src/routes/relay.ts; src/middleware/permissions.ts; src/config/env.ts: scoped probe read/status/cancel, strict restore-only POST override, keyed profile comparison and abort logic.
- services/api/scripts/relay-probe.ts: explicit max-eight candidate CLI, default dry run, authenticated sending only with --send --confirm plus environment token, redacted attempt summaries and winning configuration recommendation.
- database/migrations/033_relay_probe_heartbeat.sql: probe and secondary heartbeat evidence only. It does not modify device models, passwords, assignments or GPS data.
- Tests: tracker command/model/TCP/dispatcher suites; API restore-runner and relay integration suites; migration fixture lists. Operator instructions are in docs/vehicle-relay.md.

Protocol conflicts / caveats:

1. Client command is N+10 with no language; Concox v1.8.1's main table includes two language bytes, while its legacy appendix capture omits them. Both formats remain explicit/selectable; no live fallback.
2. Client's printed command includes eight ASCII zeros but declares length/CRC for six. The requested six-zero frame verifies DC F1 exactly. Both success reply serial/CRC pairs (0018/9177 and 000A/A2E4) validate.
3. Client says unregistered devices still need ACKs and must not be immediately disconnected. ACK receipt does not authorize storing their telemetry or dispatching a command.
4. Client forbids 0x12 reply, requires alarm 0x16 ACK and recording 7979/0x8D status reply. These are transport changes only; no location decoding/persistence was edited.
5. Client heartbeat Bit7 is relay disconnection status. It is secondary evidence because clone semantics and wiring can differ; reply Success remains authoritative for command outcome.

No command was sent to the real device by the agent. Tests use simulated sockets/isolated databases; real execution during verification was dry-run-only. Exact firmware/password, physical relay effect and the peer/network reason for reconnects remain unverified. See the operator guide for explicit commands and interpretation.

Verification: 63 tracker tests and 130 API/probe/permission tests passed; tracker/API TypeScript and targeted lint passed. Golden tests cover DC F1 and both 0x15 reply serial/CRC pairs. Simulated TCP tests hold registration/database work while verifying immediate receipt ACKs and no extra position ACKs. Dispatcher tests cover signed override rejection, model immutability, format metadata, secondary heartbeat agreement/mismatch and coalesced reply/heartbeat receipt times. Read-only CLI verification exercised two explicitly supplied temporary passwordless profiles, printed both formats, and submitted no API command. Observed real blockers varied from stale GPS to offline as the tracker connection changed. Migration 033 was applied locally; no live password/model/profile configuration was changed.
