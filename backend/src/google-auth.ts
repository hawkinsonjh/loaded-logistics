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
  console.log("1) Make sure you are signed in to the inbox you want to watch, then open:\n");
  console.log("   " + authUrl + "\n");
  console.log("2) Approve access. This window captures the token automatically.\n");
  console.log(`(Listening on ${REDIRECT} — leave this running until it prints the token.)`);
});
