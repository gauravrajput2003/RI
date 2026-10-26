# Vehicle relay control: Concox GT06

## Client PDF (GT06-Protocol-230225) and restore-only probing

Confirmation refresh fix: one-second background polling no longer disables Lock/Unlock or Confirm merely because a GET request is in flight. Actual API errors, phone offline state, loss of capability, changed tracker connections and submissions still block writes. An open confirmation shows the blocking reason and visibly disables Confirm when eligibility changes; normal lock/unlock also require a new confirmation after a detected connection change. API and tracker dispatch validations remain authoritative. A sent request followed by RELAY_CONNECTION_LOST is a separate device-link failure and is not a successful physical relay result.

Phone testing: reload the mobile app, open the selected vehicle's Lock / Unlock dialog, select a named profile under **Test Restore**, tap **Test Restore**, then confirm. It sends only HFYD restore through the same authenticated probe API; it cannot send a cut with a probe profile or change devices.model. The dialog refreshes every second while open and displays the selected profile, result and redacted tracker reply in Recent requests. A reconnect between selection and confirmation cancels the confirmation. If the tracker is offline, inactive, unassigned or relay control is disabled, the test remains disabled. Restore permits ignition ON and does not require fresh GPS. Select the profile first and keep the dialog open to see short tracker connection windows. No command is stored for a future wake-up. Test selection does not change the normal Lock/Unlock model configuration; a successful profile must be verified/configured before relying on normal controls.

The client's PDF §6.1 specifies **no language field in server 0x80 commands**: length is N+10. Its 0x15 device reply includes the two-byte language field. The existing Concox v1.8.1 format can include the field in the command; choose languageField explicitly and never change it automatically during a live attempt. The printed eight-zero example is inconsistent with its length/CRC: DC F1 verifies the six-zero public manual vector. This does not identify the installed device's password.

The probe tool accepts only your explicit list of 1–8 configured names and only HFYD restore/unlock. It never generates passwords/candidates, writes devices.model, sends cuts, retries a timed-out command or silently switches formats. API/tracker signatures prevent the same profile name from selecting different definitions in the two processes. Active-vehicle, relay wiring, ownership and live-connection checks apply before every restore write and throughout a probe run. Restore does not require ignition OFF, fresh GPS or a speed measurement. Cut uses a separate check: valid GPS/current speed measured within 60 seconds and below 20 km/h (including zero); ignition ON is allowed.

Configure the **same GT06_RELAY_MODELS JSON in the API, tracker and operator tool**, normally in D:\RI\.env, then restart API/tracker. The names below are examples you explicitly configure; they are not built-in candidates. This example tests only passwordless forms:

```dotenv
GT06_RELAY_MODELS='{"PDF_NO_PASS":{"lock":"DYD#","unlock":"HFYD#","lockSuccess":"DYD=Success!","unlockSuccess":"HFYD=Success!","languageField":false},"V18_NO_PASS":{"lock":"DYD#","unlock":"HFYD#","lockSuccess":"DYD=Success!","unlockSuccess":"HFYD=Success!","languageField":true}}'
```

To test a password candidate that **you explicitly choose**, add a named entry with lock DYD,{password}#, unlock HFYD,{password}#, your numeric password in its password property, the exact success replies, and languageField false or true. Do not put passwords into profile names, command arguments or source control. There is no factory-password list; “password not set” does not prove a default or passwordless form. A missing password is valid only when the command templates do not contain {password}. Malformed configurations stop startup.

| Example profile | Language field in command | Password form |
| --- | --- | --- |
| PDF_NO_PASS | false, client PDF | passwordless |
| V18_NO_PASS | true, Concox variant | passwordless |
| Your PDF operator profile | false | your supplied candidate |
| Your v1.8 operator profile | true | your supplied candidate |

From D:\RI, dry run (no token needed, reads local database and prints blockers plus redacted previews):

```powershell
.\scripts\pnpm.ps1 --filter @fleet/api exec tsx scripts/relay-probe.ts --imei 864943046904351 --profiles 'PDF_NO_PASS,V18_NO_PASS'
```

