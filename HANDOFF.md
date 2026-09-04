# HANDOFF — Unique SPM Email Outreach Platform

Written for a fresh Claude session with zero prior context. Read this fully before touching code.

**Repo:** https://github.com/vansh-s19/Mail_Automation (main branch, all work committed and pushed — nothing sits uncommitted)
**Client:** Unique SPM (uniquespm.com) — a Special Purpose Machines manufacturer. This tool is their internal B2B cold-outreach system: they scrape leads (mostly automotive/defence-sector manufacturing contacts — Tata Motors, Maruti, Adani Defence, etc.) into a Google Sheet, and this app turns that into managed, timezone-aware, sequenced email campaigns with human approval before anything sends.
**Original spec:** `Email-Outreach-Platform-SIMPLIFIED-v2.md` in the repo root — the founding design doc. Treat it as background/intent, not as literally up to date; several details evolved during the build (see "Deviations from the original spec" below). This HANDOFF.md is the current source of truth.

## 1. Big picture: what this actually is

Single-client (not multi-tenant) internal tool. One login, maybe two. Not deployed anywhere yet — everything so far has been built and verified by running local dev servers during Claude sessions and testing live against a real Railway-hosted Postgres/Redis. There is no production deployment, no CI, no automated tests (see caveats).

**Timeline pressure:** the user originally wanted this in 4–5 days. We're well past pure scaffolding into real feature-building now (contacts sync, templates, campaigns, daily review, unsubscribe are all done and tested). What remains is genuinely the hard, higher-risk part: AWS SES integration and the actual send-dispatch worker.

## 2. Architecture

Monorepo, npm workspaces (not pnpm/turborepo — deliberately simple).

```
apps/
  api/        Express + TypeScript API (port 4000)
  frontend/   React + Vite + TypeScript + Tailwind (port 5173)
  worker/     DOES NOT EXIST YET — see caveats. root package.json has a
              stale "dev:worker" script referencing it; ignore/fix later.
packages/
  db/         Prisma client singleton, re-exports @prisma/client
  config/     Zod-validated env loading (see packages/config/src/index.ts
              for the full list of env vars and their defaults)
  shared/     Cross-cutting utils: timezone resolution (city-timezones),
              merge-tag rendering, phone normalization, Luxon-based
              scheduling math
prisma/
  schema.prisma   The one schema, single migration so far (20260903193725_init)
  seed.ts         Creates the login user + 2 sample templates
```

**Why this structure:** matches the original spec's "monorepo-lite" plan. API and frontend are separate deployables (API → Railway, frontend → Vercel per spec, though neither is actually deployed yet). `packages/*` are consumed directly as TypeScript source (no build step) — this works fine for `tsx`-run dev/local, but **if you ever build this for production with plain `tsc` or bundle it, verify cross-package TS resolution still works** — it was never stress-tested under a real production build, only under `tsx`.

## 3. Tech stack (as actually installed, not just as originally planned)

