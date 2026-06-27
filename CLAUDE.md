# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Loaded Logistics — a live, multi-user dispatch TMS for a small North Carolina truckload
carrier (~5 drivers). It replaced a single-file browser prototype with a shared,
server-backed board the whole team logs into. Two deployable pieces:

- **`backend/`** — Express + TypeScript API over Postgres. Owns loads + team chat,
  seeds 215 historical loads, and proxies Anthropic (so the API key stays server-side).
- **`board/`** — Vite + React + TypeScript SPA. Password-gated, polls the backend every
  10s, deploys as its own static site.

Project goals (from the owner): host the board at `www.loadedlogisticsnc.com`, keep the
dispatch board updating in real time for the whole team, and (Phase 2/3) ingest broker
emails to auto-create loads. Owner: hawkinsonjh@gmail.com.

## Design / frontend skills (always apply to UI work)

Per the owner, **any app/website/UI work uses the installed design skills** — invoke them at
the start of a frontend task and follow their guidance, so nothing ships looking templated:

- `impeccable` — primary toolkit for all UI incl. dashboards/product UI (design, redesign,
  critique, audit, polish, animate, layout, typography, tokens). Use for the **dispatch board**.
- `emil-design-eng` — Emil Kowalski craft/polish/animation pass (the "invisible details").
- `design-taste-frontend` — landing pages / marketing / redesigns; **not** for dashboards.

Routing: **`board/` (dashboard) → impeccable + emil-design-eng**; the **loadedlogisticsnc.com
marketing site → all three**.

## Commands

**Backend** (`cd backend`)
- `npm run dev` — local API w/ hot reload (tsx watch) on http://localhost:8080
- `npm run build` — compile TS to `dist/`
- `npm start` — run compiled server (`node dist/index.js`); used in production
- `npm run migrate` — apply `src/schema.sql` + seed loads. Idempotent: skips seeding if
  the table is non-empty. `npm run migrate -- --force` wipes manual loads and reseeds.

