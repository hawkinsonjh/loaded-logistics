# Loaded Logistics — Operating System Reference

Single-file consolidated snapshot of the Loaded Logistics project repository (dispatch board, backend API, marketing website, and setup docs). Generated as a master reference for Claude to load full project context in one read, instead of traversing the whole folder each time.

Source folder: `Loaded Logistics/` · Files included: 34

## Directory structure

```
├── backend/
│   ├── src/
│   │   ├── auth.ts
│   │   ├── db.ts
│   │   ├── extract.ts
│   │   ├── gmail.ts
│   │   ├── google-auth.ts
│   │   ├── index.ts
│   │   ├── ingest.ts
│   │   ├── schema.sql
│   │   └── seed.ts
│   ├── .env.example
│   ├── .gitignore
│   ├── err.txt
│   ├── package.json
│   ├── seed-data.json
│   └── tsconfig.json
├── board/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   └── main.tsx
│   ├── .env.example
│   ├── .gitignore
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── website/
│   ├── public/
│   │   ├── favicon.svg
│   │   └── index.html
│   ├── .gitignore
│   ├── package.json
│   └── server.js
├── CLAUDE.md
├── COMPUTER-DEPLOY-CHECKLIST.md
├── PHASE2-SETUP.md
├── README.md
└── dispatch-board.jsx
```

## File contents

### `CLAUDE.md`

```markdown
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
  load). `digests` is still an unused Phase 3 placeholder.
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
- **The frontend is one ~1000-line file.** `board/src/App.tsx` holds the whole UI: a
  color-token object `C`, formatting helpers, and one component per tab. `src/api.ts` is
  the only network layer. Tabs (`NAV` array): Board, Loads, Drivers, Weekly P&L, Monthly
  P&L, Lane Book, Rate Cons, Team, Copilot. Styling is Tailwind via Play CDN (loaded in
  `index.html`) plus inline styles — there is no Tailwind build step.

## Domain conventions

- **Load lifecycle / lanes:** `Available -> Assigned -> In Transit -> Delivered` (the Board's
  columns; `status` column on `loads`).
- **Drivers** are free-text names, ordered `["TJ","John","Chris","Jeremy","Derek"]`.
- **RPM (rate per mile) is the core health metric:** `< 1.80` thin (red), `1.80–
```

### `COMPUTER-DEPLOY-CHECKLIST.md`

```markdown
# Loaded Logistics — One-Page Computer Deploy Checklist

Do this on a Mac or PC. Whole thing takes ~15–20 minutes. No coding.
Have these two browser tabs open: **github.com** and **railway.app**.

---

## Before you start — grab these 2 things
- [ ] **Unzip** `loaded-logistics-phase1.zip` → you'll have a `phase1` folder containing **`backend`** and **`board`**.
- [ ] **Neon connection string** ready to paste. (Neon → your project → **Connection Details** → copy the string that starts with `postgresql://…`.) Keep it on your clipboard / in a note.

---

## PART 1 — Put the code on GitHub (~5 min)

- [ ] Delete the old broken repo: GitHub → open `loaded-logistics-` → **Settings** → scroll to bottom → **Delete this repository**.
- [ ] Make a new one: top-right **+** → **New repository**. Name it `loaded-logistics`. **Leave everything unchecked** (no README, no .gitignore, no license). Click **Create repository**.
- [ ] On the new empty repo page, click the link **"uploading an existing file"** (in the quick-setup text).
- [ ] Open your `phase1` folder on your computer. **Drag the `backend` folder AND the `board` folder** together onto the GitHub upload area. Desktop GitHub keeps the folders and subfolders intact.
- [ ] Wait for the file list to finish loading, then click **Commit changes**.
- [ ] ✅ Check: the repo now shows a **`backend`** folder. Click into it — you should see `package.json` and a `src` folder. (If you only see a README, the upload didn't take — redo the drag.)

---

## PART 2 — Deploy the backend on Railway (~7 min)

- [ ] Railway → **New Project** → **Deploy from GitHub repo** → pick `loaded-logistics`. If asked, **Configure** access so Railway can see it. Choose **Add variables** (not "Deploy Now").
- [ ] Click the **service box** → **Settings** tab → find **Root Directory** → type exactly: **`backend`**  ← (just the word, no slashes, no filename — this is what broke it last time)
- [ ] Go to the **Variables** tab → click **Raw Editor** → paste these 4 lines (fill in your values):
  ```
  DATABASE_URL=postgresql://YOUR-NEON-STRING-HERE
  BOARD_PASSWORD=loaded
  AUTH_SECRET=type-any-long-random-text-here
  ANTHROPIC_API_KEY=your-anthropic-key-or-leave-blank
  ```
  Click **Save / Update Variables** (this kicks off a deploy).
- [ ] **Seed your 215 loads:** Settings tab → **Deploy** section → **Pre-Deploy Command** → enter: **`npm run migrate`** → save.
- [ ] Watch the **Deployments** tab. You want a green **build success**, and in the pre-deploy/deploy logs: `✓ seeded 215 historical loads`.
- [ ] Settings → **Networking** → **Generate Domain**. Copy the URL it gives you (looks like `https://loaded-logistics-production.up.railway.app`). **Save this — you need it in Part 3.**
- [ ] ✅ Check: open `YOUR-BACKEND-URL/api/health` in a browser → you should see `{"ok":true}`.

> If the deploy fails with empty logs: Settings → **Custom Start Command** → set to `/bin/sh -c "npm run migrate && npm start"` → redeploy.

---

## PART 3 — Deploy the board on Railway (~5 min)

- [ ] Same Railway project → **+ New** → **GitHub Repo** → pick `loaded-logistics` again (yes, the same repo).
- [ ] Click the new **service box** → **Settings** → **Root Directory** → type exactly: **`board`**
- [ ] **Variables** tab → **Raw Editor** → paste this one line using your backend URL from Part 2 (no trailing slash):
  ```
  VITE_API_URL=https://YOUR-BACKEND-URL.up.railway.app
  ```
  Save. (Must be set **before** it builds — if you set it after, hit **Redeploy**.)
- [ ] Settings → **Networking** → **Generate Domain**. **This URL is your board** — bookmark it and share with your team.
- [ ] ✅ Open the board URL → type the password **`loaded`** → you should see all 215 loads and every tab.

---

## You're live 🎉
- **Board (for the team):** the Part 3 domain.
- **Password:** `loaded` (change later by editing `BOARD_PASSWORD` on the backend service → redeploy).
- **No Anthropic key yet?** Everything works except the "Extract" and Copilot buttons — add the key anytime.

When this is done and you've kicked the tires, tell me and we'll start **Phase 2**: auto-pulling your rate cons from both Gmail inboxes into the board.

---

### Quick troubleshooting
- **"No application source code" on Railway** → the `backend` folder isn't actually in GitHub, or Root Directory is misspelled. Open the repo and confirm `backend/package.json` exists; if your files landed inside an extra `phase1` wrapper, set Root Directory to `phase1/backend`.
- **Board loads but says it can't connect / won't log in** → `VITE_API_URL` is wrong or has a trailing slash; fix it and Redeploy the board. Confirm the backend `/api/health` returns `{"ok":true}`.
- **Build succeeds but URL shows an error page** → give it a minute after first deploy; then re-check the domain under Networking.
```

### `PHASE2-SETUP.md`

```markdown
# Loaded Logistics — Phase 2: Auto-pull rate cons from Gmail

**What this does:** a read-only worker watches your two inboxes. When a rate
confirmation lands (email body *or* PDF attachment), it parses it with the *same*
extractor as the Rate Cons tab and drops the load straight onto the board as
**Available** — with a note in **Team** chat — usually within a minute. You did
nothing; the load is just there.

**It is read-only.** The only permission requested is `gmail.readonly`. It can
read mail. It cannot send, delete, or change anything in your inbox. Your
Anthropic key stays on the server, exactly like Phase 1.

This is a one-time setup, ~20–30 minutes, mostly clicking in a browser.

---

## Before you start

You'll do three things:

1. **Google Cloud** — make an app that's allowed to read Gmail (get a Client ID + Secret).
2. **Get a "refresh token" for each inbox** — the thing that lets the worker read that mailbox.
3. **Turn it on in Railway** — paste 4 settings onto your backend, redeploy.

You need: the two Gmail addresses you want watched, and access to your existing
**Railway** backend service. Your backend must already have `ANTHROPIC_API_KEY`
set (Phase 2 uses it to read the rate cons).

---

## PART 1 — Create the Google app (~10 min)

1. Go to **console.cloud.google.com** → sign in with the account that should own
   this (hawkinsonjh@gmail.com is fine) → top bar **project picker → New Project**
   → name it `loaded-logistics` → **Create**, then select it.
2. **Enable the Gmail API:** search bar → "Gmail API" → **Enable**.
3. **OAuth consent screen** (left menu: *APIs & Services → OAuth consent screen*):
   - User type: **External** → **Create**.
   - App name `Loaded Logistics`, user support email = your email, developer email = your email → **Save and Continue**.
   - **Scopes** → **Add or remove scopes** → paste this in the filter and check it:
     `https://www.googleapis.com/auth/gmail.readonly` → **Update** → **Save and Continue**.
   - **Test users** → add **both** inbox addresses → **Save and Continue**.
4. **Publish it (important).** Back on the OAuth consent screen, find **Publishing
   status** → click **Publish app** → confirm to move it to **In production**.

   > Why: while the app is in "Testing", Google **expires the login every 7 days**
   > and the worker would stop. "In production" removes that. Because you're only
   > reading your *own* inboxes, you do **not** need Google's app verification —
   > you'll just see a one-time "Google hasn't verified this app" notice in Part 2,
   > which you click through (**Advanced → Go to Loaded Logistics → Continue**).

5. **Create the credentials** (*APIs & Services → Credentials → Create Credentials
   → OAuth client ID*):
   - Application type: **Web application**.
   - Name: `loaded-logistics-web`.
   - Under **Authorized redirect URIs → Add URI**, paste exactly:
     `https://developers.google.com/oauthplayground`
   - **Create.** Copy the **Client ID** and **Client secret** — you need them next.

---

## PART 2 — Get a refresh token for each inbox (~10 min, all in browser)

Do this **twice** — once per inbox. Use a separate browser / incognito window for
the second so you sign in as the right account.

1. Open **developers.google.com/oauthplayground**.
2. Click the **gear (⚙)** top-right → check **Use your own OAuth credentials** →
   paste your **Client ID** and **Client secret** from Part 1 → close the panel.
3. On the left, in **"Input your own scopes"**, paste:
   `https://www.googleapis.com/auth/gmail.readonly` → click **Authorize APIs**.
4. Sign in as **inbox #1**. If you see "Google hasn't verified this app," click
   **Advanced → Go to Loaded Logistics (unsafe) → Continue**, then **Allow**.
   (It's your own app — this is expected.)
5. Back in the Playground you'll be on **Step 2**. Click **Exchange authorization
   code for tokens**. Copy the **Refresh token** value (a long string starting
   with `1//`).
6. **Repeat steps 1–5 for inbox #2** in a fresh incognito window.

Now build one line with **both** tokens (mind the commas and quotes):

```
GMAIL_ACCOUNTS=[{"email":"first@gmail.com","refreshToken":"1//PASTE_FIRST"},{"email":"second@gmail.com","refreshToken":"1//PASTE_SECOND"}]
```

> Prefer a terminal? See **Appendix A** to get the tokens with `npm run gmail-auth`
> instead of the Playground (needs Node + a "Desktop app" client).

---

## PART 3 — Turn it on in Railway (~5 min)

1. Railway → your project → the **backend** service → **Variables** → **Raw Editor**.
2. Add these (keep your existing `DATABASE_URL`, `BOARD_PASSWORD`, `AUTH_SECRET`,
   `ANTHROPIC_API_KEY`):
   ```
   GMAIL_INGEST_ENABLED=true
   GOOGLE_CLIENT_ID=your-client-id-from-part-1
   GOOGLE_CLIENT_SECRET=your-client-secret-from-part-1
   GMAIL_ACCOUNTS=[{"email":"first@gmail.com","refreshToken":"1//..."},{"email":"second@gmail.com","refreshToken":"1//..."}]
   ```
   **Save** (this redeploys the backend).
3. **Apply the new database columns once.** The worker adds a few columns to the
   `emails` table. Either it runs as your pre-deploy command (`npm run migrate`,
   set in Phase 1 — safe to re-run), or open the backend **Shell** and run
   `npm run migrate` once. You'll see `✓ schema applied`.

---

## PART 4 — Confirm it's working

1. **Check the Railway logs.** Backend service → **Deployments** → open the latest →
   **View logs**. Right after boot you should see:
   `Gmail ingest: polling every 60s across 2 mailbox(es).` That means it's live.
   (If instead you see "enabled but not configured," a Google value is missing —
   see Troubleshooting.)
2. **Send a test.** Forward or send a real rate con to one of the inboxes. Within
   ~1 minute it appears on the **Board** as **Available**, with a 📩 note in **Team**.
   The logs print `Gmail ingest: +1 load(s)...` when it catches one.
3. **It dedupes.** The same email is never added twice — every message it reads is
   recorded, so sweeps are safe to repeat.

> Power-user check: `GET /api/ingest/status` returns `configured`, `accounts`, and the
> last run, and `POST /api/ingest/run` forces a sweep — but both require the board's
> login token (`Authorization: Bearer …`), so a plain browser visit returns 401. The
> Railway logs above are the easy signal.

That's Phase 2. Rate cons now load themselves.

---

## Knobs (optional)

Set these as Railway variables on the backend if you want to tune it:

| Variable | Default | What it does |
|---|---|---|
| `GMAIL_POLL_MS` | `60000` | How often it checks the inboxes, in ms (min 20000). |
| `GMAIL_MIN_CONFIDENCE` | `0.6` | 0–1. How sure the AI must be before auto-adding. Raise it if junk slips through; lower it if real cons get skipped. |
| `GMAIL_QUERY` | rate-con phrases, last 3 days | The Gmail search it runs. Override to widen/narrow what counts as a candidate. |

To pause ingestion at any time: set `GMAIL_INGEST_ENABLED=false` (or delete it) and
redeploy. The board and everything else keep working.

---

## Troubleshooting

- **Logs say "enabled but not configured"** → one of `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, or `GMAIL_ACCOUNTS` is missing/blank, or `GMAIL_ACCOUNTS`
  isn't valid JSON (check the brackets, quotes, and the comma between the two inboxes).
- **Worked, then stopped after ~a week** → your OAuth app slipped back to "Testing,"
  or was never published. Re-check **Part 1, step 4** (Publishing status = *In
  production*), then redo Part 2 to get fresh tokens.
- **`token refresh failed 400`** in the logs → that inbox's refresh token is wrong
  or was revoked. Redo Part 2 for that inbox and update `GMAIL_ACCOUNTS`.
- **Nothing gets added** → confirm `ANTHROPIC_API_KEY` is set on the backend (the
  parser needs it), and that a real rate con actually matches the search. Try
  `POST /api/ingest/run` and read the `details` it returns.
- **A real con was skipped** → lower `GMAIL_MIN_CONFIDENCE` (e.g. `0.45`). It's
  still recorded in the `emails` table either way, so nothing is lost.

---

## How it fits together

```
  Gmail inbox #1 ─┐
                  ├─►  ingest worker (read-only, every 60s)  ─►  AI extractor  ─►  loads (source='email')
  Gmail inbox #2 ─┘            in your existing backend          (same parser        + 📩 Team chat note
                                                                  as Rate Cons tab)   shows on the Board
```

The worker lives inside the backend you already deployed — no new service. It only
runs when `GMAIL_INGEST_ENABLED=true` and the Google settings are present.

---

## Appendix A — Terminal method (instead of the Playground)

If you'd rather not use the OAuth Playground and you have **Node 18+** on your
computer:

1. In **Part 1, step 5**, create the OAuth client as **Desktop app** instead of
   Web application (no redirect URI needed).
2. On your computer: `cd backend` → `npm install`.
3. Put your IDs in `backend/.env`:
   ```
   GOOGLE
```

### `README.md`

```markdown
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
It's off until you connect it. **Turn it on by following [`PHASE2-SETUP
```

### `backend/.env.example`

```
# ── Loaded Logistics backend ──────────────────────────────────────────────
# Neon connection string (Dashboard → your project → Connection Details → "Connection string").
# It looks like: postgresql://USER:PASSWORD@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
DATABASE_URL=

# Team login password for the board. Defaults to "loaded" if unset.
BOARD_PASSWORD=loaded

# Secret used to sign session tokens. Set this to any long random string in production.
AUTH_SECRET=please-change-this-to-a-long-random-string

# Your Anthropic API key — powers Rate Cons extraction + Copilot + Phase 2 email parsing.
# Leave blank to launch without AI (the board still runs; AI buttons show a notice).
ANTHROPIC_API_KEY=

# Railway sets PORT automatically; leave unset locally to default to 8080.
# PORT=8080

# ── Phase 2: Gmail rate-con ingest ────────────────────────────────────────
# Read-only inbox watcher that auto-adds rate cons to the board.
# Full walkthrough: PHASE2-SETUP.md. Leave GMAIL_INGEST_ENABLED unset to keep it off.

# Master switch. Set to "true" on the backend once the values below are filled in.
GMAIL_INGEST_ENABLED=

# Google OAuth app credentials (Google Cloud Console → Credentials → OAuth client, "Desktop app").
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# One object per inbox. Get each refreshToken by running `npm run gmail-auth` (once per inbox).
# Example: GMAIL_ACCOUNTS=[{"email":"a@gmail.com","refreshToken":"1//0a..."},{"email":"b@gmail.com","refreshToken":"1//0b..."}]
GMAIL_ACCOUNTS=

# Optional tuning (sensible defaults shown):
# GMAIL_POLL_MS=60000          # how often to sweep the inboxes (ms; min 20000)
# GMAIL_MIN_CONFIDENCE=0.6     # 0..1 — how sure the AI must be before auto-adding
# GMAIL_QUERY=                 # override the Gmail search; default targets rate-con language
```

### `backend/.gitignore`

```
node_modules
dist
.env
*.log
```

### `backend/err.txt`

```
node:internal/modules/package_json_reader:208
  const result = modulesBinding.getPackageScopeConfig(`${resolved}`);
                                ^

Error: Invalid package config /sessions/hopeful-great-wright/mnt/Loaded Logistics/backend/package.json.
    at getPackageScopeConfig (node:internal/modules/package_json_reader:208:33)
    at Object.getFileProtocolModuleFormat [as file:] (node:internal/modules/esm/get_format:147:72)
    at defaultGetFormatWithoutErrors (node:internal/modules/esm/get_format:232:36)
    at defaultResolve (node:internal/modules/esm/resolve:1009:13)
    at checkSyntax (node:internal/main/check_syntax:68:27)
    at node:internal/main/check_syntax:40:25
    at loadESMIfNeeded (node:internal/main/check_syntax:56:3)
    at node:internal/main/check_syntax:40:3 {
  code: 'ERR_INVALID_PACKAGE_CONFIG'
}

Node.js v22.22.3
```

### `backend/package.json`

```json
{
  "name": "loaded-logistics-backend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=18" },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "migrate": "tsx src/seed.ts",
    "gmail-auth": "tsx src/google-auth.ts",
    "ingest": "tsx src/ingest.ts"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "pg": "^8.12.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.14.0",
    "@types/pg": "^8.11.6",
    "tsx": "^4.16.0",
    "typescript": "^5.5.0"
  }
}
```

### `backend/seed-data.json`

```json
[{"id":"h1","date":"2025-05-27","rpm":1.46,"rate":800.0,"miles":415,"broker":"CH Robinson","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":240.0,"dh":133,"status":"Delivered"},{"id":"h2","date":"2025-05-28","rpm":1.61,"rate":800.0,"miles":426,"broker":"D&L Transport","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":240.0,"dh":70,"status":"Delivered"},{"id":"h3","date":"2025-06-04","rpm":1.64,"rate":850.0,"miles":407,"broker":"NFL Logistics","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":255.0,"dh":110,"status":"Delivered"},{"id":"h4","date":"2025-06-06","rpm":1.32,"rate":350.0,"miles":265,"broker":"ILG Logistics","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":105.0,"dh":null,"status":"Delivered"},{"id":"h5","date":"2025-06-10","rpm":1.96,"rate":500.0,"miles":169,"broker":"Custom Logistics","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":150.0,"dh":86,"status":"Delivered"},{"id":"h6","date":"2025-06-24","rpm":1.76,"rate":500.0,"miles":139,"broker":"Total Transportation","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":150.0,"dh":145,"status":"Delivered"},{"id":"h7","date":"2025-06-26","rpm":2.7,"rate":1100.0,"miles":406,"broker":"Agforce Transport","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":330.0,"dh":null,"status":"Delivered"},{"id":"h8","date":"2025-07-01","rpm":2.0,"rate":400.0,"miles":200,"broker":"Centran Logistics","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":120.0,"dh":null,"status":"Delivered"},{"id":"h9","date":"2025-07-22","rpm":1.75,"rate":700.0,"miles":199,"broker":"CH Robinson","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":210.0,"dh":199,"status":"Delivered"},{"id":"h10","date":"2025-07-24","rpm":1.84,"rate":900.0,"miles":244,"broker":"BBL Transportation","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":270.0,"dh":244,"status":"Delivered"},{"id":"h11","date":"2025-07-29","rpm":1.26,"rate":700.0,"miles":276,"broker":"Cleveland Logistics","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":210.0,"dh":276,"status":"Delivered"},{"id":"h12","date":"2025-07-31","rpm":2.07,"rate":825.0,"miles":199,"broker":"APT Industries","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":247.5,"dh":199,"status":"Delivered"},{"id":"h13","date":"2025-08-06","rpm":2.07,"rate":825.0,"miles":199,"broker":"APT Industries","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":247.5,"dh":199,"status":"Delivered"},{"id":"h14","date":"2025-08-09","rpm":1.84,"rate":900.0,"miles":244,"broker":"BBL Transportation","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":270.0,"dh":244,"status":"Delivered"},{"id":"h15","date":"2025-08-18","rpm":2.07,"rate":825.0,"miles":199,"broker":"APT Industries","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":247.5,"dh":199,"status":"Delivered"},{"id":"h16","date":"2025-08-19","rpm":1.84,"rate":900.0,"miles":244,"broker":"BBL Transportation","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":270.0,"dh":244,"status":"Delivered"},{"id":"h17","date":"2025-08-26","rpm":3.25,"rate":322.5,"miles":30,"broker":"CH Robinson","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":96.75,"dh":70,"status":"Delivered"},{"id":"h18","date":"2025-09-02","rpm":1.91,"rate":1150.0,"miles":325,"broker":"BBL Transportation","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":345.0,"dh":276,"status":"Delivered"},{"id":"h19","date":"2025-09-08","rpm":2.07,"rate":825.0,"miles":199,"broker":"APT Industries","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":247.5,"dh":199,"status":"Delivered"},{"id":"h20","date":"2025-09-15","rpm":2.42,"rate":650.0,"miles":134,"broker":"CH Robinson","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":195.0,"dh":134,"status":"Delivered"},{"id":"h21","date":"2025-09-16","rpm":2.5,"rate":500.0,"miles":400,"broker":"CKM Trucks","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":150.0,"dh":null,"status":"Delivered"},{"id":"h22","date":"2025-09-23","rpm":1.33,"rate":1200.0,"miles":900,"broker":"CKM Trucks","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":360.0,"dh":null,"status":"Delivered"},{"id":"h23","date":"2025-09-30","rpm":1.06,"rate":1600.0,"miles":1500,"broker":"CKM Trucks","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":480.0,"dh":null,"status":"Delivered"},{"id":"h24","date":"2025-10-06","rpm":1.33,"rate":400.0,"miles":300,"broker":"CKM Trucks","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":120.0,"dh":null,"status":"Delivered"},{"id":"h25","date":"2025-10-07","rpm":1.25,"rate":500.0,"miles":400,"broker":"CKM Trucks","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":150.0,"dh":null,"status":"Delivered"},{"id":"h26","date":"2025-10-14","rpm":1.66,"rate":500.0,"miles":300,"broker":"LEG Freight Solutions","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":150.0,"dh":null,"status":"Delivered"},{"id":"h27","date":"2025-10-30","rpm":1.64,"rate":700.0,"miles":426,"broker":"Middle Sis Inc","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":210.0,"dh":null,"status":"Delivered"},{"id":"h28","date":"2025-11-02","rpm":2.11,"rate":900.0,"miles":426,"broker":"Flock Freight","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":270.0,"dh":null,"status":"Delivered"},{"id":"h29","date":"2025-11-03","rpm":1.86,"rate":700.0,"miles":375,"broker":"Trupoint Logistics","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":210.0,"dh":null,"status":"Delivered"},{"id":"h30","date":"2025-11-04","rpm":2.09,"rate":1300.0,"miles":620,"broker":"WSI Freight","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":390.0,"dh":null,"status":"Delivered"},{"id":"h31","date":"2025-11-05","rpm":1.69,"rate":700.0,"miles":412,"broker":"C Cross Logistics","driver":"Derek","unit":"","pay":1375.0,"fuel":1074.0,"repair":null,"dispatch":210.0,"dh":null,"status":"Delivered"},{"id":"h32","date":"2025-11-11","rpm":1.85,"rate":900.0,"miles":486,"broker":"CH Robinson","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":270.0,"dh":null,"status":"Delivered"},{"id":"h33","date":"2025-11-12","rpm":37.5,"rate":150.0,"miles":4,"broker":"Destination Transport","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":45.0,"dh":null,"status":"Delivered"},{"id":"h34","date":"2025-11-13","rpm":1.08,"rate":450.0,"miles":486,"broker":"CH Robinson","driver":"Derek","unit":"","pay":716.0,"fuel":400.0,"repair":null,"dispatch":135.0,"dh":null,"status":"Delivered"},{"id":"h35","date":"2025-11-24","rpm":2.25,"rate":1550.0,"miles":686,"broker":"HD Shipping","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":465.0,"dh":null,"status":"Delivered"},{"id":"h36","date":"2025-11-25","rpm":1.97,"rate":2000.0,"miles":1011,"broker":"HD Shipping","driver":"Derek","unit":"","pay":969.0,"fuel":707.0,"repair":null,"dispatch":600.0,"dh":null,"status":"Delivered"},{"id":"h37","date":"2025-12-01","rpm":1.99,"rate":750.0,"miles":376,"broker":"Flock Freight","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":225.0,"dh":null,"status":"Delivered"},{"id":"h38","date":"2025-12-02","rpm":1.84,"rate":1200.0,"miles":582,"broker":"Spot Freight","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":360.0,"dh":60,"status":"Delivered"},{"id":"h39","date":"2025-12-03","rpm":1.31,"rate":900.0,"miles":437,"broker":"CH Robinson","driver":"Derek","unit":"","pay":1200.0,"fuel":1214.0,"repair":null,"dispatch":270.0,"dh":245,"status":"Delivered"},{"id":"h40","date":"2025-12-16","rpm":1.8,"rate":450.0,"miles":125,"broker":"APT Industries","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":135.0,"dh":125,"status":"Delivered"},{"id":"h41","date":"2025-12-17","rpm":1.19,"rate":400.0,"miles":168,"broker":"RTS","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":120.0,"dh":168,"status":"Delivered"},{"id":"h42","date":"2025-12-18","rpm":2.32,"rate":1400.0,"miles":461,"broker":"MegaCorp","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":420.0,"dh":141,"status":"Delivered"},{"id":"h43","date":"2025-12-19","rpm":0.5,"rate":300.0,"miles":600,"broker":"Allen Lund Company","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":90.0,"dh":null,"status":"Delivered"},{"id":"h44","date":"2026-01-02","rpm":1.62,"rate":1250.0,"miles":770,"broker":"Summitt Logistics","driver":"TJ","unit":"2","pay":424.0,"fuel":319.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h45","date":"2026-01-06","rpm":1.62,"rate":750.0,"miles":461,"broker":"MegaCorp","driver":"TJ","unit":"2","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h46","date":"2026-01-08","rpm":1.6,"rate":1500.0,"miles":936,"broker":"FreightFlex","driver":"TJ","unit":"2","pay":781.0,"fuel":576.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h47","date":"2026-01-12","rpm":2.72,"rate":1500.0,"miles":550,"broker":"FreightFlex","driver":"TJ","unit":"2","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h48","date":"2026-01-13","rpm":3.8,"rate":950.0,"miles":250,"broker":"Ryan Transportation","driver":"TJ","unit":"2","pay":830.0,"fuel":600.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h49","date":"2026-01-14","rpm":1.76,"rate":1250.0,"miles":710,"broker":"TA Services","driver":"TJ","unit":"2","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h50","date":"2026-01-20","rpm":1.72,"rate":1754.0,"miles":1018,"broker":"Norfleet Logistics","driver":"TJ","unit":"2","pay":899.0,"fuel":750.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h51","date":"2026-01-22","rpm":1.55,"rate":961.0,"miles":618,"broker":"Norfleet Logistics","driver":"TJ","unit":"2","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h52","date":"2026-01-26","rpm":1.1,"rate":725.0,"miles":656,"broker":"Norfleet Logistics","driver":"TJ","unit":"2","pay":380.0,"fuel":300.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h53","date":"2026-01-28","rpm":1.84,"rate":1643.0,"miles":894,"broker":"Norfleet Logistics","driver":"John","unit":"2","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h54","date":"2026-01-29","rpm":2.0,"rate":725.0,"miles":336,"broker":"Norfleet Logistics","driver":"John","unit":"1","pay":650.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h55","date":"2026-01-29","rpm":1.84,"rate":1589.25,"miles":860,"broker":"Norfleet Logistics","driver":"Chris","unit":"2","pay":780.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h56","date":"2026-02-04","rpm":4.29,"rate":1800.0,"miles":419,"broker":"Sage Freight","driver":"Chris","unit":"2","pay":262.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h57","date":"2026-02-04","rpm":4.29,"rate":1800.0,"miles":419,"broker":"Sage Freight","driver":"John","unit":"3","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h58","date":"2026-02-04","rpm":4.29,"rate":1800.0,"miles":419,"broker":"Sage Freight","driver":"TJ","unit":"4","pay":525.0,"fuel":500.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h59","date":"2026-02-05","rpm":2.58,"rate":1800.0,"miles":695,"broker":"TQL","driver":"Chris","unit":"2","pay":450.0,"fuel":550.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h60","date":"2026-02-05","rpm":2.21,"rate":900.0,"miles":406,"broker":"NT Logistics","driver":"TJ","unit":"4","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h61","date":"2026-02-05","rpm":2.21,"rate":900.0,"miles":406,"broker":"NT Logistics","driver":"John","unit":"3","pay":500.0,"fuel":450.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h62","date":"2026-02-06","rpm":1.85,"rate":2372.0,"miles":1280,"broker":"Norfleet Logistics","driver":"John","unit":"3","pay":768.0,"fuel":798.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h63","date":"2026-02-06","rpm":1.8,"rate":2700.0,"miles":1500,"broker":"Green Logistics LLC","driver":"Chris","unit":"2","pay":906.0,"fuel":700.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h64","date":"2026-02-09","rpm":1.66,"rate":1059.0,"miles":637,"broker":"Norfleet Logistics","driver":"John","unit":"3","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h65","date":"2026-02-10","rpm":2.0,"rate":2000.0,"miles":1000,"broker":"TQL","driver":"Chris","unit":"2","pay":630.0,"fuel":719.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h66","date":"2026-02-11","rpm":2.02,"rate":2163.0,"miles":1069,"broker":"Norfleet Logistics","driver":"John","unit":"3","pay":1023.0,"fuel":542.5,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h67","date":"2026-02-11","rpm":1.75,"rate":1526.0,"miles":870,"broker":"Norfleet Logistics","driver":"TJ","unit":"4","pay":478.5,"fuel":500.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h68","date":"2026-02-12","rpm":2.88,"rate":1350.0,"miles":468,"broker":"TQL","driver":"Chris","unit":"2","pay":294.0,"fuel":272.29,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h69","date":"2026-02-12","rpm":2.03,"rate":1435.0,"miles":705,"broker":"Norfleet Logistics","driver":"TJ","unit":"4","pay":475.55,"fuel":550.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h70","date":"2026-02-16","rpm":4.25,"rate":3400.0,"miles":800,"broker":"TQL","driver":"John","unit":"3","pay":605.0,"fuel":413.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h71","date":"2026-02-18","rpm":2.69,"rate":2000.0,"miles":743,"broker":"TQL","driver":"John","unit":"3","pay":550.0,"fuel":400.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h72","date":"2026-02-18","rpm":1.54,"rate":2200.0,"miles":713,"broker":"TQL","driver":"TJ","unit":"4","pay":838.0,"fuel":1050.0,"repair":300.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h73","date":"2026-02-19","rpm":2.6,"rate":1200.0,"miles":615,"broker":"SPI Logistics","driver":"TJ","unit":"4","pay":340.0,"fuel":378.0,"repair":300.0,"dispatch":80.0,"dh":null,"status":"Delivered"},{"id":"h74","date":"2026-02-23","rpm":2.6,"rate":1150.0,"miles":441,"broker":"Trident Logistics","driver":"John","unit":"3","pay":200.0,"fuel":260.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h75","date":"2026-02-23","rpm":2.7,"rate":1350.0,"miles":499,"broker":"TQL","driver":"John","unit":"3","pay":612.0,"fuel":200.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h76","date":"2026-02-23","rpm":2.22,"rate":1000.0,"miles":450,"broker":"White Acre Logistics","driver":"TJ","unit":"4","pay":null,"fuel":250.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h77","date":"2026-02-23","rpm":1.53,"rate":2200.0,"miles":1430,"broker":"TQL","driver":"Chris","unit":"2","pay":340.0,"fuel":256.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h78","date":"2026-02-24","rpm":3.75,"rate":1500.0,"miles":400,"broker":"Pivot Supply","driver":"TJ","unit":"4","pay":null,"fuel":330.9,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h79","date":"2026-02-25","rpm":2.44,"rate":1050.0,"miles":430,"broker":"PVG Brokerage","driver":"TJ","unit":"4","pay":724.0,"fuel":200.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h80","date":"2026-02-25","rpm":1.88,"rate":900.0,"miles":460,"broker":"RTS","driver":"John","unit":"3","pay":180.0,"fuel":480.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h81","date":"2026-02-26","rpm":3.36,"rate":1050.0,"miles":312,"broker":"PVG Brokerage","driver":"Chris","unit":"2","pay":200.0,"fuel":309.42,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h82","date":"2026-02-26","rpm":2.8,"rate":1950.0,"miles":695,"broker":"Trinity Logistics","driver":"John","unit":"3","pay":null,"fuel":349.17,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h83","date":"2026-02-27","rpm":2.3,"rate":1500.0,"miles":650,"broker":"Texas Customer","driver":"John","unit":"3","pay":807.0,"fuel":200.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h84","date":"2026-02-27","rpm":2.81,"rate":1800.0,"miles":615,"broker":"Lipsey Logistics","driver":"Chris","unit":"2","pay":390.0,"fuel":220.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h85","date":"2026-03-01","rpm":2.5,"rate":1400.0,"miles":559,"broker":"TQL","driver":"John","unit":"3","pay":335.4,"fuel":443.6,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h86","date":"2026-03-02","rpm":2.9,"rate":1900.0,"miles":653,"broker":"Barnhart Logistics","driver":"John","unit":"3","pay":391.8,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h87","date":"2026-03-02","rpm":2.63,"rate":1250.0,"miles":475,"broker":"PVG Brokerage","driver":"Chris","unit":"2","pay":300.0,"fuel":370.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h88","date":"2026-03-02","rpm":2.95,"rate":1250.0,"miles":423,"broker":"PVG Brokerage","driver":"TJ","unit":"4","pay":null,"fuel":292.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h89","date":"2026-03-03","rpm":1.82,"rate":1500.0,"miles":824,"broker":"TQL","driver":"TJ","unit":"2","pay":750.0,"fuel":302.54,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h90","date":"2026-03-03","rpm":1.82,"rate":1500.0,"miles":824,"broker":"TQL","driver":"Chris","unit":"2","pay":494.0,"fuel":437.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h91","date":"2026-03-03","rpm":2.39,"rate":1100.0,"miles":460,"broker":"Uber Freight","driver":"John","unit":"3","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h92","date":"2026-03-03","rpm":2.82,"rate":1300.0,"miles":null,"broker":"D&L Transport","driver":"John","unit":"3","pay":400.0,"fuel":719.74,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h93","date":"2026-03-04","rpm":2.44,"rate":1200.0,"miles":490,"broker":"Value Logistics","driver":"John","unit":"3","pay":294.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h94","date":"2026-03-04","rpm":2.5,"rate":3000.0,"miles":1424,"broker":"TQL","driver":"TJ","unit":"4","pay":980.0,"fuel":1300.0,"repair":595.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h95","date":"2026-03-04","rpm":2.37,"rate":2500.0,"miles":1053,"broker":"Universal Logistics","driver":"Chris","unit":"2","pay":631.8,"fuel":721.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h96","date":"2026-03-06","rpm":2.1,"rate":3750.0,"miles":1781,"broker":"Jones Transport","driver":"John","unit":"3","pay":1068.0,"fuel":922.0,"repair":2000.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h97","date":"2026-03-06","rpm":2.34,"rate":2500.0,"miles":1060,"broker":"Nationwide Transport","driver":"Chris","unit":"2","pay":250.0,"fuel":324.57,"repair":900.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h98","date":"2026-03-09","rpm":1.62,"rate":700.0,"miles":430,"broker":"Ark Logistics","driver":"John","unit":"3","pay":258.0,"fuel":511.0,"repair":2000.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h99","date":"2026-03-10","rpm":2.76,"rate":1700.0,"miles":615,"broker":"Trinity Logistics","driver":"Chris","unit":"2","pay":569.0,"fuel":600.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h100","date":"2026-03-12","rpm":2.66,"rate":1600.0,"miles":555,"broker":"Heniff Logistics","driver":"Chris","unit":"2","pay":333.0,"fuel":936.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h101","date":"2026-03-13","rpm":3.39,"rate":1750.0,"miles":515,"broker":"ITS Logistics","driver":"Chris","unit":"2","pay":323.0,"fuel":490.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h102","date":"2026-03-16","rpm":2.11,"rate":1050.0,"miles":496,"broker":"PVG Brokerage","driver":"Chris","unit":"2","pay":300.0,"fuel":257.01,"repair":195.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h103","date":"2026-03-17","rpm":2.36,"rate":1700.0,"miles":720,"broker":"Tri-State Logistics","driver":"Chris","unit":"2","pay":432.0,"fuel":540.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h104","date":"2026-03-18","rpm":2.08,"rate":1000.0,"miles":479,"broker":"Trident Transport","driver":"Chris","unit":"2","pay":287.0,"fuel":334.0,"repair":40.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h105","date":"2026-03-18","rpm":2.08,"rate":1500.0,"miles":720,"broker":"Tri-State Logistics","driver":"TJ","unit":"4","pay":null,"fuel":420.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h106","date":"2026-03-18","rpm":2.22,"rate":1600.0,"miles":720,"broker":"Tri-State Logistics","driver":"John","unit":"3","pay":435.0,"fuel":466.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h107","date":"2026-03-19","rpm":3.66,"rate":2200.0,"miles":600,"broker":"Pepsi Co","driver":"Chris","unit":"2","pay":360.0,"fuel":650.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h108","date":"2026-03-20","rpm":2.4,"rate":2500.0,"miles":1040,"broker":"TQL","driver":"John","unit":"3","pay":630.0,"fuel":490.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h109","date":"2026-03-20","rpm":2.38,"rate":1000.0,"miles":420,"broker":"Cargo Solution","driver":"TJ","unit":"4","pay":629.75,"fuel":360.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h110","date":"2026-03-23","rpm":2.99,"rate":1400.0,"miles":468,"broker":"Onewaytrailers","driver":"John","unit":"3","pay":280.0,"fuel":387.14,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h111","date":"2026-03-23","rpm":2.37,"rate":1500.0,"miles":631,"broker":"Armstrong Transport","driver":"Chris","unit":"2","pay":425.0,"fuel":690.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h112","date":"2026-03-24","rpm":2.27,"rate":3300.0,"miles":1450,"broker":"Ten Logistics","driver":"Chris","unit":"2","pay":916.0,"fuel":1392.0,"repair":20.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h113","date":"2026-03-25","rpm":2.51,"rate":4000.0,"miles":1590,"broker":"Navajo Transport","driver":"John","unit":"3","pay":960.0,"fuel":1038.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h114","date":"2026-03-25","rpm":3.04,"rate":1600.0,"miles":525,"broker":"TQL","driver":"TJ","unit":"4","pay":null,"fuel":560.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h115","date":"2026-03-25","rpm":2.8,"rate":1400.0,"miles":500,"broker":"TQL","driver":"TJ","unit":"4","pay":275.0,"fuel":850.0,"repair":null,"dispatch":150.0,"dh":null,"status":"Delivered"},{"id":"h116","date":"2026-03-27","rpm":2.42,"rate":1700.0,"miles":700,"broker":"TQL","driver":"Jeremy","unit":"5","pay":320.0,"fuel":800.0,"repair":null,"dispatch":125.0,"dh":null,"status":"Delivered"},{"id":"h117","date":"2026-03-29","rpm":2.61,"rate":2750.0,"miles":1050,"broker":"TQL","driver":"Jeremy","unit":"5","pay":630.0,"fuel":950.0,"repair":null,"dispatch":140.0,"dh":null,"status":"Delivered"},{"id":"h118","date":"2026-03-30","rpm":2.1,"rate":1400.0,"miles":664,"broker":"C Cross Logistics","driver":"TJ","unit":"4","pay":null,"fuel":484.4,"repair":null,"dispatch":70.0,"dh":null,"status":"Delivered"},{"id":"h119","date":"2026-03-30","rpm":2.0,"rate":1000.0,"miles":480,"broker":"Visual Pak Logistics","driver":"John","unit":"3","pay":300.0,"fuel":660.0,"repair":null,"dispatch":150.0,"dh":null,"status":"Delivered"},{"id":"h120","date":"2026-03-31","rpm":2.48,"rate":3700.0,"miles":1490,"broker":"Confiance Logistics","driver":"Jeremy","unit":"5","pay":894.0,"fuel":1500.0,"repair":null,"dispatch":150.0,"dh":null,"status":"Delivered"},{"id":"h121","date":"2026-03-31","rpm":3.43,"rate":2750.0,"miles":800,"broker":"TQL","driver":"TJ","unit":"4","pay":null,"fuel":700.0,"repair":null,"dispatch":100.0,"dh":null,"status":"Delivered"},{"id":"h122","date":"2026-04-01","rpm":2.36,"rate":1250.0,"miles":528,"broker":"White Acre Logistics","driver":"TJ","unit":"4","pay":1100.0,"fuel":760.0,"repair":null,"dispatch":60.0,"dh":null,"status":"Delivered"},{"id":"h123","date":"2026-04-02","rpm":2.71,"rate":1200.0,"miles":442,"broker":"RXO Logistics","driver":"Jeremy","unit":"5","pay":319.24,"fuel":504.6,"repair":null,"dispatch":60.0,"dh":null,"status":"Delivered"},{"id":"h124","date":"2026-04-02","rpm":2.37,"rate":950.0,"miles":400,"broker":"PVG Brokerage","driver":"John","unit":"3","pay":240.0,"fuel":466.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h125","date":"2026-04-03","rpm":2.37,"rate":950.0,"miles":400,"broker":"PVG Brokerage","driver":"John","unit":"3","pay":240.0,"fuel":545.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h126","date":"2026-04-03","rpm":2.75,"rate":1100.0,"miles":400,"broker":"PVG Brokerage","driver":"Jeremy","unit":"5","pay":null,"fuel":452.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h127","date":"2026-04-04","rpm":2.75,"rate":1100.0,"miles":400,"broker":"PVG Brokerage","driver":"Jeremy","unit":"5","pay":480.0,"fuel":125.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h128","date":"2026-04-04","rpm":2.37,"rate":950.0,"miles":400,"broker":"PVG Brokerage","driver":"John","unit":"3","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h129","date":"2026-04-05","rpm":2.37,"rate":950.0,"miles":400,"broker":"PVG Brokerage","driver":"John","unit":"3","pay":480.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h130","date":"2026-04-06","rpm":2.53,"rate":3300.0,"miles":1300,"broker":"TQL","driver":"Jeremy","unit":"5","pay":780.0,"fuel":1100.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h131","date":"2026-04-08","rpm":2.27,"rate":1550.0,"miles":680,"broker":"TQL","driver":"Jeremy","unit":"5","pay":360.0,"fuel":653.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h132","date":"2026-04-10","rpm":1.86,"rate":1050.0,"miles":563,"broker":"Bee Mac Logistics","driver":"Jeremy","unit":"5","pay":330.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h133","date":"2026-04-13","rpm":2.78,"rate":2300.0,"miles":825,"broker":"Dedicated Logistics","driver":"Jeremy","unit":"5","pay":495.0,"fuel":424.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h134","date":"2026-04-14","rpm":4.4,"rate":3347.0,"miles":759,"broker":"Sage Freight","driver":"Jeremy","unit":"5","pay":400.0,"fuel":1110.0,"repair":null,"dispatch":200.0,"dh":null,"status":"Delivered"},{"id":"h135","date":"2026-04-14","rpm":2.54,"rate":1525.0,"miles":600,"broker":"Direct Connect","driver":"TJ","unit":"3","pay":1186.0,"fuel":849.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h136","date":"2026-04-15","rpm":2.8,"rate":2100.0,"miles":750,"broker":"TQL","driver":"TJ","unit":"3","pay":null,"fuel":80.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h137","date":"2026-04-16","rpm":2.53,"rate":3300.0,"miles":1300,"broker":"TQL","driver":"John","unit":"2","pay":840.0,"fuel":941.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h138","date":"2026-04-17","rpm":2.37,"rate":1400.0,"miles":589,"broker":"Priority","driver":"TJ","unit":"3","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h139","date":"2026-04-17","rpm":3.25,"rate":1300.0,"miles":400,"broker":"Forward Air","driver":"Jeremy","unit":"5","pay":null,"fuel":596.85,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h140","date":"2026-04-18","rpm":2.84,"rate":2150.0,"miles":820,"broker":"Direct Connect","driver":"Jeremy","unit":"5","pay":341.0,"fuel":570.0,"repair":null,"dispatch":750.0,"dh":null,"status":"Delivered"},{"id":"h141","date":"2026-04-20","rpm":3.25,"rate":1625.0,"miles":500,"broker":"American Diamond","driver":"John","unit":"2","pay":340.0,"fuel":450.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h142","date":"2026-04-20","rpm":2.89,"rate":2000.0,"miles":690,"broker":"Listo Services","driver":"Jeremy","unit":"5","pay":345.0,"fuel":420.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h143","date":"2026-04-21","rpm":2.5,"rate":2000.0,"miles":800,"broker":"MegaCorp","driver":"Jeremy","unit":"5","pay":480.0,"fuel":400.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h144","date":"2026-04-21","rpm":null,"rate":1200.0,"miles":null,"broker":"","driver":"John","unit":"2","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h145","date":"2026-04-21","rpm":4.57,"rate":1900.0,"miles":678,"broker":"Ryan Transportation","driver":"John","unit":"2","pay":null,"fuel":483.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h146","date":"2026-04-22","rpm":2.75,"rate":1100.0,"miles":400,"broker":"PVG Brokerage","driver":"TJ","unit":"3","pay":220.0,"fuel":310.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h147","date":"2026-04-26","rpm":2.78,"rate":2300.0,"miles":825,"broker":"Dedicated Logistics","driver":"John","unit":"2","pay":425.0,"fuel":560.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h148","date":"2026-04-26","rpm":3.75,"rate":300.0,"miles":80,"broker":"PVG Brokerage","driver":"TJ","unit":"3","pay":175.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h149","date":"2026-04-27","rpm":2.77,"rate":500.0,"miles":180,"broker":"Infinity Logistics","driver":"TJ","unit":"3","pay":100.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h150","date":"2026-04-28","rpm":3.26,"rate":1000.0,"miles":306,"broker":"PVG Brokerage","driver":"TJ","unit":"3","pay":200.0,"fuel":290.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h151","date":"2026-04-28","rpm":3.11,"rate":2700.0,"miles":850,"broker":"RXO Logistics","driver":"John","unit":"2","pay":null,"fuel":1110.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h152","date":"2026-04-28","rpm":2.95,"rate":1300.0,"miles":440,"broker":"Value Logistics","driver":"Jeremy","unit":"5","pay":null,"fuel":1050.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h153","date":"2026-04-29","rpm":2.58,"rate":3100.0,"miles":1200,"broker":"Blue Fawney Logistics","driver":"Jeremy","unit":"5","pay":null,"fuel":600.0,"repair":null,"dispatch":600.0,"dh":null,"status":"Delivered"},{"id":"h154","date":"2026-04-30","rpm":4.52,"rate":1300.0,"miles":552,"broker":"DHL","driver":"John","unit":"2","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h155","date":"2026-04-30","rpm":null,"rate":1200.0,"miles":null,"broker":"Trinity Logistics","driver":"John","unit":"2","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h156","date":"2026-05-01","rpm":2.6,"rate":1300.0,"miles":500,"broker":"DHL","driver":"Jeremy","unit":"5","pay":300.0,"fuel":620.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h157","date":"2026-05-02","rpm":2.37,"rate":1450.0,"miles":611,"broker":"ARL Logistics","driver":"Jeremy","unit":"5","pay":320.0,"fuel":800.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h158","date":"2026-05-03","rpm":4.04,"rate":2000.0,"miles":494,"broker":"Armstrong Transport","driver":"John","unit":"2","pay":343.0,"fuel":761.5,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h159","date":"2026-05-03","rpm":3.05,"rate":2200.0,"miles":null,"broker":"Armstrong Transport","driver":"Jeremy","unit":"5","pay":432.0,"fuel":463.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h160","date":"2026-05-04","rpm":4.8,"rate":1300.0,"miles":500,"broker":"DHL","driver":"TJ","unit":"3","pay":null,"fuel":430.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h161","date":"2026-05-04","rpm":null,"rate":1100.0,"miles":null,"broker":"TA Services","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h162","date":"2026-05-05","rpm":3.6,"rate":2200.0,"miles":610,"broker":"Spot Freight","driver":"John","unit":"2","pay":490.0,"fuel":469.0,"repair":567.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h163","date":"2026-05-06","rpm":4.0,"rate":2000.0,"miles":500,"broker":"Armstrong Transport","driver":"TJ","unit":"3","pay":660.0,"fuel":410.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h164","date":"2026-05-06","rpm":3.0,"rate":1800.0,"miles":600,"broker":"NFI Logistics","driver":"Jeremy","unit":"5","pay":365.0,"fuel":610.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h165","date":"2026-05-07","rpm":4.0,"rate":2000.0,"miles":494,"broker":"Armstrong Transport","driver":"John","unit":"2","pay":325.0,"fuel":470.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h166","date":"2026-05-07","rpm":3.44,"rate":2000.0,"miles":580,"broker":"Armstrong Transport","driver":"Jeremy","unit":"5","pay":360.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h167","date":"2026-05-08","rpm":2.77,"rate":1450.0,"miles":522,"broker":"Destination Transport","driver":"Jeremy","unit":"5","pay":320.0,"fuel":468.0,"repair":null,"dispatch":950.0,"dh":null,"status":"Delivered"},{"id":"h168","date":"2026-05-09","rpm":3.05,"rate":2200.0,"miles":720,"broker":"Armstrong Transport","driver":"Jeremy","unit":"5","pay":420.0,"fuel":227.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h169","date":"2026-05-11","rpm":2.53,"rate":1350.0,"miles":533,"broker":"Fox Logistics","driver":"TJ","unit":"3","pay":null,"fuel":548.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h170","date":"2026-05-11","rpm":2.5,"rate":1500.0,"miles":600,"broker":"TA Services","driver":"Jeremy","unit":"5","pay":360.0,"fuel":538.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h171","date":"2026-05-11","rpm":3.0,"rate":1800.0,"miles":600,"broker":"NFI Logistics","driver":"John","unit":"2","pay":360.0,"fuel":561.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h172","date":"2026-05-13","rpm":3.2,"rate":1700.0,"miles":530,"broker":"Midlink Logistics","driver":"TJ","unit":"3","pay":750.0,"fuel":520.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h173","date":"2026-05-15","rpm":4.33,"rate":1300.0,"miles":300,"broker":"Candor Expedite","driver":"Jeremy","unit":"5","pay":125.0,"fuel":530.0,"repair":1100.0,"dispatch":550.0,"dh":null,"status":"Delivered"},{"id":"h174","date":"2026-05-16","rpm":3.01,"rate":1650.0,"miles":548,"broker":"Rite Way Transport","driver":"John","unit":"2","pay":325.0,"fuel":426.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h175","date":"2026-05-16","rpm":3.1,"rate":1700.0,"miles":548,"broker":"Armstrong Transport","driver":"Jeremy","unit":"5","pay":340.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h176","date":"2026-05-18","rpm":2.8,"rate":1100.0,"miles":392,"broker":"TA Services","driver":"John","unit":"2","pay":235.0,"fuel":428.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h177","date":"2026-05-18","rpm":2.42,"rate":1550.0,"miles":642,"broker":"Priority1","driver":"Jeremy","unit":"5","pay":385.0,"fuel":412.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h178","date":"2026-05-19","rpm":5.17,"rate":2000.0,"miles":811,"broker":"DHL","driver":"TJ","unit":"3","pay":null,"fuel":920.0,"repair":700.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h179","date":"2026-05-19","rpm":null,"rate":2200.0,"miles":null,"broker":"England Logistics","driver":"TJ","unit":"3","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h180","date":"2026-05-19","rpm":3.25,"rate":1200.0,"miles":369,"broker":"UACL Logistics","driver":"John","unit":"2","pay":370.0,"fuel":721.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h181","date":"2026-05-19","rpm":3.08,"rate":2000.0,"miles":649,"broker":"Armstrong Transport","driver":"Jeremy","unit":"5","pay":395.0,"fuel":558.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h182","date":"2026-05-21","rpm":2.58,"rate":2000.0,"miles":775,"broker":"Armstrong Transport","driver":"TJ","unit":"3","pay":1045.0,"fuel":400.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h183","date":"2026-05-22","rpm":3.0,"rate":1800.0,"miles":600,"broker":"NFI Logistics","driver":"Jeremy","unit":"5","pay":430.0,"fuel":685.0,"repair":null,"dispatch":700.0,"dh":null,"status":"Delivered"},{"id":"h184","date":"2026-05-23","rpm":3.36,"rate":1600.0,"miles":476,"broker":"TQL","driver":"Jeremy","unit":"5","pay":null,"fuel":465.0,"repair":250.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h185","date":"2026-05-25","rpm":2.69,"rate":2697.0,"miles":1000,"broker":"Circle Logistics","driver":"TJ","unit":"3","pay":null,"fuel":792.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h186","date":"2026-05-25","rpm":3.65,"rate":1800.0,"miles":493,"broker":"MegaCorp","driver":"Jeremy","unit":"5","pay":200.0,"fuel":465.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h187","date":"2026-05-26","rpm":2.71,"rate":1700.0,"miles":627,"broker":"Armstrong Transport","driver":"TJ","unit":"3","pay":null,"fuel":638.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h188","date":"2026-05-26","rpm":2.91,"rate":1700.0,"miles":584,"broker":"BBI Logistics","driver":"Jeremy","unit":"5","pay":450.0,"fuel":364.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h189","date":"2026-05-27","rpm":3.96,"rate":2500.0,"miles":620,"broker":"Longship","driver":"Jeremy","unit":"5","pay":540.0,"fuel":467.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h190","date":"2026-05-27","rpm":2.29,"rate":1500.0,"miles":655,"broker":"Freight Management","driver":"TJ","unit":"3","pay":null,"fuel":260.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h191","date":"2026-05-28","rpm":3.03,"rate":2000.0,"miles":660,"broker":"Armstrong Transport","driver":"TJ","unit":"3","pay":1760.0,"fuel":780.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h192","date":"2026-05-29","rpm":2.38,"rate":2300.0,"miles":964,"broker":"Pam Transport","driver":"John","unit":"","pay":570.0,"fuel":200.0,"repair":null,"dispatch":850.0,"dh":null,"status":"Delivered"},{"id":"h193","date":"2026-05-29","rpm":3.26,"rate":2000.0,"miles":612,"broker":"Armstrong Transport","driver":"Jeremy","unit":"5","pay":735.0,"fuel":367.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h194","date":"2026-05-30","rpm":3.72,"rate":1980.0,"miles":532,"broker":"Steam Logistics","driver":"TJ","unit":"3","pay":null,"fuel":426.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h195","date":"2026-05-31","rpm":3.43,"rate":2400.0,"miles":698,"broker":"Armstrong Transport","driver":"TJ","unit":"3","pay":738.0,"fuel":715.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h196","date":"2026-06-01","rpm":2.96,"rate":2000.0,"miles":675,"broker":"Central Freight","driver":"Jeremy","unit":"5","pay":410.0,"fuel":715.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h197","date":"2026-06-01","rpm":4.42,"rate":2500.0,"miles":565,"broker":"TQL","driver":"John","unit":"","pay":null,"fuel":400.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h198","date":"2026-06-02","rpm":2.77,"rate":1000.0,"miles":360,"broker":"PVG Brokerage","driver":"John","unit":"","pay":555.0,"fuel":900.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h199","date":"2026-06-02","rpm":null,"rate":2400.0,"miles":null,"broker":"Armstrong Transport","driver":"Jeremy","unit":"5","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h200","date":"2026-06-03","rpm":7.04,"rate":2600.0,"miles":710,"broker":"Central Freight","driver":"Jeremy","unit":"5","pay":450.0,"fuel":980.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h201","date":"2026-06-04","rpm":3.44,"rate":2100.0,"miles":610,"broker":"Online Freight","driver":"TJ","unit":"3","pay":null,"fuel":500.0,"repair":null,"dispatch":900.0,"dh":null,"status":"Delivered"},{"id":"h202","date":"2026-06-06","rpm":3.42,"rate":2400.0,"miles":700,"broker":"Armstrong Transport","driver":"TJ","unit":"3","pay":810.0,"fuel":348.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h203","date":"2026-06-09","rpm":2.66,"rate":2050.0,"miles":770,"broker":"Integrity Logistics","driver":"TJ","unit":"3","pay":null,"fuel":740.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h204","date":"2026-06-11","rpm":2.3,"rate":1500.0,"miles":650,"broker":"TQL","driver":"TJ","unit":"3","pay":852.0,"fuel":651.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h205","date":"2026-06-11","rpm":2.7,"rate":1000.0,"miles":370,"broker":"TQL","driver":"Jeremy","unit":"5","pay":250.0,"fuel":470.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h206","date":"2026-06-12","rpm":3.24,"rate":1200.0,"miles":380,"broker":"Spot Freight","driver":"Jeremy","unit":"5","pay":260.0,"fuel":455.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h207","date":"2026-06-12","rpm":3.09,"rate":1500.0,"miles":484,"broker":"Armstrong Transport","driver":"TJ","unit":"3","pay":null,"fuel":372.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h208","date":"2026-06-13","rpm":2.72,"rate":1700.0,"miles":623,"broker":"TQL","driver":"Jeremy","unit":"5","pay":380.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h209","date":"2026-06-13","rpm":3.26,"rate":1500.0,"miles":460,"broker":"TQL","driver":"TJ","unit":"3","pay":567.0,"fuel":210.0,"repair":null,"dispatch":450.0,"dh":null,"status":"Delivered"},{"id":"h210","date":"2026-06-15","rpm":2.4,"rate":1800.0,"miles":750,"broker":"TAB","driver":"Jeremy","unit":"5","pay":475.0,"fuel":544.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h211","date":"2026-06-16","rpm":2.88,"rate":1875.0,"miles":650,"broker":"Around The Clock","driver":"TJ","unit":"4","pay":null,"fuel":700.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h212","date":"2026-06-16","rpm":3.75,"rate":1800.0,"miles":480,"broker":"Armstrong Transport","driver":"Jeremy","unit":"5","pay":295.0,"fuel":420.91,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h213","date":"2026-06-17","rpm":3.35,"rate":1850.0,"miles":552,"broker":"SPI Logistics","driver":"Jeremy","unit":"5","pay":330.0,"fuel":620.0,"repair":895.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h214","date":"2026-06-17","rpm":2.0,"rate":1300.0,"miles":650,"broker":"Armstrong Transport","driver":"TJ","unit":"4","pay":130.0,"fuel":130.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h215","date":"2026-06-19","rpm":null,"rate":1500.0,"miles":500,"broker":"TQL","driver":"TJ","unit":"4","pay":null,"fuel":750.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"}]
```

### `backend/src/auth.ts`

```ts
import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

