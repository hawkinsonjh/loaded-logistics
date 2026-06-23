# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Loaded Logistics is a truckload dispatch management tool for a small carrier. It tracks freight loads through a kanban-style board (Available → Assigned → In Transit → Delivered), calculates per-mile revenue (RPM), produces weekly/monthly P&L by truck, and includes an AI-powered rate confirmation extractor and dispatch copilot.

## Monorepo layout

Three independent services, each deployed separately on Railway:

| Directory | Purpose | Stack |
|-----------|---------|-------|
| `backend/` | REST API + AI proxy | Node/Express/TypeScript, PostgreSQL (Neon) |
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
                   # (safe to re-run; skips seed if rows exist; --force to reseed)
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
| `ANTHROPIC_API_KEY` | — | Required for `/api/ai/extract` and `/api/ai/copilot` |
| `BOARD_PASSWORD` | `"loaded"` | Shared team password |
| `AUTH_SECRET` | `"change-me-in-production"` | HMAC secret for token signing |
| `PORT` | `8080` | Railway sets this automatically |

### Board
| Variable | Notes |
|----------|-------|
| `VITE_API_URL` | Backend origin (e.g. `https://loaded-api.up.railway.app`). Empty string means same origin. |

## Architecture

### Authentication

Single shared password for the whole team. `auth.ts` derives a deterministic HMAC-SHA256 token from the password so the same password always produces the same token — a logged-in browser stays logged in across backend restarts. All `/api/*` routes (except `/api/health` and `/api/login`) require `Authorization: Bearer <token>`.

### Backend API

All routes are in `backend/src/index.ts`. Column writes go through the `LOAD_COLS` allowlist array — add a column name there to allow it in `POST /api/loads` and `PATCH /api/loads/:id`. Empty string values are coerced to `null` before insertion.

The backend proxies Anthropic API calls (keeping the key server-side):
- `POST /api/ai/extract` — pastes a rate confirmation email and returns structured load fields as JSON
- `POST /api/ai/copilot` — multi-turn chat with the live board state injected as system context

### Database

PostgreSQL via Neon. Schema is in `backend/src/schema.sql` and is idempotent (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`). Run `npm run migrate` to apply it.

**Critical `db.ts` note:** `node-pg` returns `numeric` columns as strings by default. `db.ts` installs a global type parser for OID 1700 that converts them to JS `float`. This means `rate`, `rpm`, `pay`, `fuel`, `dispatch`, and `repair` arrive as numbers on both backend and frontend — arithmetic on them is safe.

### Board frontend

Single `App.tsx` file (~1000 lines). All state lives in the root `App` component (`loads` array). Child components are pure display/interaction — they receive `loads` as a prop and call back via `patchLoad`/`removeLoad`/`addLoad`.

**Optimistic updates:** `patchLoad` immediately updates local state, then confirms with the API. On API failure it re-fetches. The board auto-refreshes every 10 seconds.

Load status lifecycle: `Available → Assigned → In Transit → Delivered`. Assigning a driver advances status to `Assigned`; backing to `Available` clears the driver.

**RPM color thresholds** (used consistently across all views):
- `< $1.80` → red (thin)
- `$1.80–$2.49` → amber (ok)
- `≥ $2.50` → green (strong)

`computeRpm(load)` uses `load.rpm` if present, otherwise derives it as `rate / miles`.

`netOf(load)` = `rate − pay − fuel − dispatch − repair`.

### Design tokens

All colors, font stacks, and spacing live in the `C` object and `mono`/`sans` constants at the top of `App.tsx`. Do not introduce CSS files or utility classes — all styling is inline via the `style` prop.

The app uses Tailwind utility classes sparingly for layout only (`flex`, `grid-cols-*`, `hidden md:grid`, etc.) — Tailwind CDN is loaded in `board/index.html`.

## Data model key fields

The `loads` table is the core of the application. Important fields:

- `rpm` — stored when provided; otherwise computed client-side as `rate / miles`
- `source` — `'manual'` or `'email'` (email parsing is Phase 2, not yet implemented)
- `status` — constrained by the app to `Available | Assigned | In Transit | Delivered`
- `unit` — truck unit number (e.g. "101"), used to group P&L in Weekly/Monthly views
- `dh` — deadhead miles

## Planned but not implemented

The schema has `emails` and `digests` tables stubbed out. The Rate Cons tab currently only does paste-to-extract; Phase 2 is meant to wire live Gmail inboxes so rate confirmations land automatically. The same Claude extractor call will be reused.
