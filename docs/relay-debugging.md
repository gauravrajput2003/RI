# GT06 relay investigation and verification — 25 October 2026

## Findings before patching

The selected vehicle's API read returned RELAY_OFFLINE. That blocks command creation before TCP dispatch (services/api/src/modules/vehicles/relay.ts, baseline line 37; shared relaySafety). Fresh telemetry is not proof of a live command connection.

The existing ACK builder was correct: short 7878 frame, length 05, echoed device serial, X25 CRC over length through serial. The configured idle timeout was 300000 ms, not 47 seconds. However, server.ts baseline line 5 awaited relay binding before login ACK and serialized subsequent ACKs behind database processing. A binding failure could also leave the TCP session processing later GPS without a command binding. Existing close/error logs could not establish why the tracker reconnected.

relay-dispatcher.ts baseline lines 20–23 already conditionally cleaned up by connection ID; the alleged old-close-deletes-new bug was not established. Tests now cover it, overlapping login registration and non-writable sockets. Previously, renewal only updated an existing lease; a missing lease could not recover on an otherwise active connection.

commands.ts baseline line 7 fixed command content to DYD#/HFYD#, line 13 accepted only 0x15. The family framer accepted only 7878, so extended 7979/0x21 replies were dropped. Outbound command hex/text and unmatched reply logs were absent. Absence of those logs did not prove absence of dispatch.

A later read-only inspection found one real request created at 2026-10-25T15:18:53.246Z, marked sent at 15:18:53.840Z, then timed out with RELAY_CONNECTION_LOST at 15:18:55.793Z. The old sent marker preceded the write, so it does not prove delivery. The exact cause of the reported 47-second disconnect cycle remains unproven; new close/ACK/registry logs are required to establish it. After patching, the device has a live lease, but the current safety blocker is RELAY_GPS_STALE. No real command was submitted during this investigation.

## Patch

- Receipt ACKs for established protocols are emitted synchronously before database queues. First login still resolves the registered protocol because GT06 and W15 share the login signature but have different ACK rules; the protocol is never guessed. Login ACK precedes relay binding. No changes to location decoding, persistence or GPS timestamp correction.
- One IMEI-keyed socket registry; UUID lookups resolve through it. New login replaces/destroys the old socket. Cleanup checks connection ID and socket instance. Per-IMEI lease writes are serialized. Failed binding closes the socket for a clean login retry. Missing leases recover; a connection cannot renew another process's lease.
- Exact command vectors test both standard English-language 0x80 and the manufacturer's legacy password capture, which omits the language field. Formats are explicitly configured, never retried with guessed passwords.
- Short/extended 0x15 and 0x21 response frames validate CRC and bounds. 0x21 encoding 01 is ASCII and 02 is UTF-16BE. Device/connection/server flag/action and exact configured success text determine results. Negative replies fail; unknown text is retained while awaiting confirmation. The existing twenty-second deadline and no-replay behavior remain.
- Structured API decisions, ACK hex, socket open/end/close/error/timeout, registry replacement, outbound commands, inbound replies and rejected/unhandled raw packets. Custom model command content and CRC are masked in diagnostic evidence. Configured passwords echoed by replies are redacted.
- Migration 032 stores redacted attempted-frame evidence and the exact expected success text. A local script uses the existing authenticated API; it provides no raw TCP or permission bypass.

## Model configuration

The existing explicit CONCOX_GT06_DYD profile with no devices.model preserves DYD#/HFYD#, English language field and exact DYD=Success!/HFYD=Success! replies. Do not assume this matches every GT06 clone.