// Team password. Override in production with BOARD_PASSWORD env var; defaults to "loaded".
const PASSWORD = process.env.BOARD_PASSWORD || "loaded";
// Secret used to sign the session token. Set AUTH_SECRET in production.
const SECRET = process.env.AUTH_SECRET || "change-me-in-production";

// Deterministic token for the shared password. The same password always yields the
// same token, so a logged-in browser keeps working across restarts.
export function tokenForPassword(pw: string): string {
  return crypto.createHmac("sha256", SECRET).update("board:" + pw).digest("hex");
}
const VALID_TOKEN = tokenForPassword(PASSWORD);

export function checkPassword(pw: string): boolean {
  // constant-time compare
  const a = Buffer.from(tokenForPassword(pw));
  const b = Buffer.from(VALID_TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function issueToken(): string {
  return VALID_TOKEN;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (token && token === VALID_TOKEN) return next();
  return res.status(401).json({ error: "Unauthorized" });
}
```

### `backend/src/db.ts`

```ts
import pg from "pg";

const { Pool } = pg;

// Postgres `numeric` (type OID 1700) is returned as a STRING by node-pg to preserve
// arbitrary precision. The board does math on these columns (rpm.toFixed, rate-pay-...),
// and calling .toFixed() on a string throws — which blanks the whole UI. Parse numerics
// as JS floats so rate/rpm/pay/fuel/dispatch/repair arrive as numbers, like the board expects.
pg.types.setTypeParser(1700, (v) => (v == null ? null : parseFloat(v)));

// Neon requires SSL. The DATABASE_URL from Neon already includes ?sslmode=require,
// but we set ssl here too so it works regardless of how the URL is pasted.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

export async function q(text: string, params: any[] = []) {
  const res = await pool.query(text, params);
  return res.rows;
}
```

### `backend/src/extract.ts`

```ts
// Shared AI extraction for Loaded Logistics.
//
// ONE Anthropic call, used by BOTH:
//   - the Rate Cons tab (HTTP POST /api/ai/extract), and
//   - the Phase 2 Gmail worker (src/ingest.ts)
// so the parser that reads a pasted rate con is byte-for-byte the same one that
// reads rate cons out of your inbox. Handles plain email text AND attached PDFs.

const MODEL = "claude-sonnet-4-6";

export interface PdfAttachment {
  filename: string;
  data: string; // standard base64 (not base64url)
}

export interface ExtractedLoad {
  is_rate_con: boolean;
  confidence: number; // 0..1
  broker: string | null;
  rate: number | null; // total linehaul, USD
  miles: number | null;
  origin: string | null; // "City, ST"
  dest: string | null; // "City, ST"
  pickup_date: string | null; // YYYY-MM-DD
  ref: string | null; // load / PO / pro number
  commodity: string | null;
  notes: string | null;
}

const SYSTEM =
  "You extract one freight truckload from a broker email and/or an attached rate confirmation PDF. " +
  "Respond ONLY with a single JSON object — no prose, no code fences. Keys: " +
  "is_rate_con (boolean: true ONLY if this is a real rate confirmation / load tender / carrier confirmation for a booked truckload — " +
  "false for quote requests, load-board blasts, invoices, factoring notices, newsletters, or anything you cannot confirm is a booked load), " +
  "confidence (number 0..1: your confidence it is a rate con AND the figures are right), " +
  "broker (string or null), rate (number — total linehaul in USD, digits only, no $ or commas, or null), " +
  "miles (number or null), origin (string 'City, ST' or null), dest (string 'City, ST' or null), " +
  "pickup_date (YYYY-MM-DD or null), ref (load/PO/pro number or null), commodity (string or null), notes (string or null). " +
  "Use null when unknown. Never invent numbers — only report a rate or mileage you can actually see.";

async function callAnthropic(content: any[], maxTokens = 800): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: SYSTEM,
      messages: [{ role: "user", content }],
    }),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error("Anthropic error " + r.status + (detail ? " " + detail.slice(0, 200) : ""));
  }
  const data: any = await r.json();
  return (data.content || []).map((c: any) => (c.type === "text" ? c.text : "")).join("\n");
}

function coerceNum(v: any): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseJSON(text: string): any {
  let t = (text || "").trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a >= 0 && b >= 0) t = t.slice(a, b + 1);
  return JSON.parse(t);
}

export async function extractLoad(input: { text?: string; pdfs?: PdfAttachment[] }): Promise<ExtractedLoad> {
  const content: any[] = [];
  const text = (input.text || "").trim();
  content.push({ type: "text", text: text || "(no email body — read the attached rate confirmation PDF)" });
  for (const p of input.pdfs || []) {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: p.data },
    });
  }

  const raw = await callAnthropic(content, 800);
  const j = parseJSON(raw);
  return {
    is_rate_con: !!j.is_rate_con,
    confidence: coerceNum(j.confidence) ?? 0,
    broker: j.broker ?? null,
    rate: coerceNum(j.rate),
    miles: coerceNum(j.miles),
    origin: j.origin ?? null,
    dest: j.dest ?? null,
    pickup_date: j.pickup_date ?? null,
    ref: j.ref != null ? String(j.ref) : null,
    commodity: j.commodity ?? null,
    notes: j.notes ?? null,
  };
}
```

### `backend/src/gmail.ts`

```ts
// Gmail read-only client for the Phase 2 ingest worker.
//
// Talks to the Gmail REST API directly with fetch (no SDK) — the backend already
// uses fetch for Anthropic, so there are no extra dependencies to install. Each
// inbox is accessed with its own refresh token (scope: gmail.readonly — it can
// read, never send or modify). Finds rate-con-looking emails, pulls the body
// text, and downloads any PDF attachments as base64 for the shared extractor.

export interface MailAccount {
  email: string;
  refreshToken: string;
}

export interface PdfPart {
  filename: string;
  data: string; // standard base64
}

export interface FetchedMessage {
  gmailId: string;
  mailbox: string;
  from: string;
  subject: string;
  receivedAt: Date;
  bodyText: string;
  pdfs: PdfPart[];
}

/** Parse GMAIL_ACCOUNTS (a JSON array of {email, refreshToken}) from the env. */
export function getAccounts(): MailAccount[] {
  const raw = process.env.GMAIL_ACCOUNTS;
  if (!raw) return [];
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("GMAIL_ACCOUNTS is not valid JSON — ignoring.");
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((a) => a && a.email && a.refreshToken)
    .map((a) => ({ email: String(a.email), refreshToken: String(a.refreshToken) }));
}

/** True when the Google app credentials AND at least one mailbox are present. */
export function ingestConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && getAccounts().length);
}

/* ----------------------------- OAuth tokens ------------------------------ */
// Short-lived access tokens are cached per refresh token until ~1 min before expiry.
const tokenCache = new Map<string, { access: string; exp: number }>();

export async function accessTokenFor(refreshToken: string): Promise<string> {
  const cached = tokenCache.get(refreshToken);
  if (cached && cached.exp > Date.now() + 60000) return cached.access;

  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) {
    const d = await r.text().catch(() => "");
    throw new Error("token refresh failed " + r.status + (d ? " " + d.slice(0, 200) : ""));
  }
  const d: any = await r.json();
  const access = d.access_token as string;
  const exp = Date.now() + (d.expires_in ? d.expires_in * 1000 : 3600000);
  tokenCache.set(refreshToken, { access, exp });
  return access;
}

async function gmailGet(account: MailAccount, path: string, params?: Record<string, string>): Promise<any> {
  const token = await accessTokenFor(account.refreshToken);
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/" + path);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);
  const r = await fetch(url.toString(), { headers: { Authorization: "Bearer " + token } });
  if (!r.ok) {
    const d = await r.text().catch(() => "");
    throw new Error("gmail " + path + " " + r.status + (d ? " " + d.slice(0, 200) : ""));
  }
  return r.json();
}

// Recent emails that read like a rate confirmation. Override with GMAIL_QUERY.
// The AI still confirms is_rate_con on every candidate, so this can be loose.
export function searchQuery(): string {
  return (
    process.env.GMAIL_QUERY ||
    'newer_than:3d ("rate confirmation" OR "rate con" OR "load confirmation" OR "carrier confirmation" OR "load tender" OR "rate and load confirmation")'
  );
}

export async function listCandidateIds(a: MailAccount, max = 25): Promise<string[]> {
  const data = await gmailGet(a, "messages", { q: searchQuery(), maxResults: String(max) });
  return (data.messages || []).map((m: any) => m.id).filter(Boolean);
}

/* --------------------------- message parsing ----------------------------- */
export function b64urlToBuf(data: string): Buffer {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function header(headers: any[], name: string): string {
  const h = (headers || []).find((x) => (x.name || "").toLowerCase() === name.toLowerCase());
  return h?.value || "";
}

// Walk the MIME tree, collecting plain text, html, and PDF attachment refs.
export function walk(
  part: any,
  acc: { texts: string[]; htmls: string[]; pdfs: { filename: string; attachmentId: string }[] }
) {
  if (!part) return;
  const mime = part.mimeType || "";
  const filename = part.filename || "";
  if (mime === "text/plain" && part.body?.data) acc.texts.push(b64urlToBuf(part.body.data).toString("utf8"));
  else if (mime === "text/html" && part.body?.data) acc.htmls.push(b64urlToBuf(part.body.data).toString("utf8"));
  if ((mime === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) && part.body?.attachmentId) {
    acc.pdfs.push({ filename: filename || "rate-con.pdf", attachmentId: part.body.attachmentId });
  }
  for (const p of part.parts || []) walk(p, acc);
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchMessage(a: MailAccount, gmailId: string): Promise<FetchedMessage> {
  const msg: any = await gmailGet(a, "messages/" + gmailId, { format: "full" });
  const headers = msg.payload?.headers || [];

  const acc = { texts: [] as string[], htmls: [] as string[], pdfs: [] as { filename: string; attachmentId: string }[] };
  walk(msg.payload, acc);

  let bodyText = acc.texts.join("\n").trim();
  if (!bodyText && acc.htmls.length) bodyText = stripHtml(acc.htmls.join("\n"));
  if (!bodyText && msg.snippet) bodyText = msg.snippet;
  if (bodyText.length > 12000) bodyText = bodyText.slice(0, 12000);

  // Download up to 3 PDFs (rate cons are tiny; this just caps pathological cases).
  const pdfs: PdfPart[] = [];
  for (const p of acc.pdfs.slice(0, 3)) {
    try {
      const at = await gmailGet(a, `messages/${gmailId}/attachments/${p.attachmentId}`);
      if (at.data) pdfs.push({ filename: p.filename, data: b64urlToBuf(at.data).toString("base64") });
    } catch {
      /* skip an unreadable attachment rather than failing the whole message */
    }
  }

  const dateMs = msg.internalDate ? parseInt(msg.internalDate, 10) : Date.now();
  return {
    gmailId,
    mailbox: a.email,
    from: header(headers, "From"),
    subject: header(headers, "Subject"),
    receivedAt: new Date(dateMs),
    bodyText,
    pdfs,
  };
}
```

### `backend/src/google-auth.ts`

```ts
// One-time helper to connect a Gmail inbox (READ-ONLY) and print its refresh token.
//
// Run once per inbox:   npm run gmail-auth
// It opens a local listener, you approve access in the browser as that inbox,
// and it prints the GMAIL_ACCOUNTS entry to paste into Railway. Nothing is sent
// or modified — the only scope requested is gmail.readonly. No SDK, just fetch.

import http from "http";

// Convenience for the one-time local run: load ./.env if present (Node 20.12+/21.7+).
// Falls back silently to inline env vars on older Node or when no .env exists.
try { (process as any).loadEnvFile?.(); } catch { /* no .env — that's fine */ }

const PORT = parseInt(process.env.OAUTH_PORT || "5566", 10);
const REDIRECT = `http://127.0.0.1:${PORT}`;
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("\n✗ Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first (see PHASE2-SETUP.md, Step 3).\n");
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
  }).toString();

async function exchangeCode(code: string): Promise<any> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!r.ok) throw new Error("token exchange failed " + r.status + " " + (await r.text().catch(() => "")));
  return r.json();
}

