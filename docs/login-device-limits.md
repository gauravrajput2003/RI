# Client login device limits

Admins set Maximum login devices in Add/Edit client (1–100, default 2). The same account can use 2 or 5 installations according to this setting; this is a manually administered entitlement, not payment integration. Web browser profiles also consume a slot. Admin accounts themselves are not limited.

Mobile stores an installation identifier in token storage; web uses localStorage. Re-login on that installation reuses a session. New installations over the limit receive DEVICE_LIMIT_REACHED. Token rotation preserves the slot. Logout frees it. Slots expire after 30 days without refresh. Admins can sign out all client devices from the edit form; lowering the limit retains the most recently refreshed sessions and revokes excess sessions.

HTTP and realtime delivery validate new session IDs against current refresh sessions. Existing access tokens issued before this migration remain usable until their 15-minute expiration; refresh upgrades them to session-bound tokens. Apply migration 034 before deploying the API, then deploy the web admin and rebuild mobile. Existing refresh tokens each count as one slot until expired/revoked. Use Sign out all client devices to clear stale slots after rollout if necessary.

An installation identifier is not hardware attestation. Copied credentials/tokens and reinstallations need separate security controls. Shared credentials retain the same client permissions and vehicle visibility for everyone. Parent-only bus access requires distinct scoped accounts.

No cloud database migration or APK build is performed by this source change.