For an intentional real restore probe, first set RI_RELAY_TEST_TOKEN in that terminal to an authorized API access token. Never pass a token as an argument. For a controlled physical test, keep the vehicle parked. Restore may be requested with ignition ON and without fresh GPS, provided the tracker has a live connection. Then:

```powershell
.\scripts\pnpm.ps1 --filter @fleet/api exec tsx scripts/relay-probe.ts --imei 864943046904351 --profiles 'PDF_NO_PASS,V18_NO_PASS' --send --confirm
```

The list is strictly sequential. Each attempt waits for a terminal reply or its existing twenty-second deadline. Socket/assignment changes, safety blockers and transport failures abort the run and cancel an unsent pending probe where possible. Already sent bytes cannot be recalled; they are never replayed. The first Success stops the run and prints a recommended config. Passwords are REPLACE_ME in that recommendation; --show-config deliberately exports the winning entry with its supplied password to your terminal only. It is never used automatically, in logs, in tests with real credentials, or by the agent. Embedded password forms are converted to a placeholder in the default recommendation.

| Result | Meaning / next step |
| --- | --- |
| Success reply | This profile works. Verify relay effect while stationary. |
| Fail!, Unvalued Fix!, Speed Limit | Command/password accepted; a device condition failed. This is not a password rejection. The original reason is retained. |
| Negative error outside those conditions | Preserve the reply; acceptance is not established. |
| Timeout on every profile | Wrong format/password OR connection/reply handling. Check stable connectionId, outbound evidence, inbound raw frame logs and whether your explicit list covered both language-field variants. |
| Connection lost / safety abort | Stop; do not replay. Resolve the reported blocker first. |

The probe does not permanently configure the winner. After verification, the operator can assign the winning model key for regular vehicle controls; do not change the model while probing. Once the password is known, have the client/installer change a factory-default password and update the private configuration: SMS access to the tracker SIM can otherwise allow relay control.

Heartbeat evidence is stored separately from locations in device_status.relay_state_reported (true = Bit7 disconnected), relay_terminal_info, relay_reported_at and connection ID. Logs also expose raw terminal byte, GPS bit, alarm code, external power, ACC and armed bit. After Success, the next heartbeat's expected Bit7 is secondary corroboration; mismatch logs a warning and never changes the reply-text result. Clones can differ.

Receipt ACKs for valid GT06 0x01, 0x13 and 0x16 packets are written before any registration/DB work, including unknown IMEIs, without granting them tracking or command access. The transport suppresses 0x12/0x18/0x94 replies and returns 7979/0x8D status 00. Metrics log ACK latency and warn above one second; the PDF's five-second deadline is a device requirement, not a network-latency guarantee. Unknown devices are quarantined without an immediate disconnect. Ordinary inactivity timeouts still apply.

Migration 033 adds per-request probe audit/signatures and secondary heartbeat evidence. The migration is applied locally. The supplied PDF and simulated tests establish wire behavior; they cannot establish the installed firmware/password, wiring, mobile network behavior or actual relay effect without a deliberate physical-device test. No such command was sent by the agent.

RI supports relay commands for the explicit CONCOX_GT06_DYD device profile. GT06 registration alone does not enable commands. SIM numbers remain provisioning metadata; commands travel over the tracker TCP connection selected by its registered IMEI. Each device has its own connection and command history.