async function getEmail(accessToken: string): Promise<string> {
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: "Bearer " + accessToken },
  });
  if (!r.ok) return "unknown";
  const d: any = await r.json();
  return d.emailAddress || "unknown";
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url || "", REDIRECT);
    const code = u.searchParams.get("code");
    if (!code) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Waiting for the Google redirect…");
      return;
    }

    const tokens = await exchangeCode(code);
    const email = await getEmail(tokens.access_token);
    const refresh = tokens.refresh_token;

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<h2>&#10003; Connected ${email}</h2><p>Token captured. You can close this tab and return to the terminal.</p>`);

    console.log("\n──────────────────────────────────────────────");
    if (!refresh) {
      console.log("✗ Google did not return a refresh token.");
      console.log("  Remove this app at https://myaccount.google.com/permissions and run again.");
    } else {
      console.log(`✓ Connected: ${email}\n`);
      console.log("Add this object to GMAIL_ACCOUNTS (one per inbox):\n");
      console.log("  " + JSON.stringify({ email, refreshToken: refresh }));
      console.log("\nFull value once you have BOTH inboxes:");
      console.log(`  GMAIL_ACCOUNTS=[{"email":"${email}","refreshToken":"${refresh}"},{"email":"second@gmail.com","refreshToken":"PASTE_SECOND"}]`);
    }
    console.log("──────────────────────────────────────────────\n");

    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 500);
  } catch (e: any) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Error: " + e.message);
    console.error("\nAuth failed:", e.message);
    setTimeout(() => process.exit(1), 500);
  }
});

server.listen(PORT, () => {
  console.log("\nLoaded Logistics — connect a Gmail inbox (read-only)\n");
  console.log("1) Make sure you are signed in to the inbox you want
```

### `backend/src/index.ts`

```ts
import express from "express";
import cors from "cors";
import { q } from "./db.js";
import { checkPassword, issueToken, requireAuth } from "./auth.js";
import { extractLoad } from "./extract.js";
import { runIngestOnce, getIngestStatus, startPolling } from "./ingest.js";

const app = express();
app.use(cors());                 // board is a separate origin; allow it
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 8080;

/* ----------------------------- health + auth ----------------------------- */
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/login", (req, res) => {
  const { password } = req.body || {};
  if (typeof password === "string" && checkPassword(password)) {
    return res.json({ token: issueToken() });
  }
  return res.status(401).json({ error: "Wrong password" });
});

/* ------------------------------- loads ----------------------------------- */
const LOAD_COLS = [
  "date","broker","rate","miles","rpm","origin","dest","driver","unit",
  "pay","fuel","dispatch","repair","dh","ref","commodity","status","source","source_email_id",
];

app.get("/api/loads", requireAuth, async (_req, res) => {
  const rows = await q(
    `select id, to_char(date,'YYYY-MM-DD') as date, broker, rate, miles, rpm,
            origin, dest, driver, unit, pay, fuel, dispatch, repair, dh, ref, commodity, status, source
     from loads order by created_at desc`
  );
  res.json(rows);
});

app.post("/api/loads", requireAuth, async (req, res) => {
  const b = req.body || {};
  const cols: string[] = [];
  const vals: any[] = [];
  const ph: string[] = [];
  for (const c of LOAD_COLS) {
    if (b[c] !== undefined) {
      cols.push(c);
      vals.push(b[c] === "" ? null : b[c]);
      ph.push("$" + vals.length);
    }
  }
  if (!cols.length) return res.status(400).json({ error: "No fields" });
  const rows = await q(
    `insert into loads (${cols.join(",")}) values (${ph.join(",")})
     returning id, to_char(date,'YYYY-MM-DD') as date, broker, rate, miles, rpm,
               origin, dest, driver, unit, pay, fuel, dispatch, repair, dh, ref, commodity, status, source`,
    vals
  );
  res.json(rows[0]);
});

app.patch("/api/loads/:id", requireAuth, async (req, res) => {
  const b = req.body || {};
  const sets: string[] = [];
  const vals: any[] = [];
  for (const c of LOAD_COLS) {
    if (b[c] !== undefined) {
      vals.push(b[c] === "" ? null : b[c]);
      sets.push(`${c} = $${vals.length}`);
    }
  }
  if (!sets.length) return res.status(400).json({ error: "No fields" });
  sets.push(`updated_at = now()`);
  vals.push(req.params.id);
  const rows = await q(
    `update loads set ${sets.join(",")} where id = $${vals.length}
     returning id, to_char(date,'YYYY-MM-DD') as date, broker, rate, miles, rpm,
               origin, dest, driver, unit, pay, fuel, dispatch, repair, dh, ref, commodity, status, source`,
    vals
  );
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

app.delete("/api/loads/:id", requireAuth, async (req, res) => {
  await q(`delete from loads where id = $1`, [req.params.id]);
  res.json({ ok: true });
});

/* ----------------------------- team messages ----------------------------- */
app.get("/api/messages", requireAuth, async (_req, res) => {
  const rows = await q(
    `select id, who, body, tag, extract(epoch from ts)*1000 as ts
     from messages order by ts asc limit 300`
  );
  res.json(rows);
});

app.post("/api/messages", requireAuth, async (req, res) => {
  const { who, body, tag } = req.body || {};
  if (!body) return res.status(400).json({ error: "Empty message" });
  const rows = await q(
    `insert into messages (who, body, tag) values ($1,$2,$3)
     returning id, who, body, tag, extract(epoch from ts)*1000 as ts`,
    [who || "Dispatch", body, tag || null]
  );
  res.json(rows[0]);
});

/* ------------------------------- AI proxy -------------------------------- */
// Keeps your Anthropic key on the server. Used by Rate Cons extraction + Copilot.
async function callAnthropic(messages: any[], system: string, maxTokens = 1200) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, system, messages }),
  });
  if (!r.ok) throw new Error("Anthropic error " + r.status);
  const data: any = await r.json();
  return (data.content || []).map((c: any) => (c.type === "text" ? c.text : "")).join("\n");
}

app.post("/api/ai/extract", requireAuth, async (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: "No text" });
  try {
    // Shared extractor — the SAME parser the Phase 2 Gmail worker uses.
    const load = await extractLoad({ text });
    // The board posts text and parses { text: "<json>" } back (board/src/api.ts).
    res.json({ text: JSON.stringify(load) });
  } catch (e: any) {
    res.status(503).json({ error: e.message });
  }
});

