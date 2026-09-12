# Development

Required environment variables: `DATABASE_URL`, `JWT_SECRET`, and `JWT_REFRESH_SECRET`; optional variables are in `.env.example`. PostgreSQL starts through Docker Compose and migrations run through `pnpm migrate`.

Set `NODE_ENV=development` for pretty Pino logs. The tracker TCP port defaults to `5001`; socket timeout and movement threshold are configurable. Do not expose the tracker port as a REST endpoint.
