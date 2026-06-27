# Phase 2 — Google Cloud, click by click

This is the Google side of Phase 2, every click. It uses Google's current
"Google Auth Platform" layout (the 2025 redesign of the old "OAuth consent screen").
Each section also lists a **direct URL** — if a button has been renamed or moved,
paste the URL and you'll land on the right page.

You'll end this guide with three things to paste into Railway:
**Client ID**, **Client secret**, and a **GMAIL_ACCOUNTS** line holding a token for each inbox.

Time: ~25 minutes. Have both inbox addresses handy.

---

## A — Create the project

1. Open **https://console.cloud.google.com** and sign in (use the account that should
   own this — hawkinsonjh@gmail.com is fine).
2. At the very top, click the **project dropdown** (says "Select a project" or shows a
   current project name, just right of the "Google Cloud" logo).
3. In the dialog, click **New Project** (top-right).
4. **Name:** `loaded-logistics`. Leave Location as-is. Click **Create**.
5. Wait ~10 seconds for the notification, then click the project dropdown again and
   **select `loaded-logistics`** so it's the active project. (Confirm the top bar now
   reads `loaded-logistics`.)

---

## B — Turn on the Gmail API

1. Go to **https://console.cloud.google.com/apis/library** (or ☰ menu → **APIs & Services → Library**).
2. In the search box type **Gmail API** and click the **Gmail API** result.
3. Click the blue **Enable** button. Wait for it to finish (it lands you on the API page).

---

## C — Set up the consent screen (Google Auth Platform)

Direct URL: **https://console.cloud.google.com/auth/overview**
(☰ menu → **APIs & Services → OAuth consent screen** also redirects here.)

1. If you see a **Get started** button, click it. (If the app already exists, skip to **D**.)
2. The wizard has a few short steps:
   - **App Information** — App name: `Loaded Logistics`. User support email: pick your
     email from the dropdown. Click **Next**.
   - **Audience** — choose **External**. Click **Next**.
   - **Contact Information** — enter your email again. Click **Next**.
   - **Finish** — check the box to agree to the policy. Click **Continue / Create**.
3. You'll land on the Auth Platform **Overview**. The app now exists (in "Testing" mode —
   you'll fix that in section **E**).

---

## D — Add the read-only Gmail permission (Data Access)

Direct URL: **https://console.cloud.google.com/auth/scopes**
(Left sidebar on the Auth Platform → **Data Access**.)

1. Click **Add or remove scopes**.
2. A panel opens on the right. In the **filter box** at the bottom, paste:
   `gmail.readonly`
3. Find the row whose scope is **`.../auth/gmail.readonly`** (description: "View your email
   messages and settings"). **Check its box.**
4. Click **Update** (bottom of the panel).
5. Back on the Data Access page, click **Save**.

> This is the only permission the app ever asks for: read-only Gmail. It cannot send,
> delete, or change anything.

---

## E — Add your inboxes and publish (Audience)

Direct URL: **https://console.cloud.google.com/auth/audience**
(Auth Platform left sidebar → **Audience**.)

1. Under **Test users**, click **Add users**. Add **both** inbox email addresses
   (one per line). Click **Save**.
2. Now publish so logins don't expire. Under **Publishing status** (top of the same
   page) it will say **Testing**. Click **Publish app** → in the confirm dialog click
   **Confirm**. The status should change to **In production**.

> **Why publish?** While the status is "Testing," Google **revokes the connection every
> 7 days** and the worker would go dark. "In production" removes that.
>
> **About the verification banner:** because this requests a Gmail scope, Google may show
> a note that the app "needs verification" or "is unverified." That's expected and **fine
> for your use** — you're the only person connecting, to your own inboxes. You do **not**
> need to submit anything to Google. The only effect is a one-time "Google hasn't verified
> this app" screen during sign-in (section **G**), which you click through. Leave any
> "Prepare for verification" prompts alone.

---

## F — Create the OAuth client (Clients)

Direct URL: **https://console.cloud.google.com/auth/clients**
(Auth Platform left sidebar → **Clients**.)

1. Click **Create client** (or **+ Create client** / **Create OAuth client**).
2. **Application type:** choose **Web application**.
3. **Name:** `loaded-logistics-web`.
4. Scroll to **Authorized redirect URIs** → click **Add URI** → paste **exactly**:
   ```
   https://developers.google.com/oauthplayground
   ```
   (No trailing slash, no spaces.)
5. Click **Create**.
6. A dialog pops up titled **"OAuth client created"** showing the **Client ID** and
   **Client secret**. **Copy both** somewhere safe now (you can also click the download
   icon). If you close it, you can reopen the client from the Clients list and copy them
   again. ✅ **You now have your Client ID and Client secret.**

---

## G — Get a refresh token for each inbox

Do this **twice** — once per inbox. Use a fresh **incognito window** for the second so
you sign in as the correct account.

1. Open **https://developers.google.com/oauthplayground**.
2. Click the **gear icon (⚙)** at the top-right → check **Use your own OAuth credentials**
   → paste your **Client ID** and **Client secret** from **F** → close the gear panel.
3. On the **left**, find the box labeled **"Input your own scopes"** and paste:
   ```
   https://www.googleapis.com/auth/gmail.readonly
   ```
   Then click **Authorize APIs** (blue button just below).
4. Sign in as **inbox #1**. If you see **"Google hasn't verified this app"**, click
   **Advanced** → **Go to Loaded Logistics (unsafe)** → then **Continue / Allow**.
   (It's your own app — safe.)
5. You're returned to the Playground on **Step 2**. Click **Exchange authorization code
   for tokens**. In the response, copy the value of **`refresh_token`** — a long string
   starting with **`1//`**.
6. **Repeat 1–5 for inbox #2** in a new incognito window.

Now assemble one line with **both** (watch the quotes and the comma between them):

```
GMAIL_ACCOUNTS=[{"email":"first@gmail.com","refreshToken":"1//PASTE_FIRST"},{"email":"second@gmail.com","refreshToken":"1//PASTE_SECOND"}]
```

---

## H — You're done with Google

You now have all three values:

- **GOOGLE_CLIENT_ID** — the Client ID from **F**
- **GOOGLE_CLIENT_SECRET** — the Client secret from **F**
- **GMAIL_ACCOUNTS** — the line you built in **G**

Continue with **PHASE2-SETUP.md → Part 3** to paste these onto your Railway backend
(add `GMAIL_INGEST_ENABLED=true` too) and confirm it's running.

---

## If something looks different

- **No "Get started" button, just tabs** → your app already exists. Go straight to
  **Data Access** (C is done) for scopes, **Audience** to publish, **Clients** to make the client.
- **Can't find a page** → use the direct URLs above; they're stable even when buttons move.
- **"Add users" greyed out / no Test users section** → the app is already "In production";
  that's fine, test users aren't required once published.
- **Lost the Client secret** → Clients list → click your `loaded-logistics-web` client →
  the secret is shown / re-downloadable there.