**Board** (`cd board`)
- `npm run dev` — Vite dev server on http://localhost:5173
- `npm run build` — production build to `dist/`
- `npm start` / `npm run preview` — serve the built site (binds Railway's `$PORT`)

There is no test suite or linter configured. Both packages are `"type": "module"`.

## Environment

Backend (`.env`): `DATABASE_URL` (Neon Postgres), `BOARD_PASSWORD` (team login, default
`loaded`), `AUTH_SECRET` (signs session tokens — set in prod), `ANTHROPIC_API_KEY`
(optional; only Rate Cons + Copilot need it). `PORT` is set by the host.

Board (`.env`): `VITE_API_URL` — backend base URL, **no trailing slash**. Vite bakes this
in at *build time*, so changing it requires a rebuild/redeploy, not just a restart.

## Architecture

```
Neon (Postgres) <- backend (Express) <- 10s poll - board (React SPA) - team browsers
```

- **Data flow is poll-based, not push.** `board/src/App.tsx` runs `setInterval(refresh, 10000)`
  to re-fetch loads; the Team tab polls messages on its own 10s timer. "Real-time" today
  means ~10s eventual consistency — there are no websockets/SSE.
- **Auth is one shared password, no users table.** `backend/src/auth.ts` derives a
  deterministic HMAC-SHA256 token from `BOARD_PASSWORD` + `AUTH_SECRET`; the same password
  always yields the same token. The board stores it in `localStorage` (`ll_token`) and
  sends `Authorization: Bearer <token>`. `requireAuth` guards every route except
  `/api/health` and `/api/login`. There are no per-user identities or roles.
- **Backend state lives in `backend/src/schema.sql`:** `loads` and `messages` are the
  core live tables. `emails` is now populated by the Phase 2 ingest worker (one row per
  message it reads, `gmail_id` unique for dedupe, `parsed_load_id` links to the created
  load, `extract_json` holds the parsed fields). `fuel_purchases` + `ifta_miles` back the
  IFTA tab. `digests` remains an unused placeholder.
- **The AI key never touches the browser.** `/api/ai/extract` (parse a broker email/rate
  con into a load) and `/api/ai/copilot` (answer over live board state) call Anthropic
  server-side, model `claude-sonnet-4-6`. Extraction now lives in `backend/src/extract.ts`
  (`extractLoad`, supports email text **and** PDF document blocks) and is shared by both
  the HTTP endpoint and the Phase 2 worker, so the paste-in parser and the inbox parser
  are identical. Copilot still uses `callAnthropic` in `index.ts`. With no key set these
  return 503 and the board shows a notice; everything else works.

- **Phase 2 — Gmail ingest (`src/gmail.ts`, `src/ingest.ts`, `src/google-auth.ts`).**
  When `GMAIL_INGEST_ENABLED=true` and Google creds are present, `startPolling()` (called
  from `index.ts` after `listen`) sweeps every mailbox in `GMAIL_ACCOUNTS` on a timer
  (`GMAIL_POLL_MS`, default 60s). `gmail.ts` hits the Gmail REST API directly with `fetch`
  (no SDK; scope `gmail.readonly`), refreshing access tokens per mailbox. Each new message
  (deduped via `emails.gmail_id`) is parsed by `extractLoad`; if `is_rate_con` and
  `confidence ≥ GMAIL_MIN_CONFIDENCE` (default 0.6), a load is inserted with
  `source='email'` + `source_email_id`, and an "Inbox" Team message is posted. Manual
  controls: `POST /api/ingest/run`, `GET /api/ingest/status`, or `npm run ingest` (one
  shot). Owner-facing setup: `PHASE2-SETUP.md`. Note: the Google OAuth app must be
  published to **Production**, or refresh tokens expire after 7 days.
- **The frontend is one big single file.** `board/src/App.tsx` holds the whole UI: a
  color-token object `C`, formatting helpers, and one component per tab. `src/api.ts` is
  the only network layer. Tabs (`NAV` array): Board, Loads, Drivers, Weekly P&L, Monthly
  P&L, **Billing**, **Settlements**, **IFTA**, Lane Book, Rate Cons, Team, Copilot. Styling
  is Tailwind via Play CDN (loaded in `index.html`) plus inline styles — no Tailwind build step.

- **Phase 2 board UI** lives in the **Rate Cons** tab: `RateCons` composes `GmailFeed`
  (live ingest status + "Check inboxes now" + a feed of recently-read emails from
  `GET /api/emails`, each addable via `POST /api/emails/:id/promote`) over the manual
  `PasteExtract` panel. The worker stores its parsed result in `emails.extract_json` so the
  feed can preview fields and promote a skipped/low-confidence email with one click.

- **Phase 3 — back-office (billing / settlements / IFTA), added to close competitor gaps.**
  All pure-data, no new infrastructure.
  - **Billing & A/R** (`Billing` tab): per-load `billing_status` (`unbilled`→`invoiced`→
    `paid`) with `invoiced_at`/`paid_at`; `detention_hours/detention_pay/lumper/accessorial`;
    paperwork flags `ratecon_received/bol_received/pod_received` + `doc_link`. Surfaces A/R
    aging, uncollected detention, avg days-to-pay, a broker pay-performance scorecard, and a
    "ready to invoice" queue. **Design choice:** accessorials roll into `billableOf(l)`
    (linehaul + extras) for invoicing, but **RPM and the P&L tabs stay linehaul-based**
    (`netOf` unchanged). Don't fold detention into RPM.
  - **Driver settlements** (`Settlements` tab): per-driver, per-week statement =
    `sum(pay) − sum(advance)`. `advance` is the only new load column; pay is set on the load.
  - **IFTA worksheet** (`IFTA` tab): a *prep* worksheet, not a filing. New tables
    `fuel_purchases` (fuel log by jurisdiction) and `ifta_miles` (per-quarter taxable miles
    by state, upserted via `PUT /api/ifta/miles`). Computes fleet MPG, taxable gallons
    (miles ÷ MPG), net gallons per state. Per-state tax rates are deliberately **not** applied.
  - The Copilot context now also carries a `billing` summary (open A/R, uncollected
    detention, overdue invoices) so it can answer "who owes me money?".
  - **Any schema change here requires `npm run migrate` on the backend + a board rebuild.**

- **Prototype surfaces (driver / owner views + broker/customer portals).** The board SPA now
  has five surfaces, switched in `board/src/main.tsx` by the first path/hash segment — no router
  lib: `/` (or anything else) → the dispatch board (`App`); `/driver` → `DriverApp`; `/track`
  (or `/#portal`) → `CustomerPortal`; `/broker` → `BrokerPortal`; `/owner` → `OwnerDash`. Each
  also resolves via its hash form (`/#driver`, …) so the surfaces work on static hosts without
  SPA fallback.
  - **`board/src/theme.ts`** is a new shared module exporting the `C` tokens, fonts, and
    pure helpers (`computeRpm`, `rpmColor`, `laneColor`, `money`, `nextLane`/`prevLane`, …).
    The new surfaces import from it; **`App.tsx` still keeps its own copies** — keep the
    values identical between the two until App.tsx is refactored to import from `theme.ts`.
  - **`DriverApp.tsx`** — phone-first. Driver signs in with the **team password** (prototype;
    production wants per-driver PINs), picks their name (persisted in `localStorage.ll_driver`),
    and works only their own loads: advance status, log detention hours, and **capture a BOL/POD
    photo** (camera-enabled file input → client-side canvas compression → upload). Status writes
    go through `PATCH /api/loads/:id` (optimistic); photo uploads go through the document routes
    below and return the updated load. Dispatch sees everything within one 10s poll.
  - **`BrokerPortal.tsx`** — authenticated, with a credential SEPARATE from the team password.
    Each broker has a deterministic 6-char access code (`brokerCode` in `auth.ts` = HMAC of the
    normalized company name); the broker signs in with company name + code
    (`POST /api/broker/login`), gets a broker-scoped token (`issueBrokerToken`, stored in
    `localStorage.ll_broker_token`, kept apart from `ll_token`), and `GET /api/broker/loads`
    (`requireBroker`) returns only that company's loads — **sanitized**: agreed rate +
    accessorials + billing/paperwork state, but **never** pay/fuel/dispatch/repair/rpm/advance.
    Dispatch reads codes from the team-only `GET /api/broker/codes` (shown in the owner
    dashboard). Prototype: one shared code per company; production wants a real broker table
    with rotatable per-contact credentials. No schema change → no migration.
  - **`CustomerPortal.tsx`** — public, no login. Tracks one shipment by `ref` via the new
    **`GET /api/track/:ref`** (the only un-`requireAuth`'d data route). That endpoint returns a
    **sanitized** record — lane, status, broker, commodity, pickup date, last-updated — and
    **never** rate/pay/fuel/margin. Refs are short, so treat this as tracking-grade privacy,
    not a secret; production should swap in a longer opaque tracking token. `api.trackLoad(ref)`
    is the (auth-header-free) client. No schema change → no migration needed for tracking.
  - **`OwnerDash.tsx`** — phone-first owner view over the **team** auth + `GET /api/loads`.
    Performance KPIs (revenue, net, avg RPM, active) respect a 7d/30d/all period; A/R (open A/R,
    uncollected detention) and the "needs attention" list (ready-to-invoice, overdue >30d,
    missing POD) are always current-state, not period-scoped. Driver + top-broker leaderboards,
    plus the broker access codes (`api.getBrokerCodes`) so the owner can hand them out. Pure
    client-side compute reusing `netOf`/`billableOf`/`ageDays` from `theme.ts`; no backend
    changes. **No icon-font dependency** — the board's `index.html` has no Tabler/icon font, so
    these surfaces use text glyphs + colored dots only (don't introduce `<i class="ti …">`).
  - **Load documents (POD/BOL photo upload).** New `documents` table (`load_id`, `kind`,
    `mime`, `bytes` bytea, `size_bytes`, …) — the image is stored **in Postgres**, no external
    bucket. `POST /api/loads/:id/docs` (`requireAuth`, base64 body; `express.json` limit raised
    to 8mb) stores the bytes, flips the matching paperwork flag (`pod_received`/`bol_received`/
    `ratecon_received`), and sets `doc_link` to an absolute `/api/docs/:id` URL so the board /
    broker portal / owner views light up automatically. `GET /api/docs/:id` is **public** (the
    UUID is the capability — same model as `/api/track`) so plain `<img>`/`<a>` work without an
    auth header; `app.set("trust proxy", true)` makes the stored URL `https` behind Railway.
    `GET /api/loads/:id/docs` lists a load's docs. **This one DOES require `npm run migrate`**
    (the `documents` table). Prototype tradeoff: images-in-Postgres is fine for ~5 drivers;
    production should move bytes to object storage and keep only the URL.

  - **Design-skills follow-up (not yet done):** the live `App.tsx` still uses banned side-stripe
    borders (`borderLeft: 3px` on `LoadCard` ~line 109 and the chat row ~line 756). The five new
    surfaces are already side-stripe-free per `impeccable`; the board itself wants the same pass.

## Domain conventions

- **Load lifecycle / lanes:** `Available -> Assigned -> In Transit -> Delivered` (the Board's
  columns; `status` column on `loads`).
- **Drivers** are free-text names, ordered `["TJ","John","Chris","Jeremy","Derek"]`.
- **RPM (rate per mile) is the core health metric:** `< 1.80` thin (red), `1.80–2.49` ok
  (amber), `2.50+` strong (green). Stored on the load when known, else computed
  `rate / miles`. These thresholds also live in the Copilot system prompt — keep them in sync.
- **Net per load** = `rate − pay − fuel − dispatch − repair` (`netOf` in App.tsx).
- `loads.source` is `'manual'` or `'email'`; `--force` reseed only clears `'manual'` rows.

## Deployment (Railway + Neon)

Backend and board deploy as **two separate Railway services from the same repo**, each
with its **Root Directory** set to `backend` or `board` respectively. Database is Neon
(SSL required; `db.ts` disables `rejectUnauthorized` for the managed cert). After the first
backend deploy, run `npm run migrate` once (or as a pre-deploy command) to seed. The board
needs `VITE_API_URL` set *before* its build. Full step-by-step lives in `README.md` and
`COMPUTER-DEPLOY-CHECKLIST.md`.

## Note on `dispatch-board.jsx`

The standalone `dispatch-board.jsx` at the repo root is the **original single-file
prototype** — the result that `board/` was built from. It embeds the seed data inline,
persists to `window.storage`/localStorage, and calls Anthropic directly from the browser.
The server-backed `board/src/App.tsx` is the source of truth and supersedes it. Don't edit
the prototype expecting it to affect the live board.
