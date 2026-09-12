# Fleet Tracking Platform

Phase 1 backend monorepo for independent GPS fleet tracking. It contains an Express REST API and a TCP tracker ingestion service, backed by PostgreSQL/PostGIS.

## Start

1. Copy `.env.example` to `.env` and replace both JWT secrets with random 32+ character values.
2. `corepack enable && pnpm install`
3. `docker compose up -d postgres`
4. `pnpm migrate`
5. Run `pnpm --filter @fleet/api dev` and `pnpm --filter @fleet/tracker dev` in separate terminals.

Run checks with `pnpm typecheck`, `pnpm lint`, and `pnpm test`.

See [development notes](docs/development.md), [architecture](docs/architecture.md), [database](docs/database.md), [protocols](docs/protocols.md), and [API](docs/api.md).
