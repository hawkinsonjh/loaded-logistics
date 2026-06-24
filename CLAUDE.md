# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Loaded Logistics is a truckload dispatch management tool for a small carrier. It tracks freight loads through a kanban-style board (Available → Assigned → In Transit → Delivered), calculates per-mile revenue (RPM), produces weekly/monthly P&L by truck, and includes an AI-powered rate confirmation extractor, a dispatch copilot, and two autonomous AI agents (analyst + executor).

## Monorepo layout

Three independent services, each deployed separately on Railway:

| Directory | Purpose | Stack |
|-----------|---------|-------|
| `backend/` | REST API + AI proxy + agents | Node/Express/TypeScript, PostgreSQL (Neon) |
| `board/` | Dispatch web app (SPA) | React 18, Vite, TypeScript |
| `website/` | Static marketing site | Express serving `public/` |

There is no shared package or workspace root — each directory has its own `package.json` and must be `cd`'d into before running commands.

## Commands

### Backend (`backend/`)
```bash
npm run dev        # tsx watch — hot-reloads on file change
npm run build      # tsc compile to dist/
npm run start      # run compiled dist/index.js
npm run migrate    # apply schema.sql + seed historical loads from seed-data.json
                   # safe to re-run; skips seed if rows exist; --force to reseed
```

### Board (`board/`)
```bash
npm run dev        # Vite dev server on port 5173
npm run build      # production Vite build to dist/
npm run preview    # serve the built dist/ (Railway uses this in production)
```

### Website (`website/`)
```bash
npm start          # serve public/ on PORT (no build step)
```

There are **no tests** in any package.

## Required environment variables