/* --------------------------- Phase 2: email ingest ------------------------ */
// Manually trigger one sweep of the inboxes (also runs automatically on a timer).
app.post("/api/ingest/run", requireAuth, async (_req, res) => {
  try {
    const result = await runIngestOnce();
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Health/inspection for the email worker: enabled? configured? last run?
app.get("/api/ingest/status", requireAuth, (_req, res) => {
  res.json(getIngestStatus());
});

app.post("/api/ai/copilot", requireAuth, async (req, res) => {
  const { messages, context } = req.body || {};
  const sys =
    "You are a sharp truckload dispatch copilot for a small carrier. Be concise and decisive, use the data given. " +
    "RPM under $1.80 is thin, $1.80-2.49 is ok, $2.50+ is strong. When pairing loads to drivers, prefer the driver " +
    "whose recent brokers/lanes match. Current board state JSON: " + JSON.stringify(context || {});
  try {
    const out = await callAnthropic(messages || [], sys, 900);
    res.json({ text: out });
  } catch (e: any) {
    res.status(503).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Loaded Logistics API listening on :${PORT}`);
  // Phase 2: start the Gmail rate-con poller only when explicitly enabled AND configured.
  const ingest = getIngestStatus();
  if (ingest.enabled && ingest.configured) {
    startPolling();
  } else if (ingest.enabled && !ingest.configured) {
    console.log("Gmail ingest is enabled but not configured (set GOOGLE_CLIENT_ID/SECRET + GMAIL_ACCOUNTS).");
  }
});
```

### `backend/src/ingest.ts`

```ts
// Phase 2 — Gmail rate-con ingest worker.
//
// Polls every configured inbox, dedupes against the `emails` table (gmail_id is
// unique), runs each new candidate through the shared extractor, and — when it's
// a confident rate con — drops the load straight onto the board (source='email')
// and posts a note in Team chat. Every email it looks at is recorded so it is
// never reprocessed.

import { fileURLToPath } from "url";
import { q, pool } from "./db.js";
import { getAccounts, listCandidateIds, fetchMessage, ingestConfigured, type FetchedMessage } from "./gmail.js";
import { extractLoad, type ExtractedLoad } from "./extract.js";

const MIN_CONFIDENCE = parseFloat(process.env.GMAIL_MIN_CONFIDENCE || "0.6");

export interface IngestResult {
  ok: boolean;
  scanned: number; // candidate ids seen across all mailboxes
  fetched: number; // new messages actually fetched
  loadsAdded: number;
  skipped: number; // fetched but not a confident rate con
  errors: number;
  details: string[];
  ranAt: string;
}

let lastResult: IngestResult | null = null;
let lastRunAt: string | null = null;
let running = false;
let timer: ReturnType<typeof setInterval> | null = null;

export function getIngestStatus() {
  return {
    enabled: process.env.GMAIL_INGEST_ENABLED === "true",
    configured: ingestConfigured(),
    accounts: getAccounts().map((a) => a.email),
    minConfidence: MIN_CONFIDENCE,
    pollSeconds: Math.max(20, Math.round(parseInt(process.env.GMAIL_POLL_MS || "60000", 10) / 1000)),
    running,
    lastRunAt,
    lastResult,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function runIngestOnce(): Promise<IngestResult> {
  const result: IngestResult = {
    ok: true,
    scanned: 0,
    fetched: 0,
    loadsAdded: 0,
    skipped: 0,
    errors: 0,
    details: [],
    ranAt: new Date().toISOString(),
  };

  if (running) {
    result.ok = false;
    result.details.push("A run is already in progress.");
    return result;
  }
  running = true;

  try {
    const accounts = getAccounts();
    if (!accounts.length) {
      result.ok = false;
      result.details.push("No GMAIL_ACCOUNTS configured.");
      return result;
    }

    for (const account of accounts) {
      let ids: string[];
      try {
        ids = await listCandidateIds(account);
      } catch (e: any) {
        result.errors++;
        result.details.push(`[${account.email}] list failed: ${e.message}`);
        continue;
      }
      result.scanned += ids.length;
      if (!ids.length) continue;

      // Skip anything we've already recorded.
      const seen = await q(`select gmail_id from emails where gmail_id = any($1)`, [ids]);
      const seenSet = new Set(seen.map((r: any) => r.gmail_id));
      const newIds = ids.filter((id) => !seenSet.has(id));

      for (const id of newIds) {
        try {
          const msg = await fetchMessage(account, id);
          result.fetched++;

          let extracted: ExtractedLoad;
          try {
            extracted = await extractLoad({
              text: `Subject: ${msg.subject}\nFrom: ${msg.from}\n\n${msg.bodyText}`,
              pdfs: msg.pdfs,
            });
          } catch (e: any) {
            // Record it (with the error) so we don't retry it forever.
            await recordEmail(msg, null, null, e.message);
            result.errors++;
            result.details.push(`[${account.email}] extract failed "${msg.subject}": ${e.message}`);
            continue;
          }

          const qualifies = extracted.is_rate_con && (extracted.confidence ?? 0) >= MIN_CONFIDENCE;
          const emailId = await recordEmail(msg, extracted.is_rate_con, extracted.confidence, null);
          if (!emailId) continue; // a concurrent run already inserted it

          if (qualifies) {
            const loadId = await insertLoad(extracted, emailId);
            await q(`update emails set parsed_load_id = $1 where id = $2`, [loadId, emailId]);
            await postTeamNote(extracted, loadId);
            result.loadsAdded++;
            result.details.push(
              `[${account.email}] added: ${extracted.broker || "Unknown"} ${extracted.origin || "?"}→${extracted.dest || "?"} $${extracted.rate ?? "?"}`
            );
          } else {
            result.skipped++;
          }
        } catch (e: any) {
          result.errors++;
          result.details.push(`[${account.email}] ${id}: ${e.message}`);
        }
      }
    }
  } finally {
    running = false;
    lastResult = result;
    lastRunAt = result.ranAt;
  }
  return result;
}

async function recordEmail(
  msg: FetchedMessage,
  isRateCon: boolean | null,
  confidence: number | null,
  error: string | null
): Promise<string | null> {
  const rows = await q(
    `insert into emails
       (mailbox, gmail_id, from_addr, subject, received_at, is_rate_con, confidence, raw_excerpt, attachment_count, processed_at, error)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9, now(), $10)
     on conflict (gmail_id) do nothing
     returning id`,
    [
      msg.mailbox,
      msg.gmailId,
      msg.from,
      msg.subject,
      msg.receivedAt,
      isRateCon,
      confidence,
      (msg.bodyText || "").slice(0, 1000),
      (msg.pdfs || []).length,
      error,
    ]
  );
  return rows[0]?.id || null;
}

async function insertLoad(x: ExtractedLoad, emailId: string): Promise<string> {
  const rpm = x.rate && x.miles ? round2(x.rate / x.miles) : null;
  const rows = await q(
    `insert into loads (date, broker, rate, miles, rpm, origin, dest, ref, commodity, status, source, source_email_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Available','email',$10)
     returning id`,
    [x.pickup_date || null, x.broker || "Unknown broker", x.rate, x.miles, rpm, x.origin, x.dest, x.ref, x.commodity, emailId]
  );
  return rows[0].id;
}

async function postTeamNote(x: ExtractedLoad, loadId: string) {
  const rpm = x.rate && x.miles ? (x.rate / x.miles).toFixed(2) : null;
  const lane = [x.origin, x.dest].filter(Boolean).join(" → ") || "lane TBD";
  const bits = [
    `📩 Auto-added from email: ${x.broker || "Unknown broker"}`,
    lane,
    x.rate != null ? `$${Number(x.rate).toLocaleString()}` : null,
    rpm ? `${rpm}/mi` : null,
    x.ref ? `ref ${x.ref}` : null,
  ].filter(Boolean);
  try {
    await q(`insert into messages (who, body, tag) values ($1,$2,$3)`, ["Inbox", bits.join(" · "), loadId]);
  } catch {
    /* a missing chat note is non-fatal */
  }
}

/** Start the background poller (called from index.ts when ingest is enabled). */
export function startPolling() {
  if (timer) return;
  const everyMs = Math.max(20000, parseInt(process.env.GMAIL_POLL_MS || "60000", 10));
  console.log(`Gmail ingest: polling every ${Math.round(everyMs / 1000)}s across ${getAccounts().length} mailbox(es).`);
  const tick = () =>
    runIngestOnce()
      .then((r) => {
        if (r.loadsAdded || r.errors) {
          console.log(`Gmail ingest: +${r.loadsAdded} load(s), ${r.errors} error(s) (scanned ${r.scanned}).`);
        }
      })
      .catch((e) => console.error("Gmail ingest tick failed:", e.message));
  setTimeout(tick, 8000); // first sweep shortly after boot
  timer = setInterval(tick, everyMs);
}

// `npm run ingest` — run one sweep from the command line, then exit.
const isMain = process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  try { (process as any).loadEnvFile?.(); } catch { /* no .env — use inline/platform env */ }
  runIngestOnce()
    .then(async (r) => {
      console.log(JSON.stringify(r, null, 2));
      await pool.end();
      process.exit(r.ok ? 0 : 1);
    })
    .catch(async (e) => {
   
```

### `backend/src/schema.sql`

```sql
-- Loaded Logistics — Phase 1 schema
-- Safe to run repeatedly.

create extension if not exists "pgcrypto";

create table if not exists loads (
  id              uuid primary key default gen_random_uuid(),
  date            date,
  broker          text,
  rate            numeric,
  miles           integer,
  rpm             numeric,                 -- stored as-given when present; else computed in app
  origin          text,
  dest            text,
  driver          text,
  unit            text,
  pay             numeric,
  fuel            numeric,
  dispatch        numeric,
  repair          numeric,
  dh              integer,
  ref             text,
  commodity       text,
  status          text not null default 'Available',
  source          text not null default 'manual',   -- 'manual' | 'email'
  source_email_id text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists loads_broker_idx on loads (broker);
create index if not exists loads_origin_idx on loads (origin);
create index if not exists loads_date_idx   on loads (date);
create index if not exists loads_status_idx on loads (status);

-- expense columns (idempotent for already-deployed databases)
alter table loads add column if not exists dispatch numeric;
alter table loads add column if not exists repair numeric;
alter table loads add column if not exists dh integer;

create table if not exists messages (
  id        uuid primary key default gen_random_uuid(),
  who       text not null default 'Dispatch',
  body      text not null,
  tag       uuid,                          -- optional load id this message is about
  ts        timestamptz not null default now()
);
create index if not exists messages_ts_idx on messages (ts);

-- Phase 2/3 placeholders (created now so the email service has a home later)
create table if not exists emails (
  id             uuid primary key default gen_random_uuid(),
  mailbox        text,
  gmail_id       text unique,
  from_addr      text,
  subject        text,
  received_at    timestamptz,
  is_rate_con    boolean,
  parsed_load_id uuid references loads(id),
  raw_excerpt    text,
  created_at     timestamptz not null default now()
);

-- Phase 2 ingest columns (idempotent for already-deployed databases)
alter table emails add column if not exists confidence       numeric;
alter table emails add column if not exists attachment_count integer default 0;
alter table emails add column if not exists processed_at      timestamptz;
alter table emails add column if not exists error             text;
create index if not exists emails_received_idx     on emails (received_at);
create index if not exists loads_source_email_idx  on loads (source_email_id);

create table if not exists digests (
  id           uuid primary key default gen_random_uuid(),
  for_date     date unique,
  summary_md   text,
  metrics_json jsonb,
  created_at   timestamptz not null default now()
);
```

### `backend/src/seed.ts`

```ts
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { pool, q } from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const force = process.argv.includes("--force");

  // 1) apply schema
  const schema = readFileSync(join(__dirname, "schema.sql"), "utf8");
  await pool.query(schema);
  console.log("✓ schema applied");

  // 2) seed loads (skip if already populated, unless --force)
  const existing = await q("select count(*)::int as n from loads");
  if (existing[0].n > 0 && !force) {
    console.log(`• loads table already has ${existing[0].n} rows — skipping seed (use --force to reseed)`);
    await pool.end();
    return;
  }
  if (force) {
    await q("delete from loads where source = 'manual'");
    console.log("• --force: cleared existing manual loads");
  }

  const seed: any[] = JSON.parse(readFileSync(join(__dirname, "..", "seed-data.json"), "utf8"));
  let n = 0;
  for (const l of seed) {
    await q(
      `insert into loads (date, broker, rate, miles, rpm, driver, unit, pay, fuel, dispatch, repair, dh, status, source)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'manual')`,
      [
        l.date || null, l.broker || null, l.rate, l.miles, l.rpm,
        l.driver || null, l.unit || null, l.pay, l.fuel,
        l.dispatch ?? null, l.repair ?? null, l.dh ?? null,
        l.status || "Delivered",
      ]
    );
    n++;
  }
  console.log(`✓ seeded ${n} historical loads`);
  await pool.end();
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
```

### `backend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": false,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "resolveJsonModule": true,
    "allowImportingTsExtensions": false
  },
  "include": ["src"]
}
```

### `board/.env.example`

```
# URL of your deployed backend API on Railway. No trailing slash.
# Find it in Railway → backend service → Settings → Networking → Public Domain.
# Example: https://loaded-logistics-backend-production.up.railway.app
VITE_API_URL=
```

### `board/.gitignore`

```
node_modules
dist
.env
*.log
```

### `board/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Loaded Logistics — Dispatch</title>
    <!-- Tailwind utilities used by the board. For a fully self-hosted build you can
         swap this for compiled Tailwind; the Play CDN is fine for an internal tool. -->
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      html, body, #root { height: 100%; }
      body { margin: 0; background: #0E1116; }
      *:focus-visible { outline: 2px solid #F2A413; outline-offset: 1px; }
      ::selection { background: #F2A41355; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### `board/package.json`

```json
{
  "name": "loaded-logistics-board",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "start": "vite preview",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.0",
    "vite": "^5.3.0"
  }
}
```

### `board/src/App.tsx`

```tsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import * as api from "./api";

/* ============================ DATA ============================ */
const SEED: any[] = [];

/* ============================ TOKENS ============================ */
const C = {
  bg:"#0E1116", panel:"#161B22", panel2:"#1C222B", raised:"#222933",
  line:"#2A323D", lineSoft:"#222932",
  ink:"#E9ECF1", dim:"#8B95A3", faint:"#5E6675",
  amber:"#F2A413", amberHi:"#FFB740",
  green:"#36D399", greenDim:"#1f6b50",
  red:"#F0594C", redDim:"#6b2722",
  blue:"#4DA3FF", purple:"#A78BFA",
};
const LANES = ["Available","Assigned","In Transit","Delivered"];
const DRIVER_ORDER = ["TJ","John","Chris","Jeremy","Derek"];
const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const sans = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/* ============================ HELPERS ============================ */
const fmt0 = n => (n==null||isNaN(n)) ? "—" : Math.round(n).toLocaleString();
const money = n => (n==null||isNaN(n)) ? "—" : "$"+Math.round(n).toLocaleString();
const money1 = n => (n==null||isNaN(n)) ? "—" : "$"+Number(n).toFixed(2);
const uid = () => "l"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const todayISO = () => new Date().toISOString().slice(0,10);

function rpmColor(rpm){
  if(rpm==null||isNaN(rpm)) return C.faint;
  if(rpm>=2.5) return C.green;
  if(rpm>=1.8) return C.amber;
  return C.red;
}
function rpmLabel(rpm){
  if(rpm==null||isNaN(rpm)) return "no rpm";
  if(rpm>=2.5) return "strong";
  if(rpm>=1.8) return "ok";
  return "thin";
}
function laneColor(s){
  return s==="Available"?C.amber : s==="Assigned"?C.purple : s==="In Transit"?C.blue : C.green;
}
function computeRpm(l){
  if(l.rpm!=null) return l.rpm;
  if(l.rate&&l.miles) return l.rate/l.miles;
  return null;
}
function netOf(l){ return (l.rate||0)-(l.pay||0)-(l.fuel||0)-(l.dispatch||0)-(l.repair||0); }

/* ============================ SMALL UI ============================ */
function Pill({children,color,bg,style}){
  return <span style={{fontFamily:mono,fontSize:10,letterSpacing:.5,textTransform:"uppercase",
    color:color||C.dim, background:bg||"transparent", border:`1px solid ${(color||C.line)}33`,
    padding:"2px 7px", borderRadius:4, whiteSpace:"nowrap", ...style}}>{children}</span>;
}
function Label({children,style}){
  return <div style={{fontFamily:sans,fontSize:10.5,letterSpacing:1.4,textTransform:"uppercase",color:C.faint,...style}}>{children}</div>;
}

/* ============================ KPI BAR ============================ */
function KpiBar({loads}){
  const k = useMemo(()=>{
    let rev=0,mi=0,rpmN=0,rpmC=0,pay=0,fuel=0,disp=0,rep=0,active=0;
    const wk = Date.now()-7*864e5;
    let wkRev=0;
    loads.forEach(l=>{
      rev+=l.rate||0; mi+=l.miles||0; pay+=l.pay||0; fuel+=l.fuel||0; disp+=l.dispatch||0; rep+=l.repair||0;
      const r=computeRpm(l); if(r!=null){rpmN+=r;rpmC++;}
      if(l.status!=="Delivered") active++;
      if(l.date && new Date(l.date).getTime()>=wk) wkRev+=l.rate||0;
    });
    return {rev,mi,avgRpm:rpmC?rpmN/rpmC:0,pay,fuel,disp,rep,active,margin:rev-pay-fuel-disp-rep,wkRev,count:loads.length};
  },[loads]);
  const items=[
    {k:"Booked revenue",v:money(k.rev),c:C.ink},
    {k:"Net (after all costs)",v:money(k.margin),c:k.margin>=0?C.green:C.red},
    {k:"Avg RPM",v:"$"+k.avgRpm.toFixed(2),c:rpmColor(k.avgRpm)},
    {k:"Total miles",v:fmt0(k.mi),c:C.ink},
    {k:"Active loads",v:fmt0(k.active),c:C.amber},
    {k:"Loads logged",v:fmt0(k.count),c:C.dim},
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-px" style={{background:C.line,border:`1px solid ${C.line}`,borderRadius:8,overflow:"hidden"}}>
      {items.map((it,i)=>(
        <div key={i} style={{background:C.panel,padding:"12px 14px"}}>
          <Label>{it.k}</Label>
          <div style={{fontFamily:mono,fontSize:21,fontWeight:600,color:it.c,marginTop:5,lineHeight:1}}>{it.v}</div>
        </div>
      ))}
    </div>
  );
}

/* ============================ LOAD CARD ============================ */
function LoadCard({l,onAssign,onAdvance,onBack,onDelete,drivers,compact}){
  const rpm=computeRpm(l), col=rpmColor(rpm);
  return (
    <div style={{background:C.panel2,border:`1px solid ${C.line}`,borderLeft:`3px solid ${col}`,
      borderRadius:7,padding:"10px 11px",display:"flex",flexDirection:"column",gap:7}}>
      <div className="flex items-start justify-between" style={{gap:8}}>
        <div style={{minWidth:0}}>
          <div style={{fontFamily:sans,fontSize:13.5,fontWeight:600,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.broker||"—"}</div>
          <div style={{fontFamily:mono,fontSize:10.5,color:C.dim,marginTop:2}}>
            {(l.origin||l.dest)?`${l.origin||"?"} → ${l.dest||"?"}`:(l.ref?("REF "+l.ref):(l.date||""))}
          </div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontFamily:mono,fontSize:18,fontWeight:700,color:col,lineHeight:1}}>{rpm!=null?("$"+rpm.toFixed(2)):"—"}</div>
          <div style={{fontFamily:mono,fontSize:9,letterSpacing:.5,textTransform:"uppercase",color:col}}>{rpmLabel(rpm)} · rpm</div>
        </div>
      </div>
      <div className="flex items-center" style={{gap:14}}>
        <div><span style={{fontFamily:mono,fontSize:15,fontWeight:600,color:C.ink}}>{money(l.rate)}</span></div>
        <div style={{fontFamily:mono,fontSize:12,color:C.dim}}>{fmt0(l.miles)} mi</div>
        {l.unit && <Pill color={C.faint}>unit {l.unit}</Pill>}
      </div>

      {!compact && (
        <div className="flex items-center justify-between" style={{gap:8,marginTop:1}}>
          {l.status==="Available" ? (
            <select value="" onChange={e=>onAssign(l.id,e.target.value)}
              style={{flex:1,background:C.raised,color:C.amber,border:`1px solid ${C.line}`,borderRadius:5,
                padding:"5px 7px",fontFamily:mono,fontSize:11.5}}>
              <option value="" style={{color:C.dim}}>Assign driver…</option>
              {drivers.map(d=><option key={d} value={d} style={{color:C.ink}}>{d}</option>)}
            </select>
          ) : (
            <div className="flex items-center" style={{gap:6}}>
              <div style={{width:7,height:7,borderRadius:9,background:laneColor(l.status)}}/>
              <span style={{fontFamily:mono,fontSize:12,color:C.ink}}>{l.driver||"unassigned"}</span>
            </div>
          )}
          <div className="flex items-center" style={{gap:5}}>
            {l.status!=="Available" && <IconBtn title="Back a stage" onClick={()=>onBack(l.id)}>‹</IconBtn>}
            {l.status!=="Delivered" && (
              <button onClick={()=>onAdvance(l.id)} style={{fontFamily:mono,fontSize:11,letterSpacing:.3,
                color:C.bg,background:laneColor(LANES[LANES.indexOf(l.status)+1]),border:"none",
                borderRadius:5,padding:"5px 9px",cursor:"pointer",fontWeight:600}}>
                {l.status==="Available"?"—":LANES[LANES.indexOf(l.status)+1]} ›
              </button>
            )}
            {onDelete && <IconBtn title="Remove" onClick={()=>onDelete(l.id)} danger>×</IconBtn>}
          </div>
        </div>
      )}
    </div>
  );
}
function IconBtn({children,onClick,title,danger}){
  return <button title={title} onClick={onClick} style={{width:26,height:26,borderRadius:5,
    background:C.raised,border:`1px solid ${C.line}`,color:danger?C.red:C.dim,cursor:"pointer",
    fontFamily:mono,fontSize:14,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center"}}>{children}</button>;
}

/* ============================ BOARD ============================ */
function Board({loads,patchLoad,removeLoad,drivers,onNewLoad}){
  const grouped = useMemo(()=>{
    const g={Available:[],Assigned:[],"In Transit":[],Delivered:[]};
    loads.forEach(l=>{ (g[l.status]||g.Delivered).push(l); });
    g.Delivered.sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    return g;
  },[loads]);

  const assign=(id,driver)=>patchLoad(id,{driver,status:"Assigned"});
  const advance=id=>{const l=loads.find(x=>x.id===id);const i=LANES.indexOf(l.status);if(i<LANES.length-1)patchLoad(id,{status:LANES[i+1]});};
  const back=id=>{const l=loads.find(x=>x.id===id);const i=LANES.indexOf(l.status);if(i>0)patchLoad(id,{status:LANES[i-1], ...(LANES[i-1]==="Available"?{driver:null}:{})});};
  const del=id=>removeLoad(id);

  return (
    <div>
      <div className="flex items-center justify-between" style={{marginBottom:12}}>
        <Label style={{fontSize:11}}>Dispatch board · drag-free, tap to advance</Label>
        <button onClick={onNewLoad} style={{fontFamily:mono,fontSize:12,color:C.bg,background:C.amber,
          border:"none",borderRadius:6,padding:"7px 13px",cursor:"pointer",fontWeight:700,letterSpacing:.3}}>+ New load</button>
      </div>
      <div className="flex flex-col lg:flex-row" style={{gap:12,alignItems:"stretch"}}>
        {LANES.map(lane=>{
          const list=grouped[lane];
          const rev=list.reduce((s,l)=>s+(l.rate||0),0);
          const rpms=list.map(computeRpm).filter(x=>x!=null);
          const avg=rpms.length?rpms.reduce((a,b)=>a+b,0)/rpms.length:null;
          const isDel=lane==="Delivered";
          const show=isDel?list.slice(0,12):list;
          return (
            <div key={lane} className="flex-1" style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:9,minWidth:0,display:"flex",flexDirection:"column"}}>
              <div style={{padding:"11px 12px",borderBottom:`1px solid ${C.lineSoft}`}}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center" style={{gap:7}}>
                    <div style={{width:8,height:8,borderRadius:9,background:laneColor(lane)}}/>
                    <span style={{fontFamily:sans,fontSize:12.5,fontWeight:700,letterSpacing:.6,textTransform:"uppercase",color:C.ink}}>{lane}</span>
                  </div>
                  <span style={{fontFamily:mono,fontSize:12,color:C.dim}}>{list.length}</span>
                </div>
                <div className="flex items-center justify-between" style={{marginTop:6}}>
                  <span style={{fontFamily:mono,fontSize:12,color:C.faint}}>{money(rev)}</span>
                  {avg!=null && <span style={{fontFamily:mono,fontSize:11,color:rpmColor(avg)}}>avg ${avg.toFixed(2)}</span>}
                </div>
              </div>
              <div style={{padding:10,display:"flex",flexDirection:"column",gap:9,overflowY:"auto",maxHeight:560}}>
                {show.length===0 && <div style={{fontFamily:mono,fontSize:11,color:C.faint,padding:"14px 4px",textAlign:"center"}}>{lane==="Available"?"Add a load or pull one from Rate Cons.":"Nothing here."}</div>}
                {show.map(l=><LoadCard key={l.id} l={l} drivers={drivers} onAssign={assign} onAdvance={advance} onBack={back} onDelete={isDel?null:del} compact={isDel}/>)}
                {isDel && list.length>12 && <div style={{fontFamily:mono,fontSize:11,color:C.faint,textAlign:"center",padding:4}}>+{list.length-12} more in Loads ledger</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================ LOADS LEDGER ============================ */
function Ledger({loads}){
  const [q,setQ]=useState(""); const [drv,setDrv]=useState("all"); const [sort,setSort]=useState("date");
  const drivers=useMemo(()=>["all",...Array.from(new Set(loads.map(l=>l.driver).filter(Boolean)))],[loads]);
  const rows=useMemo(()=>{
    let r=loads.filter(l=>{
      const okD = drv==="all"||l.driver===drv;
      const okQ = !q || (l.broker||"").toLowerCase().includes(q.toLowerCase()) || (l.driver||"").toLowerCase().includes(q.toLowerCase());
      return okD&&okQ;
    });
    r=[...r].sort((a,b)=>{
      if(sort==="date") return (b.date||"").localeCompare(a.date||"");
      if(sort==="rpm") return (computeRpm(b)||0)-(computeRpm(a)||0);
      if(sort==="rate") return (b.rate||0)-(a.rate||0);
      return 0;
    });
    return r;
  },[loads,q,drv,sort]);
  return (
    <div>
      <div className="flex flex-wrap items-center" style={{gap:8,marginBottom:12}}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search broker or driver…"
          style={{flex:"1 1 200px",background:C.panel,border:`1px solid ${C.line}`,borderRadius:6,color:C.ink,padding:"8px 11px",fontFamily:mono,fontSize:12.5}}/>
        <select value={drv} onChange={e=>setDrv(e.target.value)} style={selStyle}>{drivers.map(d=><option key={d} value={d}>{d==="all"?"All drivers":d}</option>)}</select>
        <select value={sort} onChange={e=>setSort(e.target.value)} style={selStyle}>
          <option value="date">Newest</option><option value="rpm">Highest RPM</option><option value="rate">Highest rate</option>
        </select>
        <Pill color={C.dim}>{rows.length} loads</Pill>
      </div>
      <div style={{border:`1px solid ${C.line}`,borderRadius:9,overflow:"hidden"}}>
        <div className="hidden md:grid" style={{gridTemplateColumns:"80px 1fr 92px 56px 52px 70px 64px 64px 60px 66px",
          background:C.panel2,padding:"9px 12px",gap:8}}>
          {["Date","Broker","Driver","RPM","Miles","Rate","Pay","Fuel","Disp","Repair"].map((h,i)=>(
            <div key={i} style={{fontFamily:sans,fontSize:10,letterSpacing:1,textTransform:"uppercase",color:C.faint,textAlign:i>2?"right":"left"}}>{h}</div>
          ))}
        </div>
        <div style={{maxHeight:600,overflowY:"auto"}}>
          {rows.map((l,idx)=>{const rpm=computeRpm(l);return(
            <div key={l.id} className="grid grid-cols-2 md:grid-cols-none" style={{gridTemplateColumns:"80px 1fr 92px 56px 52px 70px 64px 64px 60px 66px",
              gap:8,padding:"9px 12px",background:idx%2?C.bg:C.panel,borderTop:`1px solid ${C.lineSoft}`,alignItems:"center"}}>
              <div style={{fontFamily:mono,fontSize:11.5,color:C.dim}}>{(l.date||"").slice(5)}</div>
              <div style={{fontFamily:sans,fontSize:12.5,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.broker||"—"}</div>
              <div style={{fontFamily:mono,fontSize:11.5,color:C.dim}}>{l.driver||"—"}{l.unit?(" · "+l.unit):""}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,fontWeight:600,color:rpmColor(rpm)}}>{rpm!=null?"$"+rpm.toFixed(2):"—"}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{fmt0(l.miles)}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:C.ink}}>{money(l.rate)}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(l.pay)}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(l.fuel)}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:C.dim}}>{l.dispatch?money(l.dispatch):"—"}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:l.repair?C.amber:C.dim}}>{l.repair?money(l.repair):"—"}</div>
            </div>
          );})}
        </div>
      </div>
    </div>
  );
}
const selStyle={background:C.panel,border:`1px solid ${C.line}`,borderRadius:6,color:C.ink,padding:"8px 10px",fontFamily:mono,fontSize:12};

/* ============================ DRIVERS ============================ */
function Drivers({loads}){
  const stats=useMemo(()=>{
    const m={};
    loads.forEach(l=>{
      if(!l.driver) return;
      const d=m[l.driver]||(m[l.driver]={driver:l.driver,n:0,miles:0,rev:0,pay:0,fuel:0,disp:0,rep:0,rpmN:0,rpmC:0,units:new Set(),active:null});
      d.n++; d.miles+=l.miles||0; d.rev+=l.rate||0; d.pay+=l.pay||0; d.fuel+=l.fuel||0; d.disp+=l.dispatch||0; d.rep+=l.repair||0;
      const r=computeRpm(l); if(r!=null){d.rpmN+=r;d.rpmC++;}
      if(l.unit) d.units.add(l.unit);
      if(l.status&&l.status!=="Delivered") d.active=l;
    });
    return Object.values(m).map(d=>({...d,avg:d.rpmC?d.rpmN/d.rpmC:0,margin:d.rev-d.pay-d.fuel-d.disp-d.rep,units:Array.from(d.units)}))
      .sort((a,b)=>{const ia=DRIVER_ORDER.indexOf(a.driver),ib=DRIVER_ORDER.indexOf(b.driver);return (ia<0?99:ia)-(ib<0?99:ib);});
  },[loads]);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3" style={{gap:12}}>
      {stats.map(d=>(
        <div key={d.driver} style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:14}}>
          <div className="flex items-center justify-between">
            <div className="flex items-center" style={{gap:10}}>
              <div style={{width:36,height:36,borderRadius:8,background:C.raised,border:`1px solid ${C.line}`,
                display:"flex",alignItems:"center",justifyContent:"center",fontFamily:mono,fontWeight:700,color:C.amber,fontSize:14}}>{d.driver.slice(0,2).toUpperCase()}</div>
              <div>
                <div style={{fontFamily:sans,fontSize:15,fontWeight:700,color:C.ink}}>{d.driver}</div>
                <div style={{fontFamily:mono,fontSize:10.5,color:C.faint}}>units {d.units.join(", ")||"—"}</div>
              </div>
            </div>
            {d.active
              ? <Pill color={laneColor(d.active.status)} bg={laneColor(d.active.status)+"1a"}>{d.active.status}</Pill>
              : <Pill color={C.faint}>open</Pill>}
          </div>
          {d.active && <div style={{marginTop:10,padding:"8px 10px",background:C.panel2,border:`1px solid ${C.line}`,borderRadius:7,fontFamily:mono,fontSize:11.5,color:C.dim}}>
            on: <span style={{color:C.ink}}>{d.active.broker}</span> · {money(d.active.rate)} · {fmt0(d.active.miles)}mi</div>}
          <div className="grid grid-cols-3" style={{gap:8,marginTop:12}}>
            {[["Loads",fmt0(d.n),C.ink],["Revenue",money(d.rev),C.ink],["Avg RPM","$"+d.avg.toFixed(2),rpmColor(d.avg)],
              ["Miles",fmt0(d.miles),C.dim],["Driver pay",money(d.pay),C.dim],["Net to truck",money(d.margin),d.margin>=0?C.green:C.red]].map((s,i)=>(
              <div key={i}>
                <Label style={{fontSize:9}}>{s[0]}</Label>
                <div style={{fontFamily:mono,fontSize:14,fontWeight:600,color:s[2],marginTop:3}}>{s[1]}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================ WEEKLY P&L PER TRUCK ============================ */
function isoMonday(d){ const dt=new Date(d+"T00:00:00"); const day=(dt.getDay()+6)%7; dt.setDate(dt.getDate()-day); return dt.toISOString().slice(0,10); }
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function weekLabel(monIso){ const a=new Date(monIso+"T00:00:00"); const b=new Date(a); b.setDate(b.getDate()+6);
  const sameM=a.getMonth()===b.getMonth(); return `${MON[a.getMonth()]} ${a.getDate()} – ${sameM?'':MON[b.getMonth()]+' '}${b.getDate()}`; }

function WeeklyPnL({loads}){
  const weeks=useMemo(()=>{ const m={}; loads.forEach(l=>{ if(!l.date)return; const wk=isoMonday(l.date); (m[wk]||(m[wk]=[])).push(l); });
    return Object.keys(m).sort((a,b)=>b.localeCompare(a)).map(k=>({wk:k,loads:m[k]})); },[loads]);
  const [sel,setSel]=useState(""); 
  useEffect(()=>{ if(weeks.length&&!weeks.find(w=>w.wk===sel)) setSel(weeks[0].wk); },[weeks]);
  const cur=weeks.find(w=>w.wk===sel)||weeks[0];

  const trend=useMemo(()=>weeks.slice(0,14).reverse().map(w=>{ let net=0; w.loads.forEach(l=>net+=(l.rate||0)-(l.pay||0)-(l.fuel||0)); return {wk:w.wk,net}; }),[weeks]);
  const maxNet=Math.max(1,...trend.map(t=>Math.abs(t.net)));

  const trucks=useMemo(()=>{ if(!cur) return []; const m={};
    cur.loads.forEach(l=>{ const u=l.unit||"—"; const t=m[u]||(m[u]={unit:u,drivers:new Set(),n:0,miles:0,rev:0,pay:0,fuel:0,exp:0,rpmN:0,rpmC:0});
      t.n++; t.miles+=l.miles||0; t.rev+=l.rate||0; t.pay+=l.pay||0; t.fuel+=l.fuel||0; t.exp+=(l.dispatch||0)+(l.repair||0); const r=computeRpm(l); if(r){t.rpmN+=r;t.rpmC++;} if(l.driver)t.drivers.add(l.driver); });
    return Object.values(m).map(t=>({...t,net:t.rev-t.pay-t.fuel-t.exp,avg:t.rpmC?t.rpmN/t.rpmC:0,drivers:Array.from(t.drivers)})).sort((a,b)=>b.rev-a.rev); },[cur]);
  const tot=trucks.reduce((s,t)=>({rev:s.rev+t.rev,pay:s.pay+t.pay,fuel:s.fuel+t.fuel,exp:s.exp+t.exp,net:s.net+t.net,miles:s.miles+t.miles,n:s.n+t.n}),{rev:0,pay:0,fuel:0,exp:0,net:0,miles:0,n:0});

  if(!cur) return <Empty msg="No dated loads yet."/>;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between" style={{gap:10,marginBottom:14}}>
        <div className="flex items-center" style={{gap:10}}>
          <Label>Week of</Label>
          <select value={sel} onChange={e=>setSel(e.target.value)} style={{...selStyle,fontSize:13}}>
            {weeks.map(w=><option key={w.wk} value={w.wk}>{weekLabel(w.wk)}, {w.wk.slice(0,4)}</option>)}
          </select>
        </div>
        <div className="flex items-center" style={{gap:18}}>
          <Stat k="Revenue" v={money(tot.rev)} c={C.ink}/>
          <Stat k="Net to fleet" v={money(tot.net)} c={tot.net>=0?C.green:C.red}/>
          <Stat k="Miles" v={fmt0(tot.miles)} c={C.dim}/>
          <Stat k="Avg RPM" v={"$"+(tot.miles?(tot.rev/tot.miles):0).toFixed(2)} c={rpmColor(tot.miles?tot.rev/tot.miles:0)}/>
        </div>
      </div>

      {/* trend */}
      <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:"12px 14px",marginBottom:14}}>
        <Label style={{marginBottom:10}}>Weekly net to fleet · last {trend.length} weeks</Label>
        <div className="flex items-end" style={{gap:6,height:90}}>
          {trend.map(t=>{ const h=Math.max(3,Math.round(Math.abs(t.net)/maxNet*78)); const on=t.wk===sel;
            return (
              <div key={t.wk} onClick={()=>setSel(t.wk)} title={weekLabel(t.wk)+": "+money(t.net)}
                className="flex-1" style={{display:"flex",flexDirection:"column",justifyContent:"flex-end",alignItems:"center",cursor:"pointer",minWidth:0}}>
                <div style={{width:"100%",maxWidth:26,height:h,background:t.net>=0?(on?C.green:C.greenDim):(on?C.red:C.redDim),borderRadius:3}}/>
                <div style={{fontFamily:mono,fontSize:8.5,color:on?C.ink:C.faint,marginTop:5}}>{MON[new Date(t.wk+"T00:00:00").getMonth()]}{new Date(t.wk+"T00:00:00").getDate()}</div>
              </div>
            ); })}
        </div>
      </div>

      {/* per truck table */}
      <div style={{border:`1px solid ${C.line}`,borderRadius:10,overflow:"hidden"}}>
        <div className="hidden md:grid" style={{gridTemplateColumns:"60px 1fr 46px 56px 80px 70px 70px 70px 78px 58px",background:C.panel2,padding:"9px 12px",gap:8}}>
          {["Truck","Driver","Loads","Miles","Revenue","Pay","Fuel","Exp","Net","RPM"].map((h,i)=>(
            <div key={i} style={{fontFamily:sans,fontSize:10,letterSpacing:1,textTransform:"uppercase",color:C.faint,textAlign:i>1?"right":"left"}}>{h}</div>))}
        </div>
        {trucks.map((t,i)=>(
          <div key={t.unit} style={{display:"grid",gridTemplateColumns:"60px 1fr 46px 56px 80px 70px 70px 70px 78px 58px",gap:8,padding:"11px 12px",background:i%2?C.bg:C.panel,borderTop:`1px solid ${C.lineSoft}`,alignItems:"center"}}>
            <div className="flex items-center" style={{gap:7}}><div style={{width:9,height:9,borderRadius:3,background:C.amber}}/><span style={{fontFamily:mono,fontWeight:700,color:C.ink,fontSize:14}}>{t.unit}</span></div>
            <div style={{fontFamily:sans,fontSize:12.5,color:C.dim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.drivers.join(", ")||"—"}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:C.dim}}>{t.n}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{fmt0(t.miles)}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:13,color:C.ink}}>{money(t.rev)}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(t.pay)}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(t.fuel)}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{t.exp?money(t.exp):"—"}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:13,fontWeight:700,color:t.net>=0?C.green:C.red}}>{money(t.net)}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,fontWeight:600,color:rpmColor(t.avg)}}>${t.avg.toFixed(2)}</div>
          </div>
        ))}
        <div style={{display:"grid",gridTemplateColumns:"60px 1fr 46px 56px 80px 70px 70px 70px 78px 58px",gap:8,padding:"11px 12px",background:C.panel2,borderTop:`2px solid ${C.line}`,alignItems:"center"}}>
          <div style={{fontFamily:sans,fontSize:11,letterSpacing:.8,textTransform:"uppercase",color:C.amber,fontWeight:700,gridColumn:"1 / 3"}}>Week total</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:C.dim}}>{tot.n}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{fmt0(tot.miles)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:13,color:C.ink}}>{money(tot.rev)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(tot.pay)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(tot.fuel)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{tot.exp?money(tot.exp):"—"}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:13,fontWeight:700,color:tot.net>=0?C.green:C.red}}>{money(tot.net)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:rpmColor(tot.miles?tot.rev/tot.miles:0)}}>${(tot.miles?tot.rev/tot.miles:0).toFixed(2)}</div>
        </div>
      </div>
      <div style={{fontFamily:sans,fontSize:11,color:C.faint,marginTop:10}}>Net = revenue − driver pay − fuel − dispatch fees − repairs. Exp = dispatch fees + repairs. Truck = unit number. Tap a bar to jump to that week.</div>
    </div>
  );
}
function Stat({k,v,c}){ return <div><Label style={{fontSize:9}}>{k}</Label><div style={{fontFamily:mono,fontSize:17,fontWeight:600,color:c,marginTop:2,lineHeight:1}}>{v}</div></div>; }
function Empty({msg}){ return <div style={{fontFamily:mono,fontSize:12.5,color:C.faint,textAlign:"center",padding:"50px 20px",border:`1px dashed ${C.line}`,borderRadius:10}}>{msg}</div>; }

/* ============================ MONTHLY P&L ============================ */
function monthLabel(ym){ const [y,m]=ym.split("-"); return `${MON[parseInt(m,10)-1]} ${y}`; }
function aggLoads(list){
  let rev=0,pay=0,fuel=0,disp=0,rep=0,miles=0,rpmN=0,rpmC=0;
  list.forEach(l=>{ rev+=l.rate||0; pay+=l.pay||0; fuel+=l.fuel||0; disp+=l.dispatch||0; rep+=l.repair||0; miles+=l.miles||0;
    const r=computeRpm(l); if(r!=null){rpmN+=r;rpmC++;} });
  return {rev,pay,fuel,disp,rep,exp:disp+rep,miles,n:list.length,net:rev-pay-fuel-disp-rep,avg:rpmC?rpmN/rpmC:0};
}
function trucksOf(list){
  const m={};
  list.forEach(l=>{ const u=l.unit||"—"; const t=m[u]||(m[u]={unit:u,loads:[],drivers:new Set()}); t.loads.push(l); if(l.driver)t.drivers.add(l.driver); });
  return Object.values(m).map(t=>({unit:t.unit,drivers:Array.from(t.drivers),...aggLoads(t.loads)})).sort((a,b)=>b.rev-a.rev);
}
const M_GRID="118px 44px 60px 84px 72px 72px 66px 84px 58px";
function MonthlyPnL({loads}){
  const years=useMemo(()=>Array.from(new Set(loads.filter(l=>l.date).map(l=>l.date.slice(0,4)))).sort((a,b)=>b.localeCompare(a)),[loads]);
  const [year,setYear]=useState("");
  useEffect(()=>{ if(years.length && year!=="all" && !years.includes(year)) setYear(years[0]); },[years]);
  const view=useMemo(()=> (year&&year!=="all") ? loads.filter(l=>l.date&&l.date.slice(0,4)===year) : loads.filter(l=>l.date), [loads,year]);
  const months=useMemo(()=>{
    const m={}; view.forEach(l=>{ const ym=l.date.slice(0,7); (m[ym]||(m[ym]=[])).push(l); });
    return Object.keys(m).sort((a,b)=>b.localeCompare(a)).map(k=>({ym:k,loads:m[k],agg:aggLoads(m[k])}));
  },[view]);
  const [open,setOpen]=useState(new Set());
  useEffect(()=>{ if(months.length) setOpen(o=>o.size?o:new Set([months[0].ym])); },[months.length]);
  const toggle=ym=>setOpen(o=>{ const n=new Set(o); n.has(ym)?n.delete(ym):n.add(ym); return n; });

  const tot=useMemo(()=>aggLoads(view),[view]);
  const trend=useMemo(()=>months.slice(0,12).reverse(),[months]);
  const maxNet=Math.max(1,...trend.map(t=>Math.abs(t.agg.net)));
  const avgMonthNet=months.length?tot.net/months.length:0;

  if(!months.length) return <Empty msg="No dated loads yet — monthly P&L builds as loads come in."/>;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between" style={{gap:12,marginBottom:14}}>
        <div className="flex items-center" style={{gap:12,flexWrap:"wrap"}}>
          <div className="flex" style={{gap:3,background:C.panel,border:`1px solid ${C.line}`,borderRadius:9,padding:3}}>
            {[...years,"all"].map(y=>{ const on=(y==="all")?(year==="all"):((year||years[0])===y);
              return <button key={y} onClick={()=>setYear(y)} style={{fontFamily:mono,fontSize:12.5,fontWeight:700,letterSpacing:.3,
                color:on?C.bg:C.dim,background:on?C.amber:"transparent",border:"none",borderRadius:6,padding:"6px 14px",cursor:"pointer"}}>{y==="all"?"All":y}</button>; })}
          </div>
          <Label style={{fontSize:11}}>{months.length} month{months.length===1?"":"s"} · tap a month for trucks</Label>
        </div>
        <div className="flex items-center" style={{gap:18}}>
          <Stat k={(year&&year!=="all")?(year+" net"):"All-time net"} v={money(tot.net)} c={tot.net>=0?C.green:C.red}/>
          <Stat k="Avg / month" v={money(avgMonthNet)} c={avgMonthNet>=0?C.green:C.red}/>
          <Stat k="Avg RPM" v={"$"+(tot.miles?tot.rev/tot.miles:0).toFixed(2)} c={rpmColor(tot.miles?tot.rev/tot.miles:0)}/>
        </div>
      </div>

      {/* monthly net trend */}
      <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:"12px 14px",marginBottom:14}}>
        <Label style={{marginBottom:10}}>Monthly net to fleet · last {trend.length} months</Label>
        <div className="flex items-end" style={{gap:8,height:96}}>
          {trend.map(t=>{ const h=Math.max(3,Math.round(Math.abs(t.agg.net)/maxNet*72)); const on=open.has(t.ym);
            return (
              <div key={t.ym} onClick={()=>setOpen(new Set([t.ym]))} title={monthLabel(t.ym)+": "+money(t.agg.net)}
                className="flex-1" style={{display:"flex",flexDirection:"column",justifyContent:"flex-end",alignItems:"center",cursor:"pointer",minWidth:0}}>
                <div style={{fontFamily:mono,fontSize:8.5,color:on?C.ink:C.faint,marginBottom:3}}>{(t.agg.net/1000).toFixed(0)}k</div>
                <div style={{width:"100%",maxWidth:30,height:h,background:t.agg.net>=0?(on?C.green:C.greenDim):(on?C.red:C.redDim),borderRadius:3}}/>
                <div style={{fontFamily:mono,fontSize:8.5,color:on?C.ink:C.faint,marginTop:5}}>{MON[parseInt(t.ym.slice(5),10)-1]}</div>
              </div>
            ); })}
        </div>
      </div>

      {/* monthly table */}
      <div style={{border:`1px solid ${C.line}`,borderRadius:10,overflow:"hidden"}}>
        <div className="hidden md:grid" style={{gridTemplateColumns:M_GRID,background:C.panel2,padding:"9px 12px",gap:8}}>
          {["Month","Loads","Miles","Revenue","Pay","Fuel","Exp","Net","RPM"].map((h,i)=>(
            <div key={i} style={{fontFamily:sans,fontSize:10,letterSpacing:1,textTransform:"uppercase",color:C.faint,textAlign:i>0?"right":"left"}}>{h}</div>))}
        </div>
        {months.map((mo,i)=>{ const a=mo.agg; const isOpen=open.has(mo.ym);
          return (
            <div key={mo.ym} style={{borderTop:`1px solid ${C.lineSoft}`}}>
              <div onClick={()=>toggle(mo.ym)} style={{display:"grid",gridTemplateColumns:M_GRID,gap:8,padding:"11px 12px",background:isOpen?C.panel2:(i%2?C.bg:C.panel),alignItems:"center",cursor:"pointer"}}>
                <div className="flex items-center" style={{gap:6,minWidth:0}}>
                  <span style={{color:C.faint,fontFamily:mono,fontSize:11,width:9}}>{isOpen?"▾":"▸"}</span>
                  <span style={{fontFamily:sans,fontSize:13,fontWeight:700,color:C.ink,whiteSpace:"nowrap"}}>{monthLabel(mo.ym)}</span>
                </div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:C.dim}}>{a.n}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{fmt0(a.miles)}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:13,color:C.ink}}>{money(a.rev)}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(a.pay)}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(a.fuel)}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{a.exp?money(a.exp):"—"}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:13,fontWeight:700,color:a.net>=0?C.green:C.red}}>{money(a.net)}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,fontWeight:600,color:rpmColor(a.avg)}}>${a.avg.toFixed(2)}</div>
              </div>
              {isOpen && (
                <div style={{background:C.bg,padding:"4px 12px 12px 12px"}}>
                  {trucksOf(mo.loads).map(t=>(
                    <div key={t.unit} style={{display:"grid",gridTemplateColumns:M_GRID,gap:8,padding:"7px 0 7px 18px",alignItems:"center",borderTop:`1px solid ${C.lineSoft}`}}>
                      <div className="flex items-center" style={{gap:6,minWidth:0}}>
                        <div style={{width:7,height:7,borderRadius:2,background:C.amber}}/>
                        <span style={{fontFamily:mono,fontSize:12,color:C.ink}}>Unit {t.unit}</span>
                        <span style={{fontFamily:sans,fontSize:10.5,color:C.faint,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.drivers.join(", ")}</span>
                      </div>
                      <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:C.faint}}>{t.n}</div>
                      <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:C.faint}}>{fmt0(t.miles)}</div>
                      <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(t.rev)}</div>
                      <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:C.faint}}>{money(t.pay)}</div>
                      <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:C.faint}}>{money(t.fuel)}</div>
                      <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:C.faint}}>{t.exp?money(t.exp):"—"}</div>
                      <div style={{textAlign:"right",fontFamily:mono,fontSize:12,fontWeight:600,color:t.net>=0?C.green:C.red}}>{money(t.net)}</div>
                      <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:rpmColor(t.avg)}}>${t.avg.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div style={{display:"grid",gridTemplateColumns:M_GRID,gap:8,padding:"11px 12px",background:C.panel2,borderTop:`2px solid ${C.line}`,alignItems:"center"}}>
          <div style={{fontFamily:sans,fontSize:11,letterSpacing:.8,textTransform:"uppercase",color:C.amber,fontWeight:700}}>{(year&&year!=="all")?year+" total":"All-time"}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:C.dim}}>{tot.n}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{fmt0(tot.miles)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:13,color:C.ink}}>{money(tot.rev)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(tot.pay)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(tot.fuel)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{tot.exp?money(tot.exp):"—"}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:13,fontWeight:700,color:tot.net>=0?C.green:C.red}}>{money(tot.net)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:rpmColor(tot.miles?tot.rev/tot.miles:0)}}>${(tot.miles?tot.rev/tot.miles:0).toFixed(2)}</div>
        </div>
      </div>
      <div style={{fontFamily:sans,fontSize:11,color:C.faint,marginTop:10}}>Net = revenue − driver pay − fuel − dispatch fees − repairs. Exp = dispatch + repairs. Tap any month to see each truck's P&amp;L for that month.</div>
    </div>
  );
}



/* ============================ LANE BOOK ============================ */
function LaneBook({loads}){
  const withLane=useMemo(()=>loads.filter(l=>l.origin&&l.origin.trim()),[loads]);
  const origins=useMemo(()=>["all",...Array.from(new Set(withLane.map(l=>l.origin.trim())))],[withLane]);
  const [origin,setOrigin]=useState("all");

  const byOrigin=useMemo(()=>{
    const m={};
    withLane.forEach(l=>{
      if(origin!=="all"&&l.origin.trim()!==origin) return;
      const o=l.origin.trim(), d=(l.dest||"?").trim(), b=l.broker||"—", key=o+"|"+d+"|"+b;
      const e=m[key]||(m[key]={origin:o,dest:d,broker:b,n:0,rpmN:0,rpmC:0,rate:0,miles:0,last:""});
      e.n++; const r=computeRpm(l); if(r){e.rpmN+=r;e.rpmC++;} e.rate+=l.rate||0; e.miles+=l.miles||0; if((l.date||"")>e.last)e.last=l.date||"";
    });
    const lanes=Object.values(m).map(e=>({...e,avgRpm:e.rpmC?e.rpmN/e.rpmC:0,avgRate:e.rate/e.n,avgMiles:Math.round(e.miles/e.n)}));
    const g={}; lanes.forEach(e=>{(g[e.origin]||(g[e.origin]=[])).push(e);});
    Object.values(g).forEach(a=>a.sort((x,y)=>y.n-x.n));
    return Object.entries(g).sort((a,b)=>b[1].reduce((s,x)=>s+x.n,0)-a[1].reduce((s,x)=>s+x.n,0));
  },[withLane,origin]);

  const brokerRef=useMemo(()=>{ const m={};
    loads.forEach(l=>{ if(!l.broker)return; const e=m[l.broker]||(m[l.broker]={broker:l.broker,n:0,rpmN:0,rpmC:0,rate:0,last:""});
      e.n++; const r=computeRpm(l); if(r){e.rpmN+=r;e.rpmC++;} e.rate+=l.rate||0; if((l.date||"")>e.last)e.last=l.date||""; });
    return Object.values(m).map(e=>({...e,avgRpm:e.rpmC?e.rpmN/e.rpmC:0,avgRate:e.rate/e.n})).sort((a,b)=>b.n-a.n);
  },[loads]);
  const [showRef,setShowRef]=useState(false);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between" style={{gap:10,marginBottom:14}}>
        <div className="flex items-center" style={{gap:10}}>
          <Label>Coming out of</Label>
          <select value={origin} onChange={e=>setOrigin(e.target.value)} style={{...selStyle,fontSize:13}}>
            {origins.map(o=><option key={o} value={o}>{o==="all"?"All origin cities":o}</option>)}
          </select>
        </div>
        <Pill color={C.dim}>{byOrigin.reduce((s,[,a])=>s+a.length,0)} lanes on file</Pill>
      </div>

      {byOrigin.length===0 ? (
        <div style={{border:`1px dashed ${C.line}`,borderRadius:10,padding:"28px 22px",textAlign:"center"}}>
          <div style={{fontFamily:sans,fontSize:14,color:C.ink,fontWeight:600}}>No city lanes recorded yet</div>
          <div style={{fontFamily:sans,fontSize:12,color:C.dim,marginTop:8,maxWidth:520,marginLeft:"auto",marginRight:"auto",lineHeight:1.5}}>
            Your imported history didn't include pickup/drop cities, so lanes start filling in as rate cons come through (the extractor captures origin and destination) or when you add a load with city fields. Your NC→IN and NC→OH runs will group here automatically. In the meantime, your broker rate reference below works off all 167 loads.
          </div>
        </div>
      ) : byOrigin.map(([orig,lanes])=>(
        <div key={orig} style={{marginBottom:14}}>
          <div className="flex items-center" style={{gap:9,marginBottom:8}}>
            <div style={{width:9,height:9,borderRadius:9,background:C.amber}}/>
            <span style={{fontFamily:sans,fontSize:14.5,fontWeight:700,color:C.ink}}>Out of {orig}</span>
            <Pill color={C.faint}>{lanes.length} lane{lanes.length>1?"s":""}</Pill>
          </div>
          <div style={{border:`1px solid ${C.line}`,borderRadius:10,overflow:"hidden"}}>
            {lanes.map((e,i)=>(
              <div key={i} className="flex items-center justify-between" style={{padding:"11px 13px",gap:10,background:i%2?C.bg:C.panel,borderTop:i?`1px solid ${C.lineSoft}`:"none"}}>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontFamily:sans,fontSize:13.5,color:C.ink,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>→ {e.dest}</div>
                  <div style={{fontFamily:mono,fontSize:11,color:C.dim,marginTop:2}}>{e.broker} · {e.n} load{e.n>1?"s":""} · {fmt0(e.avgMiles)} mi avg · last {e.last? e.last.slice(5):"—"}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontFamily:mono,fontSize:16,fontWeight:700,color:rpmColor(e.avgRpm)}}>${e.avgRpm.toFixed(2)}</div>
                  <div style={{fontFamily:mono,fontSize:11,color:C.faint}}>{money(e.avgRate)} avg</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* broker reference fallback */}
      <div style={{marginTop:6}}>
        <button onClick={()=>setShowRef(!showRef)} style={{fontFamily:sans,fontSize:12.5,fontWeight:600,color:C.dim,background:C.panel,border:`1px solid ${C.line}`,borderRadius:8,padding:"9px 13px",cursor:"pointer",width:"100%",textAlign:"left"}}>
          {showRef?"▾":"▸"} Broker rate reference — all {brokerRef.length} brokers across full history (lane not recorded)
        </button>
        {showRef && (
          <div style={{border:`1px solid ${C.line}`,borderTop:"none",borderRadius:"0 0 8px 8px",overflow:"hidden",maxHeight:420,overflowY:"auto"}}>
            <div className="hidden md:grid" style={{gridTemplateColumns:"1fr 70px 64px 100px 80px",background:C.panel2,padding:"8px 13px",gap:8}}>
              {["Broker","Loads","RPM","Avg rate","Last"].map((h,i)=><div key={i} style={{fontFamily:sans,fontSize:10,letterSpacing:1,textTransform:"uppercase",color:C.faint,textAlign:i?"right":"left"}}>{h}</div>)}
            </div>
            {brokerRef.map((e,i)=>(
              <div key={e.broker} style={{display:"grid",gridTemplateColumns:"1fr 70px 64px 100px 80px",gap:8,padding:"9px 13px",background:i%2?C.bg:C.panel,borderTop:`1px solid ${C.lineSoft}`,alignItems:"center"}}>
                <div style={{fontFamily:sans,fontSize:12.5,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.broker}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{e.n}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,fontWeight:600,color:rpmColor(e.avgRpm)}}>${e.avgRpm.toFixed(2)}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(e.avgRate)}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:11,color:C.faint}}>{e.last?e.last.slice(5):"—"}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ RATE CON INBOX ============================ */
function Inbox({onAdd}){
  const [text,setText]=useState(""); const [busy,setBusy]=useState(false);
  const [draft,setDraft]=useState(null); const [err,setErr]=useState("");
  const [recent,setRecent]=useState([]);
  // recent captures live in memory for the session

  async function extract(){
    if(!text.trim()) return;
    setBusy(true); setErr(""); setDraft(null);
    try{
      const j=await api.extractLoad(text);
      if(j.rate&&j.miles&&!j.rpm) j.rpm=j.rate/j.miles;
      setDraft(j);
    }catch(e){ setErr("Couldn't read that one. Paste the rate con text including broker, rate, and miles, then try again."); }
    setBusy(false);
  }
  function add(){
    const l={id:uid(),status:"Available",date:draft.pickup_date||todayISO(),
      broker:draft.broker||"Unknown broker",rate:draft.rate??null,miles:draft.miles??null,
      rpm:(draft.rate&&draft.miles)?draft.rate/draft.miles:null,
      origin:draft.origin||null,dest:draft.dest||null,ref:draft.ref||null,driver:null,unit:null,pay:null,fuel:null};
    onAdd(l);
    const nr=[{when:new Date().toLocaleString(),broker:l.broker,rate:l.rate,miles:l.miles},...recent].slice(0,8);
    setRecent(nr);
    setDraft(null); setText("");
  }
  return (
    <div className="flex flex-col lg:flex-row" style={{gap:14}}>
      <div className="flex-1" style={{minWidth:0}}>
        <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:14}}>
          <Label style={{marginBottom:8}}>Paste a rate con / broker email</Label>
          <textarea value={text} onChange={e=>setText(e.target.value)} rows={9}
            placeholder={"Paste the broker's email or rate confirmation here.\n\nExample: 'TQL — Dallas TX to Memphis TN, 452 mi, $1,450 all in, PU 6/19 0800, ref 88231, dry van.'"}
            style={{width:"100%",background:C.bg,border:`1px solid ${C.line}`,borderRadius:7,color:C.ink,
              padding:"11px",fontFamily:mono,fontSize:12.5,resize:"vertical"}}/>
          <div className="flex items-center justify-between" style={{marginTop:10,gap:10}}>
            <div style={{fontFamily:sans,fontSize:11,color:C.faint,maxWidth:330}}>Reads text you paste. It does not connect to your live inbox — see the note below the board.</div>
            <button onClick={extract} disabled={busy} style={{fontFamily:mono,fontSize:12.5,fontWeight:700,
              color:C.bg,background:busy?C.faint:C.amber,border:"none",borderRadius:7,padding:"9px 16px",cursor:busy?"default":"pointer",whiteSpace:"nowrap"}}>
              {busy?"Reading…":"Extract load"}</button>
          </div>
          {err && <div style={{marginTop:10,color:C.red,fontFamily:mono,fontSize:11.5}}>{err}</div>}
        </div>

        {draft && (
          <div style={{marginTop:12,background:C.panel,border:`1px solid ${C.amber}55`,borderRadius:10,padding:14}}>
            <div className="flex items-center justify-between" style={{marginBottom:10}}>
              <Label style={{color:C.amber}}>Extracted — review then add</Label>
              {draft.rate&&draft.miles && <Pill color={rpmColor(draft.rate/draft.miles)}>rpm ${ (draft.rate/draft.miles).toFixed(2)}</Pill>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3" style={{gap:10}}>
              {[["Broker",draft.broker],["Rate",draft.rate!=null?money(draft.rate):"—"],["Miles",draft.miles!=null?fmt0(draft.miles):"—"],
                ["Origin",draft.origin||"—"],["Dest",draft.dest||"—"],["Pickup",draft.pickup_date||"—"],
                ["Ref",draft.ref||"—"],["Commodity",draft.commodity||"—"]].map((f,i)=>(
                <div key={i}><Label style={{fontSize:9}}>{f[0]}</Label>
                  <div style={{fontFamily:mono,fontSize:13,color:C.ink,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f[1]}</div></div>
              ))}
            </div>
            {draft.notes && <div style={{marginTop:10,fontFamily:sans,fontSize:11.5,color:C.dim}}>Note: {draft.notes}</div>}
            <button onClick={add} style={{marginTop:12,fontFamily:mono,fontSize:12.5,fontWeight:700,color:C.bg,
              background:C.green,border:"none",borderRadius:7,padding:"9px 16px",cursor:"pointer"}}>+ Add to board (Available)</button>
          </div>
        )}
      </div>

      <div style={{width:"100%",maxWidth:320}}>
        <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:14}}>
          <Label style={{marginBottom:10}}>Recently captured</Label>
          {recent.length===0 && <div style={{fontFamily:mono,fontSize:11,color:C.faint}}>Nothing yet. Extracted loads show up here.</div>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {recent.map((r,i)=>(
              <div key={i} style={{padding:"8px 10px",background:C.panel2,border:`1px solid ${C.line}`,borderRadius:7}}>
                <div style={{fontFamily:sans,fontSize:12.5,color:C.ink,fontWeight:600}}>{r.broker}</div>
                <div style={{fontFamily:mono,fontSize:10.5,color:C.dim,marginTop:2}}>{money(r.rate)} · {fmt0(r.miles)}mi · {r.when}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================ TEAM CHAT ============================ */
function Chat({loads}){
  const [msgs,setMsgs]=useState([]); const [who,setWho]=useState("");
  const [body,setBody]=useState(""); const [tag,setTag]=useState(""); const endRef=useRef(null);
  useEffect(()=>{ let on=true; const load=async()=>{ try{ const m=await api.getMessages(); if(on) setMsgs(m); }catch(e){} }; load(); const id=setInterval(load,10000); return ()=>{ on=false; clearInterval(id); }; },[]);
  useEffect(()=>{ endRef.current&&endRef.current.scrollIntoView({behavior:"smooth"}); },[msgs]);
  const active=useMemo(()=>loads.filter(l=>l.status!=="Delivered"),[loads]);
  async function send(){
    if(!body.trim()) return;
    const payload={who:who.trim()||"Dispatch",body:body.trim(),tag:tag||null};
    setBody("");
    try{ const saved=await api.postMessage(payload); setMsgs(ms=>[...ms,saved].slice(-300)); }
    catch(e){ setMsgs(ms=>[...ms,{id:uid(),...payload,ts:Date.now()}]); }
  }
  return (
    <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,display:"flex",flexDirection:"column",height:620,maxWidth:760,margin:"0 auto"}}>
      <div style={{padding:"12px 14px",borderBottom:`1px solid ${C.lineSoft}`}} className="flex items-center justify-between">
        <div><Label>Team channel</Label><div style={{fontFamily:sans,fontSize:13,color:C.ink,marginTop:2}}>Active loads thread · shared with everyone on this board</div></div>
        <Pill color={C.green} bg={C.green+"1a"}>{active.length} active</Pill>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:10}}>
        {msgs.length===0 && <div style={{fontFamily:mono,fontSize:12,color:C.faint,margin:"auto",textAlign:"center"}}>No messages yet.<br/>Post an update about an active load to start the thread.</div>}
        {msgs.map(m=>{
          const tl=active.find(l=>l.id===m.tag);
          return (
            <div key={m.id} style={{background:C.panel2,border:`1px solid ${C.line}`,borderRadius:8,padding:"9px 11px"}}>
              <div className="flex items-center justify-between" style={{marginBottom:4}}>
                <span style={{fontFamily:mono,fontSize:12,fontWeight:700,color:C.amber}}>{m.who}</span>
                <span style={{fontFamily:mono,fontSize:10,color:C.faint}}>{new Date(m.ts).toLocaleString()}</span>
              </div>
              {m.tag && <div style={{marginBottom:5}}><Pill color={C.blue} bg={C.blue+"15"}>{tl?(tl.broker+" · "+money(tl.rate)):"load"}</Pill></div>}
              <div style={{fontFamily:sans,fontSize:13.5,color:C.ink,whiteSpace:"pre-wrap"}}>{m.body}</div>
            </div>
          );
        })}
        <div ref={endRef}/>
      </div>
      <div style={{padding:12,borderTop:`1px solid ${C.lineSoft}`}}>
        <div className="flex" style={{gap:8,marginBottom:8}}>
          <input value={who} onChange={e=>setWho(e.target.value)} placeholder="Your name"
            style={{width:130,background:C.bg,border:`1px solid ${C.line}`,borderRadius:6,color:C.ink,padding:"7px 10px",fontFamily:mono,fontSize:12}}/>
          <select value={tag} onChange={e=>setTag(e.target.value)} style={{...selStyle,flex:1}}>
            <option value="">Tag a load (optional)</option>
            {active.map(l=><option key={l.id} value={l.id}>{l.broker} · {money(l.rate)} · {l.driver||"open"}</option>)}
          </select>
        </div>
        <div className="flex" style={{gap:8}}>
          <input value={body} onChange={e=>setBody(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Message your team…"
            style={{flex:1,background:C.bg,border:`1px solid ${C.line}`,borderRadius:6,color:C.ink,padding:"9px 12px",fontFamily:sans,fontSize:13.5}}/>
          <button onClick={send} style={{fontFamily:mono,fontSize:12.5,fontWeight:700,color:C.bg,background:C.amber,border:"none",borderRadius:6,padding:"9px 16px",cursor:"pointer"}}>Send</button>
        </div>
      </div>
    </div>
  );
}

/* ============================ COPILOT ============================ */
function Copilot({loads}){
  const [msgs,setMsgs]=useState([{role:"assistant",content:"I'm your dispatch copilot. I can see your board. Ask me to pair open loads with drivers, flag thin-margin freight, rank brokers by RPM, or draft a reply to a broker."}]);
  const [input,setInput]=useState(""); const [busy,setBusy]=useState(false); const endRef=useRef(null);
  useEffect(()=>{ endRef.current&&endRef.current.scrollIntoView({behavior:"smooth"}); },[msgs,busy]);
  const ctx=useMemo(()=>{
    const active=loads.filter(l=>l.status!=="Delivered").map(l=>({broker:l.broker,rate:l.rate,miles:l.miles,rpm:computeRpm(l)?+computeRpm(l).toFixed(2):null,status:l.status,driver:l.driver,origin:l.origin,dest:l.dest,dispatchFee:l.dispatch||null,repair:l.repair||null,net:Math.round(netOf(l))}));
    const byDrv={};
    loads.forEach(l=>{ if(!l.driver)return; const d=byDrv[l.driver]||(byDrv[l.driver]={loads:0,rpmN:0,rpmC:0,brokers:{}}); d.loads++; const r=computeRpm(l); if(r){d.rpmN+=r;d.rpmC++;} if(l.broker)d.brokers[l.broker]=(d.brokers[l.broker]||0)+1; });
    const drivers=Object.entries(byDrv).map(([k,v])=>({driver:k,loads:v.loads,avgRpm:v.rpmC?+(v.rpmN/v.rpmC).toFixed(2):null,topBrokers:Object.entries(v.brokers).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0])}));
    return {active,drivers};
  },[loads]);
  async function send(){
    if(!input.trim()||busy) return;
    const next=[...msgs,{role:"user",content:input.trim()}]; setMsgs(next); setInput(""); setBusy(true);
    try{
      const apiMsgs=next.filter(m=>m.role!=="assistant"||m!==next[0]).map(m=>({role:m.role,content:m.content}));
      const out=await api.copilotReply(apiMsgs,ctx);
      setMsgs([...next,{role:"assistant",content:out}]);
    }catch(e){ setMsgs([...next,{role:"assistant",content:"I couldn't reach the model just now. Try again in a moment."}]); }
    setBusy(false);
  }
  return (
    <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,display:"flex",flexDirection:"column",height:620,maxWidth:760,margin:"0 auto"}}>
      <div style={{padding:"12px 14px",borderBottom:`1px solid ${C.lineSoft}`}} className="flex items-center justify-between">
        <div><Label>Dispatch copilot</Label><div style={{fontFamily:sans,fontSize:13,color:C.ink,marginTop:2}}>Reads your live board · {ctx.active.length} active loads</div></div>
        <Pill color={C.purple} bg={C.purple+"1a"}>AI</Pill>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:11}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{alignSelf:m.role==="user"?"flex-end":"flex-start",maxWidth:"86%",
            background:m.role==="user"?C.amber:C.panel2,color:m.role==="user"?C.bg:C.ink,
            border:m.role==="user"?"none":`1px solid ${C.line}`,borderRadius:9,padding:"9px 12px",
            fontFamily:sans,fontSize:13.5,whiteSpace:"pre-wrap",lineHeight:1.45}}>{m.content}</div>
        ))}
        {busy && <div style={{alignSelf:"flex-start",fontFamily:mono,fontSize:12,color:C.faint}}>thinking…</div>}
        <div ref={endRef}/>
      </div>
      <div style={{padding:12,borderTop:`1px solid ${C.lineSoft}`}} className="flex" >
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="e.g. Pair my open loads with the best driver" style={{flex:1,background:C.bg,border:`1px solid ${C.line}`,borderRadius:6,color:C.ink,padding:"9px 12px",fontFamily:sans,fontSize:13.5,marginRight:8}}/>
        <button onClick={send} disabled={busy} style={{fontFamily:mono,fontSize:12.5,fontWeight:700,color:C.bg,background:busy?C.faint:C.purple,border:"none",borderRadius:6,padding:"9px 16px",cursor:busy?"default":"pointer"}}>Ask</button>
      </div>
    </div>
  );
}

/* ============================ NEW LOAD MODAL ============================ */
function NewLoad({onClose,onSave,drivers}){
  const [f,setF]=useState({broker:"",rate:"",miles:"",origin:"",dest:"",driver:"",date:todayISO()});
  const set=(k,v)=>setF({...f,[k]:v});
  const rpm=(f.rate&&f.miles)?(parseFloat(f.rate)/parseFloat(f.miles)):null;
  function save(){
    const l={id:uid(),status:f.driver?"Assigned":"Available",date:f.date,broker:f.broker||"Unknown broker",
      rate:f.rate?parseFloat(f.rate):null,miles:f.miles?parseFloat(f.miles):null,
      rpm:rpm,origin:f.origin||null,dest:f.dest||null,driver:f.driver||null,unit:null,pay:null,fuel:null,ref:null};
    onSave(l);
  }
  const inp={width:"100%",background:C.bg,border:`1px solid ${C.line}`,borderRadius:6,color:C.ink,padding:"9px 11px",fontFamily:mono,fontSize:12.5};
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#000000aa",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:12,padding:18,width:"100%",maxWidth:440}}>
        <div className="flex items-center justify-between" style={{marginBottom:14}}>
          <div style={{fontFamily:sans,fontSize:16,fontWeight:700,color:C.ink}}>New load</div>
          {rpm!=null && <Pill color={rpmColor(rpm)} bg={rpmColor(rpm)+"1a"}>rpm ${rpm.toFixed(2)} · {rpmLabel(rpm)}</Pill>}
        </div>
        <div className="grid grid-cols-2" style={{gap:10}}>
          <div className="col-span-2"><Label style={{marginBottom:4}}>Broker</Label><input style={inp} value={f.broker} onChange={e=>set("broker",e.target.value)}/></div>
          <div><Label style={{marginBottom:4}}>Rate $</Label><input style={inp} value={f.rate} onChange={e=>set("rate",e.target.value)} inputMode="decimal"/></div>
          <div><Label style={{marginBottom:4}}>Miles</Label><input style={inp} value={f.miles} onChange={e=>set("miles",e.target.value)} inputMode="numeric"/></div>
          <div><Label style={{marginBottom:4}}>Origin</Label><input style={inp} value={f.origin} onChange={e=>set("origin",e.target.value)} placeholder="Dallas, TX"/></div>
          <div><Label style={{marginBottom:4}}>Dest</Label><input style={inp} value={f.dest} onChange={e=>set("dest",e.target.value)} placeholder="Memphis, TN"/></div>
          <div><Label style={{marginBottom:4}}>Pickup</Label><input style={inp} type="date" value={f.date} onChange={e=>set("date",e.target.value)}/></div>
          <div><Label style={{marginBottom:4}}>Driver</Label>
            <select style={{...inp,color:C.ink}} value={f.driver} onChange={e=>set("driver",e.target.value)}>
              <option value="">Leave open</option>{drivers.map(d=><option key={d} value={d}>{d}</option>)}
            </select></div>
        </div>
        <div className="flex justify-end" style={{gap:8,marginTop:16}}>
          <button onClick={onClose} style={{fontFamily:mono,fontSize:12.5,color:C.dim,background:C.raised,border:`1px solid ${C.line}`,borderRadius:7,padding:"9px 15px",cursor:"pointer"}}>Cancel</button>
          <button onClick={save} style={{fontFamily:mono,fontSize:12.5,fontWeight:700,color:C.bg,background:C.amber,border:"none",borderRadius:7,padding:"9px 18px",cursor:"pointer"}}>Add load</button>
        </div>
      </div>
    </div>
  );
}

/* ============================ LOGIN ============================ */
function Login({onAuthed}){
  const [pw,setPw]=useState(""); const [err,setErr]=useState(""); const [busy,setBusy]=useState(false);
  async function go(){
    if(!pw) return;
    setBusy(true); setErr("");
    const t=await api.login(pw); setBusy(false);
    if(t) onAuthed(); else setErr("Wrong password");
  }
  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.ink,fontFamily:sans,display:"flex",alignItems:"center",justifyContent:"center",padding:18}}>
      <div style={{width:"100%",maxWidth:360,background:C.panel,border:`1px solid ${C.line}`,borderRadius:14,padding:24}}>
        <div className="flex items-center" style={{gap:12,marginBottom:18}}>
          <div style={{width:38,height:38,borderRadius:9,background:C.amber,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontFamily:mono,fontWeight:800,color:C.bg,fontSize:19}}>L</span>
          </div>
          <div>
            <div style={{fontFamily:sans,fontWeight:800,fontSize:17,letterSpacing:.5}}>LOADED LOGISTICS</div>
            <div style={{fontFamily:mono,fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:C.faint}}>Dispatch terminal</div>
          </div>
        </div>
        <Label style={{marginBottom:6}}>Team password</Label>
        <input type="password" value={pw} autoFocus onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()}
          placeholder="Enter password" style={{width:"100%",background:C.bg,border:`1px solid ${err?C.red:C.line}`,borderRadius:8,color:C.ink,padding:"11px 13px",fontFamily:mono,fontSize:14}}/>
        {err && <div style={{color:C.red,fontFamily:mono,fontSize:11.5,marginTop:8}}>{err}</div>}
        <button onClick={go} disabled={busy} style={{width:"100%",marginTop:14,fontFamily:mono,fontSize:13,fontWeight:700,color:C.bg,background:busy?C.faint:C.amber,border:"none",borderRadius:8,padding:"11px",cursor:busy?"default":"pointer"}}>
          {busy?"Checking…":"Enter board"}</button>
        <div style={{fontFamily:sans,fontSize:11,color:C.faint,marginTop:14,lineHeight:1.5}}>Shared board for the Loaded Logistics team. Everyone who signs in sees the same live loads and chat.</div>
      </div>
    </div>
  );
}

/* ============================ APP ============================ */
const NAV=[["board","Board"],["loads","Loads"],["drivers","Drivers"],["pnl","Weekly P&L"],["monthly","Monthly P&L"],["lanes","Lane Book"],["inbox","Rate Cons"],["chat","Team"],["copilot","Copilot"]];
export default function App(){
  const [authed,setAuthed]=useState(!!api.token());
  const [loads,setLoads]=useState([]);
  const [view,setView]=useState("board");
  const [ready,setReady]=useState(false);
  const [showNew,setShowNew]=useState(false);

  async function refresh(){
    try{ const rows=await api.getLoads(); setLoads(rows); setReady(true); }
    catch(e){ if(String(e).includes("401")) setAuthed(false); }
  }
  useEffect(()=>{
    if(!authed) return;
    refresh();
    const id=setInterval(refresh,10000);
    return ()=>clearInterval(id);
  },[authed]);

  async function patchLoad(id,patch){
    setLoads(ls=>ls.map(l=>l.id===id?{...l,...patch}:l));            // optimistic
    try{ const row=await api.patchLoad(id,patch); setLoads(ls=>ls.map(l=>l.id===id?row:l)); }
    catch(e){ refresh(); }
  }
  async function removeLoad(id){
    setLoads(ls=>ls.filter(l=>l.id!==id));
    try{ await api.deleteLoad(id); }catch(e){ refresh(); }
  }
  async function addLoad(load){
    try{ const row=await api.createLoad(load); setLoads(ls=>[row,...ls]); }
    catch(e){ refresh(); }
  }
  function signOut(){ api.logout(); setAuthed(false); }

  const drivers=useMemo(()=>{
    const s=new Set(DRIVER_ORDER); loads.forEach(l=>l.driver&&s.add(l.driver)); return Array.from(s);
  },[loads]);

  if(!authed) return <Login onAuthed={()=>setAuthed(true)}/>;

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.ink,fontFamily:sans}}>
      <div style={{borderBottom:`1px solid ${C.line}`,background:C.panel,position:"sticky",top:0,zIndex:20}}>
        <div style={{maxWidth:1280,margin:"0 auto",padding:"12px 18px"}} className="flex items-center justify-between">
          <div className="flex items-center" style={{gap:12}}>
            <div style={{width:34,height:34,borderRadius:8,background:C.amber,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontFamily:mono,fontWeight:800,color:C.bg,fontSize:17}}>L</span>
            </div>
            <div>
              <div style={{fontFamily:sans,fontWeight:800,fontSize:16,letterSpacing:.5,color:C.ink}}>LOADED LOGISTICS</div>
              <div style={{fontFamily:mono,fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:C.faint}}>Dispatch terminal</div>
            </div>
          </div>
          <div className="flex items-center" style={{gap:14}}>
            <div className="flex items-center" style={{gap:7}}>
              <div style={{width:7,height:7,borderRadius:9,background:ready?C.green:C.amber}}/>
              <span style={{fontFamily:mono,fontSize:10.5,color:C.dim}}>{ready?"synced":"connecting"}</span>
            </div>
            <button onClick={signOut} style={{fontFamily:mono,fontSize:10.5,color:C.dim,background:"transparent",border:`1px solid ${C.line}`,borderRadius:6,padding:"5px 10px",cursor:"pointer"}}>Sign out</button>
          </div>
        </div>
        <div style={{maxWidth:1280,margin:"0 auto",padding:"0 18px"}}>
          <div className="flex" style={{gap:2,overflowX:"auto"}}>
            {NAV.map(([id,label])=>(
              <button key={id} onClick={()=>setView(id)} style={{fontFamily:sans,fontSize:12.5,fontWeight:600,letterSpacing:.4,
                color:view===id?C.ink:C.dim,background:"transparent",border:"none",borderBottom:`2px solid ${view===id?C.amber:"transparent"}`,
                padding:"10px 14px",cursor:"pointer",whiteSpace:"nowrap"}}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{maxWidth:1280,margin:"0 auto",padding:"16px 18px 60px"}}>
        <div style={{marginBottom:16}}><KpiBar loads={loads}/></div>
        {view==="board" && <Board loads={loads} patchLoad={patchLoad} removeLoad={removeLoad} drivers={drivers} onNewLoad={()=>setShowNew(true)}/>}
        {view==="loads" && <Ledger loads={loads}/>}
        {view==="drivers" && <Drivers loads={loads}/>}
        {view==="pnl" && <WeeklyPnL loads={loads}/>}
        {view==="monthly" && <MonthlyPnL loads={loads}/>}
        {view==="lanes" && <LaneBook loads={loads}/>}
        {view==="inbox" && <Inbox onAdd={addLoad}/>}
        {view==="chat" && <Chat loads={loads}/>}
        {view==="copilot" && <Copilot loads={loads}/>}

        {view==="inbox" && (
          <div style={{marginTop:16,maxWidth:760,fontFamily:sans,fontSize:11.5,color:C.faint,lineHeight:1.5,borderTop:`1px solid ${C.lineSoft}`,paddingTop:12}}>
            Paste-to-extract works now. Phase 2 wires your two Gmail inboxes so rate cons land here automatically — the extractor here is the same parser the email worker will use.
          </div>
        )}
      </div>

      {showNew && <NewLoad drivers={drivers} onClose={()=>setShowNew(false)} onSave={l=>{addLoad(l);setShowNew(false);setView("board");}}/>}
    </div>
  );
}
```

### `board/src/api.ts`

```ts
// API client for the Loaded Logistics board.
// Set VITE_API_URL to your deployed backend URL (e.g. https://loaded-api.up.railway.app).
const BASE: string = (import.meta as any).env?.VITE_API_URL || "";

const TOKEN_KEY = "ll_token";
export function token(): string { return localStorage.getItem(TOKEN_KEY) || ""; }
export function logout() { localStorage.removeItem(TOKEN_KEY); }

function authHeaders(): Record<string, string> {
  return { Authorization: "Bearer " + token(), "Content-Type": "application/json" };
}
async function req(path: string, opts: RequestInit = {}) {
  const r = await fetch(BASE + path, opts);
  if (r.status === 401) { logout(); throw new Error("HTTP 401"); }
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r;
}

export async function login(password: string): Promise<string | null> {
  const r = await fetch(BASE + "/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!r.ok) return null;
  const d = await r.json();
  localStorage.setItem(TOKEN_KEY, d.token);
  return d.token;
}

export async function getLoads(): Promise<any[]> {
  const r = await req("/api/loads", { headers: authHeaders() });
  return r.json();
}
export async function createLoad(load: any): Promise<any> {
  const r = await req("/api/loads", { method: "POST", headers: authHeaders(), body: JSON.stringify(load) });
  return r.json();
}
export async function patchLoad(id: string, patch: any): Promise<any> {
  const r = await req("/api/loads/" + id, { method: "PATCH", headers: authHeaders(), body: JSON.stringify(patch) });
  return r.json();
}
export async function deleteLoad(id: string): Promise<void> {
  await req("/api/loads/" + id, { method: "DELETE", headers: authHeaders() });
}

export async function getMessages(): Promise<any[]> {
  const r = await req("/api/messages", { headers: authHeaders() });
  return r.json();
}
export async function postMessage(m: any): Promise<any> {
  const r = await req("/api/messages", { method: "POST", headers: authHeaders(), body: JSON.stringify(m) });
  return r.json();
}

function parseJSON(text: string): any {
  let t = (text || "").trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b >= 0) t = t.slice(a, b + 1);
  return JSON.parse(t);
}
export async function extractLoad(text: string): Promise<any> {
  const r = await fetch(BASE + "/api/ai/extract", { method: "POST", headers: authHeaders(), body: JSON.stringify({ text }) });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || "extract failed"); }
  const d = await r.json();
  return parseJSON(d.text);
}
export async function copilotReply(messages: any[], context: any): Promise<string> {
  const r = await fetch(BASE + "/api/ai/copilot", { method: "POST", headers: authHeaders(), body: JSON.stringify({ messages, context }) });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || "copilot failed"); }
  const d = await r.json();
  return d.text;
}
```

### `board/src/main.tsx`

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### `board/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": false,
    "allowJs": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

### `board/vite.config.ts`

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Railway sets PORT at runtime; preview binds to it and allows the Railway domain.
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
  preview: {
    host: true,
    port: Number(process.env.PORT) || 4173,
    allowedHosts: true,
  },
});
```

### `dispatch-board.jsx`

```jsx
import React, { useState, useEffect, useMemo, useRef } from "react";

/* ============================ DATA ============================ */
const SEED = [{"id":"h1","date":"2025-05-27","rpm":1.46,"rate":800.0,"miles":415,"broker":"CH Robinson","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":240.0,"dh":133,"status":"Delivered"},{"id":"h2","date":"2025-05-28","rpm":1.61,"rate":800.0,"miles":426,"broker":"D&L Transport","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":240.0,"dh":70,"status":"Delivered"},{"id":"h3","date":"2025-06-04","rpm":1.64,"rate":850.0,"miles":407,"broker":"NFL Logistics","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":255.0,"dh":110,"status":"Delivered"},{"id":"h4","date":"2025-06-06","rpm":1.32,"rate":350.0,"miles":265,"broker":"ILG Logistics","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":105.0,"dh":null,"status":"Delivered"},{"id":"h5","date":"2025-06-10","rpm":1.96,"rate":500.0,"miles":169,"broker":"Custom Logistics","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":150.0,"dh":86,"status":"Delivered"},{"id":"h6","date":"2025-06-24","rpm":1.76,"rate":500.0,"miles":139,"broker":"Total Transportation","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":150.0,"dh":145,"status":"Delivered"},{"id":"h7","date":"2025-06-26","rpm":2.7,"rate":1100.0,"miles":406,"broker":"Agforce Transport","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":330.0,"dh":null,"status":"Delivered"},{"id":"h8","date":"2025-07-01","rpm":2.0,"rate":400.0,"miles":200,"broker":"Centran Logistics","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":120.0,"dh":null,"status":"Delivered"},{"id":"h9","date":"2025-07-22","rpm":1.75,"rate":700.0,"miles":199,"broker":"CH Robinson","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":210.0,"dh":199,"status":"Delivered"},{"id":"h10","date":"2025-07-24","rpm":1.84,"rate":900.0,"miles":244,"broker":"BBL Transportation","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":270.0,"dh":244,"status":"Delivered"},{"id":"h11","date":"2025-07-29","rpm":1.26,"rate":700.0,"miles":276,"broker":"Cleveland Logistics","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":210.0,"dh":276,"status":"Delivered"},{"id":"h12","date":"2025-07-31","rpm":2.07,"rate":825.0,"miles":199,"broker":"APT Industries","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":247.5,"dh":199,"status":"Delivered"},{"id":"h13","date":"2025-08-06","rpm":2.07,"rate":825.0,"miles":199,"broker":"APT Industries","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":247.5,"dh":199,"status":"Delivered"},{"id":"h14","date":"2025-08-09","rpm":1.84,"rate":900.0,"miles":244,"broker":"BBL Transportation","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":270.0,"dh":244,"status":"Delivered"},{"id":"h15","date":"2025-08-18","rpm":2.07,"rate":825.0,"miles":199,"broker":"APT Industries","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":247.5,"dh":199,"status":"Delivered"},{"id":"h16","date":"2025-08-19","rpm":1.84,"rate":900.0,"miles":244,"broker":"BBL Transportation","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":270.0,"dh":244,"status":"Delivered"},{"id":"h17","date":"2025-08-26","rpm":3.25,"rate":322.5,"miles":30,"broker":"CH Robinson","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":96.75,"dh":70,"status":"Delivered"},{"id":"h18","date":"2025-09-02","rpm":1.91,"rate":1150.0,"miles":325,"broker":"BBL Transportation","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":345.0,"dh":276,"status":"Delivered"},{"id":"h19","date":"2025-09-08","rpm":2.07,"rate":825.0,"miles":199,"broker":"APT Industries","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":247.5,"dh":199,"status":"Delivered"},{"id":"h20","date":"2025-09-15","rpm":2.42,"rate":650.0,"miles":134,"broker":"CH Robinson","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":195.0,"dh":134,"status":"Delivered"},{"id":"h21","date":"2025-09-16","rpm":2.5,"rate":500.0,"miles":400,"broker":"CKM Trucks","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":150.0,"dh":null,"status":"Delivered"},{"id":"h22","date":"2025-09-23","rpm":1.33,"rate":1200.0,"miles":900,"broker":"CKM Trucks","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":360.0,"dh":null,"status":"Delivered"},{"id":"h23","date":"2025-09-30","rpm":1.06,"rate":1600.0,"miles":1500,"broker":"CKM Trucks","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":480.0,"dh":null,"status":"Delivered"},{"id":"h24","date":"2025-10-06","rpm":1.33,"rate":400.0,"miles":300,"broker":"CKM Trucks","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":120.0,"dh":null,"status":"Delivered"},{"id":"h25","date":"2025-10-07","rpm":1.25,"rate":500.0,"miles":400,"broker":"CKM Trucks","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":150.0,"dh":null,"status":"Delivered"},{"id":"h26","date":"2025-10-14","rpm":1.66,"rate":500.0,"miles":300,"broker":"LEG Freight Solutions","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":150.0,"dh":null,"status":"Delivered"},{"id":"h27","date":"2025-10-30","rpm":1.64,"rate":700.0,"miles":426,"broker":"Middle Sis Inc","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":210.0,"dh":null,"status":"Delivered"},{"id":"h28","date":"2025-11-02","rpm":2.11,"rate":900.0,"miles":426,"broker":"Flock Freight","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":270.0,"dh":null,"status":"Delivered"},{"id":"h29","date":"2025-11-03","rpm":1.86,"rate":700.0,"miles":375,"broker":"Trupoint Logistics","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":210.0,"dh":null,"status":"Delivered"},{"id":"h30","date":"2025-11-04","rpm":2.09,"rate":1300.0,"miles":620,"broker":"WSI Freight","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":390.0,"dh":null,"status":"Delivered"},{"id":"h31","date":"2025-11-05","rpm":1.69,"rate":700.0,"miles":412,"broker":"C Cross Logistics","driver":"Derek","unit":"","pay":1375.0,"fuel":1074.0,"repair":null,"dispatch":210.0,"dh":null,"status":"Delivered"},{"id":"h32","date":"2025-11-11","rpm":1.85,"rate":900.0,"miles":486,"broker":"CH Robinson","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":270.0,"dh":null,"status":"Delivered"},{"id":"h33","date":"2025-11-12","rpm":37.5,"rate":150.0,"miles":4,"broker":"Destination Transport","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":45.0,"dh":null,"status":"Delivered"},{"id":"h34","date":"2025-11-13","rpm":1.08,"rate":450.0,"miles":486,"broker":"CH Robinson","driver":"Derek","unit":"","pay":716.0,"fuel":400.0,"repair":null,"dispatch":135.0,"dh":null,"status":"Delivered"},{"id":"h35","date":"2025-11-24","rpm":2.25,"rate":1550.0,"miles":686,"broker":"HD Shipping","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":465.0,"dh":null,"status":"Delivered"},{"id":"h36","date":"2025-11-25","rpm":1.97,"rate":2000.0,"miles":1011,"broker":"HD Shipping","driver":"Derek","unit":"","pay":969.0,"fuel":707.0,"repair":null,"dispatch":600.0,"dh":null,"status":"Delivered"},{"id":"h37","date":"2025-12-01","rpm":1.99,"rate":750.0,"miles":376,"broker":"Flock Freight","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":225.0,"dh":null,"status":"Delivered"},{"id":"h38","date":"2025-12-02","rpm":1.84,"rate":1200.0,"miles":582,"broker":"Spot Freight","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":360.0,"dh":60,"status":"Delivered"},{"id":"h39","date":"2025-12-03","rpm":1.31,"rate":900.0,"miles":437,"broker":"CH Robinson","driver":"Derek","unit":"","pay":1200.0,"fuel":1214.0,"repair":null,"dispatch":270.0,"dh":245,"status":"Delivered"},{"id":"h40","date":"2025-12-16","rpm":1.8,"rate":450.0,"miles":125,"broker":"APT Industries","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":135.0,"dh":125,"status":"Delivered"},{"id":"h41","date":"2025-12-17","rpm":1.19,"rate":400.0,"miles":168,"broker":"RTS","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":120.0,"dh":168,"status":"Delivered"},{"id":"h42","date":"2025-12-18","rpm":2.32,"rate":1400.0,"miles":461,"broker":"MegaCorp","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":420.0,"dh":141,"status":"Delivered"},{"id":"h43","date":"2025-12-19","rpm":0.5,"rate":300.0,"miles":600,"broker":"Allen Lund Company","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":90.0,"dh":null,"status":"Delivered"},{"id":"h44","date":"2026-01-02","rpm":1.62,"rate":1250.0,"miles":770,"broker":"Summitt Logistics","driver":"TJ","unit":"2","pay":424.0,"fuel":319.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h45","date":"2026-01-06","rpm":1.62,"rate":750.0,"miles":461,"broker":"MegaCorp","driver":"TJ","unit":"2","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h46","date":"2026-01-08","rpm":1.6,"rate":1500.0,"miles":936,"broker":"FreightFlex","driver":"TJ","unit":"2","pay":781.0,"fuel":576.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h47","date":"2026-01-12","rpm":2.72,"rate":1500.0,"miles":550,"broker":"FreightFlex","driver":"TJ","unit":"2","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h48","date":"2026-01-13","rpm":3.8,"rate":950.0,"miles":250,"broker":"Ryan Transportation","driver":"TJ","unit":"2","pay":830.0,"fuel":600.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h49","date":"2026-01-14","rpm":1.76,"rate":1250.0,"miles":710,"broker":"TA Services","driver":"TJ","unit":"2","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h50","date":"2026-01-20","rpm":1.72,"rate":1754.0,"miles":1018,"broker":"Norfleet Logistics","driver":"TJ","unit":"2","pay":899.0,"fuel":750.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h51","date":"2026-01-22","rpm":1.55,"rate":961.0,"miles":618,"broker":"Norfleet Logistics","driver":"TJ","unit":"2","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h52","date":"2026-01-26","rpm":1.1,"rate":725.0,"miles":656,"broker":"Norfleet Logistics","driver":"TJ","unit":"2","pay":380.0,"fuel":300.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h53","date":"2026-01-28","rpm":1.84,"rate":1643.0,"miles":894,"broker":"Norfleet Logistics","driver":"John","unit":"2","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h54","date":"2026-01-29","rpm":2.0,"rate":725.0,"miles":336,"broker":"Norfleet Logistics","driver":"John","unit":"1","pay":650.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h55","date":"2026-01-29","rpm":1.84,"rate":1589.25,"miles":860,"broker":"Norfleet Logistics","driver":"Chris","unit":"2","pay":780.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h56","date":"2026-02-04","rpm":4.29,"rate":1800.0,"miles":419,"broker":"Sage Freight","driver":"Chris","unit":"2","pay":262.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h57","date":"2026-02-04","rpm":4.29,"rate":1800.0,"miles":419,"broker":"Sage Freight","driver":"John","unit":"3","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h58","date":"2026-02-04","rpm":4.29,"rate":1800.0,"miles":419,"broker":"Sage Freight","driver":"TJ","unit":"4","pay":525.0,"fuel":500.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h59","date":"2026-02-05","rpm":2.58,"rate":1800.0,"miles":695,"broker":"TQL","driver":"Chris","unit":"2","pay":450.0,"fuel":550.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h60","date":"2026-02-05","rpm":2.21,"rate":900.0,"miles":406,"broker":"NT Logistics","driver":"TJ","unit":"4","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h61","date":"2026-02-05","rpm":2.21,"rate":900.0,"miles":406,"broker":"NT Logistics","driver":"John","unit":"3","pay":500.0,"fuel":450.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h62","date":"2026-02-06","rpm":1.85,"rate":2372.0,"miles":1280,"broker":"Norfleet Logistics","driver":"John","unit":"3","pay":768.0,"fuel":798.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h63","date":"2026-02-06","rpm":1.8,"rate":2700.0,"miles":1500,"broker":"Green Logistics LLC","driver":"Chris","unit":"2","pay":906.0,"fuel":700.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h64","date":"2026-02-09","rpm":1.66,"rate":1059.0,"miles":637,"broker":"Norfleet Logistics","driver":"John","unit":"3","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h65","date":"2026-02-10","rpm":2.0,"rate":2000.0,"miles":1000,"broker":"TQL","driver":"Chris","unit":"2","pay":630.0,"fuel":719.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h66","date":"2026-02-11","rpm":2.02,"rate":2163.0,"miles":1069,"broker":"Norfleet Logistics","driver":"John","unit":"3","pay":1023.0,"fuel":542.5,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h67","date":"2026-02-11","rpm":1.75,"rate":1526.0,"miles":870,"broker":"Norfleet Logistics","driver":"TJ","unit":"4","pay":478.5,"fuel":500.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h68","date":"2026-02-12","rpm":2.88,"rate":1350.0,"miles":468,"broker":"TQL","driver":"Chris","unit":"2","pay":294.0,"fuel":272.29,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h69","date":"2026-02-12","rpm":2.03,"rate":1435.0,"miles":705,"broker":"Norfleet Logistics","driver":"TJ","unit":"4","pay":475.55,"fuel":550.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h70","date":"2026-02-16","rpm":4.25,"rate":3400.0,"miles":800,"broker":"TQL","driver":"John","unit":"3","pay":605.0,"fuel":413.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h71","date":"2026-02-18","rpm":2.69,"rate":2000.0,"miles":743,"broker":"TQL","driver":"John","unit":"3","pay":550.0,"fuel":400.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h72","date":"2026-02-18","rpm":1.54,"rate":2200.0,"miles":713,"broker":"TQL","driver":"TJ","unit":"4","pay":838.0,"fuel":1050.0,"repair":300.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h73","date":"2026-02-19","rpm":2.6,"rate":1200.0,"miles":615,"broker":"SPI Logistics","driver":"TJ","unit":"4","pay":340.0,"fuel":378.0,"repair":300.0,"dispatch":80.0,"dh":null,"status":"Delivered"},{"id":"h74","date":"2026-02-23","rpm":2.6,"rate":1150.0,"miles":441,"broker":"Trident Logistics","driver":"John","unit":"3","pay":200.0,"fuel":260.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h75","date":"2026-02-23","rpm":2.7,"rate":1350.0,"miles":499,"broker":"TQL","driver":"John","unit":"3","pay":612.0,"fuel":200.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h76","date":"2026-02-23","rpm":2.22,"rate":1000.0,"miles":450,"broker":"White Acre Logistics","driver":"TJ","unit":"4","pay":null,"fuel":250.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h77","date":"2026-02-23","rpm":1.53,"rate":2200.0,"miles":1430,"broker":"TQL","driver":"Chris","unit":"2","pay":340.0,"fuel":256.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h78","date":"2026-02-24","rpm":3.75,"rate":1500.0,"miles":400,"broker":"Pivot Supply","driver":"TJ","unit":"4","pay":null,"fuel":330.9,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h79","date":"2026-02-25","rpm":2.44,"rate":1050.0,"miles":430,"broker":"PVG Brokerage","driver":"TJ","unit":"4","pay":724.0,"fuel":200.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h80","date":"2026-02-25","rpm":1.88,"rate":900.0,"miles":460,"broker":"RTS","driver":"John","unit":"3","pay":180.0,"fuel":480.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h81","date":"2026-02-26","rpm":3.36,"rate":1050.0,"miles":312,"broker":"PVG Brokerage","driver":"Chris","unit":"2","pay":200.0,"fuel":309.42,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h82","date":"2026-02-26","rpm":2.8,"rate":1950.0,"miles":695,"broker":"Trinity Logistics","driver":"John","unit":"3","pay":null,"fuel":349.17,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h83","date":"2026-02-27","rpm":2.3,"rate":1500.0,"miles":650,"broker":"Texas Customer","driver":"John","unit":"3","pay":807.0,"fuel":200.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h84","date":"2026-02-27","rpm":2.81,"rate":1800.0,"miles":615,"broker":"Lipsey Logistics","driver":"Chris","unit":"2","pay":390.0,"fuel":220.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h85","date":"2026-03-01","rpm":2.5,"rate":1400.0,"miles":559,"broker":"TQL","driver":"John","unit":"3","pay":335.4,"fuel":443.6,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h86","date":"2026-03-02","rpm":2.9,"rate":1900.0,"miles":653,"broker":"Barnhart Logistics","driver":"John","unit":"3","pay":391.8,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h87","date":"2026-03-02","rpm":2.63,"rate":1250.0,"miles":475,"broker":"PVG Brokerage","driver":"Chris","unit":"2","pay":300.0,"fuel":370.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h88","date":"2026-03-02","rpm":2.95,"rate":1250.0,"miles":423,"broker":"PVG Brokerage","driver":"TJ","unit":"4","pay":null,"fuel":292.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h89","date":"2026-03-03","rpm":1.82,"rate":1500.0,"miles":824,"broker":"TQL","driver":"TJ","unit":"2","pay":750.0,"fuel":302.54,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h90","date":"2026-03-03","rpm":1.82,"rate":1500.0,"miles":824,"broker":"TQL","driver":"Chris","unit":"2","pay":494.0,"fuel":437.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h91","date":"2026-03-03","rpm":2.39,"rate":1100.0,"miles":460,"broker":"Uber Freight","driver":"John","unit":"3","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h92","date":"2026-03-03","rpm":2.82,"rate":1300.0,"miles":null,"broker":"D&L Transport","driver":"John","unit":"3","pay":400.0,"fuel":719.74,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h93","date":"2026-03-04","rpm":2.44,"rate":1200.0,"miles":490,"broker":"Value Logistics","driver":"John","unit":"3","pay":294.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h94","date":"2026-03-04","rpm":2.5,"rate":3000.0,"miles":1424,"broker":"TQL","driver":"TJ","unit":"4","pay":980.0,"fuel":1300.0,"repair":595.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h95","date":"2026-03-04","rpm":2.37,"rate":2500.0,"miles":1053,"broker":"Universal Logistics","driver":"Chris","unit":"2","pay":631.8,"fuel":721.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h96","date":"2026-03-06","rpm":2.1,"rate":3750.0,"miles":1781,"broker":"Jones Transport","driver":"John","unit":"3","pay":1068.0,"fuel":922.0,"repair":2000.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h97","date":"2026-03-06","rpm":2.34,"rate":2500.0,"miles":1060,"broker":"Nationwide Transport","driver":"Chris","unit":"2","pay":250.0,"fuel":324.57,"repair":900.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h98","date":"2026-03-09","rpm":1.62,"rate":700.0,"miles":430,"broker":"Ark Logistics","driver":"John","unit":"3","pay":258.0,"fuel":511.0,"repair":2000.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h99","date":"2026-03-10","rpm":2.76,"rate":1700.0,"miles":615,"broker":"Trinity Logistics","driver":"Chris","unit":"2","pay":569.0,"fuel":600.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h100","date":"2026-03-12","rpm":2.66,"rate":1600.0,"miles":555,"broker":"Heniff Logistics","driver":"Chris","unit":"2","pay":333.0,"fuel":936.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h101","date":"2026-03-13","rpm":3.39,"rate":1750.0,"miles":515,"broker":"ITS Logistics","driver":"Chris","unit":"2","pay":323.0,"fuel":490.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h102","date":"2026-03-16","rpm":2.11,"rate":1050.0,"miles":496,"broker":"PVG Brokerage","driver":"Chris","unit":"2","pay":300.0,"fuel":257.01,"repair":195.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h103","date":"2026-03-17","rpm":2.36,"rate":1700.0,"miles":720,"broker":"Tri-State Logistics","driver":"Chris","unit":"2","pay":432.0,"fuel":540.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h104","date":"2026-03-18","rpm":2.08,"rate":1000.0,"miles":479,"broker":"Trident Transport","driver":"Chris","unit":"2","pay":287.0,"fuel":334.0,"repair":40.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h105","date":"2026-03-18","rpm":2.08,"rate":1500.0,"miles":720,"broker":"Tri-State Logistics","driver":"TJ","unit":"4","pay":null,"fuel":420.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h106","date":"2026-03-18","rpm":2.22,"rate":1600.0,"miles":720,"broker":"Tri-State Logistics","driver":"John","unit":"3","pay":435.0,"fuel":466.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h107","date":"2026-03-19","rpm":3.66,"rate":2200.0,"miles":600,"broker":"Pepsi Co","driver":"Chris","unit":"2","pay":360.0,"fuel":650.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h108","date":"2026-03-20","rpm":2.4,"rate":2500.0,"miles":1040,"broker":"TQL","driver":"John","unit":"3","pay":630.0,"fuel":490.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h109","date":"2026-03-20","rpm":2.38,"rate":1000.0,"miles":420,"broker":"Cargo Solution","driver":"TJ","unit":"4","pay":629.75,"fuel":360.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h110","date":"2026-03-23","rpm":2.99,"rate":1400.0,"miles":468,"broker":"Onewaytrailers","driver":"John","unit":"3","pay":280.0,"fuel":387.14,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h111","date":"2026-03-23","rpm":2.37,"rate":1500.0,"miles":631,"broker":"Armstrong Transport","driver":"Chris","unit":"2","pay":425.0,"fuel":690.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h112","date":"2026-03-24","rpm":2.27,"rate":3300.0,"miles":1450,"broker":"Ten Logistics","driver":"Chris","unit":"2","pay":916.0,"fuel":1392.0,"repair":20.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h113","date":"2026-03-25","rpm":2.51,"rate":4000.0,"miles":1590,"broker":"Navajo Transport","driver":"John","unit":"3","pay":960.0,"fuel":1038.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h114","date":"2026-03-25","rpm":3.04,"rate":1600.0,"miles":525,"broker":"TQL","driver":"TJ","unit":"4","pay":null,"fuel":560.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h115","date":"2026-03-25","rpm":2.8,"rate":1400.0,"miles":500,"broker":"TQL","driver":"TJ","unit":"4","pay":275.0,"fuel":850.0,"repair":null,"dispatch":150.0,"dh":null,"status":"Delivered"},{"id":"h116","date":"2026-03-27","rpm":2.42,"rate":1700.0,"miles":700,"broker":"TQL","driver":"Jeremy","unit":"5","pay":320.0,"fuel":800.0,"repair":null,"dispatch":125.0,"dh":null,"status":"Delivered"},{"id":"h117","date":"2026-03-29","rpm":2.61,"rate":2750.0,"miles":1050,"broker":"TQL","driver":"Jeremy","unit":"5","pay":630.0,"fuel":950.0,"repair":null,"dispatch":140.0,"dh":null,"status":"Delivered"},{"id":"h118","date":"2026-03-30","rpm":2.1,"rate":1400.0,"miles":664,"broker":"C Cross Logistics","driver":"TJ","unit":"4","pay":null,"fuel":484.4,"repair":null,"dispatch":70.0,"dh":null,"status":"Delivered"},{"id":"h119","date":"2026-03-30","rpm":2.0,"rate":1000.0,"miles":480,"broker":"Visual Pak Logistics","driver":"John","unit":"3","pay":300.0,"fuel":660.0,"repair":null,"dispatch":150.0,"dh":null,"status":"Delivered"},{"id":"h120","date":"2026-03-31","rpm":2.48,"rate":3700.0,"miles":1490,"broker":"Confiance Logistics","driver":"Jeremy","unit":"5","pay":894.0,"fuel":1500.0,"repair":null,"dispatch":150.0,"dh":null,"status":"Delivered"},{"id":"h121","date":"2026-03-31","rpm":3.43,"rate":2750.0,"miles":800,"broker":"TQL","driver":"TJ","unit":"4","pay":null,"fuel":700.0,"repair":null,"dispatch":100.0,"dh":null,"status":"Delivered"},{"id":"h122","date":"2026-04-01","rpm":2.36,"rate":1250.0,"miles":528,"broker":"White Acre Logistics","driver":"TJ","unit":"4","pay":1100.0,"fuel":760.0,"repair":null,"dispatch":60.0,"dh":null,"status":"Delivered"},{"id":"h123","date":"2026-04-02","rpm":2.71,"rate":1200.0,"miles":442,"broker":"RXO Logistics","driver":"Jeremy","unit":"5","pay":319.24,"fuel":504.6,"repair":null,"dispatch":60.0,"dh":null,"status":"Delivered"},{"id":"h124","date":"2026-04-02","rpm":2.37,"rate":950.0,"miles":400,"broker":"PVG Brokerage","driver":"John","unit":"3","pay":240.0,"fuel":466.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h125","date":"2026-04-03","rpm":2.37,"rate":950.0,"miles":400,"broker":"PVG Brokerage","driver":"John","unit":"3","pay":240.0,"fuel":545.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h126","date":"2026-04-03","rpm":2.75,"rate":1100.0,"miles":400,"broker":"PVG Brokerage","driver":"Jeremy","unit":"5","pay":null,"fuel":452.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h127","date":"2026-04-04","rpm":2.75,"rate":1100.0,"miles":400,"broker":"PVG Brokerage","driver":"Jeremy","unit":"5","pay":480.0,"fuel":125.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h128","date":"2026-04-04","rpm":2.37,"rate":950.0,"miles":400,"broker":"PVG Brokerage","driver":"John","unit":"3","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h129","date":"2026-04-05","rpm":2.37,"rate":950.0,"miles":400,"broker":"PVG Brokerage","driver":"John","unit":"3","pay":480.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h130","date":"2026-04-06","rpm":2.53,"rate":3300.0,"miles":1300,"broker":"TQL","driver":"Jeremy","unit":"5","pay":780.0,"fuel":1100.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h131","date":"2026-04-08","rpm":2.27,"rate":1550.0,"miles":680,"broker":"TQL","driver":"Jeremy","unit":"5","pay":360.0,"fuel":653.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h132","date":"2026-04-10","rpm":1.86,"rate":1050.0,"miles":563,"broker":"Bee Mac Logistics","driver":"Jeremy","unit":"5","pay":330.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h133","date":"2026-04-13","rpm":2.78,"rate":2300.0,"miles":825,"broker":"Dedicated Logistics","driver":"Jeremy","unit":"5","pay":495.0,"fuel":424.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h134","date":"2026-04-14","rpm":4.4,"rate":3347.0,"miles":759,"broker":"Sage Freight","driver":"Jeremy","unit":"5","pay":400.0,"fuel":1110.0,"repair":null,"dispatch":200.0,"dh":null,"status":"Delivered"},{"id":"h135","date":"2026-04-14","rpm":2.54,"rate":1525.0,"miles":600,"broker":"Direct Connect","driver":"TJ","unit":"3","pay":1186.0,"fuel":849.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h136","date":"2026-04-15","rpm":2.8,"rate":2100.0,"miles":750,"broker":"TQL","driver":"TJ","unit":"3","pay":null,"fuel":80.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h137","date":"2026-04-16","rpm":2.53,"rate":3300.0,"miles":1300,"broker":"TQL","driver":"John","unit":"2","pay":840.0,"fuel":941.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h138","date":"2026-04-17","rpm":2.37,"rate":1400.0,"miles":589,"broker":"Priority","driver":"TJ","unit":"3","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h139","date":"2026-04-17","rpm":3.25,"rate":1300.0,"miles":400,"broker":"Forward Air","driver":"Jeremy","unit":"5","pay":null,"fuel":596.85,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h140","date":"2026-04-18","rpm":2.84,"rate":2150.0,"miles":820,"broker":"Direct Connect","driver":"Jeremy","unit":"5","pay":341.0,"fuel":570.0,"repair":null,"dispatch":750.0,"dh":null,"status":"Delivered"},{"id":"h141","date":"2026-04-20","rpm":3.25,"rate":1625.0,"miles":500,"broker":"American Diamond","driver":"John","unit":"2","pay":340.0,"fuel":450.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h142","date":"2026-04-20","rpm":2.89,"rate":2000.0,"miles":690,"broker":"Listo Services","driver":"Jeremy","unit":"5","pay":345.0,"fuel":420.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h143","date":"2026-04-21","rpm":2.5,"rate":2000.0,"miles":800,"broker":"MegaCorp","driver":"Jeremy","unit":"5","pay":480.0,"fuel":400.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h144","date":"2026-04-21","rpm":null,"rate":1200.0,"miles":null,"broker":"","driver":"John","unit":"2","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h145","date":"2026-04-21","rpm":4.57,"rate":1900.0,"miles":678,"broker":"Ryan Transportation","driver":"John","unit":"2","pay":null,"fuel":483.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h146","date":"2026-04-22","rpm":2.75,"rate":1100.0,"miles":400,"broker":"PVG Brokerage","driver":"TJ","unit":"3","pay":220.0,"fuel":310.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h147","date":"2026-04-26","rpm":2.78,"rate":2300.0,"miles":825,"broker":"Dedicated Logistics","driver":"John","unit":"2","pay":425.0,"fuel":560.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h148","date":"2026-04-26","rpm":3.75,"rate":300.0,"miles":80,"broker":"PVG Brokerage","driver":"TJ","unit":"3","pay":175.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h149","date":"2026-04-27","rpm":2.77,"rate":500.0,"miles":180,"broker":"Infinity Logistics","driver":"TJ","unit":"3","pay":100.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h150","date":"2026-04-28","rpm":3.26,"rate":1000.0,"miles":306,"broker":"PVG Brokerage","driver":"TJ","unit":"3","pay":200.0,"fuel":290.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h151","date":"2026-04-28","rpm":3.11,"rate":2700.0,"miles":850,"broker":"RXO Logistics","driver":"John","unit":"2","pay":null,"fuel":1110.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h152","date":"2026-04-28","rpm":2.95,"rate":1300.0,"miles":440,"broker":"Value Logistics","driver":"Jeremy","unit":"5","pay":null,"fuel":1050.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h153","date":"2026-04-29","rpm":2.58,"rate":3100.0,"miles":1200,"broker":"Blue Fawney Logistics","driver":"Jeremy","unit":"5","pay":null,"fuel":600.0,"repair":null,"dispatch":600.0,"dh":null,"status":"Delivered"},{"id":"h154","date":"2026-04-30","rpm":4.52,"rate":1300.0,"miles":552,"broker":"DHL","driver":"John","unit":"2","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h155","date":"2026-04-30","rpm":null,"rate":1200.0,"miles":null,"broker":"Trinity Logistics","driver":"John","unit":"2","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h156","date":"2026-05-01","rpm":2.6,"rate":1300.0,"miles":500,"broker":"DHL","driver":"Jeremy","unit":"5","pay":300.0,"fuel":620.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h157","date":"2026-05-02","rpm":2.37,"rate":1450.0,"miles":611,"broker":"ARL Logistics","driver":"Jeremy","unit":"5","pay":320.0,"fuel":800.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h158","date":"2026-05-03","rpm":4.04,"rate":2000.0,"miles":494,"broker":"Armstrong Transport","driver":"John","unit":"2","pay":343.0,"fuel":761.5,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h159","date":"2026-05-03","rpm":3.05,"rate":2200.0,"miles":null,"broker":"Armstrong Transport","driver":"Jeremy","unit":"5","pay":432.0,"fuel":463.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h160","date":"2026-05-04","rpm":4.8,"rate":1300.0,"miles":500,"broker":"DHL","driver":"TJ","unit":"3","pay":null,"fuel":430.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h161","date":"2026-05-04","rpm":null,"rate":1100.0,"miles":null,"broker":"TA Services","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h162","date":"2026-05-05","rpm":3.6,"rate":2200.0,"miles":610,"broker":"Spot Freight","driver":"John","unit":"2","pay":490.0,"fuel":469.0,"repair":567.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h163","date":"2026-05-06","rpm":4.0,"rate":2000.0,"miles":500,"broker":"Armstrong Transport","driver":"TJ","unit":"3","pay":660.0,"fuel":410.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h164","date":"2026-05-06","rpm":3.0,"rate":1800.0,"miles":600,"broker":"NFI Logistics","driver":"Jeremy","unit":"5","pay":365.0,"fuel":610.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h165","date":"2026-05-07","rpm":4.0,"rate":2000.0,"miles":494,"broker":"Armstrong Transport","driver":"John","unit":"2","pay":325.0,"fuel":470.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h166","date":"2026-05-07","rpm":3.44,"rate":2000.0,"miles":580,"broker":"Armstrong Transport","driver":"Jeremy","unit":"5","pay":360.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h167","date":"2026-05-08","rpm":2.77,"rate":1450.0,"miles":522,"broker":"Destination Transport","driver":"Jeremy","unit":"5","pay":320.0,"fuel":468.0,"repair":null,"dispatch":950.0,"dh":null,"status":"Delivered"},{"id":"h168","date":"2026-05-09","rpm":3.05,"rate":2200.0,"miles":720,"broker":"Armstrong Transport","driver":"Jeremy","unit":"5","pay":420.0,"fuel":227.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h169","date":"2026-05-11","rpm":2.53,"rate":1350.0,"miles":533,"broker":"Fox Logistics","driver":"TJ","unit":"3","pay":null,"fuel":548.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h170","date":"2026-05-11","rpm":2.5,"rate":1500.0,"miles":600,"broker":"TA Services","driver":"Jeremy","unit":"5","pay":360.0,"fuel":538.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h171","date":"2026-05-11","rpm":3.0,"rate":1800.0,"miles":600,"broker":"NFI Logistics","driver":"John","unit":"2","pay":360.0,"fuel":561.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h172","date":"2026-05-13","rpm":3.2,"rate":1700.0,"miles":530,"broker":"Midlink Logistics","driver":"TJ","unit":"3","pay":750.0,"fuel":520.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h173","date":"2026-05-15","rpm":4.33,"rate":1300.0,"miles":300,"broker":"Candor Expedite","driver":"Jeremy","unit":"5","pay":125.0,"fuel":530.0,"repair":1100.0,"dispatch":550.0,"dh":null,"status":"Delivered"},{"id":"h174","date":"2026-05-16","rpm":3.01,"rate":1650.0,"miles":548,"broker":"Rite Way Transport","driver":"John","unit":"2","pay":325.0,"fuel":426.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h175","date":"2026-05-16","rpm":3.1,"rate":1700.0,"miles":548,"broker":"Armstrong Transport","driver":"Jeremy","unit":"5","pay":340.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h176","date":"2026-05-18","rpm":2.8,"rate":1100.0,"miles":392,"broker":"TA Services","driver":"John","unit":"2","pay":235.0,"fuel":428.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h177","date":"2026-05-18","rpm":2.42,"rate":1550.0,"miles":642,"broker":"Priority1","driver":"Jeremy","unit":"5","pay":385.0,"fuel":412.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h178","date":"2026-05-19","rpm":5.17,"rate":2000.0,"miles":811,"broker":"DHL","driver":"TJ","unit":"3","pay":null,"fuel":920.0,"repair":700.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h179","date":"2026-05-19","rpm":null,"rate":2200.0,"miles":null,"broker":"England Logistics","driver":"TJ","unit":"3","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h180","date":"2026-05-19","rpm":3.25,"rate":1200.0,"miles":369,"broker":"UACL Logistics","driver":"John","unit":"2","pay":370.0,"fuel":721.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h181","date":"2026-05-19","rpm":3.08,"rate":2000.0,"miles":649,"broker":"Armstrong Transport","driver":"Jeremy","unit":"5","pay":395.0,"fuel":558.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h182","date":"2026-05-21","rpm":2.58,"rate":2000.0,"miles":775,"broker":"Armstrong Transport","driver":"TJ","unit":"3","pay":1045.0,"fuel":400.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h183","date":"2026-05-22","rpm":3.0,"rate":1800.0,"miles":600,"broker":"NFI Logistics","driver":"Jeremy","unit":"5","pay":430.0,"fuel":685.0,"repair":null,"dispatch":700.0,"dh":null,"status":"Delivered"},{"id":"h184","date":"2026-05-23","rpm":3.36,"rate":1600.0,"miles":476,"broker":"TQL","driver":"Jeremy","unit":"5","pay":null,"fuel":465.0,"repair":250.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h185","date":"2026-05-25","rpm":2.69,"rate":2697.0,"miles":1000,"broker":"Circle Logistics","driver":"TJ","unit":"3","pay":null,"fuel":792.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h186","date":"2026-05-25","rpm":3.65,"rate":1800.0,"miles":493,"broker":"MegaCorp","driver":"Jeremy","unit":"5","pay":200.0,"fuel":465.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h187","date":"2026-05-26","rpm":2.71,"rate":1700.0,"miles":627,"broker":"Armstrong Transport","driver":"TJ","unit":"3","pay":null,"fuel":638.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h188","date":"2026-05-26","rpm":2.91,"rate":1700.0,"miles":584,"broker":"BBI Logistics","driver":"Jeremy","unit":"5","pay":450.0,"fuel":364.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h189","date":"2026-05-27","rpm":3.96,"rate":2500.0,"miles":620,"broker":"Longship","driver":"Jeremy","unit":"5","pay":540.0,"fuel":467.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h190","date":"2026-05-27","rpm":2.29,"rate":1500.0,"miles":655,"broker":"Freight Management","driver":"TJ","unit":"3","pay":null,"fuel":260.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h191","date":"2026-05-28","rpm":3.03,"rate":2000.0,"miles":660,"broker":"Armstrong Transport","driver":"TJ","unit":"3","pay":1760.0,"fuel":780.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h192","date":"2026-05-29","rpm":2.38,"rate":2300.0,"miles":964,"broker":"Pam Transport","driver":"John","unit":"","pay":570.0,"fuel":200.0,"repair":null,"dispatch":850.0,"dh":null,"status":"Delivered"},{"id":"h193","date":"2026-05-29","rpm":3.26,"rate":2000.0,"miles":612,"broker":"Armstrong Transport","driver":"Jeremy","unit":"5","pay":735.0,"fuel":367.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h194","date":"2026-05-30","rpm":3.72,"rate":1980.0,"miles":532,"broker":"Steam Logistics","driver":"TJ","unit":"3","pay":null,"fuel":426.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h195","date":"2026-05-31","rpm":3.43,"rate":2400.0,"miles":698,"broker":"Armstrong Transport","driver":"TJ","unit":"3","pay":738.0,"fuel":715.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h196","date":"2026-06-01","rpm":2.96,"rate":2000.0,"miles":675,"broker":"Central Freight","driver":"Jeremy","unit":"5","pay":410.0,"fuel":715.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h197","date":"2026-06-01","rpm":4.42,"rate":2500.0,"miles":565,"broker":"TQL","driver":"John","unit":"","pay":null,"fuel":400.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h198","date":"2026-06-02","rpm":2.77,"rate":1000.0,"miles":360,"broker":"PVG Brokerage","driver":"John","unit":"","pay":555.0,"fuel":900.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h199","date":"2026-06-02","rpm":null,"rate":2400.0,"miles":null,"broker":"Armstrong Transport","driver":"Jeremy","unit":"5","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h200","date":"2026-06-03","rpm":7.04,"rate":2600.0,"miles":710,"broker":"Central Freight","driver":"Jeremy","unit":"5","pay":450.0,"fuel":980.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h201","date":"2026-06-04","rpm":3.44,"rate":2100.0,"miles":610,"broker":"Online Freight","driver":"TJ","unit":"3","pay":null,"fuel":500.0,"repair":null,"dispatch":900.0,"dh":null,"status":"Delivered"},{"id":"h202","date":"2026-06-06","rpm":3.42,"rate":2400.0,"miles":700,"broker":"Armstrong Transport","driver":"TJ","unit":"3","pay":810.0,"fuel":348.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h203","date":"2026-06-09","rpm":2.66,"rate":2050.0,"miles":770,"broker":"Integrity Logistics","driver":"TJ","unit":"3","pay":null,"fuel":740.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h204","date":"2026-06-11","rpm":2.3,"rate":1500.0,"miles":650,"broker":"TQL","driver":"TJ","unit":"3","pay":852.0,"fuel":651.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h205","date":"2026-06-11","rpm":2.7,"rate":1000.0,"miles":370,"broker":"TQL","driver":"Jeremy","unit":"5","pay":250.0,"fuel":470.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h206","date":"2026-06-12","rpm":3.24,"rate":1200.0,"miles":380,"broker":"Spot Freight","driver":"Jeremy","unit":"5","pay":260.0,"fuel":455.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h207","date":"2026-06-12","rpm":3.09,"rate":1500.0,"miles":484,"broker":"Armstrong Transport","driver":"TJ","unit":"3","pay":null,"fuel":372.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h208","date":"2026-06-13","rpm":2.72,"rate":1700.0,"miles":623,"broker":"TQL","driver":"Jeremy","unit":"5","pay":380.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h209","date":"2026-06-13","rpm":3.26,"rate":1500.0,"miles":460,"broker":"TQL","driver":"TJ","unit":"3","pay":567.0,"fuel":210.0,"repair":null,"dispatch":450.0,"dh":null,"status":"Delivered"},{"id":"h210","date":"2026-06-15","rpm":2.4,"rate":1800.0,"miles":750,"broker":"TAB","driver":"Jeremy","unit":"5","pay":475.0,"fuel":544.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h211","date":"2026-06-16","rpm":2.88,"rate":1875.0,"miles":650,"broker":"Around The Clock","driver":"TJ","unit":"4","pay":null,"fuel":700.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h212","date":"2026-06-16","rpm":3.75,"rate":1800.0,"miles":480,"broker":"Armstrong Transport","driver":"Jeremy","unit":"5","pay":295.0,"fuel":420.91,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h213","date":"2026-06-17","rpm":3.35,"rate":1850.0,"miles":552,"broker":"SPI Logistics","driver":"Jeremy","unit":"5","pay":330.0,"fuel":620.0,"repair":895.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h214","date":"2026-06-17","rpm":2.0,"rate":1300.0,"miles":650,"broker":"Armstrong Transport","driver":"TJ","unit":"4","pay":130.0,"fuel":130.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h215","date":"2026-06-19","rpm":null,"rate":1500.0,"miles":500,"broker":"TQL","driver":"TJ","unit":"4","pay":null,"fuel":750.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"}];

/* ============================ TOKENS ============================ */
const C = {
  bg:"#0E1116", panel:"#161B22", panel2:"#1C222B", raised:"#222933",
  line:"#2A323D", lineSoft:"#222932",
  ink:"#E9ECF1", dim:"#8B95A3", faint:"#5E6675",
  amber:"#F2A413", amberHi:"#FFB740",
  green:"#36D399", greenDim:"#1f6b50",
  red:"#F0594C", redDim:"#6b2722",
  blue:"#4DA3FF", purple:"#A78BFA",
};
const LANES = ["Available","Assigned","In Transit","Delivered"];
const DRIVER_ORDER = ["TJ","John","Chris","Jeremy","Derek"];
const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const sans = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/* ============================ HELPERS ============================ */
const fmt0 = n => (n==null||isNaN(n)) ? "—" : Math.round(n).toLocaleString();
const money = n => (n==null||isNaN(n)) ? "—" : "$"+Math.round(n).toLocaleString();
const money1 = n => (n==null||isNaN(n)) ? "—" : "$"+Number(n).toFixed(2);
const uid = () => "l"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const todayISO = () => new Date().toISOString().slice(0,10);

function rpmColor(rpm){
  if(rpm==null||isNaN(rpm)) return C.faint;
  if(rpm>=2.5) return C.green;
  if(rpm>=1.8) return C.amber;
  return C.red;
}
function rpmLabel(rpm){
  if(rpm==null||isNaN(rpm)) return "no rpm";
  if(rpm>=2.5) return "strong";
  if(rpm>=1.8) return "ok";
  return "thin";
}
function laneColor(s){
  return s==="Available"?C.amber : s==="Assigned"?C.purple : s==="In Transit"?C.blue : C.green;
}
function computeRpm(l){
  if(l.rpm!=null) return l.rpm;
  if(l.rate&&l.miles) return l.rate/l.miles;
  return null;
}
function netOf(l){ return (l.rate||0)-(l.pay||0)-(l.fuel||0)-(l.dispatch||0)-(l.repair||0); }

/* ============================ STORAGE ============================ */
const KEY_LOADS="tms_loads_v3", KEY_CHAT="tms_chat_v3", KEY_INBOX="tms_inbox_v3";
async function sget(k,shared){ try{ const r=await window.storage.get(k,shared); return r? JSON.parse(r.value):null; }catch(e){ return null; } }
async function sset(k,v,shared){ try{ await window.storage.set(k,JSON.stringify(v),shared); }catch(e){} }

/* ============================ AI ============================ */
async function callClaude(messages, system, maxTokens=1200){
  const res = await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:maxTokens, system, messages })
  });
  if(!res.ok) throw new Error("AI request failed ("+res.status+")");
  const data = await res.json();
  return (data.content||[]).map(b=>b.type==="text"?b.text:"").filter(Boolean).join("\n");
}
function parseJSON(text){
  let t=(text||"").trim().replace(/^```(json)?/i,"").replace(/```$/,"").trim();
  const a=t.indexOf("{"), b=t.lastIndexOf("}");
  if(a>=0&&b>=0) t=t.slice(a,b+1);
  return JSON.parse(t);
}