For a confirmed model, set devices.model to its exact configuration key and configure GT06_RELAY_MODELS in the tracker environment. Restart the tracker after changing this environment value. Example template (replace the password with the installer's confirmed value):

```dotenv
GT06_RELAY_MODELS='{"MY_CONFIRMED_MODEL":{"lock":"DYD,{password}#","unlock":"HFYD,{password}#","password":"REPLACE_WITH_CONFIRMED_NUMERIC_PASSWORD","lockSuccess":"DYD=Success!","unlockSuccess":"HFYD=Success!","languageField":true}}'
```

Only set languageField:false if that firmware's documentation or capture verifies the legacy format. Alternate RELAY,1#/RELAY,0# text and exact reply strings can be configured for a confirmed model. There is no password fallback. A nonempty unknown model fails closed. No live model, password, wiring setting or safety threshold was changed by this patch.

Concox documents device-side cut-off restrictions for GPS fix and speed below approximately 20 km/h. Wiring/polarity and password are installer/model requirements. RI deliberately requires fresh valid GPS, zero speed and ignition off for both actions. Do not weaken those checks to force a test.

## Real-device test

1. Apply migrations and restart one API and one tracker process. Migration 032 has been applied to the configured local database. Keep ngrok forwarding to port 5001.
2. Watch tracker socket opened, login control ACK, registry bound, heartbeat ACK and any subsequent close reason. Reconnects caused by remote_end/socket_error are distinguishable from idle_timeout. A second tracker process must not compete for the same IMEI.
3. Run the read-only diagnostic from D:\RI:

```powershell
.\scripts\pnpm.ps1 --filter @fleet/api exec tsx scripts/relay-test.ts --imei 864943046904351 --action unlock
```

4. Resolve its reported blocker. Confirm the exact firmware/password and installed relay wiring. Park safely, ignition off, with a fresh valid GPS fix. The default diagnostic sends nothing.
5. To deliberately test restoration, set RI_RELAY_TEST_TOKEN in your terminal to an authorized API access token (never commit or pass it as an argument), then run:

```powershell
.\scripts\pnpm.ps1 --filter @fleet/api exec tsx scripts/relay-test.ts --imei 864943046904351 --action unlock --send --confirm
```

The script prints status, attempted command_hex_redacted and the response text; model-specific content is masked. The worker's relay outbound command and relay inbound response logs include IMEI, connection ID and server flag for correlation. A sent status alone is not success. Verify the physical relay effect while stationary. Only then consider a stationary lock test, and restore before driving.

## Sources

- [Concox GT06 v1.8.1](https://www.traccar.org/protocol/5023-gt06/GT06_GPS_Tracker_Communication_Protocol_v1.8.1.pdf), sections 6.1–6.5 and appendix p37: standard framing, commands, restrictions and legacy password capture.
- [S20/WanWay protocol v2.1](https://www.traccar.org/protocol/5023-gt06/S20WanWayProtocol2021.03.22V21.pdf), section 6.2: 7979/0x21 server flag and encoding layout. Parsing this response does not automatically choose that model's command syntax.

Open questions for physical verification: exact model/firmware and password, relay wiring/polarity, whether it expects the language field, and the peer/network reason for recurring disconnects. The new diagnostics establish these without guessing or sending unsolicited hardware commands.

## Files changed for this investigation

- TCP runtime: services/tracker/src/server.ts; src/transport/tcp-session.ts, control-ack.ts, tracker-sockets.ts; src/services/relay-dispatcher.ts, relay-models.ts; src/config/env.ts; root .env.example.
- Wire protocol: services/tracker/src/protocols/gt06/commands.ts, parser.ts; protocols/framing/gt06-family-framer.ts, framing-registry.ts.
- API/diagnostics: services/api/src/routes/relay.ts; services/api/scripts/relay-test.ts; database/migrations/032_relay_wire_evidence.sql.
- Tracker verification: test/gt06-commands.test.ts, gt06-family-framer.test.ts, relay-dispatcher.test.ts, relay-models.test.ts, tracker-sockets.test.ts, tcp-session.test.ts. API migration fixture lists and existing profile-test result types were updated for the new schema/typecheck.
- Documentation: this report and docs/vehicle-relay.md. Earlier uncommitted mobile/web/profile implementation remains in place; no location persistence or GPS timestamp code was changed.

Verification: all 58 tracker tests, 11 relay API integration tests, tracker/API TypeScript and tracker/API diagnostic lint passed. A real read-only diagnostic verified the live lease and current stale-GPS blocker. No real relay command was sent by the agent. Physical delivery/effect and the exact disconnect trigger remain to be verified with the new logs.
