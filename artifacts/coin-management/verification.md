# Coin management verification — 4 October 2026

Implemented in Reports → Coin Distribution; monthly issuance also appears on the super-admin dashboard.

- Migration 016 applied locally. Existing positive ADMIN/CLIENT users.coins carried into batches valid for one year from migration. No sales invented and no historical transactions rewritten.
- Migration 013 enforces exactly one root super-admin and rooted ownership. Existing coinDistribution query remains unchanged and its two independent scope joins expose every platform transaction to that root.
- Sales, transaction audit, FIFO deduction, receiving batch and cached balances commit or roll back together. Global issuance row and live batches are locked during mutations; settings changes share the same lock order.
- Root grants have no balance requirement. Cap disabled by default; optional cap counts gross DISTRIBUTED issuance in the current Asia/Kolkata calendar month.
- Admin/client spendable balances are read from non-expired batches. User coins is a compatibility cache; account-summary, admin list/details and coin-flow read live batch sums.
- Tests: 117 API tests passed, 99 web tests passed; API and web TypeScript passed; Vite production build passed.
- Acceptance coverage: root repeated grants; sales/grant/batch consistency; cross-tree audit; foreign/self/client authorization; FIFO across two live batches; expired admin/client batches; insufficient-balance rollback; hard cap across sale, grant, Add Admin and Edit Admin.
- Browser QA used an isolated synthetic API, never recorded a real payment. Desktop and phone screenshots are in this directory. Phone viewport requested 390×844; measured document width and scroll width both 380 CSS px with inputs inside the viewport.
- Existing permanent coin_transactions audit retained. No payment gateway or monthly refill job added.