/* ============================ SMALL UI ============================ */
function Pill({children,color,bg,style}){
  return <span style={{fontFamily:mono,fontSize:10,letterSpacing:.5,textTransform:"uppercase",
    color:color||C.dim, background:bg||"transparent", border:`1px solid ${(color||C.line)}33`,
    padding:"2px 7px", borderRadius:4, whiteSpace:"nowrap", ...style}}>{children}</span>;
}
function Label({children,style}){
  return <div style={{fontFamily:sans,fontSize:10.5,letterSpacing:1.4,textTransform:"uppercase",color:C.faint,...style}}>{children}</div>;
}

/* ============================ KPI BAR ============================ */
function KpiBar({loads}){
  const k = useMemo(()=>{
    let rev=0,mi=0,rpmN=0,rpmC=0,pay=0,fuel=0,disp=0,rep=0,active=0;
    const wk = Date.now()-7*864e5;
    let wkRev=0;
    loads.forEach(l=>{
      rev+=l.rate||0; mi+=l.miles||0; pay+=l.pay||0; fuel+=l.fuel||0; disp+=l.dispatch||0; rep+=l.repair||0;
      const r=computeRpm(l); if(r!=null){rpmN+=r;rpmC++;}
      if(l.status!=="Delivered") active++;
      if(l.date && new Date(l.date).getTime()>=wk) wkRev+=l.rate||0;
    });
    return {rev,mi,avgRpm:rpmC?rpmN/rpmC:0,pay,fuel,disp,rep,active,margin:rev-pay-fuel-disp-rep,wkRev,count:loads.length};
  },[loads]);
  const items=[
    {k:"Booked revenue",v:money(k.rev),c:C.ink},
    {k:"Net (after all costs)",v:money(k.margin),c:k.margin>=0?C.green:C.red},
    {k:"Avg RPM",v:"$"+k.avgRpm.toFixed(2),c:rpmColor(k.avgRpm)},
    {k:"Total miles",v:fmt0(k.mi),c:C.ink},
    {k:"Active loads",v:fmt0(k.active),c:C.amber},
    {k:"Loads logged",v:fmt0(k.count),c:C.dim},
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-px" style={{background:C.line,border:`1px solid ${C.line}`,borderRadius:8,overflow:"hidden"}}>
      {items.map((it,i)=>(
        <div key={i} style={{background:C.panel,padding:"12px 14px"}}>
          <Label>{it.k}</Label>
          <div style={{fontFamily:mono,fontSize:21,fontWeight:600,color:it.c,marginTop:5,lineHeight:1}}>{it.v}</div>
        </div>
      ))}
    </div>
  );
}