### Backend
| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_URL` | — | Neon Postgres connection string; SSL auto-configured |
| `ANTHROPIC_API_KEY` | — | Required for all `/api/ai/*` routes |
| `BOARD_PASSWORD` | `"loaded"` | Shared team password |
| `AUTH_SECRET` | `"change-me-in-production"` | HMAC secret for token signing |
| `PORT` | `8080` | Railway sets this automatically |

### Board
| Variable | Notes |
|----------|-------|
| `VITE_API_URL` | Backend origin (e.g. `https://loaded-api.up.railway.app`). Empty string means same origin. |

## Backend architecture

### `index.ts` — all routes

Single file, all routes. Structure:

```
GET  /api/health                   — no auth required
POST /api/login                    — returns deterministic token for the shared password
GET  /api/loads                    — full load list, ordered by created_at desc
POST /api/loads                    — insert new load
PATCH /api/loads/:id               — partial update
DELETE /api/loads/:id              — remove load
GET  /api/messages                 — team channel, last 300 msgs ordered by ts asc
POST /api/messages                 — post a message
POST /api/ai/extract               — AI rate-con extractor (returns JSON load fields)
POST /api/ai/copilot               — multi-turn AI chat with board state in system prompt
POST /api/ai/analyze               — Operations Analyst agent (read-only critique)
POST /api/ai/execute               — Workflow Executor agent (agentic tool-use loop)
```

**`LOAD_COLS` allowlist**: The `LOAD_COLS` array in `index.ts` gates which columns are writable via `POST /api/loads` and `PATCH /api/loads/:id`. To expose a new DB column to the API, add its name to that array. Empty strings are coerced to `null` before insertion.

**`callAnthropic()`**: A local helper in `index.ts` used by `/api/ai/extract` and `/api/ai/copilot`. Returns the concatenated text of all `text`-type content blocks. The agents module (`agents.ts`) has its own equivalent helper `anthropic()` that returns the full response object (needed for tool-use).

### `db.ts` — database client

`node-pg` returns `numeric` columns (OID 1700) as strings by default. `db.ts` installs a global type parser that converts them to JS floats. This affects `rate`, `rpm`, `pay`, `fuel`, `dispatch`, and `repair` — they arrive as numbers everywhere. **Do not remove this parser**: losing it causes `.toFixed()` calls in the UI to throw, which blanks the entire board.

SSL: Neon requires SSL. The pool checks whether `DATABASE_URL` contains `localhost` and skips SSL only in that case.

The exported `q(text, params?)` function is a thin wrapper around `pool.query` that returns `res.rows`.

### `auth.ts` — shared-password auth

`tokenForPassword(pw)` derives a deterministic HMAC-SHA256 hex string from the password. The same password always produces the same token, so a logged-in browser stays logged in across backend restarts. `requireAuth` middleware checks the `Authorization: Bearer <token>` header.

### `agents.ts` — AI agent implementations

Two agents:

#### Operations Analyst (`runAnalyst()`)
- Queries all loads from the DB
- Computes `fleetMetrics()`: total revenue, net margin, avg RPM, loads by status, thin-margin active loads, which drivers are active vs idle
- Sends metrics + active load detail to Claude with a system prompt asking for a JSON critique
- Returns `{ summary: string, flags: string[], opportunities: string[] }` — **read-only, no DB writes**

#### Workflow Executor (`runExecutor(goal)`)
- Runs an **agentic tool-use loop** (up to 8 iterations) using Claude's native tool-use API
- Tools available: `list_loads`, `patch_load`, `post_message`, `get_driver_stats`, `finish`
- `list_loads` and `get_driver_stats` query the DB fresh on each call (executor always sees current state even after patching)
- `patch_load` uses a `SAFE_PATCH_COLS` allowlist (same principle as `LOAD_COLS` in index.ts) and hits the DB directly — **changes are real and immediate**
- Loop ends when the agent calls `finish()` or reaches 8 iterations
- Returns `{ actions: Action[], summary: string, trace: TraceEntry[] }` where `trace` is the full tool call log for UI display

**Tool-use loop mechanics**: Each iteration calls `anthropic()` with the accumulated `messages` array plus the `tools` definition. If the response has `tool_use` content blocks, each tool is executed via `runTool()` and the results are appended as a `tool_result` message before the next iteration. The loop breaks when `stop_reason === "end_turn"` or `finish` is called.

### `seed.ts` — migration + seeding

Run via `npm run migrate`. Reads and executes `schema.sql` (idempotent), then seeds from `seed-data.json` unless the `loads` table already has rows. `--force` clears existing `source='manual'` rows and re-seeds.

## Frontend architecture

### `api.ts` — HTTP client

All API calls go through the `req()` helper which auto-handles 401 (calls `logout()` and throws). Token is stored in `localStorage` under key `ll_token`. `parseJSON()` strips code fences and finds the first `{...}` block — used to parse Claude's extract response which may include markdown wrapping.

All exported functions: `login`, `getLoads`, `createLoad`, `patchLoad`, `deleteLoad`, `getMessages`, `postMessage`, `extractLoad`, `copilotReply`, `runAnalysis`, `runExecutorWorkflow`.

### `App.tsx` — single-file SPA (~1200 lines)

**State**: All load state lives in the root `App` component. Children receive `loads` as a prop and call back via `patchLoad` / `removeLoad` / `addLoad`. No external state library.

**Auto-refresh**: `setInterval(refresh, 10000)` polls the backend every 10 seconds. `patchLoad` uses optimistic updates: immediately mutates local state, then confirms with the API. On failure it calls `refresh()` to reconcile.

**NAV tabs and their components**:
| Tab key | Component | Purpose |
|---------|-----------|---------|
| `board` | `Board` | Kanban columns (Available/Assigned/In Transit/Delivered), assign/advance/back/delete actions |
| `loads` | `Ledger` | Sortable/filterable full load table |
| `drivers` | `Drivers` | Per-driver stats grid with current active load |
| `pnl` | `WeeklyPnL` | Weekly net-to-fleet by truck with bar chart trend |
| `monthly` | `MonthlyPnL` | Monthly P&L accordion grouped by truck |
| `lanes` | `LaneBook` | Origin→dest lanes with avg RPM; broker rate reference fallback |
| `inbox` | `Inbox` | Paste-to-extract rate confirmation via AI |
| `chat` | `Chat` | Team message channel with load tagging, polls every 10s |
| `copilot` | `Copilot` | Multi-turn AI chat with live board state injected as context |
| `agents` | `Agents` | Operations Analyst (read-only critique) + Workflow Executor (agentic tool-use) |
| `recruiting` | `Recruiting` | Candidate pipeline, social content generator, recruiting agent |

**Shared helper functions** (used across components):
- `computeRpm(l)` — uses `l.rpm` if present, otherwise `l.rate / l.miles`
- `netOf(l)` — `rate − pay − fuel − dispatch − repair`
- `rpmColor(rpm)` — returns `C.red / C.amber / C.green` at `<1.80 / 1.80–2.49 / ≥2.50`
- `rpmLabel(rpm)` — returns `"thin" / "ok" / "strong"`
- `laneColor(status)` — `amber / purple / blue / green` for the four statuses

**Design system**: All styling is inline via `style` prop. Colors live in the `C` object at the top of `App.tsx`. Font stacks are `mono` (monospace) and `sans` (system-ui). Tailwind CDN is loaded in `index.html` and used sparingly for layout (`flex`, `grid-cols-*`, `hidden md:grid`). **Do not introduce CSS files.**

**Load status lifecycle**:
```
Available → (assign driver) → Assigned → (advance) → In Transit → (advance) → Delivered
Assigned/In Transit → (back) → previous stage
Back to Available clears the driver field
```

**`DRIVER_ORDER`**: Hardcoded at the top of `App.tsx` as `["TJ","John","Chris","Jeremy","Derek"]`. The `drivers` array merges this with any driver names found in loaded loads. Affects display order in the Drivers tab and dropdown order in load cards.

## Data model key fields

The `loads` table is the core. Important fields:

| Field | Notes |
|-------|-------|
| `rpm` | Stored when provided; otherwise computed client-side as `rate / miles` |
| `source` | `'manual'` or `'email'`; Phase 2 email parsing not yet implemented |
| `status` | `Available \| Assigned \| In Transit \| Delivered` |
| `unit` | Truck unit number (e.g. `"101"`), used to group P&L in weekly/monthly views |
| `dh` | Deadhead miles |
| `dispatch` | Dispatch fee (expense column) |
| `repair` | Repair cost (expense column) |

**RPM thresholds** (enforced consistently in UI coloring and AI agent system prompts):
- `< $1.80` → red / thin
- `$1.80 – $2.49` → amber / ok
- `≥ $2.50` → green / strong

## AI agents — Agents tab

The **Agents** tab in the board exposes both agents:

**Operations Analyst panel**: Click "Run analysis" → `POST /api/ai/analyze` → returns a read-only critique card showing `summary`, `flags` (red bullets), and `opportunities` (green bullets). Takes ~3–5s. No board changes.

**Workflow Executor panel**: Type a natural-language goal and click "Execute workflow" → `POST /api/ai/execute` → the agent runs a tool-use loop, then the UI shows:
- **Completed** summary box
- **Actions taken** list (each `patch_load` or `post_message` with its reason and changed fields)
- **Tool call trace** (collapsible) showing every tool invocation and its raw result
- Board auto-refreshes via `onRefresh()` when execution completes

Example goals the executor handles well:
- *"Assign all Available loads to drivers with the best matching RPM history"*
- *"Flag all thin-margin In Transit loads and post a warning to the team channel"*
- *"Post a daily summary of active loads to the team channel"*

## Database schema

Core tables:
- `loads` — main entity, all financial and routing fields
- `messages` — team channel messages, optionally tagged to a load UUID
- `emails` — Phase 2 placeholder for Gmail integration
- `digests` — Phase 2 placeholder for automated daily summaries

Schema is idempotent — `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` throughout. Safe to re-run `npm run migrate` at any time.

## Recruiting & social media — Recruiting tab

The **Recruiting** tab has three sub-sections, toggled by pills at the top:

### Candidate pipeline
Backed by the `candidates` table. Status flow: `New → Contacted → Interview → Offer → Hired | Rejected`. Each row has one-click advance buttons and a Reject button. "Add candidate" opens a modal capturing name, phone, CDL class, years of experience, source channel, and notes.

CRUD routes follow the same `CANDIDATE_COLS` allowlist pattern as loads:
```
GET    /api/candidates
POST   /api/candidates
PATCH  /api/candidates/:id
DELETE /api/candidates/:id
```

### Social content generator (`POST /api/ai/social`)
Non-agentic single-call endpoint. Backend calls `buildSocialContext()` (fetches last 100 loads, computes avg RPM, truck count, driver count, states served) and passes it to Claude with platform-specific rules and a topic-specific prompt. Returns `{ post: string, hashtags: string[] }`. The post body never contains hashtags — they are separated so the UI can display them as pills and the user can copy them independently.

Supported platforms: `Facebook | Instagram | LinkedIn | Twitter/X`  
Supported topics: `Driver Recruiting | Performance Highlight | Lane Spotlight | Company Culture | Milestone`

### Recruiting agent (`POST /api/ai/recruit`, `backend/src/recruiting.ts`)
Agentic tool-use loop (up to 8 iterations). Tools:

| Tool | Effect |
|------|--------|
| `list_candidates` | Fresh DB query, filterable by status |
| `update_candidate` | Patches candidate via `CAND_SAFE_COLS` allowlist |
| `add_candidate` | Inserts a new candidate |
| `get_fleet_needs` | Derives open seats from unit count vs active-driver count |
| `draft_outreach` | Calls Claude to write a personalised text/email/DM using candidate profile + real fleet averages |
| `finish` | Ends the loop, returns summary |

`draft_outreach` makes a nested Claude call inside the tool execution — it fetches the last 30 delivered loads to compute real avg RPM and avg driver pay, then generates a brief channel-appropriate message. The message is included in the action object so the UI can display it inline.

## Gmail integration — Email tab

The **Email** tab (`backend/src/gmail.ts`) wires Joe's Gmail inbox to the dispatch board. It cross-references broker names from the loads table with their email domains and uses past thread history to replicate Joe's exact writing style when drafting replies.

### Required env vars (backend)
| Variable | Notes |
|----------|-------|
| `GMAIL_CLIENT_ID` | Google OAuth 2.0 client ID |
| `GMAIL_CLIENT_SECRET` | Google OAuth 2.0 client secret |
| `GMAIL_REFRESH_TOKEN` | Offline refresh token obtained via OAuth consent flow |
| `GMAIL_USER_EMAIL` | Joe's Gmail address (default: `hawkinsonjh@gmail.com`) |

### `backend/src/gmail.ts`
- `getAccessToken()` — exchanges refresh token for access token; caches with 60s buffer before expiry
- `searchInbox(q, limit)` — searches Gmail threads using `labelIds=INBOX`; returns `ThreadSummary[]` (no message bodies, just metadata for the list view)
- `getThread(threadId)` — fetches full thread with decoded `text/plain` bodies; marks each message `isFromMe` based on From header matching `GMAIL_USER_EMAIL` or `loadedlogisticsnc.com`
- `createDraft(to, subject, body, inReplyTo?, references?, threadId?)` — creates a Gmail draft; encodes as `base64url` RFC 2822 message; optionally threads it
- `fetchStyleExamples(brokerEmail, limit)` — queries `in:sent to:<domain>` to get Joe's past emails to that broker; used by `/api/ai/compose` to extract style
- `BROKER_DOMAINS` — lookup table mapping broker display names to email domains (TQL, RXO, MegaCorp, Armstrong, Echo, Coyote, CH Robinson, etc.)
- `detectBroker(emailAddr)` — reverse-lookup: given an email address, returns the matching broker display name
- `buildBrokerQuery(extra?)` — builds a Gmail search string targeting all known broker domains via `from:(domain1 OR domain2 …)`

### Backend routes
```
GET  /api/gmail/inbox?q=<extra>&limit=20   — search inbox, default: all broker domains last 60d
GET  /api/gmail/thread/:id                 — full thread with decoded message bodies
POST /api/gmail/draft                      — create Gmail draft { to, subject, body, threadId?, inReplyTo? }
POST /api/ai/compose                       — AI-compose in Joe's voice { broker, brokerEmail, context, loadId? }
GET  /api/gmail/brokers                    — board brokers enriched with known email domains
```

### `/api/ai/compose` flow
1. Fetches load details from DB if `loadId` provided
2. Calls `fetchStyleExamples(brokerEmail)` — pulls up to 8 sent emails to that broker's domain
3. Injects examples into Claude's system prompt alongside Joe's hardcoded style rules
4. Generates a short, casual email (1–4 sentences) in Joe's voice
5. Returns `{ text: string }` — the draft body including Joe's signature block

Joe's signature block (always appended):
```
Joseph Hawkinson
Owner & Founder
Loaded Logistics
(704)-962-4987
www.loadedlogisticsnc.com
```

### Frontend `Email` component (App.tsx)
Three-panel layout:
- **Left sidebar** (300px): inbox thread list with broker pill tags, search field, "Compose" button
- **Main panel**: thread conversation view (bubble layout, sent=green right, received=dark left) with "Draft Reply with AI" button
- **Compose panel**: broker picker (from board), To/Subject fields, context textarea, "Draft with AI" → editable textarea → "Save to Gmail Drafts"

Broker picker is pre-populated from `loads` state — brokers on the board appear as chips. Clicking "Draft Reply with AI" on an open thread pre-fills To/Subject from the thread.

### Writing style profile (learned from Gmail)
Key broker contacts found in Joe's inbox:
- TQL: `RSalinasSolorio@tql.com` (Rudy Salinas Solorio) — most frequent
- RXO: `smbcr@rxo.com`, `Terry.Googer@rxo.com`, `alyssa.souder@rxo.com`
- MegaCorp: `teamwaugh@megacorplogistics.com`, `teamthurston@megacorplogistics.com`
- Armstrong: `tschaefer@armstrongtransport.com` (Tucker Schaefer)

Joe's style patterns:
- Confirmations: "Signed RC", "Signed RC for Jeremy C"
- Booking: "Let's go ahead and book it! Driver is [Name]"
- Rate negotiation: "Can you do $X since it's a weekend one?"
- Inquiry format: MC#, pickup/dropoff city, trip miles, ref# — from load posted on DAT
- Status: "We're in route", "On site been waiting"
- Casual: "brother", "Yessir", "boss"

## Planned but not implemented

The `emails` and `digests` tables are stubbed for Phase 2: auto-importing rate confirmations from Gmail directly into the Rate Cons tab. The existing `POST /api/ai/extract` parser is what the Phase 2 email worker will reuse.
