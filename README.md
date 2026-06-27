# Loaded Logistics — Phase 1: Shared Backend + Standalone Board

This is the live, multi-user version of your dispatch board. It has two deployable pieces:

- **`backend/`** — the API + Postgres-backed data store (Express + TypeScript). Holds loads and team chat, seeds your 215 historical loads, and proxies AI (Rate Cons extraction + Copilot) so your Anthropic key stays server-side.
- **`board/`** — your dispatch board, now a standalone Vite + React site that talks to the backend. Password-gated, polls every 10 seconds, deploys to its own Railway URL.

Everything you already had — Board, Loads, Drivers, Weekly P&L, Lane Book, Rate Cons, Team, Copilot — is intact. Only the plumbing changed: data now lives in Postgres instead of the browser, so the whole team shares one live board.

Team password: **`loaded`** (change anytime via the `BOARD_PASSWORD` env var).

---

## What you'll set up (≈30–40 min, no coding)

1. A **Neon** Postgres database (free).
2. The **backend** on Railway → run the migration to seed your loads.
3. The **board** on Railway, pointed at the backend.

You'll need: a [Neon](https://neon.tech) account, a [Railway](https://railway.app) account, and your Anthropic API key (optional — the board runs without it; only the AI buttons need it).

---

## Step 1 — Create the database (Neon)

1. Sign in to Neon → **New Project** → name it `loaded-logistics`. Pick the region closest to you (US East is fine for NC).
2. After it creates, open **Connection Details** and copy the **connection string**. It looks like:
   ```
   postgresql://USER:PASSWORD@ep-xxxx-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
3. Keep that handy — it's your `DATABASE_URL`.

---

## Step 2 — Deploy the backend (Railway)

1. Push this repo to GitHub (or use Railway's "Deploy from local"). In Railway: **New Project → Deploy from GitHub repo**, and pick this repo.
2. When it asks for the service root / it deploys the whole repo: set the **Root Directory** to `backend`.
3. Open the service → **Variables** and add:
   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the Neon string from Step 1 |
   | `BOARD_PASSWORD` | `loaded` |
   | `AUTH_SECRET` | any long random string (mash the keyboard) |
   | `ANTHROPIC_API_KEY` | your Anthropic key (leave blank to skip AI for now) |
4. Railway builds and starts it automatically (`npm run build` → `npm start`).
5. **Seed your loads — run once.** In the backend service, open the **Shell** (or a one-off command) and run:
   ```
   npm run migrate
   ```
   You should see `✓ schema applied` and `✓ seeded 215 historical loads`. (Safe to run again — it won't double-seed. To wipe and reseed: `npm run migrate -- --force`.)
6. Under **Settings → Networking**, click **Generate Domain**. Copy that URL — it's your API base, e.g.
   `https://loaded-logistics-backend-production.up.railway.app`.
7. Quick check: open `<that URL>/api/health` in a browser — you should see `{"ok":true}`.

---

## Step 3 — Deploy the board (Railway)

1. In the **same Railway project**: **New → GitHub repo** (same repo), and set **Root Directory** to `board`.
2. Open the board service → **Variables** and add:
   | Variable | Value |
   |---|---|
   | `VITE_API_URL` | your backend URL from Step 2 (no trailing slash) |

   > This must be set **before** the build — Vite bakes it in at build time. If you set it after, hit **Redeploy**.
3. Railway builds (`npm run build`) and serves it (`npm start`).
4. **Settings → Networking → Generate Domain.** That URL is your board — share it with your team.
5. Open it, enter the password **`loaded`**, and you're in. You should see all 215 loads, the KPI bar, and every tab.

---

## How it fits together

```
  Neon (Postgres)  ◄──────  backend (Railway)  ◄── 10s poll ──  board (Railway)
                              ▲                                    │
                              └──────────  team's browsers  ───────┘
                                   (everyone shares one board)
```

- Add a load, assign a driver, post in Team chat → it writes to Postgres and shows up for everyone within ~10 seconds.
- **Rate Cons** tab → paste a broker email → the backend asks Claude to extract it → you confirm → it's on the board.
- **Copilot** → reads the live board and answers, all through the backend (your API key never touches the browser).

---

## Running it locally (optional)

**Backend**
```
cd backend
cp .env.example .env        # fill in DATABASE_URL (Neon works locally too)
npm install
npm run migrate             # seed once
npm run dev                 # http://localhost:8080
```

**Board**
```
cd board
cp .env.example .env        # set VITE_API_URL=http://localhost:8080
npm install
npm run dev                 # http://localhost:5173
```

---

## Notes & knobs

- **Change the password:** set `BOARD_PASSWORD` on the backend and redeploy. Everyone signs in again.
- **No Anthropic key yet?** The board runs fine; the Rate Cons "Extract" and Copilot buttons will show a short notice until `ANTHROPIC_API_KEY` is set. Nothing else is affected.
- **Tailwind:** the board loads Tailwind from its CDN for styling utilities. For a fully self-hosted build later, it can be compiled in — not needed to run.
- **Security posture (Phase 1):** one shared team password over HTTPS, AI key server-side, CORS open to your board. Good for a trusted 5-person team. Phase 2 (email ingestion) is where we add per-broker mailbox auth and tighten this further.

---

## Phase 2 — built ✅ (Gmail rate-con auto-pull)

The Gmail worker is now in the backend: it watches both inboxes (read-only), parses
each rate con with the *same* extractor as the Rate Cons tab, and auto-adds the load
to the board (`source='email'`) with a 📩 note in Team chat — usually within a minute.
It's off until you connect it. **Turn it on by following [`PHASE2-SETUP.md`](PHASE2-SETUP.md)**
(~20–30 min, mostly clicking in a browser). New backend files: `src/gmail.ts`,
`src/extract.ts` (shared parser), `src/ingest.ts` (worker), `src/google-auth.ts` (token helper).

## What's next (Phase 3)

Phase 3 adds the morning freight digest into your Team tab (the `digests` table is
already waiting). The hard parts — a shared server-backed board, and hands-off rate-con
ingestion — are done.