/* ============================ LOAD CARD ============================ */
function LoadCard({l,onAssign,onAdvance,onBack,onDelete,drivers,compact}){
  const rpm=computeRpm(l), col=rpmColor(rpm);
  return (
    <div style={{background:C.panel2,border:`1px solid ${C.line}`,borderLeft:`3px solid ${col}`,
      borderRadius:7,padding:"10px 11px",display:"flex",flexDirection:"column",gap:7}}>
      <div className="flex items-start justify-between" style={{gap:8}}>
        <div style={{minWidth:0}}>
          <div style={{fontFamily:sans,fontSize:13.5,fontWeight:600,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.broker||"—"}</div>
          <div style={{fontFamily:mono,fontSize:10.5,color:C.dim,marginTop:2}}>
            {(l.origin||l.dest)?`${l.origin||"?"} → ${l.dest||"?"}`:(l.ref?("REF "+l.ref):(l.date||""))}
          </div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontFamily:mono,fontSize:18,fontWeight:700,color:col,lineHeight:1}}>{rpm!=null?("$"+rpm.toFixed(2)):"—"}</div>
          <div style={{fontFamily:mono,fontSize:9,letterSpacing:.5,textTransform:"uppercase",color:col}}>{rpmLabel(rpm)} · rpm</div>
        </div>
      </div>
      <div className="flex items-center" style={{gap:14}}>
        <div><span style={{fontFamily:mono,fontSize:15,fontWeight:600,color:C.ink}}>{money(l.rate)}</span></div>
        <div style={{fontFamily:mono,fontSize:12,color:C.dim}}>{fmt0(l.miles)} mi</div>
        {l.unit && <Pill color={C.faint}>unit {l.unit}</Pill>}
      </div>

      {!compact && (
        <div className="flex items-center justify-between" style={{gap:8,marginTop:1}}>
          {l.status==="Available" ? (
            <select value="" onChange={e=>onAssign(l.id,e.target.value)}
              style={{flex:1,background:C.raised,color:C.amber,border:`1px solid ${C.line}`,borderRadius:5,
                padding:"5px 7px",fontFamily:mono,fontSize:11.5}}>
              <option value="" style={{color:C.dim}}>Assign driver…</option>
              {drivers.map(d=><option key={d} value={d} style={{color:C.ink}}>{d}</option>)}
            </select>
          ) : (
            <div className="flex items-center" style={{gap:6}}>
              <div style={{width:7,height:7,borderRadius:9,background:laneColor(l.status)}}/>
              <span style={{fontFamily:mono,fontSize:12,color:C.ink}}>{l.driver||"unassigned"}</span>
            </div>
          )}
          <div className="flex items-center" style={{gap:5}}>
            {l.status!=="Available" && <IconBtn title="Back a stage" onClick={()=>onBack(l.id)}>‹</IconBtn>}
            {l.status!=="Delivered" && (
              <button onClick={()=>onAdvance(l.id)} style={{fontFamily:mono,fontSize:11,letterSpacing:.3,
                color:C.bg,background:laneColor(LANES[LANES.indexOf(l.status)+1]),border:"none",
                borderRadius:5,padding:"5px 9px",cursor:"pointer",fontWeight:600}}>
                {l.status==="Available"?"—":LANES[LANES.indexOf(l.status)+1]} ›
              </button>
            )}
            {onDelete && <IconBtn title="Remove" onClick={()=>onDelete(l.id)} danger>×</IconBtn>}
          </div>
        </div>
      )}
    </div>
  );
}
function IconBtn({children,onClick,title,danger}){
  return <button title={title} onClick={onClick} style={{width:26,height:26,borderRadius:5,
    background:C.raised,border:`1px solid ${C.line}`,color:danger?C.red:C.dim,cursor:"pointer",
    fontFamily:mono,fontSize:14,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center"}}>{children}</button>;
}

/* ============================ BOARD ============================ */
function Board({loads,setLoads,drivers,onNewLoad}){
  const grouped = useMemo(()=>{
    const g={Available:[],Assigned:[],"In Transit":[],Delivered:[]};
    loads.forEach(l=>{ (g[l.status]||g.Delivered).push(l); });
    g.Delivered.sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    return g;
  },[loads]);

  const upd=(id,patch)=>setLoads(loads.map(l=>l.id===id?{...l,...patch}:l));
  const assign=(id,driver)=>upd(id,{driver,status:"Assigned"});
  const advance=id=>{const l=loads.find(x=>x.id===id);const i=LANES.indexOf(l.status);if(i<LANES.length-1)upd(id,{status:LANES[i+1]});};
  const back=id=>{const l=loads.find(x=>x.id===id);const i=LANES.indexOf(l.status);if(i>0)upd(id,{status:LANES[i-1], ...(LANES[i-1]==="Available"?{driver:null}:{})});};
  const del=id=>setLoads(loads.filter(l=>l.id!==id));

  return (
    <div>
      <div className="flex items-center justify-between" style={{marginBottom:12}}>
        <Label style={{fontSize:11}}>Dispatch board · drag-free, tap to advance</Label>
        <button onClick={onNewLoad} style={{fontFamily:mono,fontSize:12,color:C.bg,background:C.amber,
          border:"none",borderRadius:6,padding:"7px 13px",cursor:"pointer",fontWeight:700,letterSpacing:.3}}>+ New load</button>
      </div>
      <div className="flex flex-col lg:flex-row" style={{gap:12,alignItems:"stretch"}}>
        {LANES.map(lane=>{
          const list=grouped[lane];
          const rev=list.reduce((s,l)=>s+(l.rate||0),0);
          const rpms=list.map(computeRpm).filter(x=>x!=null);
          const avg=rpms.length?rpms.reduce((a,b)=>a+b,0)/rpms.length:null;
          const isDel=lane==="Delivered";
          const show=isDel?list.slice(0,12):list;
          return (
            <div key={lane} className="flex-1" style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:9,minWidth:0,display:"flex",flexDirection:"column"}}>
              <div style={{padding:"11px 12px",borderBottom:`1px solid ${C.lineSoft}`}}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center" style={{gap:7}}>
                    <div style={{width:8,height:8,borderRadius:9,background:laneColor(lane)}}/>
                    <span style={{fontFamily:sans,fontSize:12.5,fontWeight:700,letterSpacing:.6,textTransform:"uppercase",color:C.ink}}>{lane}</span>
                  </div>
                  <span style={{fontFamily:mono,fontSize:12,color:C.dim}}>{list.length}</span>
                </div>
                <div className="flex items-center justify-between" style={{marginTop:6}}>
                  <span style={{fontFamily:mono,fontSize:12,color:C.faint}}>{money(rev)}</span>
                  {avg!=null && <span style={{fontFamily:mono,fontSize:11,color:rpmColor(avg)}}>avg ${avg.toFixed(2)}</span>}
                </div>
              </div>
              <div style={{padding:10,display:"flex",flexDirection:"column",gap:9,overflowY:"auto",maxHeight:560}}>
                {show.length===0 && <div style={{fontFamily:mono,fontSize:11,color:C.faint,padding:"14px 4px",textAlign:"center"}}>{lane==="Available"?"Add a load or pull one from Rate Cons.":"Nothing here."}</div>}
                {show.map(l=><LoadCard key={l.id} l={l} drivers={drivers} onAssign={assign} onAdvance={advance} onBack={back} onDelete={isDel?null:del} compact={isDel}/>)}
                {isDel && list.length>12 && <div style={{fontFamily:mono,fontSize:11,color:C.faint,textAlign:"center",padding:4}}>+{list.length-12} more in Loads ledger</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================ LOADS LEDGER ============================ */
function Ledger({loads}){
  const [q,setQ]=useState(""); const [drv,setDrv]=useState("all"); const [sort,setSort]=useState("date");
  const drivers=useMemo(()=>["all",...Array.from(new Set(loads.map(l=>l.driver).filter(Boolean)))],[loads]);
  const rows=useMemo(()=>{
    let r=loads.filter(l=>{
      const okD = drv==="all"||l.driver===drv;
      const okQ = !q || (l.broker||"").toLowerCase().includes(q.toLowerCase()) || (l.driver||"").toLowerCase().includes(q.toLowerCase());
      return okD&&okQ;
    });
    r=[...r].sort((a,b)=>{
      if(sort==="date") return (b.date||"").localeCompare(a.date||"");
      if(sort==="rpm") return (computeRpm(b)||0)-(computeRpm(a)||0);
      if(sort==="rate") return (b.rate||0)-(a.rate||0);
      return 0;
    });
    return r;
  },[loads,q,drv,sort]);
  return (
    <div>
      <div className="flex flex-wrap items-center" style={{gap:8,marginBottom:12}}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search broker or driver…"
          style={{flex:"1 1 200px",background:C.panel,border:`1px solid ${C.line}`,borderRadius:6,color:C.ink,padding:"8px 11px",fontFamily:mono,fontSize:12.5}}/>
        <select value={drv} onChange={e=>setDrv(e.target.value)} style={selStyle}>{drivers.map(d=><option key={d} value={d}>{d==="all"?"All drivers":d}</option>)}</select>
        <select value={sort} onChange={e=>setSort(e.target.value)} style={selStyle}>
          <option value="date">Newest</option><option value="rpm">Highest RPM</option><option value="rate">Highest rate</option>
        </select>
        <Pill color={C.dim}>{rows.length} loads</Pill>
      </div>
      <div style={{border:`1px solid ${C.line}`,borderRadius:9,overflow:"hidden"}}>
        <div className="hidden md:grid" style={{gridTemplateColumns:"80px 1fr 92px 56px 52px 70px 64px 64px 60px 66px",
          background:C.panel2,padding:"9px 12px",gap:8}}>
          {["Date","Broker","Driver","RPM","Miles","Rate","Pay","Fuel","Disp","Repair"].map((h,i)=>(
            <div key={i} style={{fontFamily:sans,fontSize:10,letterSpacing:1,textTransform:"uppercase",color:C.faint,textAlign:i>2?"right":"left"}}>{h}</div>
          ))}
        </div>
        <div style={{maxHeight:600,overflowY:"auto"}}>
          {rows.map((l,idx)=>{const rpm=computeRpm(l);return(
            <div key={l.id} className="grid grid-cols-2 md:grid-cols-none" style={{gridTemplateColumns:"80px 1fr 92px 56px 52px 70px 64px 64px 60px 66px",
              gap:8,padding:"9px 12px",background:idx%2?C.bg:C.panel,borderTop:`1px solid ${C.lineSoft}`,alignItems:"center"}}>
              <div style={{fontFamily:mono,fontSize:11.5,color:C.dim}}>{(l.date||"").slice(5)}</div>
              <div style={{fontFamily:sans,fontSize:12.5,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.broker||"—"}</div>
              <div style={{fontFamily:mono,fontSize:11.5,color:C.dim}}>{l.driver||"—"}{l.unit?(" · "+l.unit):""}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,fontWeight:600,color:rpmColor(rpm)}}>{rpm!=null?"$"+rpm.toFixed(2):"—"}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{fmt0(l.miles)}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:C.ink}}>{money(l.rate)}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(l.pay)}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(l.fuel)}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:C.dim}}>{l.dispatch?money(l.dispatch):"—"}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:l.repair?C.amber:C.dim}}>{l.repair?money(l.repair):"—"}</div>
            </div>
          );})}
        </div>
      </div>
    </div>
  );
}
const selStyle={background:C.panel,border:`1px solid ${C.line}`,borderRadius:6,color:C.ink,padding:"8px 10px",fontFamily:mono,fontSize:12};

