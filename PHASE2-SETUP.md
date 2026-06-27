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
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```
4. Run `npm run gmail-auth`. It prints a link — open it **signed in as the inbox
   you want** → approve. It prints that inbox's `GMAIL_ACCOUNTS` entry.
5. Run it again for the second inbox, then combine both entries into one
   `GMAIL_ACCOUNTS` line and continue with **Part 3**.