Protocol source: [Concox GT06 communication protocol v1.8.1](https://www.traccar.org/protocol/5023-gt06/GT06_GPS_Tracker_Communication_Protocol_v1.8.1.pdf), sections 6.1–6.5. This profile sends DYD# (cut the configured circuit) or HFYD# (restore it) inside a CRC-protected 0x80 frame. It accepts a 0x15 command reply only when its server flag, device, connection and action match the outstanding request. Only DYD=Success! / HFYD=Success! establish a successful tracker result. Login and heartbeat ACKs never confirm relay operation.

GT06 firmware using password-prefixed commands or RELAY,1# requires explicit model configuration. W15 relay commands remain unsupported. Obtain the exact model/firmware and installer confirmation before selecting a profile. A tracker success response does not independently measure relay wiring or physical vehicle immobilization.
Model-specific command configuration, 0x21 reply decoding, wire diagnostics and the read-only/test script are now described in [relay-debugging.md](relay-debugging.md). The current parser accepts both 7878 and 7979 command replies; command text remains an explicit model choice.

## Setup and stationary test

1. Start PostgreSQL, then run the command below from D:\RI. This includes migration 031_gt06_relay_dispatch.sql. Restart both API and tracker processes after migration, then reload the mobile app.

   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\pnpm.ps1 --filter @fleet/api migrate

2. In web Vehicle management, edit the correct vehicle and IMEI. Select GT06 and **Concox GT06 v1.8 — DYD / HFYD** under **Relay command profile**. Enable the Relay checkbox only after the installer confirms the relay is fitted, its circuit/polarity is correct, and this device supports the command family. Profiles are not enabled automatically for existing trackers.
3. Keep that tracker connected to RI (and the ngrok TCP tunnel open during local testing). For a controlled test, stop the vehicle safely. Restore needs the live authenticated tracker connection and configured relay. Cut additionally requires a valid current speed/GPS reading under 60 seconds old and below 20 km/h; ignition ON is allowed.
4. Open the vehicle's Lock / Unlock dialog. Confirm Lock, then watch Recent requests. Accepted means pending, followed by sent; it is not success. Only a matching positive reply changes the displayed state to Locked. A rejection or timeout retains Unknown.
5. Have the installer verify the physical relay effect while stationary. Confirm Unlock and verify restoration before driving. Do not drive during the test or use a moving vehicle to test cut-off.

Migration 031 was applied to the configured local database on 25 October 2026. No live tracker profile or relay flag was enabled by this implementation, and no real relay command was transmitted during development. Isolated protocol/database tests verify the code; physical hardware verification remains required.

## Safety, ownership and result handling

- Vehicle must be active, Relay enabled, with exactly one active device owned by that vehicle's client and an explicit supported profile.
- Connection lease must be current for either action. Restore has no GPS, speed or ignition restriction in RI. Cut requires valid GPS and current speed readings within 60 seconds, belonging to the current assignment; both measured/status speeds must be known, nonnegative and below 20 km/h. Ignition may be ON. An old zero-speed sample is not accepted as proof of current safe speed.
- API uses existing authentication, recursive ownership, vehicle-edit permission, strict confirmation, rate limiting and retry idempotency. Tracker rechecks permission, assignment, ownership, connection, profile and telemetry immediately before writing.
- API records the request in PostgreSQL. Only the tracker process holding the current device connection can dispatch. There is no unauthenticated command HTTP endpoint or arbitrary command text API.
- Requests have a five-second dispatch window and twenty-second response deadline. A persisted attempt is committed before the socket write so a crash cannot replay it. Expired, disconnected or obsolete commands are never queued for reconnection or automatically retried.
- Correlation uses a persistent non-reused 32-bit server flag. Wrong-device, wrong-connection, wrong-action, wrong-flag and late replies cannot confirm a command. Negative responses are failed. Missing responses time out with an unknown result.
- Read API shows the last matching successful tracker result only for the current assignment, connection and profile. Mobile polls pending requests every second and otherwise every ten seconds. It never changes state optimistically.

## Implementation and verification

Migration 031 adds the device profile, connection leases, dispatch/correlation fields and shared SQL snapshot function. Migration 028 remains the audit foundation. Tracker code is in src/protocols/gt06/commands.ts and src/services/relay-dispatcher.ts, with login/socket lifecycle integration in src/server.ts. API vehicle relay service/routes and admin provisioning handle the profile; client vehicle editing cannot set it. Web provides profile selection; mobile displays confirmed results.

Isolated tests exercise CRC/frame lengths, the manufacturer's reply fixture, two-device routing, exact response matching, negative results, safety checks, revoked permissions, reassignment, connection replacement, deadlines, no replay, API authorization/idempotency and mobile controls. They use in-memory PostgreSQL fixtures and simulated sockets, without sending commands to fleet hardware.

Client-reported password candidates are configured privately as PDF_CLIENT_PASS and V18_CLIENT_PASS (same candidate, explicit false/true language-field formats). They are not proven to work until a successful tracker reply; passwords are never printed by default. The phone test selects only one candidate at a time. No real command was sent by the agent when changing these action-specific rules.