/* ============================ DRIVERS ============================ */
function Drivers({loads}){
  const stats=useMemo(()=>{
    const m={};
    loads.forEach(l=>{
      if(!l.driver) return;
      const d=m[l.driver]||(m[l.driver]={driver:l.driver,n:0,miles:0,rev:0,pay:0,fuel:0,disp:0,rep:0,rpmN:0,rpmC:0,units:new Set(),active:null});
      d.n++; d.miles+=l.miles||0; d.rev+=l.rate||0; d.pay+=l.pay||0; d.fuel+=l.fuel||0; d.disp+=l.dispatch||0; d.rep+=l.repair||0;
      const r=computeRpm(l); if(r!=null){d.rpmN+=r;d.rpmC++;}
      if(l.unit) d.units.add(l.unit);
      if(l.status&&l.status!=="Delivered") d.active=l;
    });
    return Object.values(m).map(d=>({...d,avg:d.rpmC?d.rpmN/d.rpmC:0,margin:d.rev-d.pay-d.fuel-d.disp-d.rep,units:Array.from(d.units)}))
      .sort((a,b)=>{const ia=DRIVER_ORDER.indexOf(a.driver),ib=DRIVER_ORDER.indexOf(b.driver);return (ia<0?99:ia)-(ib<0?99:ib);});
  },[loads]);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3" style={{gap:12}}>
      {stats.map(d=>(
        <div key={d.driver} style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:14}}>
          <div className="flex items-center justify-between">
            <div className="flex items-center" style={{gap:10}}>
              <div style={{width:36,height:36,borderRadius:8,background:C.raised,border:`1px solid ${C.line}`,
                display:"flex",alignItems:"center",justifyContent:"center",fontFamily:mono,fontWeight:700,color:C.amber,fontSize:14}}>{d.driver.slice(0,2).toUpperCase()}</div>
              <div>
                <div style={{fontFamily:sans,fontSize:15,fontWeight:700,color:C.ink}}>{d.driver}</div>
                <div style={{fontFamily:mono,fontSize:10.5,color:C.faint}}>units {d.units.join(", ")||"—"}</div>
              </div>
            </div>
            {d.active
              ? <Pill color={laneColor(d.active.status)} bg={laneColor(d.active.status)+"1a"}>{d.active.status}</Pill>
              : <Pill color={C.faint}>open</Pill>}
          </div>
          {d.active && <div style={{marginTop:10,padding:"8px 10px",background:C.panel2,border:`1px solid ${C.line}`,borderRadius:7,fontFamily:mono,fontSize:11.5,color:C.dim}}>
            on: <span style={{color:C.ink}}>{d.active.broker}</span> · {money(d.active.rate)} · {fmt0(d.active.miles)}mi</div>}
          <div className="grid grid-cols-3" style={{gap:8,marginTop:12}}>
            {[["Loads",fmt0(d.n),C.ink],["Revenue",money(d.rev),C.ink],["Avg RPM","$"+d.avg.toFixed(2),rpmColor(d.avg)],
              ["Miles",fmt0(d.miles),C.dim],["Driver pay",money(d.pay),C.dim],["Net to truck",money(d.margin),d.margin>=0?C.green:C.red]].map((s,i)=>(
              <div key={i}>
                <Label style={{fontSize:9}}>{s[0]}</Label>
                <div style={{fontFamily:mono,fontSize:14,fontWeight:600,color:s[2],marginTop:3}}>{s[1]}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================ WEEKLY P&L PER TRUCK ============================ */
function isoMonday(d){ const dt=new Date(d+"T00:00:00"); const day=(dt.getDay()+6)%7; dt.setDate(dt.getDate()-day); return dt.toISOString().slice(0,10); }
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function weekLabel(monIso){ const a=new Date(monIso+"T00:00:00"); const b=new Date(a); b.setDate(b.getDate()+6);
  const sameM=a.getMonth()===b.getMonth(); return `${MON[a.getMonth()]} ${a.getDate()} – ${sameM?'':MON[b.getMonth()]+' '}${b.getDate()}`; }

function WeeklyPnL({loads}){
  const weeks=useMemo(()=>{ const m={}; loads.forEach(l=>{ if(!l.date)return; const wk=isoMonday(l.date); (m[wk]||(m[wk]=[])).push(l); });
    return Object.keys(m).sort((a,b)=>b.localeCompare(a)).map(k=>({wk:k,loads:m[k]})); },[loads]);
  const [sel,setSel]=useState(""); 
  useEffect(()=>{ if(weeks.length&&!weeks.find(w=>w.wk===sel)) setSel(weeks[0].wk); },[weeks]);
  const cur=weeks.find(w=>w.wk===sel)||weeks[0];

  const trend=useMemo(()=>weeks.slice(0,14).reverse().map(w=>{ let net=0; w.loads.forEach(l=>net+=(l.rate||0)-(l.pay||0)-(l.fuel||0)); return {wk:w.wk,net}; }),[weeks]);
  const maxNet=Math.max(1,...trend.map(t=>Math.abs(t.net)));

  const trucks=useMemo(()=>{ if(!cur) return []; const m={};
    cur.loads.forEach(l=>{ const u=l.unit||"—"; const t=m[u]||(m[u]={unit:u,drivers:new Set(),n:0,miles:0,rev:0,pay:0,fuel:0,exp:0,rpmN:0,rpmC:0});
      t.n++; t.miles+=l.miles||0; t.rev+=l.rate||0; t.pay+=l.pay||0; t.fuel+=l.fuel||0; t.exp+=(l.dispatch||0)+(l.repair||0); const r=computeRpm(l); if(r){t.rpmN+=r;t.rpmC++;} if(l.driver)t.drivers.add(l.driver); });
    return Object.values(m).map(t=>({...t,net:t.rev-t.pay-t.fuel-t.exp,avg:t.rpmC?t.rpmN/t.rpmC:0,drivers:Array.from(t.drivers)})).sort((a,b)=>b.rev-a.rev); },[cur]);
  const tot=trucks.reduce((s,t)=>({rev:s.rev+t.rev,pay:s.pay+t.pay,fuel:s.fuel+t.fuel,exp:s.exp+t.exp,net:s.net+t.net,miles:s.miles+t.miles,n:s.n+t.n}),{rev:0,pay:0,fuel:0,exp:0,net:0,miles:0,n:0});

  if(!cur) return <Empty msg="No dated loads yet."/>;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between" style={{gap:10,marginBottom:14}}>
        <div className="flex items-center" style={{gap:10}}>
          <Label>Week of</Label>
          <select value={sel} onChange={e=>setSel(e.target.value)} style={{...selStyle,fontSize:13}}>
            {weeks.map(w=><option key={w.wk} value={w.wk}>{weekLabel(w.wk)}, {w.wk.slice(0,4)}</option>)}
          </select>
        </div>
        <div className="flex items-center" style={{gap:18}}>
          <Stat k="Revenue" v={money(tot.rev)} c={C.ink}/>
          <Stat k="Net to fleet" v={money(tot.net)} c={tot.net>=0?C.green:C.red}/>
          <Stat k="Miles" v={fmt0(tot.miles)} c={C.dim}/>
          <Stat k="Avg RPM" v={"$"+(tot.miles?(tot.rev/tot.miles):0).toFixed(2)} c={rpmColor(tot.miles?tot.rev/tot.miles:0)}/>
        </div>
      </div>

      {/* trend */}
      <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:"12px 14px",marginBottom:14}}>
        <Label style={{marginBottom:10}}>Weekly net to fleet · last {trend.length} weeks</Label>
        <div className="flex items-end" style={{gap:6,height:90}}>
          {trend.map(t=>{ const h=Math.max(3,Math.round(Math.abs(t.net)/maxNet*78)); const on=t.wk===sel;
            return (
              <div key={t.wk} onClick={()=>setSel(t.wk)} title={weekLabel(t.wk)+": "+money(t.net)}
                className="flex-1" style={{display:"flex",flexDirection:"column",justifyContent:"flex-end",alignItems:"center",cursor:"pointer",minWidth:0}}>
                <div style={{width:"100%",maxWidth:26,height:h,background:t.net>=0?(on?C.green:C.greenDim):(on?C.red:C.redDim),borderRadius:3}}/>
                <div style={{fontFamily:mono,fontSize:8.5,color:on?C.ink:C.faint,marginTop:5}}>{MON[new Date(t.wk+"T00:00:00").getMonth()]}{new Date(t.wk+"T00:00:00").getDate()}</div>
              </div>
            ); })}
        </div>
      </div>

      {/* per truck table */}
      <div style={{border:`1px solid ${C.line}`,borderRadius:10,overflow:"hidden"}}>
        <div className="hidden md:grid" style={{gridTemplateColumns:"60px 1fr 46px 56px 80px 70px 70px 70px 78px 58px",background:C.panel2,padding:"9px 12px",gap:8}}>
          {["Truck","Driver","Loads","Miles","Revenue","Pay","Fuel","Exp","Net","RPM"].map((h,i)=>(
            <div key={i} style={{fontFamily:sans,fontSize:10,letterSpacing:1,textTransform:"uppercase",color:C.faint,textAlign:i>1?"right":"left"}}>{h}</div>))}
        </div>
        {trucks.map((t,i)=>(
          <div key={t.unit} style={{display:"grid",gridTemplateColumns:"60px 1fr 46px 56px 80px 70px 70px 70px 78px 58px",gap:8,padding:"11px 12px",background:i%2?C.bg:C.panel,borderTop:`1px solid ${C.lineSoft}`,alignItems:"center"}}>
            <div className="flex items-center" style={{gap:7}}><div style={{width:9,height:9,borderRadius:3,background:C.amber}}/><span style={{fontFamily:mono,fontWeight:700,color:C.ink,fontSize:14}}>{t.unit}</span></div>
            <div style={{fontFamily:sans,fontSize:12.5,color:C.dim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.drivers.join(", ")||"—"}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:C.dim}}>{t.n}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{fmt0(t.miles)}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:13,color:C.ink}}>{money(t.rev)}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(t.pay)}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(t.fuel)}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{t.exp?money(t.exp):"—"}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:13,fontWeight:700,color:t.net>=0?C.green:C.red}}>{money(t.net)}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,fontWeight:600,color:rpmColor(t.avg)}}>${t.avg.toFixed(2)}</div>
          </div>
        ))}
        <div style={{display:"grid",gridTemplateColumns:"60px 1fr 46px 56px 80px 70px 70px 70px 78px 58px",gap:8,padding:"11px 12px",background:C.panel2,borderTop:`2px solid ${C.line}`,alignItems:"center"}}>
          <div style={{fontFamily:sans,fontSize:11,letterSpacing:.8,textTransform:"uppercase",color:C.amber,fontWeight:700,gridColumn:"1 / 3"}}>Week total</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:C.dim}}>{tot.n}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{fmt0(tot.miles)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:13,color:C.ink}}>{money(tot.rev)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(tot.pay)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(tot.fuel)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{tot.exp?money(tot.exp):"—"}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:13,fontWeight:700,color:tot.net>=0?C.green:C.red}}>{money(tot.net)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:rpmColor(tot.miles?tot.rev/tot.miles:0)}}>${(tot.miles?tot.rev/tot.miles:0).toFixed(2)}</div>
        </div>
      </div>
      <div style={{fontFamily:sans,fontSize:11,color:C.faint,marginTop:10}}>Net = revenue − driver pay − fuel − dispatch fees − repairs. Exp = dispatch fees + repairs. Truck = unit number. Tap a bar to jump to that week.</div>
    </div>
  );
}
function Stat({k,v,c}){ return <div><Label style={{fontSize:9}}>{k}</Label><div style={{fontFamily:mono,fontSize:17,fontWeight:600,color:c,marginTop:2,lineHeight:1}}>{v}</div></div>; }
function Empty({msg}){ return <div style={{fontFamily:mono,fontSize:12.5,color:C.faint,textAlign:"center",padding:"50px 20px",border:`1px dashed ${C.line}`,borderRadius:10}}>{msg}</div>; }

/* ============================ MONTHLY P&L ============================ */
function monthLabel(ym){ const [y,m]=ym.split("-"); return `${MON[parseInt(m,10)-1]} ${y}`; }
function aggLoads(list){
  let rev=0,pay=0,fuel=0,disp=0,rep=0,miles=0,rpmN=0,rpmC=0;
  list.forEach(l=>{ rev+=l.rate||0; pay+=l.pay||0; fuel+=l.fuel||0; disp+=l.dispatch||0; rep+=l.repair||0; miles+=l.miles||0;
    const r=computeRpm(l); if(r!=null){rpmN+=r;rpmC++;} });
  return {rev,pay,fuel,disp,rep,exp:disp+rep,miles,n:list.length,net:rev-pay-fuel-disp-rep,avg:rpmC?rpmN/rpmC:0};
}
function trucksOf(list){
  const m={};
  list.forEach(l=>{ const u=l.unit||"—"; const t=m[u]||(m[u]={unit:u,loads:[],drivers:new Set()}); t.loads.push(l); if(l.driver)t.drivers.add(l.driver); });
  return Object.values(m).map(t=>({unit:t.unit,drivers:Array.from(t.drivers),...aggLoads(t.loads)})).sort((a,b)=>b.rev-a.rev);
}
const M_GRID="118px 44px 60px 84px 72px 72px 66px 84px 58px";
function MonthlyPnL({loads}){
  const years=useMemo(()=>Array.from(new Set(loads.filter(l=>l.date).map(l=>l.date.slice(0,4)))).sort((a,b)=>b.localeCompare(a)),[loads]);
  const [year,setYear]=useState("");
  useEffect(()=>{ if(years.length && year!=="all" && !years.includes(year)) setYear(years[0]); },[years]);
  const view=useMemo(()=> (year&&year!=="all") ? loads.filter(l=>l.date&&l.date.slice(0,4)===year) : loads.filter(l=>l.date), [loads,year]);
  const months=useMemo(()=>{
    const m={}; view.forEach(l=>{ const ym=l.date.slice(0,7); (m[ym]||(m[ym]=[])).push(l); });
    return Object.keys(m).sort((a,b)=>b.localeCompare(a)).map(k=>({ym:k,loads:m[k],agg:aggLoads(m[k])}));
  },[view]);
  const [open,setOpen]=useState(new Set());
  useEffect(()=>{ if(months.length) setOpen(o=>o.size?o:new Set([months[0].ym])); },[months.length]);
  const toggle=ym=>setOpen(o=>{ const n=new Set(o); n.has(ym)?n.delete(ym):n.add(ym); return n; });

  const tot=useMemo(()=>aggLoads(view),[view]);
  const trend=useMemo(()=>months.slice(0,12).reverse(),[months]);
  const maxNet=Math.max(1,...trend.map(t=>Math.abs(t.agg.net)));
  const avgMonthNet=months.length?tot.net/months.length:0;

  if(!months.length) return <Empty msg="No dated loads yet — monthly P&L builds as loads come in."/>;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between" style={{gap:12,marginBottom:14}}>
        <div className="flex items-center" style={{gap:12,flexWrap:"wrap"}}>
          <div className="flex" style={{gap:3,background:C.panel,border:`1px solid ${C.line}`,borderRadius:9,padding:3}}>
            {[...years,"all"].map(y=>{ const on=(y==="all")?(year==="all"):((year||years[0])===y);
              return <button key={y} onClick={()=>setYear(y)} style={{fontFamily:mono,fontSize:12.5,fontWeight:700,letterSpacing:.3,
                color:on?C.bg:C.dim,background:on?C.amber:"transparent",border:"none",borderRadius:6,padding:"6px 14px",cursor:"pointer"}}>{y==="all"?"All":y}</button>; })}
          </div>
          <Label style={{fontSize:11}}>{months.length} month{months.length===1?"":"s"} · tap a month for trucks</Label>
        </div>
        <div className="flex items-center" style={{gap:18}}>
          <Stat k={(year&&year!=="all")?(year+" net"):"All-time net"} v={money(tot.net)} c={tot.net>=0?C.green:C.red}/>
          <Stat k="Avg / month" v={money(avgMonthNet)} c={avgMonthNet>=0?C.green:C.red}/>
          <Stat k="Avg RPM" v={"$"+(tot.miles?tot.rev/tot.miles:0).toFixed(2)} c={rpmColor(tot.miles?tot.rev/tot.miles:0)}/>
        </div>
      </div>

      {/* monthly net trend */}
      <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:"12px 14px",marginBottom:14}}>
        <Label style={{marginBottom:10}}>Monthly net to fleet · last {trend.length} months</Label>
        <div className="flex items-end" style={{gap:8,height:96}}>
          {trend.map(t=>{ const h=Math.max(3,Math.round(Math.abs(t.agg.net)/maxNet*72)); const on=open.has(t.ym);
            return (
              <div key={t.ym} onClick={()=>setOpen(new Set([t.ym]))} title={monthLabel(t.ym)+": "+money(t.agg.net)}
                className="flex-1" style={{display:"flex",flexDirection:"column",justifyContent:"flex-end",alignItems:"center",cursor:"pointer",minWidth:0}}>
                <div style={{fontFamily:mono,fontSize:8.5,color:on?C.ink:C.faint,marginBottom:3}}>{(t.agg.net/1000).toFixed(0)}k</div>
                <div style={{width:"100%",maxWidth:30,height:h,background:t.agg.net>=0?(on?C.green:C.greenDim):(on?C.red:C.redDim),borderRadius:3}}/>
                <div style={{fontFamily:mono,fontSize:8.5,color:on?C.ink:C.faint,marginTop:5}}>{MON[parseInt(t.ym.slice(5),10)-1]}</div>
              </div>
            ); })}
        </div>
      </div>

      {/* monthly table */}
      <div style={{border:`1px solid ${C.line}`,borderRadius:10,overflow:"hidden"}}>
        <div className="hidden md:grid" style={{gridTemplateColumns:M_GRID,background:C.panel2,padding:"9px 12px",gap:8}}>
          {["Month","Loads","Miles","Revenue","Pay","Fuel","Exp","Net","RPM"].map((h,i)=>(
            <div key={i} style={{fontFamily:sans,fontSize:10,letterSpacing:1,textTransform:"uppercase",color:C.faint,textAlign:i>0?"right":"left"}}>{h}</div>))}
        </div>
        {months.map((mo,i)=>{ const a=mo.agg; const isOpen=open.has(mo.ym);
          return (
            <div key={mo.ym} style={{borderTop:`1px solid ${C.lineSoft}`}}>
              <div onClick={()=>toggle(mo.ym)} style={{display:"grid",gridTemplateColumns:M_GRID,gap:8,padding:"11px 12px",background:isOpen?C.panel2:(i%2?C.bg:C.panel),alignItems:"center",cursor:"pointer"}}>
                <div className="flex items-center" style={{gap:6,minWidth:0}}>
                  <span style={{color:C.faint,fontFamily:mono,fontSize:11,width:9}}>{isOpen?"▾":"▸"}</span>
                  <span style={{fontFamily:sans,fontSize:13,fontWeight:700,color:C.ink,whiteSpace:"nowrap"}}>{monthLabel(mo.ym)}</span>
                </div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:C.dim}}>{a.n}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{fmt0(a.miles)}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:13,color:C.ink}}>{money(a.rev)}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(a.pay)}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(a.fuel)}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{a.exp?money(a.exp):"—"}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:13,fontWeight:700,color:a.net>=0?C.green:C.red}}>{money(a.net)}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,fontWeight:600,color:rpmColor(a.avg)}}>${a.avg.toFixed(2)}</div>
              </div>
              {isOpen && (
                <div style={{background:C.bg,padding:"4px 12px 12px 12px"}}>
                  {trucksOf(mo.loads).map(t=>(
                    <div key={t.unit} style={{display:"grid",gridTemplateColumns:M_GRID,gap:8,padding:"7px 0 7px 18px",alignItems:"center",borderTop:`1px solid ${C.lineSoft}`}}>
                      <div className="flex items-center" style={{gap:6,minWidth:0}}>
                        <div style={{width:7,height:7,borderRadius:2,background:C.amber}}/>
                        <span style={{fontFamily:mono,fontSize:12,color:C.ink}}>Unit {t.unit}</span>
                        <span style={{fontFamily:sans,fontSize:10.5,color:C.faint,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.drivers.join(", ")}</span>
                      </div>
                      <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:C.faint}}>{t.n}</div>
                      <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:C.faint}}>{fmt0(t.miles)}</div>
                      <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(t.rev)}</div>
                      <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:C.faint}}>{money(t.pay)}</div>
                      <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:C.faint}}>{money(t.fuel)}</div>
                      <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:C.faint}}>{t.exp?money(t.exp):"—"}</div>
                      <div style={{textAlign:"right",fontFamily:mono,fontSize:12,fontWeight:600,color:t.net>=0?C.green:C.red}}>{money(t.net)}</div>
                      <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:rpmColor(t.avg)}}>${t.avg.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div style={{display:"grid",gridTemplateColumns:M_GRID,gap:8,padding:"11px 12px",background:C.panel2,borderTop:`2px solid ${C.line}`,alignItems:"center"}}>
          <div style={{fontFamily:sans,fontSize:11,letterSpacing:.8,textTransform:"uppercase",color:C.amber,fontWeight:700}}>{(year&&year!=="all")?year+" total":"All-time"}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:C.dim}}>{tot.n}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{fmt0(tot.miles)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:13,color:C.ink}}>{money(tot.rev)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(tot.pay)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(tot.fuel)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{tot.exp?money(tot.exp):"—"}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:13,fontWeight:700,color:tot.net>=0?C.green:C.red}}>{money(tot.net)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:rpmColor(tot.miles?tot.rev/tot.miles:0)}}>${(tot.miles?tot.rev/tot.miles:0).toFixed(2)}</div>
        </div>
      </div>
      <div style={{fontFamily:sans,fontSize:11,color:C.faint,marginTop:10}}>Net = revenue − driver pay − fuel − dispatch fees − repairs. Exp = dispatch + repairs. Tap any month to see each truck's P&amp;L for that month.</div>
    </div>
  );
}

/* ============================ LANE BOOK ============================ */
function LaneBook({loads}){
  const withLane=useMemo(()=>loads.filter(l=>l.origin&&l.origin.trim()),[loads]);
  const origins=useMemo(()=>["all",...Array.from(new Set(withLane.map(l=>l.origin.trim())))],[withLane]);
  const [origin,setOrigin]=useState("all");

  const byOrigin=useMemo(()=>{
    const m={};
    withLane.forEach(l=>{
      if(origin!=="all"&&l.origin.trim()!==origin) return;
      const o=l.origin.trim(), d=(l.dest||"?").trim(), b=l.broker||"—", key=o+"|"+d+"|"+b;
      const e=m[key]||(m[key]={origin:o,dest:d,broker:b,n:0,rpmN:0,rpmC:0,rate:0,miles:0,last:""});
      e.n++; const r=computeRpm(l); if(r){e.rpmN+=r;e.rpmC++;} e.rate+=l.rate||0; e.miles+=l.miles||0; if((l.date||"")>e.last)e.last=l.date||"";
    });
    const lanes=Object.values(m).map(e=>({...e,avgRpm:e.rpmC?e.rpmN/e.rpmC:0,avgRate:e.rate/e.n,avgMiles:Math.round(e.miles/e.n)}));
    const g={}; lanes.forEach(e=>{(g[e.origin]||(g[e.origin]=[])).push(e);});
    Object.values(g).forEach(a=>a.sort((x,y)=>y.n-x.n));
    return Object.entries(g).sort((a,b)=>b[1].reduce((s,x)=>s+x.n,0)-a[1].reduce((s,x)=>s+x.n,0));
  },[withLane,origin]);

  const brokerRef=useMemo(()=>{ const m={};
    loads.forEach(l=>{ if(!l.broker)return; const e=m[l.broker]||(m[l.broker]={broker:l.broker,n:0,rpmN:0,rpmC:0,rate:0,last:""});
      e.n++; const r=computeRpm(l); if(r){e.rpmN+=r;e.rpmC++;} e.rate+=l.rate||0; if((l.date||"")>e.last)e.last=l.date||""; });
    return Object.values(m).map(e=>({...e,avgRpm:e.rpmC?e.rpmN/e.rpmC:0,avgRate:e.rate/e.n})).sort((a,b)=>b.n-a.n);
  },[loads]);
  const [showRef,setShowRef]=useState(false);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between" style={{gap:10,marginBottom:14}}>
        <div className="flex items-center" style={{gap:10}}>
          <Label>Coming out of</Label>
          <select value={origin} onChange={e=>setOrigin(e.target.value)} style={{...selStyle,fontSize:13}}>
            {origins.map(o=><option key={o} value={o}>{o==="all"?"All origin cities":o}</option>)}
          </select>
        </div>
        <Pill color={C.dim}>{byOrigin.reduce((s,[,a])=>s+a.length,0)} lanes on file</Pill>
      </div>

      {byOrigin.length===0 ? (
        <div style={{border:`1px dashed ${C.line}`,borderRadius:10,padding:"28px 22px",textAlign:"center"}}>
          <div style={{fontFamily:sans,fontSize:14,color:C.ink,fontWeight:600}}>No city lanes recorded yet</div>
          <div style={{fontFamily:sans,fontSize:12,color:C.dim,marginTop:8,maxWidth:520,marginLeft:"auto",marginRight:"auto",lineHeight:1.5}}>
            Your imported history didn't include pickup/drop cities, so lanes start filling in as rate cons come through (the extractor captures origin and destination) or when you add a load with city fields. Your NC→IN and NC→OH runs will group here automatically. In the meantime, your broker rate reference below works off all 167 loads.
          </div>
        </div>
      ) : byOrigin.map(([orig,lanes])=>(
        <div key={orig} style={{marginBottom:14}}>
          <div className="flex items-center" style={{gap:9,marginBottom:8}}>
            <div style={{width:9,height:9,borderRadius:9,background:C.amber}}/>
            <span style={{fontFamily:sans,fontSize:14.5,fontWeight:700,color:C.ink}}>Out of {orig}</span>
            <Pill color={C.faint}>{lanes.length} lane{lanes.length>1?"s":""}</Pill>
          </div>
          <div style={{border:`1px solid ${C.line}`,borderRadius:10,overflow:"hidden"}}>
            {lanes.map((e,i)=>(
              <div key={i} className="flex items-center justify-between" style={{padding:"11px 13px",gap:10,background:i%2?C.bg:C.panel,borderTop:i?`1px solid ${C.lineSoft}`:"none"}}>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontFamily:sans,fontSize:13.5,color:C.ink,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>→ {e.dest}</div>
                  <div style={{fontFamily:mono,fontSize:11,color:C.dim,marginTop:2}}>{e.broker} · {e.n} load{e.n>1?"s":""} · {fmt0(e.avgMiles)} mi avg · last {e.last? e.last.slice(5):"—"}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontFamily:mono,fontSize:16,fontWeight:700,color:rpmColor(e.avgRpm)}}>${e.avgRpm.toFixed(2)}</div>
                  <div style={{fontFamily:mono,fontSize:11,color:C.faint}}>{money(e.avgRate)} avg</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* broker reference fallback */}
      <div style={{marginTop:6}}>
        <button onClick={()=>setShowRef(!showRef)} style={{fontFamily:sans,fontSize:12.5,fontWeight:600,color:C.dim,background:C.panel,border:`1px solid ${C.line}`,borderRadius:8,padding:"9px 13px",cursor:"pointer",width:"100%",textAlign:"left"}}>
          {showRef?"▾":"▸"} Broker rate reference — all {brokerRef.length} brokers across full history (lane not recorded)
        </button>
        {showRef && (
          <div style={{border:`1px solid ${C.line}`,borderTop:"none",borderRadius:"0 0 8px 8px",overflow:"hidden",maxHeight:420,overflowY:"auto"}}>
            <div className="hidden md:grid" style={{gridTemplateColumns:"1fr 70px 64px 100px 80px",background:C.panel2,padding:"8px 13px",gap:8}}>
              {["Broker","Loads","RPM","Avg rate","Last"].map((h,i)=><div key={i} style={{fontFamily:sans,fontSize:10,letterSpacing:1,textTransform:"uppercase",color:C.faint,textAlign:i?"right":"left"}}>{h}</div>)}
            </div>
            {brokerRef.map((e,i)=>(
              <div key={e.broker} style={{display:"grid",gridTemplateColumns:"1fr 70px 64px 100px 80px",gap:8,padding:"9px 13px",background:i%2?C.bg:C.panel,borderTop:`1px solid ${C.lineSoft}`,alignItems:"center"}}>
                <div style={{fontFamily:sans,fontSize:12.5,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.broker}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{e.n}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,fontWeight:600,color:rpmColor(e.avgRpm)}}>${e.avgRpm.toFixed(2)}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(e.avgRate)}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:11,color:C.faint}}>{e.last?e.last.slice(5):"—"}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ RATE CON INBOX ============================ */
function Inbox({onAdd}){
  const [text,setText]=useState(""); const [busy,setBusy]=useState(false);
  const [draft,setDraft]=useState(null); const [err,setErr]=useState("");
  const [recent,setRecent]=useState([]);
  useEffect(()=>{ sget(KEY_INBOX,true).then(v=>v&&setRecent(v)); },[]);

  async function extract(){
    if(!text.trim()) return;
    setBusy(true); setErr(""); setDraft(null);
    try{
      const sys="You extract a freight load from a pasted broker email or rate confirmation. Respond ONLY with one JSON object, no prose, no code fences. Keys: broker (string), rate (number, total linehaul in USD), miles (number or null), origin (string 'City, ST' or null), dest (string 'City, ST' or null), pickup_date (YYYY-MM-DD or null), ref (string load/PO number or null), commodity (string or null), notes (string, anything important like detention or appointment, or null). If a value is unknown use null. Never invent numbers.";
      const out=await callClaude([{role:"user",content:text}],sys,700);
      const j=parseJSON(out);
      if(j.rate&&j.miles&&!j.rpm) j.rpm=j.rate/j.miles;
      setDraft(j);
    }catch(e){ setErr("Couldn't read that one. Paste the rate con text including broker, rate, and miles, then try again."); }
    setBusy(false);
  }
  function add(){
    const l={id:uid(),status:"Available",date:draft.pickup_date||todayISO(),
      broker:draft.broker||"Unknown broker",rate:draft.rate??null,miles:draft.miles??null,
      rpm:(draft.rate&&draft.miles)?draft.rate/draft.miles:null,
      origin:draft.origin||null,dest:draft.dest||null,ref:draft.ref||null,driver:null,unit:null,pay:null,fuel:null};
    onAdd(l);
    const nr=[{when:new Date().toLocaleString(),broker:l.broker,rate:l.rate,miles:l.miles},...recent].slice(0,8);
    setRecent(nr); sset(KEY_INBOX,nr,true);
    setDraft(null); setText("");
  }
  return (
    <div className="flex flex-col lg:flex-row" style={{gap:14}}>
      <div className="flex-1" style={{minWidth:0}}>
        <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:14}}>
          <Label style={{marginBottom:8}}>Paste a rate con / broker email</Label>
          <textarea value={text} onChange={e=>setText(e.target.value)} rows={9}
            placeholder={"Paste the broker's email or rate confirmation here.\n\nExample: 'TQL — Dallas TX to Memphis TN, 452 mi, $1,450 all in, PU 6/19 0800, ref 88231, dry van.'"}
            style={{width:"100%",background:C.bg,border:`1px solid ${C.line}`,borderRadius:7,color:C.ink,
              padding:"11px",fontFamily:mono,fontSize:12.5,resize:"vertical"}}/>
          <div className="flex items-center justify-between" style={{marginTop:10,gap:10}}>
            <div style={{fontFamily:sans,fontSize:11,color:C.faint,maxWidth:330}}>Reads text you paste. It does not connect to your live inbox — see the note below the board.</div>
            <button onClick={extract} disabled={busy} style={{fontFamily:mono,fontSize:12.5,fontWeight:700,
              color:C.bg,background:busy?C.faint:C.amber,border:"none",borderRadius:7,padding:"9px 16px",cursor:busy?"default":"pointer",whiteSpace:"nowrap"}}>
              {busy?"Reading…":"Extract load"}</button>
          </div>
          {err && <div style={{marginTop:10,color:C.red,fontFamily:mono,fontSize:11.5}}>{err}</div>}
        </div>

        {draft && (
          <div style={{marginTop:12,background:C.panel,border:`1px solid ${C.amber}55`,borderRadius:10,padding:14}}>
            <div className="flex items-center justify-between" style={{marginBottom:10}}>
              <Label style={{color:C.amber}}>Extracted — review then add</Label>
              {draft.rate&&draft.miles && <Pill color={rpmColor(draft.rate/draft.miles)}>rpm ${ (draft.rate/draft.miles).toFixed(2)}</Pill>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3" style={{gap:10}}>
              {[["Broker",draft.broker],["Rate",draft.rate!=null?money(draft.rate):"—"],["Miles",draft.miles!=null?fmt0(draft.miles):"—"],
                ["Origin",draft.origin||"—"],["Dest",draft.dest||"—"],["Pickup",draft.pickup_date||"—"],
                ["Ref",draft.ref||"—"],["Commodity",draft.commodity||"—"]].map((f,i)=>(
                <div key={i}><Label style={{fontSize:9}}>{f[0]}</Label>
                  <div style={{fontFamily:mono,fontSize:13,color:C.ink,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f[1]}</div></div>
              ))}
            </div>
            {draft.notes && <div style={{marginTop:10,fontFamily:sans,fontSize:11.5,color:C.dim}}>Note: {draft.notes}</div>}
            <button onClick={add} style={{marginTop:12,fontFamily:mono,fontSize:12.5,fontWeight:700,color:C.bg,
              background:C.green,border:"none",borderRadius:7,padding:"9px 16px",cursor:"pointer"}}>+ Add to board (Available)</button>
          </div>
        )}
      </div>

      <div style={{width:"100%",maxWidth:320}}>
        <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:14}}>
          <Label style={{marginBottom:10}}>Recently captured</Label>
          {recent.length===0 && <div style={{fontFamily:mono,fontSize:11,color:C.faint}}>Nothing yet. Extracted loads show up here.</div>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {recent.map((r,i)=>(
              <div key={i} style={{padding:"8px 10px",background:C.panel2,border:`1px solid ${C.line}`,borderRadius:7}}>
                <div style={{fontFamily:sans,fontSize:12.5,color:C.ink,fontWeight:600}}>{r.broker}</div>
                <div style={{fontFamily:mono,fontSize:10.5,color:C.dim,marginTop:2}}>{money(r.rate)} · {fmt0(r.miles)}mi · {r.when}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================ TEAM CHAT ============================ */
function Chat({loads}){
  const [msgs,setMsgs]=useState([]); const [who,setWho]=useState("");
  const [body,setBody]=useState(""); const [tag,setTag]=useState(""); const endRef=useRef(null);
  useEffect(()=>{ sget(KEY_CHAT,true).then(v=>{ if(v) setMsgs(v); }); },[]);
  useEffect(()=>{ endRef.current&&endRef.current.scrollIntoView({behavior:"smooth"}); },[msgs]);
  const active=useMemo(()=>loads.filter(l=>l.status!=="Delivered"),[loads]);
  async function send(){
    if(!body.trim()) return;
    const m={id:uid(),who:who.trim()||"Dispatch",body:body.trim(),tag:tag||null,ts:Date.now()};
    const next=[...msgs,m].slice(-200); setMsgs(next); setBody(""); await sset(KEY_CHAT,next,true);
  }
  return (
    <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,display:"flex",flexDirection:"column",height:620,maxWidth:760,margin:"0 auto"}}>
      <div style={{padding:"12px 14px",borderBottom:`1px solid ${C.lineSoft}`}} className="flex items-center justify-between">
        <div><Label>Team channel</Label><div style={{fontFamily:sans,fontSize:13,color:C.ink,marginTop:2}}>Active loads thread · shared with everyone on this board</div></div>
        <Pill color={C.green} bg={C.green+"1a"}>{active.length} active</Pill>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:10}}>
        {msgs.length===0 && <div style={{fontFamily:mono,fontSize:12,color:C.faint,margin:"auto",textAlign:"center"}}>No messages yet.<br/>Post an update about an active load to start the thread.</div>}
        {msgs.map(m=>{
          const tl=active.find(l=>l.id===m.tag);
          return (
            <div key={m.id} style={{background:C.panel2,border:`1px solid ${C.line}`,borderRadius:8,padding:"9px 11px"}}>
              <div className="flex items-center justify-between" style={{marginBottom:4}}>
                <span style={{fontFamily:mono,fontSize:12,fontWeight:700,color:C.amber}}>{m.who}</span>
                <span style={{fontFamily:mono,fontSize:10,color:C.faint}}>{new Date(m.ts).toLocaleString()}</span>
              </div>
              {m.tag && <div style={{marginBottom:5}}><Pill color={C.blue} bg={C.blue+"15"}>{tl?(tl.broker+" · "+money(tl.rate)):"load"}</Pill></div>}
              <div style={{fontFamily:sans,fontSize:13.5,color:C.ink,whiteSpace:"pre-wrap"}}>{m.body}</div>
            </div>
          );
        })}
        <div ref={endRef}/>
      </div>
      <div style={{padding:12,borderTop:`1px solid ${C.lineSoft}`}}>
        <div className="flex" style={{gap:8,marginBottom:8}}>
          <input value={who} onChange={e=>setWho(e.target.value)} placeholder="Your name"
            style={{width:130,background:C.bg,border:`1px solid ${C.line}`,borderRadius:6,color:C.ink,padding:"7px 10px",fontFamily:mono,fontSize:12}}/>
          <select value={tag} onChange={e=>setTag(e.target.value)} style={{...selStyle,flex:1}}>
            <option value="">Tag a load (optional)</option>
            {active.map(l=><option key={l.id} value={l.id}>{l.broker} · {money(l.rate)} · {l.driver||"open"}</option>)}
          </select>
        </div>
        <div className="flex" style={{gap:8}}>
          <input value={body} onChange={e=>setBody(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Message your team…"
            style={{flex:1,background:C.bg,border:`1px solid ${C.line}`,borderRadius:6,color:C.ink,padding:"9px 12px",fontFamily:sans,fontSize:13.5}}/>
          <button onClick={send} style={{fontFamily:mono,fontSize:12.5,fontWeight:700,color:C.bg,background:C.amber,border:"none",borderRadius:6,padding:"9px 16px",cursor:"pointer"}}>Send</button>
        </div>
      </div>
    </div>
  );
}

/* ============================ COPILOT ============================ */
function Copilot({loads}){
  const [msgs,setMsgs]=useState([{role:"assistant",content:"I'm your dispatch copilot. I can see your board. Ask me to pair open loads with drivers, flag thin-margin freight, rank brokers by RPM, or draft a reply to a broker."}]);
  const [input,setInput]=useState(""); const [busy,setBusy]=useState(false); const endRef=useRef(null);
  useEffect(()=>{ endRef.current&&endRef.current.scrollIntoView({behavior:"smooth"}); },[msgs,busy]);
  const ctx=useMemo(()=>{
    const active=loads.filter(l=>l.status!=="Delivered").map(l=>({broker:l.broker,rate:l.rate,miles:l.miles,rpm:computeRpm(l)?+computeRpm(l).toFixed(2):null,status:l.status,driver:l.driver,origin:l.origin,dest:l.dest,dispatchFee:l.dispatch||null,repair:l.repair||null,net:Math.round(netOf(l))}));
    const byDrv={};
    loads.forEach(l=>{ if(!l.driver)return; const d=byDrv[l.driver]||(byDrv[l.driver]={loads:0,rpmN:0,rpmC:0,brokers:{}}); d.loads++; const r=computeRpm(l); if(r){d.rpmN+=r;d.rpmC++;} if(l.broker)d.brokers[l.broker]=(d.brokers[l.broker]||0)+1; });
    const drivers=Object.entries(byDrv).map(([k,v])=>({driver:k,loads:v.loads,avgRpm:v.rpmC?+(v.rpmN/v.rpmC).toFixed(2):null,topBrokers:Object.entries(v.brokers).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0])}));
    return {active,drivers};
  },[loads]);
  async function send(){
    if(!input.trim()||busy) return;
    const next=[...msgs,{role:"user",content:input.trim()}]; setMsgs(next); setInput(""); setBusy(true);
    try{
      const sys="You are a sharp truckload dispatch copilot for a small carrier. Be concise and decisive, use the data given. RPM under $1.80 is thin, $1.80-2.49 is ok, $2.50+ is strong. When pairing loads to drivers, prefer the driver whose recent brokers/lanes match. Current board state JSON: "+JSON.stringify(ctx);
      const apiMsgs=next.filter(m=>m.role!=="assistant"||m!==next[0]).map(m=>({role:m.role,content:m.content}));
      const out=await callClaude(apiMsgs,sys,900);
      setMsgs([...next,{role:"assistant",content:out}]);
    }catch(e){ setMsgs([...next,{role:"assistant",content:"I couldn't reach the model just now. Try again in a moment."}]); }
    setBusy(false);
  }
  return (
    <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,display:"flex",flexDirection:"column",height:620,maxWidth:760,margin:"0 auto"}}>
      <div style={{padding:"12px 14px",borderBottom:`1px solid ${C.lineSoft}`}} className="flex items-center justify-between">
        <div><Label>Dispatch copilot</Label><div style={{fontFamily:sans,fontSize:13,color:C.ink,marginTop:2}}>Reads your live board · {ctx.active.length} active loads</div></div>
        <Pill color={C.purple} bg={C.purple+"1a"}>AI</Pill>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:11}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{alignSelf:m.role==="user"?"flex-end":"flex-start",maxWidth:"86%",
            background:m.role==="user"?C.amber:C.panel2,color:m.role==="user"?C.bg:C.ink,
            border:m.role==="user"?"none":`1px solid ${C.line}`,borderRadius:9,padding:"9px 12px",
            fontFamily:sans,fontSize:13.5,whiteSpace:"pre-wrap",lineHeight:1.45}}>{m.content}</div>
        ))}
        {busy && <div style={{alignSelf:"flex-start",fontFamily:mono,fontSize:12,color:C.faint}}>thinking…</div>}
        <div ref={endRef}/>
      </div>
      <div style={{padding:12,borderTop:`1px solid ${C.lineSoft}`}} className="flex" >
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="e.g. Pair my open loads with the best driver" style={{flex:1,background:C.bg,border:`1px solid ${C.line}`,borderRadius:6,color:C.ink,padding:"9px 12px",fontFamily:sans,fontSize:13.5,marginRight:8}}/>
        <button onClick={send} disabled={busy} style={{fontFamily:mono,fontSize:12.5,fontWeight:700,color:C.bg,background:busy?C.faint:C.purple,border:"none",borderRadius:6,padding:"9px 16px",cursor:busy?"default":"pointer"}}>Ask</button>
      </div>
    </div>
  );
}

