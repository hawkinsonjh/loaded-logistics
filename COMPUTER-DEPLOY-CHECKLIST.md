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
