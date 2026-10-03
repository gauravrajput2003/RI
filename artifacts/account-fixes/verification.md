# Account password recovery

Migration: `015_account_password_recovery.sql` adds encrypted recovery storage and a password-access audit table. Run the normal API migration command before deploying this version.

Set `ACCOUNT_PASSWORD_ENCRYPTION_KEY` to an independent 32-byte key, represented by 64 hexadecimal characters. Generate it using the command in `.env.example`. Keep the key outside source control and preserve it across restarts and deployments; changing or losing it makes earlier encrypted credentials unreadable. The local development `.env` has been configured and the migration applied.

Authentication continues to use bcrypt hashes. Newly created/reset admin and client passwords also have an AES-256-GCM encrypted recovery copy. An existing admin/client login captures a recovery copy only after validating the password and only if the stored hash still matches. Super-admin passwords are never captured for recovery.

`POST /api/v1/users/:id/password-recovery` requires an authenticated active super-admin, their current `superAdminPassword`, and `action: REVEAL | RESET` (default REVEAL). It accepts only admin/client targets within the super-admin's scope. Successful access is audited without recording plaintext. Responses use `Cache-Control: no-store`; confirmation requests are rate limited. Ordinary account list/detail/create/edit responses contain no hashes, ciphertext, or plaintext passwords. The web UI keeps revealed credentials only in the active preview and clears them on closing; password columns provide a confirmation action rather than returning secrets in list responses.

Older hash-only passwords cannot be decrypted. REVEAL returns `password: null` for those accounts. Their next successful login captures the password, or the super-admin can confirm again to generate a replacement. RESET revokes existing refresh tokens and returns the replacement for copying. If encryption is unconfigured, recovery storage is unavailable; account authentication still works.

Vehicle inventory now includes admin-owned records without reparenting them. Existing admin-owned vehicles can retain their owner and be edited without provisioning a GPS device. Dashboard and inventory share NEW/INACTIVE definitions and respect assignment timestamps when classifying device states.

Verification: 111 API tests, 93 web tests, API/web TypeScript checks, and the production web build passed. Production SQL against the local database returned five identical vehicle IDs for dashboard and inventory. Browser checks used synthetic accounts for password confirmation, clipboard copying, optional edit password, full profile name wrapping, compact red status labels, and legacy vehicle editing.

Additional focused verification: closing a password confirmation while its API request is pending cannot reopen the preview or display a late credential. All eight recovery-panel tests and the final TypeScript check/build passed.