/* ============================ NEW LOAD MODAL ============================ */
function NewLoad({onClose,onSave,drivers}){
  const [f,setF]=useState({broker:"",rate:"",miles:"",origin:"",dest:"",driver:"",date:todayISO()});
  const set=(k,v)=>setF({...f,[k]:v});
  const rpm=(f.rate&&f.miles)?(parseFloat(f.rate)/parseFloat(f.miles)):null;
  function save(){
    const l={id:uid(),status:f.driver?"Assigned":"Available",date:f.date,broker:f.broker||"Unknown broker",
      rate:f.rate?parseFloat(f.rate):null,miles:f.miles?parseFloat(f.miles):null,
      rpm:rpm,origin:f.origin||null,dest:f.dest||null,driver:f.driver||null,unit:null,pay:null,fuel:null,ref:null};
    onSave(l);
  }
  const inp={width:"100%",background:C.bg,border:`1px solid ${C.line}`,borderRadius:6,color:C.ink,padding:"9px 11px",fontFamily:mono,fontSize:12.5};
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#000000aa",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:12,padding:18,width:"100%",maxWidth:440}}>
        <div className="flex items-center justify-between" style={{marginBottom:14}}>
          <div style={{fontFamily:sans,fontSize:16,fontWeight:700,color:C.ink}}>New load</div>
          {rpm!=null && <Pill color={rpmColor(rpm)} bg={rpmColor(rpm)+"1a"}>rpm ${rpm.toFixed(2)} · {rpmLabel(rpm)}</Pill>}
        </div>
        <div className="grid grid-cols-2" style={{gap:10}}>
          <div className="col-span-2"><Label style={{marginBottom:4}}>Broker</Label><input style={inp} value={f.broker} onChange={e=>set("broker",e.target.value)}/></div>
          <div><Label style={{marginBottom:4}}>Rate $</Label><input style={inp} value={f.rate} onChange={e=>set("rate",e.target.value)} inputMode="decimal"/></div>
          <div><Label style={{marginBottom:4}}>Miles</Label><input style={inp} value={f.miles} onChange={e=>set("miles",e.target.value)} inputMode="numeric"/></div>
          <div><Label style={{marginBottom:4}}>Origin</Label><input style={inp} value={f.origin} onChange={e=>set("origin",e.target.value)} placeholder="Dallas, TX"/></div>
          <div><Label style={{marginBottom:4}}>Dest</Label><input style={inp} value={f.dest} onChange={e=>set("dest",e.target.value)} placeholder="Memphis, TN"/></div>
          <div><Label style={{marginBottom:4}}>Pickup</Label><input style={inp} type="date" value={f.date} onChange={e=>set("date",e.target.value)}/></div>
          <div><Label style={{marginBottom:4}}>Driver</Label>
            <select style={{...inp,color:C.ink}} value={f.driver} onChange={e=>set("driver",e.target.value)}>
              <option value="">Leave open</option>{drivers.map(d=><option key={d} value={d}>{d}</option>)}
            </select></div>
        </div>
        <div className="flex justify-end" style={{gap:8,marginTop:16}}>
          <button onClick={onClose} style={{fontFamily:mono,fontSize:12.5,color:C.dim,background:C.raised,border:`1px solid ${C.line}`,borderRadius:7,padding:"9px 15px",cursor:"pointer"}}>Cancel</button>
          <button onClick={save} style={{fontFamily:mono,fontSize:12.5,fontWeight:700,color:C.bg,background:C.amber,border:"none",borderRadius:7,padding:"9px 18px",cursor:"pointer"}}>Add load</button>
        </div>
      </div>
    </div>
  );
}

/* ============================ APP ============================ */
const NAV=[["board","Board"],["loads","Loads"],["drivers","Drivers"],["pnl","Weekly P&L"],["monthly","Monthly P&L"],["lanes","Lane Book"],["inbox","Rate Cons"],["chat","Team"],["copilot","Copilot"]];
export default function App(){
  const [loads,setLoadsRaw]=useState(SEED);
  const [view,setView]=useState("board");
  const [ready,setReady]=useState(false);
  const [showNew,setShowNew]=useState(false);

  useEffect(()=>{(async()=>{
    const saved=await sget(KEY_LOADS,true);
    if(saved&&Array.isArray(saved)&&saved.length){ setLoadsRaw(saved); }
    else { await sset(KEY_LOADS,SEED,true); }
    setReady(true);
  })();},[]);
  function setLoads(next){ setLoadsRaw(next); sset(KEY_LOADS,next,true); }
  function addLoad(l){ setLoads([l,...loads]); }

  const drivers=useMemo(()=>{
    const s=new Set(DRIVER_ORDER); loads.forEach(l=>l.driver&&s.add(l.driver)); return Array.from(s);
  },[loads]);

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.ink,fontFamily:sans}}>
      {/* header */}
      <div style={{borderBottom:`1px solid ${C.line}`,background:C.panel,position:"sticky",top:0,zIndex:20}}>
        <div style={{maxWidth:1280,margin:"0 auto",padding:"12px 18px"}} className="flex items-center justify-between">
          <div className="flex items-center" style={{gap:12}}>
            <div style={{width:34,height:34,borderRadius:8,background:C.amber,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontFamily:mono,fontWeight:800,color:C.bg,fontSize:17}}>L</span>
            </div>
            <div>
              <div style={{fontFamily:sans,fontWeight:800,fontSize:16,letterSpacing:.5,color:C.ink}}>LOADED LOGISTICS</div>
              <div style={{fontFamily:mono,fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:C.faint}}>Dispatch terminal</div>
            </div>
          </div>
          <div className="flex items-center" style={{gap:8}}>
            <div style={{width:7,height:7,borderRadius:9,background:ready?C.green:C.amber}}/>
            <span style={{fontFamily:mono,fontSize:10.5,color:C.dim}}>{ready?"synced":"loading"}</span>
          </div>
        </div>
        {/* nav */}
        <div style={{maxWidth:1280,margin:"0 auto",padding:"0 18px"}}>
          <div className="flex" style={{gap:2,overflowX:"auto"}}>
            {NAV.map(([id,label])=>(
              <button key={id} onClick={()=>setView(id)} style={{fontFamily:sans,fontSize:12.5,fontWeight:600,letterSpacing:.4,
                color:view===id?C.ink:C.dim,background:"transparent",border:"none",borderBottom:`2px solid ${view===id?C.amber:"transparent"}`,
                padding:"10px 14px",cursor:"pointer",whiteSpace:"nowrap"}}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{maxWidth:1280,margin:"0 auto",padding:"16px 18px 60px"}}>
        <div style={{marginBottom:16}}><KpiBar loads={loads}/></div>
        {view==="board" && <Board loads={loads} setLoads={setLoads} drivers={drivers} onNewLoad={()=>setShowNew(true)}/>}
        {view==="loads" && <Ledger loads={loads}/>}
        {view==="drivers" && <Drivers loads={loads}/>}
        {view==="pnl" && <WeeklyPnL loads={loads}/>}
        {view==="monthly" && <MonthlyPnL loads={loads}/>}
        {view==="lanes" && <LaneBook loads={loads}/>}
        {view==="inbox" && <Inbox onAdd={addLoad}/>}
        {view==="chat" && <Chat loads={loads}/>}
        {view==="copilot" && <Copilot loads={loads}/>}

        {(view==="inbox") && (
          <div style={{marginTop:16,maxWidth:760,fontFamily:sans,fontSize:11.5,color:C.faint,lineHeight:1.5,borderTop:`1px solid ${C.lineSoft}`,paddingTop:12}}>
            On live email: this board can't read your inbox on its own — an in-app tool has no server to watch your mailbox or run on a schedule. The realistic path is paste-to-extract here, or a small backend service that forwards rate-con emails to the board. Ask and I'll spec that out.
          </div>
        )}
      </div>

      {showNew && <NewLoad drivers={drivers} onClose={()=>setShowNew(false)} onSave={l=>{addLoad(l);setShowNew(false);setView("board");}}/>}
    </div>
  );
}
```

### `website/.gitignore`

```
node_modules
```

### `website/package.json`

```json
{
  "name": "loaded-logistics-website",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=18" },
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.19.2"
  }
}
```

### `website/public/favicon.svg`

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <rect x="2" y="2" width="96" height="96" rx="23" fill="#0A0D18"/>
  <rect x="22" y="18" width="17" height="46" rx="4" fill="#16C7DE"/>
  <rect x="22" y="47" width="39" height="17" rx="4" fill="#16C7DE"/>
  <rect x="58" y="33" width="23" height="52" rx="6" fill="#0A0D18"/>
  <rect x="36" y="33" width="45" height="23" rx="6" fill="#0A0D18"/>
  <rect x="61" y="36" width="17" height="46" rx="4" fill="#8B5CFF"/>
  <rect x="39" y="36" width="39" height="17" rx="4" fill="#8B5CFF"/>
</svg>
```

### `website/public/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Loaded Logistics — Reliable Freight, Nationwide</title>
  <meta name="description" content="Loaded Logistics is a family-owned North Carolina carrier delivering dependable, nationwide freight — full truckload, LTL, time-sensitive and specialized shipments, with a safety-first promise.">
  <link rel="icon" type="image/png" href="favicon.svg">
  <link rel="apple-touch-icon" href="favicon.svg">
  <meta property="og:title" content="Loaded Logistics — Reliable Freight, Nationwide">
  <meta property="og:description" content="Dependable, nationwide freight from a family-owned NC carrier. FTL, LTL, time-sensitive & specialized handling.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://www.loadedlogisticsnc.com">
  <meta property="og:image" content="https://www.loadedlogisticsnc.com/favicon.svg">
  <meta name="twitter:card" content="summary">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root{--ink:#0B0F1C;--paper:#FFFFFF;--mist:#F3F5F8;--line:#E4E7EC;--muted:#5b6478;
    --teal:#0E8FA3;--tealb:#16C7DE;--purple:#6C2BD9;--purpleb:#8B5CFF;--badge:#0A0D18}
  *{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{font-family:'Inter',system-ui,sans-serif;color:var(--ink);background:var(--paper);line-height:1.6}
  .container{max-width:1120px;margin:0 auto;padding:0 clamp(18px,4vw,32px)}
  a{color:inherit;text-decoration:none}
  h1,h2,h3,.dt{font-family:'Oswald',sans-serif;text-transform:uppercase;letter-spacing:.01em;font-weight:700;line-height:1.05}

  /* header */
  header{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.86);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
  .nav{display:flex;align-items:center;justify-content:space-between;height:68px}
  .brand{display:flex;align-items:center;gap:12px}
  .brand .bt{font-family:'Oswald',sans-serif;font-weight:700;text-transform:uppercase;font-size:20px;letter-spacing:.02em;line-height:1}
  .brand .bs{font-family:'Oswald',sans-serif;font-weight:500;text-transform:uppercase;font-size:9.5px;letter-spacing:.34em;color:var(--teal);line-height:1;margin-top:2px}
  .navlinks{display:flex;gap:28px;align-items:center}
  .navlinks a{font-size:14px;font-weight:600;color:#3b4256}
  .navlinks a:hover{color:var(--teal)}
  .btn{display:inline-block;font-family:'Oswald',sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.04em;
    font-size:14px;padding:11px 20px;border-radius:9px;cursor:pointer;transition:transform .12s,box-shadow .12s}
  .btn-primary{background:linear-gradient(120deg,var(--tealb),var(--purpleb));color:#fff;box-shadow:0 6px 18px rgba(108,43,217,.28)}
  .btn-primary:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(108,43,217,.36)}
  .btn-ghost{border:1.5px solid rgba(255,255,255,.4);color:#fff}
  .btn-dark{background:var(--ink);color:#fff}
  @media(max-width:760px){.navlinks{display:none}}

  /* hero */
  .hero{position:relative;overflow:hidden;color:#fff;
    background:linear-gradient(125deg,#00839A 0%,#076086 32%,#2A1E74 68%,#1C1060 100%)}
  .hero::before{content:"";position:absolute;inset:0;background:radial-gradient(40% 60% at 22% 40%,rgba(22,199,222,.30),transparent 70%),radial-gradient(46% 66% at 80% 60%,rgba(139,92,255,.32),transparent 72%)}
  .hero .container{position:relative;padding-top:clamp(56px,9vw,104px);padding-bottom:clamp(56px,9vw,104px)}
  .eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#9fe9f4;
    background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);padding:6px 12px;border-radius:30px;margin-bottom:22px}
  .hero h1{font-size:clamp(34px,6.2vw,68px);max-width:16ch}
  .hero h1 .accent{background:linear-gradient(100deg,#5fe6f7,#b69bff);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
  .hero p.sub{font-size:clamp(16px,2.2vw,20px);color:rgba(255,255,255,.82);max-width:52ch;margin:20px 0 30px}
  .hero .cta{display:flex;gap:14px;flex-wrap:wrap}
  .heromark{position:absolute;right:clamp(-40px,2vw,40px);bottom:-30px;opacity:.16;transform:rotate(-8deg)}

  /* trust strip */
  .trust{background:var(--ink);color:#fff}
  .trust .container{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;padding:26px 0}
  .trust .item{display:flex;flex-direction:column;gap:2px}
  .trust .k{font-family:'Oswald',sans-serif;font-weight:700;font-size:22px;color:#fff}
  .trust .l{font-size:12.5px;color:#9aa3b5;letter-spacing:.02em}
  @media(max-width:760px){.trust .container{grid-template-columns:1fr 1fr;gap:14px}}

  /* sections */
  section.block{padding:clamp(54px,8vw,92px) 0}
  .kicker{font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--teal);margin-bottom:10px}
  h2.sec{font-size:clamp(26px,4vw,40px);max-width:20ch}
  .lead2{color:var(--muted);font-size:clamp(15px,1.8vw,17.5px);max-width:60ch;margin-top:12px}

  .svc{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:38px}
  .scard{border:1px solid var(--line);border-radius:16px;padding:26px;background:#fff;transition:transform .14s,box-shadow .14s,border-color .14s}
  .scard:hover{transform:translateY(-3px);box-shadow:0 14px 30px rgba(11,15,28,.08);border-color:#cfd5de}
  .scard .ico{width:46px;height:46px;border-radius:11px;display:flex;align-items:center;justify-content:center;
    background:linear-gradient(125deg,rgba(22,199,222,.16),rgba(139,92,255,.16));margin-bottom:16px}
  .scard h3{font-size:18px;margin-bottom:7px}
  .scard p{font-size:14px;color:var(--muted)}
  @media(max-width:820px){.svc{grid-template-columns:1fr}}

  /* split: why / safety */
  .split{display:grid;grid-template-columns:1fr 1fr;gap:clamp(26px,5vw,60px);align-items:center}
  .split.mist{background:var(--mist)}
  .checks{list-style:none;margin-top:22px;display:flex;flex-direction:column;gap:14px}
  .checks li{display:flex;gap:12px;font-size:15px}
  .checks .cm{flex-shrink:0;width:24px;height:24px;border-radius:7px;background:linear-gradient(125deg,var(--tealb),var(--purpleb));color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;margin-top:1px}
  .panelcard{border-radius:20px;background:linear-gradient(125deg,#00839A 0%,#076086 34%,#2A1E74 70%,#1C1060 100%);position:relative;overflow:hidden;padding:clamp(28px,4vw,44px);color:#fff;min-height:280px;display:flex;flex-direction:column;justify-content:center}
  .panelcard::before{content:"";position:absolute;inset:0;background:radial-gradient(50% 70% at 40% 40%,rgba(22,199,222,.26),transparent 70%),radial-gradient(50% 70% at 70% 60%,rgba(139,92,255,.28),transparent 72%)}
  .panelcard>*{position:relative}
  .panelcard .big{font-family:'Oswald',sans-serif;font-weight:700;text-transform:uppercase;font-size:clamp(24px,3.4vw,34px);line-height:1.05}
  @media(max-width:820px){.split{grid-template-columns:1fr}}

  /* careers CTA */
  .careers{background:var(--ink);color:#fff;border-radius:22px;padding:clamp(34px,5vw,56px);text-align:center;position:relative;overflow:hidden}
  .careers::before{content:"";position:absolute;inset:0;background:radial-gradient(40% 80% at 50% 0%,rgba(22,199,222,.18),transparent 70%)}
  .careers>*{position:relative}
  .careers h2{font-size:clamp(24px,4vw,38px)}
  .careers p{color:#aab2c2;max-width:48ch;margin:12px auto 24px}

  /* contact */
  .contact{display:grid;grid-template-columns:1.1fr .9fr;gap:clamp(26px,5vw,56px)}
  .cinfo .row{display:flex;align-items:center;gap:14px;padding:16px 0;border-bottom:1px solid var(--line)}
  .cinfo .ic{width:42px;height:42px;border-radius:11px;background:linear-gradient(125deg,rgba(22,199,222,.16),rgba(139,92,255,.16));display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
  .cinfo .rk{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
  .cinfo .rv{font-family:'Oswald',sans-serif;font-weight:600;font-size:18px}
  .quote{border:1px solid var(--line);border-radius:18px;padding:28px;background:var(--mist)}
  .quote .field{margin-bottom:12px}
  .quote label{font-size:12.5px;font-weight:600;color:#3b4256;display:block;margin-bottom:5px}
  .quote input,.quote textarea{width:100%;border:1px solid var(--line);border-radius:9px;padding:11px 12px;font-family:inherit;font-size:14px;background:#fff}
  @media(max-width:820px){.contact{grid-template-columns:1fr}}

  /* footer */
  footer{background:var(--ink);color:#fff;padding:48px 0 28px}
  .fgrid{display:flex;justify-content:space-between;gap:30px;flex-wrap:wrap;padding-bottom:28px;border-bottom:1px solid rgba(255,255,255,.1)}
  .fcol h4{font-family:'Oswald',sans-serif;text-transform:uppercase;font-size:13px;letter-spacing:.1em;color:#9aa3b5;margin-bottom:12px}
  .fcol a,.fcol p{display:block;color:#c7cdda;font-size:14px;margin-bottom:8px}
  .fcol a:hover{color:#fff}
  .fbottom{padding-top:18px;font-size:12.5px;color:#8a92a5;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
</style>
</head>
<body>

<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset=".46" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <clipPath id="bc"><rect x="2" y="2" width="96" height="96" rx="23"/></clipPath>
  <filter id="ws" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.7" flood-color="#000" flood-opacity="0.55"/></filter>
</defs></svg>

<script>
  window.MARK = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 100 100" aria-label="Loaded Logistics">
    <rect x="2" y="2" width="96" height="96" rx="23" fill="#0A0D18"/>
    <rect x="22" y="18" width="17" height="46" rx="4" fill="#16C7DE"/><rect x="22" y="47" width="39" height="17" rx="4" fill="#16C7DE"/>
    <rect x="58" y="33" width="23" height="52" rx="6" fill="#0A0D18"/><rect x="36" y="33" width="45" height="23" rx="6" fill="#0A0D18"/>
    <g filter="url(#ws)"><rect x="61" y="36" width="17" height="46" rx="4" fill="#8B5CFF"/><rect x="39" y="36" width="39" height="17" rx="4" fill="#8B5CFF"/></g>
    <rect x="2" y="2" width="96" height="96" fill="url(#gloss)" clip-path="url(#bc)"/></svg>`;
</script>

<!-- HEADER -->
<header>
  <div class="container nav">
    <a class="brand" href="#top">
      <span id="navmark"></span>
      <span><span class="bt">Loaded</span><br><span class="bs">Logistics</span></span>
    </a>
    <nav class="navlinks">
      <a href="#services">Services</a>
      <a href="#why">Why Us</a>
      <a href="#about">About</a>
      <a href="#careers">Careers</a>
      <a href="#contact">Contact</a>
      <a class="btn btn-primary" href="#contact">Get a Quote</a>
    </nav>
  </div>
</header>

<!-- HERO -->
<section class="hero" id="top">
  <span class="heromark" id="heromark"></span>
  <div class="container">
    <span class="eyebrow">● Family-owned · Matthews, NC</span>
    <h1>Freight moved right — <span class="accent">on time, every time.</span></h1>
    <p class="sub">From one box truck to a growing semi fleet, Loaded Logistics delivers dependable, nationwide freight with the kind of straightforward, safety-first service you can actually count on.</p>
    <div class="cta">
      <a class="btn btn-primary" href="#contact">Get a Quote</a>
      <a class="btn btn-ghost" href="#careers">Apply to Drive</a>
    </div>
  </div>
</section>

<!-- TRUST -->
<div class="trust">
  <div class="container">
    <div class="item"><span class="k">48 States</span><span class="l">Coast-to-coast coverage</span></div>
    <div class="item"><span class="k">8a–8p</span><span class="l">Responsive dispatch, 7 days</span></div>
    <div class="item"><span class="k">Safety-First</span><span class="l">Vetted drivers, maintained fleet</span></div>
    <div class="item"><span class="k">Family-Owned</span><span class="l">We treat freight like our own</span></div>
  </div>
</div>

<!-- SERVICES -->
<section class="block container" id="services">
  <p class="kicker">What we haul</p>
  <h2 class="sec">Full-service freight, built around your schedule</h2>
  <p class="lead2">Truckload or partial, routine or time-critical — we move it with professional drivers, well-maintained equipment, and communication you don't have to chase.</p>
  <div class="svc">
    <div class="scard"><div class="ico">🚛</div><h3>Full Truckload (FTL)</h3><p>Dedicated capacity coast to coast, with on-time performance you can plan around.</p></div>
    <div class="scard"><div class="ico">📦</div><h3>Less-Than-Truckload (LTL)</h3><p>Cost-efficient partial loads across the Southeast and beyond, handled with care.</p></div>
    <div class="scard"><div class="ico">⏱️</div><h3>Time-Sensitive & Dedicated</h3><p>Dedicated-route and expedited solutions for manufacturers, distributors, and retailers.</p></div>
    <div class="scard"><div class="ico">🛡️</div><h3>Specialized Handling</h3><p>Careful transport for high-value, fragile, and hazardous shipments.</p></div>
    <div class="scard"><div class="ico">📍</div><h3>Real-Time Tracking</h3><p>Proactive updates and visibility from pickup to delivery — no guesswork.</p></div>
    <div class="scard"><div class="ico">🤝</div><h3>People Who Solve Problems</h3><p>Clear quotes, honest timelines, and a dispatch team that actually picks up.</p></div>
  </div>
</section>

<!-- WHY / SAFETY -->
<section class="block" id="why" style="background:var(--mist)">
  <div class="container split">
    <div>
      <p class="kicker">Our safety-first promise</p>
      <h2 class="sec">Freight moves the economy — but never at the cost of the people who move it</h2>
      <ul class="checks">
        <li><span class="cm">✓</span><span>Rigorous driver vetting and continuous training, led by hands-on leadership.</span></li>
        <li><span class="cm">✓</span><span>Fleet maintained to the highest standards with preventive maintenance and modern safety tech.</span></li>
        <li><span class="cm">✓</span><span>Strict compliance with federal and state regulations and best-practice protocols.</span></li>
        <li><span class="cm">✓</span><span>Safety metrics tracked and shared transparently with our customers.</span></li>
      </ul>
    </div>
    <div class="panelcard">
      <div class="big">Reliable.<br>Efficient.<br>Professional.</div>
      <p style="color:rgba(255,255,255,.82);margin-top:14px;font-size:15px">The same no-nonsense dedication we started with — now backed by systems that move freight efficiently at scale.</p>
    </div>
  </div>
</section>

<!-- ABOUT -->
<section class="block container" id="about">
  <div class="split">
    <div class="panelcard" style="background:linear-gradient(125deg,#1C1060 0%,#2A1E74 36%,#076086 100%)">
      <div class="big">Started with one box truck<br>& a big idea.</div>
    </div>
    <div>
      <p class="kicker">Our story</p>
      <h2 class="sec">A North Carolina carrier, family-owned and built on integrity</h2>
      <p class="lead2">Founded in Matthews, NC by Joseph Hawkinson and Meredith Taylor, Loaded Logistics grew from a small, principled operation into a regional leader in safe, reliable freight transportation — without ever compromising on accountability. We treat your freight like it's our own, and we keep it simple: clear quotes, honest timelines, responsive dispatch.</p>
    </div>
  </div>
</section>

<!-- CAREERS -->
<section class="block container" id="careers">
  <div class="careers">
    <p class="kicker" style="color:var(--tealb)">Employment opportunities</p>
    <h2>Drive with a team that has your back</h2>
    <p>We're always looking for motivated, well-qualified drivers to join our growing fleet. Safety-first culture, well-maintained trucks, and leadership that listens.</p>
    <a class="btn btn-primary" href="https://www.indeed.com/job/truck-driver-0f054c41fd6edeff" target="_blank" rel="noopener">Apply Now</a>
  </div>
</section>

<!-- CONTACT -->
<section class="block container" id="contact">
  <p class="kicker">Get in touch</p>
  <h2 class="sec" style="margin-bottom:34px">Get freight moved right</h2>
  <div class="contact">
    <div class="cinfo">
      <div class="row"><span class="ic">📞</span><span><span class="rk">Call dispatch</span><br><a class="rv" href="tel:+17049624987">704-962-4987</a></span></div>
      <div class="row"><span class="ic">✉️</span><span><span class="rk">Email</span><br><a class="rv" href="mailto:j.hawkinson@loadedlogisticsnc.com">j.hawkinson@loadedlogisticsnc.com</a></span></div>
      <div class="row"><span class="ic">📍</span><span><span class="rk">Based in</span><br><span class="rv">Matthews, North Carolina</span></span></div>
      <div class="row" style="border-bottom:none"><span class="ic">🕗</span><span><span class="rk">Hours</span><br><span class="rv">Mon–Sun · 8:00a – 8:00p</span></span></div>
    </div>
    <div class="quote">
      <div class="field"><label>Name</label><input id="qName" type="text" placeholder="Your name"></div>
      <div class="field"><label>Email or phone</label><input id="qContact" type="text" placeholder="How we reach you"></div>
      <div class="field"><label>What do you need moved?</label><textarea id="qNeed" rows="3" placeholder="Lane, freight type, timing…"></textarea></div>
      <button class="btn btn-primary" style="width:100%;border:none" onclick="sendQuote()">Request a Quote</button>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer>
  <div class="container">
    <div class="fgrid">
      <div class="fcol" style="max-width:300px">
        <div class="brand" style="margin-bottom:12px"><span id="footmark"></span><span><span class="bt" style="color:#fff">Loaded</span><br><span class="bs">Logistics</span></span></div>
        <p style="color:#9aa3b5">Dependable, simple, nationwide freight. Family-owned in Matthews, NC.</p>
      </div>
      <div class="fcol"><h4>Company</h4><a href="#services">Services</a><a href="#why">Why Us</a><a href="#about">About</a><a href="#careers">Careers</a></div>
      <div class="fcol"><h4>Contact</h4><a href="tel:+17049624987">704-962-4987</a><a href="mailto:j.hawkinson@loadedlogisticsnc.com">j.hawkinson@loadedlogisticsnc.com</a><p>Matthews, NC</p></div>
    </div>
    <div class="fbottom"><span>© 2026 Loaded Logistics. All rights reserved.</span><span>Joseph Hawkinson &amp; Meredith Taylor</span></div>
  </div>
</footer>

<script>
  document.getElementById('navmark').innerHTML = window.MARK(40);
  document.getElementById('footmark').innerHTML = window.MARK(40);
  document.getElementById('heromark').innerHTML = window.MARK(360);

  // Quote form: compose an email to dispatch with whatever the visitor filled in.
  function sendQuote(){
    var name = (document.getElementById('qName').value || '').trim();
    var contact = (document.getElementById('qContact').value || '').trim();
    var need = (document.getElementById('qNeed').value || '').trim();
    if(!contact && !need){ alert('Add your contact info and what you need moved, then tap Request a Quote.'); return; }
    var subject = 'Quote request' + (name ? ' — ' + name : '');
    var body = 'Name: ' + name + '\nEmail or phone: ' + contact + '\n\nWhat to move:\n' + need;
    window.location.href = 'mailto:j.hawkinson@loadedlogisticsnc.com'
      + '?subject=' + encodeURIComponent(subject)
      + '&body=' + encodeURIComponent(body);
  }
</script>
</body>
</html>
```

### `website/server.js`

```js
import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Serves the static marketing site in ./public. Railway sets PORT at runtime.
const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(join(__dirname, "public")));

app.listen(PORT, () => console.log("Loaded Logistics website on :" + PORT));
```

