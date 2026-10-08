# Web → mobile announcement delivery

Verified on 7 October 2026. Announcement content stays in the existing `announcements` table, with the existing `announcement_recipients` mapping. No announcement copying, separate mobile content store, hardcoded recipient IDs, or demo notices were introduced.

## Changes

- Added authenticated `GET /api/v1/announcements/my`. The server derives the recipient from the authenticated database account, checks the creator's current ancestor scope, explicit recipient mapping, active status, schedule and archive status. Existing legacy all-client records retain their original scoped behavior; new targeted records require explicit recipient mappings.
- Added per-recipient read state and unread count. Migration `020_announcement_reads.sql` stores only read receipts and was applied locally. Existing content and recipient records were preserved.
- Added recipient-only `POST /announcements/:id/read` and `/announcements/:id/hide-popup`. These reject another user's announcement and cannot grant management access.
- Kept the existing web creation, update, management and recipient validation contract. An Admin can target its own Clients and permitted descendant Admins/Clients; unrelated branches are rejected. Ancestor access never substitutes for explicit receipt.
- Added mobile `announcement-center` with search, refresh, detail popup, text/image support and clear empty/error states. Both Client and Admin dashboard headers expose the recipient inbox. Client announcement creation/editing remains hidden and forbidden.
- Added the red popup and Don't Show Again checkbox. Read/dismiss state is stored on the server per recipient. Dismissed notices remain readable in the inbox during their active schedule. Editing a notice makes the updated version unread again.
- Added refetch on app focus/reconnect through the existing query runtime, screen focus, dashboard pull-to-refresh and a 15-second active-app interval. No logout, reinstall or storage clearing is required for new records. No global announcement broadcast was added.

## Live evidence

The user's actual web-created notice **“test” / “new gps added”**, created by Super Admin for Client **vishal**, was traced through PostgreSQL and its explicit recipient mapping. Its schedule was 7 October 2026 19:16 to 8 October 2026 19:16 IST. The recipient query returned the existing record; the expired older notice was excluded.

After the user signed into the current mobile web preview, the dashboard icon opened Announcement Center, which displayed that title/body. Opening its detail showed the red popup. PostgreSQL then confirmed a persisted read receipt for the same announcement ID and recipient. No live announcement was recreated or copied, and the live notice was not opted out during the check.

## Verification

- 14 announcement/alert integration tests passed, including real password login to persisted users and the same web POST API used by the UI. Cases cover Super Admin → Client, Super Admin → Admin, Admin → Client, Admin → child Admins B/C/D, sibling exclusion, no implicit parent receipt, forged recipient parameters, unauthorized read/dismiss, active/future/expired/archived filtering and receipt isolation.
- 62 existing permission integration tests passed. An additional recipient test proves revoked management grants do not prevent reading an explicitly received notice, while management remains forbidden.
- Full existing mobile suite: 92 tests passed. Three additional popup/inbox tests passed after correcting the QueryClient test boundary to match its stable production identity. Total mobile tests verified: 95.
- Mobile and API TypeScript checks passed. ESLint passed for the mobile app and changed API files; the additional mobile test file also passed. `git diff --check` passed.
- Android, iOS and web development bundles exported successfully.
- Live Client preview verified at 360px width; screenshots saved in the task visualization directory as `mobile-announcement-center.png` and `mobile-web-announcement-popup.png`.

Physical-phone rendering was not controlled by this verification; the actual API/database and mobile web flow were verified, and native bundles passed. Other environments must apply migration 020. No commit or push was made.