| Layer | Choice |
|---|---|
| Backend | Node + Express 4 + TypeScript, run via `tsx` (no separate build step in dev) |
| ORM | Prisma 5.x (deliberately not upgraded to 6/8 mid-build — stability over latest) |
| Database | PostgreSQL on Railway (public proxy URL used for local dev — see §7 caveats) |
| Queue/cache | Redis on Railway — **provisioned but nothing uses it yet**. BullMQ is planned, not installed. |
| Email send | AWS SES — **not set up yet**, in progress (see §6) |
| Contact source | Google Sheets API v4, via a **service account** (not a public API key — deliberate, so the client's real lead sheet never has to be link-shareable) |
| Frontend | React 18 + Vite + React Router v6 + Tailwind, no component library, hand-rolled everything |
| Timezone math | Luxon (`packages/shared/src/scheduling.ts`) — chosen over hand-rolled UTC offset arithmetic specifically because DST correctness matters for the client's "10 AM local time" requirement |
| Auth | Single bcrypt+JWT login, no OAuth, no RBAC — matches spec's "single client, 1-2 logins" scope |

## 4. Database schema (Prisma, `prisma/schema.prisma`)

All models, current as of this handoff:

- **Contact** — the synced lead data. `email` unique. `resolvedTimezone` (IANA string, e.g. `Asia/Kolkata`) computed once at sync time via `city-timezones` lookup on `locationRaw`. `customFields` (JSONB) holds sheet-specific metadata (`status`, `source` from the client's sheet — see §5 mapping). `isSuppressed` is the master kill-switch checked everywhere before any send-related action.
- **ContactList / ContactListMember** — defined in schema, **never actually used by any route or UI**. Leftover from the original spec's design; campaigns enroll contacts directly via `CampaignContact`, not through lists. Either wire this up later if list-based segmentation becomes a real need, or drop it — don't assume it does anything today.
- **Template** — `subject`, `bodyHtml`, `bodyText`, merge tags like `{{name}}` `{{title}}` `{{company}}` `{{location}}`. Reusable across multiple campaigns by design (no FK ties a template to one campaign).
- **Campaign** — `status` (`draft` → `active` → `paused`/`completed`/`archived`, transitions validated server-side), `sendingRules` (JSONB: `dailySendCap`, `businessHoursStart`, `businessHoursEnd`, `weekendsEnabled` — all client-configurable, nothing hardcoded).
- **SequenceStep** — ordered steps per campaign (`stepOrder`, unique per campaign), each pointing at a `Template` with `delayDays`/`delayHours`.
- **CampaignContact** — the enrollment join table. **Enrollment is always manual** (client's explicit requirement — syncing from the sheet never auto-enrolls anyone into a campaign). `currentStepId` tracks progress; `state` (`pending` etc.) tracks whether they're still active in the sequence.
- **DailySendQueue** — one row per (contact, step, date) that's "due" for review. `status`: `pending_review` → `approved`/`excluded` → (eventually) `dispatched`. This is the daily-approval-screen backing table.
- **EmailSend** — one row per actually-attempted send, unique on `(campaignContactId, sequenceStepId)` — this uniqueness is the core duplicate-send guard for the not-yet-built worker. `currentStatus`, `providerMessageId` (SES message ID), `attemptCount` are ready for the worker to use but **nothing writes to this table yet** — it's schema-ready, not wired up.
- **EmailEvent** — append-only event log per send (opens/clicks/bounces/etc.) — also schema-ready, not wired up (no tracking pixel, no SES webhook receiver yet).
- **SuppressionList** — `email` unique, `reason` (e.g. `"unsubscribed"`, would also hold `"bounced"`/`"complained"` once the worker exists). This is the single source of truth for "never email this person again" — checked at sync time, campaign-enrollment time, and daily-queue-build time.
- **User** — just email + bcrypt hash. No roles.

## 5. Google Sheet → Contact field mapping

The client's real sheet columns (verified against actual data, not assumed): `COMPANY | PERSON NAME | PROFILE | CONTACT | MAIL | LOCATION | STATUS | SOURCE`. Full mapping table lives in `docs/sheet-mapping.md` — read it before touching sync logic. Key points:
- `PROFILE` → `Contact.title` (this was **not** in the original spec's assumed schema — added because it's clearly real data the client uses)
- `STATUS`/`SOURCE` → `customFields` JSON, not real columns (they're lead-gen metadata, not campaign state)
- `CONTACT` (phone) needs normalization — Excel/Sheets stores long numbers in scientific notation (e.g. `7.760968855E9`), handled in `packages/shared/src/normalize.ts`
- Sync is **manual only** (a "Sync from Sheet" button), never polls automatically — deliberate, matches how the client actually works (batch-edits the sheet, then syncs when ready)
- Validation pipeline (spec §13.9): required email → syntax check → MX record check (with a per-domain cache + 5s timeout — see caveats about why this was rewritten) → in-batch dedup → suppression check → name-presence flag (`needs_review`) → timezone resolution

## 6. AWS SES status — IN PROGRESS, NOT DONE

This is the most important "what's left" item. Current state: **the user has not yet confirmed they've created an AWS account.** We were mid-walkthrough of step 1 (account creation) when this handoff was written. Nothing AWS-side exists yet — no SES domain verification, no IAM user, no SNS topic, no credentials in `.env`.

**The plan we agreed on** (not yet executed), in order:
1. User creates AWS account (basic/free support tier)
2. Pick a region, verify the client's actual sending domain (SPF/DKIM DNS records)
3. Add a DMARC record
4. Request SES production access (exits the 200/day sandbox — takes AWS ~24-48h to approve, so kick this off early)
5. Create a scoped IAM user (SES-only permissions), generate access keys → goes into `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_REGION`/`SES_FROM_ADDRESS` in `.env`
6. Connect SES bounce/complaint/delivery notifications to an SNS topic pointed at a webhook endpoint in the API (that webhook endpoint **does not exist yet** — needs building)

**When picking this back up:** ask the user where they left off in the AWS console before assuming step 1 is done.

## 7. The send-dispatch worker — NOT BUILT, but the design is agreed

We discussed this design in detail with the user before building anything (they explicitly asked for the plan before implementation). It has **not been implemented yet** — no BullMQ, no worker process, nothing writes to `EmailSend` today. The agreed design:

- **Rate limiting**: BullMQ worker `limiter` option set just under SES's actual per-second send rate; separately, each campaign's `dailySendCap` is a business-rule counter check, independent of SES's technical throughput limit.
- **Retries**: transient SES errors (throttling, network) → BullMQ automatic retry, exponential backoff, 3 attempts. Permanent rejections (invalid address etc.) → no retry, immediately `failed`.
- **Bounce/suppression**: arrives async via SES→SNS→webhook (not from the synchronous send call). Hard bounce → immediate permanent suppression. Soft bounce → retry once, second soft bounce → suppress + flag.
- **Duplicate-send prevention**: the `EmailSend` unique constraint on `(campaignContactId, sequenceStepId)` is the hard guarantee. BullMQ jobs get a deterministic `jobId` (`send:<emailSendId>`) so re-queuing the same job is a no-op.
- **Resume after downtime**: job state lives in Redis, not worker memory — a crashed worker's stalled jobs get reclaimed automatically by BullMQ on restart. Processor checks `EmailSend.currentStatus` is still `queued` before actually calling SES, to close the crash-mid-send gap.
- **Job structure**: one job per (contact, step), created **only when a Daily Review row is approved** (not at daily-queue-build time), `delay` computed from that row's `scheduledLocalSendTime`. No special "follow-up" job type — a follow-up is just the next sequence step, which becomes eligible naturally once the prior step's `EmailSend.scheduledFor` exists for the due-date calculation to key off (`buildDailyQueue` in `apps/api/src/services/dailyQueue.ts` already looks up the most recent `EmailSend` for a contact to compute the next step's due date — this part of the plumbing already exists and is tested, just has nothing to consume it yet).

This is genuinely the next major build task once AWS SES is live.

## 8. Completed features (verified live against real data, not just typechecked)

Every feature below was tested by actually running the dev servers and exercising it — through curl for API-level checks, and through the real browser pane for UI flows — not just "it compiles." Where a bug was found during that testing, it's called out because the fix is part of why the current code looks the way it does.

### Auth
Single bcrypt+JWT login (`POST /auth/login`, rate-limited). Seed script (`npm run prisma:seed`) creates the user from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars.

### Contacts + Google Sheets sync
- `GET /contacts`, `PATCH /contacts/:id`, `POST /contacts/sync-sheet`
- Frontend: search (name/title/company/email), status filter (active/suppressed), "last synced X ago" (client-side, localStorage — see caveats), sync report chips (new/updated/skipped/invalid/needs-review)
- **Performance bug found and fixed**: initial sync implementation did 2 sequential DB round-trips + an uncached DNS lookup *per row* — 119 rows took 93.77s over Railway's public Postgres proxy. Rewrote to bulk-fetch existing contacts + suppression status (2 queries total) and cache MX lookups per-domain within a sync run. Now 7.68s for the same 119 rows. If sync ever feels slow again, this is the pattern to check first.

### Templates
Full CRUD (`GET/POST/PATCH/DELETE /templates`), Add/Edit modal with merge-tag quick-insert buttons. Delete is blocked (409) if a template is referenced by any campaign's sequence step. Seeded with 2 starter templates (Intro, Follow-up 1) since the client had no fixed copy — explicitly wants full add/edit control, not fixed templates.

### Campaigns + sequence builder
- `GET/POST/PATCH /campaigns`, `POST /campaigns/:id/{launch,pause,resume,archive}` (status transitions validated — invalid ones return 409), `POST /campaigns/:id/duplicate` (copies steps + sending rules, resets to draft, does **not** copy enrolled contacts)
- Sequence steps: `POST /campaigns/:id/steps`, `PATCH/DELETE /campaigns/steps/:stepId`, `POST /campaigns/:id/steps/reorder`
- Contact enrollment: `POST/DELETE /campaigns/:id/contacts` — **always manual**, never automatic from sync
- **Real bug found and fixed**: reordering steps crashed with a Postgres unique-constraint violation on `(campaign_id, step_order)` — swapping two steps' order tried to write a duplicate value mid-transaction. Fixed with a two-phase update (temp negative values, then final indexes) in `apps/api/src/routes/campaigns.ts`.
- **More serious bug found and fixed**: that crash didn't just fail one request — it **crashed the entire API process**, because Express 4 doesn't catch rejected promises from async route handlers. This is why every route handler across the whole API is now wrapped in `asyncHandler` (`apps/api/src/middleware/asyncHandler.ts`) with a global error middleware in `index.ts`. If you add a new route, **wrap it in `asyncHandler`** or you're reintroducing this exact class of bug.

### Daily Review (the approval screen)
`POST /daily-queue/build` (idempotent — re-running for the same date only adds genuinely new rows), `GET /daily-queue`, `POST /daily-queue/bulk-action` (approve/exclude). Frontend: date picker, "Refresh Due List", select-all + individual checkboxes, bulk approve/exclude, shows each row's actual computed local send time.

**Timezone math verified for real**, not just trusted: tested with 4 contacts across `Asia/Kolkata`, `Asia/Dubai`, `Europe/Malta`, `Europe/Budapest` simultaneously — all four independently resolved to their own correct 10:00 AM local instant despite different UTC offsets, using Luxon (`packages/shared/src/scheduling.ts::localTimeToUtc`).

### Unsubscribe
- Every rendered email gets an HTML+plaintext unsubscribe footer (`apps/api/src/services/emailRender.ts`), built from a stateless HMAC-signed token (`unsubscribeToken.ts`) — deliberately not a JWT, since this link must never expire.
- `GET /unsubscribe?token=...` — public, no auth, updates both `Contact.isSuppressed` and `SuppressionList` in one transaction, shows a plain confirmation page.
- `GET /templates/:id/preview/:contactId` — lets you see (and click) a real rendered email including its real unsubscribe link, useful right now since there's no actual sending yet.
- Suppressed contacts are excluded at three separate points, all verified live: daily-queue generation (pre-existing), campaign enrollment (both API-level 409-style skip and UI-level hiding — this was the one real gap found and closed), and sheet re-sync (the `suppressed || existing.isSuppressed` OR-logic was already correct, verified rather than rebuilt).

### Frontend design/branding
Rebranded from a generic placeholder to the client's real identity: pulled actual navy (`#111B55`-ish) + orange (`#FF8214`) colors and logo (`uniquespm.com/img/logo.png`) from their live site rather than guessing. Logo is white-on-transparent, rendered on a navy backdrop chip since the app's background is light. Inter font, custom icon set (hand-written SVGs, no icon library dependency).

## 9. Design decisions worth knowing the "why" on

- **Service account over API key for Sheets**: avoids making the client's real lead sheet (names/emails/phones of real people) link-shareable.
- **`ContactList`/`ContactListMember` unused**: schema kept from original spec, but campaigns enroll contacts directly. Don't assume list-based UI features work — they don't exist.
- **Manual sync, manual enrollment**: both deliberate per client's explicit answers, not oversights. Don't "fix" these into automatic behavior.
- **Multi-campaign support built, UI kept simple**: client wasn't sure if they'd run simultaneous campaigns; schema supports it (a contact can be in 2+ campaigns at once — no guard against this today, by design/default, not yet contradicted by the client), but the UI is a plain list + single detail page, not a complex multi-campaign dashboard.
- **`asyncHandler` on every route**: not optional style — it's the fix for a real crash class. New routes need it.
- **Luxon added specifically for scheduling math**: correctness here has real client-facing stakes ("10 AM their time"), hand-rolled UTC offset math was rejected as a foot-gun (DST).
- **"Sent Inbox" clarified with the client**: it will be a list view over `EmailSend` (recipient/subject/campaign/status), not a raw mailbox — confirmed with the client, not yet built.

## 10. Known caveats / things that will bite you

- **`DATABASE_URL` in `.env` is Railway's *public proxy* URL**, not the internal one — required for local dev (this machine isn't on Railway's private network) but should switch to the internal URL once the API is actually deployed on Railway itself. Also: **Postgres "Public Access" is toggled ON** on Railway right now for local dev to work — revisit whether to turn it back off once deployed.
- **No deployment exists.** Everything verified so far was via local `npm run dev` processes started fresh each session, both API (`localhost:4000`) and frontend (`localhost:5173`). They do not persist between sessions — if you're picking this up cold, you'll need to start them yourself (`npm run dev:api` from repo root, `npm run dev --workspace=apps/frontend`).
- **`dev:worker` script in root `package.json` references a nonexistent `apps/worker`** — leftover from planning, will error if run. Either scaffold that app when building the send worker, or update the script.
- **No automated tests.** All verification in this project has been manual: curl scripts against a live local server + real database, and browser-driven UI checks. There is no test suite to run and no CI.
- **"Last synced" timestamp is per-browser (localStorage)**, not server-tracked — if the client syncs from a different browser/device, this won't reflect it. Low-stakes, known tradeoff.
- **A stray test contact exists in the dev database**: "Vansh Saxena / PREFLIGHT AI" — added intentionally by the user for testing, not real client data. Don't be confused by it; don't delete it without checking with the user first (it might still be in use for testing).
- **npm audit shows one critical advisory** in `node-tar` (via `bcrypt`'s native build tooling, `@mapbox/node-pre-gyp`) — only exploitable during `npm install`, not at runtime. Left alone deliberately; revisit if it becomes blocking.
- **Prisma is pinned at 5.x** despite an available 6/8 major upgrade prompt — deliberate, avoid upgrading mid-build without a reason.
- **`EmailSend`/`EmailEvent` tables are schema-only** — nothing writes to them yet. Don't assume any "sent" data exists anywhere in the system.
- **No tracking pixel, no click-redirect, no SES webhook receiver** — all planned (spec §8) but not started.
- **IMAP reply-detection**: per the client, replies land in the same mailbox that sends (no separate reply-to inbox) — simplifies the planned IMAP polling design, but that polling is not built yet.

## 11. Development conventions established in this codebase

- **Verify live, not just typecheck.** Every feature in this project was tested by actually running it against the real Railway database (or, for frontend, the real browser pane) before being called done. `npm run build --workspace=apps/api` (this is a `tsc --noEmit` typecheck, not a real build — see `apps/api/package.json`) is necessary but not sufficient.
- **Wrap async route handlers in `asyncHandler`.** Non-negotiable, see §8.
- **Zod for all request validation**, `safeParse` + `.flatten().fieldErrors` for error responses.
- **Comments explain *why*, not *what*.** The codebase has almost no comments; the ones that exist mark non-obvious constraints (e.g. the two-phase reorder update, the zsh `echo` gotcha encountered during testing, the HMAC-not-JWT choice for unsubscribe tokens). Follow that pattern — don't add narrative comments describing what the next line obviously does.
- **No unnecessary abstraction.** Small route files, direct Prisma calls, no repository/service-layer ceremony beyond what's genuinely reused (e.g. `sheetsSync.ts`, `dailyQueue.ts`, `emailRender.ts` are real services because multiple things call them or the logic is genuinely complex; most routes just call Prisma directly).
- **Real data over synthetic test data wherever possible.** Testing has consistently used the client's actual (test-copy) Google Sheet and real contact records rather than fabricated fixtures — catches real-world issues like the scientific-notation phone numbers and the sync performance bug.
- **Git commits are detailed and explain the *why*/what-was-tested**, not just what changed — read recent commit messages (`git log`) for context on specific decisions; they're more detailed than this document in places.
- **Never commit secrets.** `.env` is gitignored; `.env.example` documents every variable with no real values. A real credential leak happened once early in this project (a Railway connection string got committed to `.env.example` by mistake) and was cleaned up — be paranoid about this.

## 12. Suggested next steps, in order

1. Confirm with the user where AWS SES setup actually stands (don't assume; ask).
2. Finish AWS SES setup (domain verification takes real wall-clock time — kick off DNS records early even if the worker isn't built yet).
3. Scaffold `apps/worker`, add BullMQ, implement the send-dispatch design from §7.
4. Build the SES webhook receiver (bounce/complaint/delivery → updates `EmailSend`/`EmailEvent`/`SuppressionList`).
5. Tracking pixel + click-redirect for opens/clicks.
6. IMAP polling for reply detection (same mailbox as sending, per client).
7. The "Sent" list view (`GET /email-sends` or similar) once there's real data to show.
8. Analytics page (currently a placeholder).
9. Actual deployment: API → Railway, frontend → Vercel, switch `DATABASE_URL` to Railway's internal URL, reconsider Postgres public access.

## Update (2026-09-04): deployment is live, auto-deploy on `main`

Everything above this line was written before deployment happened - keeping it
as-is for history. Current state: `apps/api` and `apps/worker` run on Railway
(internal Postgres/Redis, not the public dev proxy), frontend on Vercel. All
three are connected to GitHub and auto-deploy on push/merge to `main` - no
more manual `railway up`/`vercel --prod` for normal changes. AWS SES domain
verification/production access status: check with the user, don't assume.
