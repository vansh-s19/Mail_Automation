# Mail Automation

Single-client cold email outreach platform. See [Email-Outreach-Platform-SIMPLIFIED-v2.md](./Email-Outreach-Platform-SIMPLIFIED-v2.md) for full spec.

## Structure

- `apps/api` — Express API, dashboard-facing routes
- `apps/worker` — BullMQ processors, scheduler, IMAP poller
- `apps/frontend` — React dashboard
- `packages/db` — Prisma schema + client
- `packages/shared` — shared types, merge-tag renderer, timezone utils
- `packages/config` — env validation/loading

## Setup

1. Copy `.env.example` to `.env` and fill in values (DB/Redis URLs come from Railway).
2. `npm install`
3. `npm run prisma:migrate` — creates tables from `prisma/schema.prisma`
