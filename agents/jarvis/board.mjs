#!/usr/bin/env node
/*
 * Loaded Logistics — live board reader for Jarvis (and the role agents).
 * READ-ONLY BY DESIGN. This helper only issues the login POST + GET requests.
 * It never creates, edits, or deletes loads. Board writes stay manual — Joe approves.
 *
 * Usage:
 *   node agents/jarvis/board.mjs health           # backend health (no auth)
 *   node agents/jarvis/board.mjs loads            # current loads + RPM summary
 *   node agents/jarvis/board.mjs messages         # team chat (last 300)
 *   node agents/jarvis/board.mjs raw /api/loads   # any GET path, raw JSON
 *
 * Credentials resolve in this order (first hit wins):
 *   1) Environment:  BOARD_API_URL  +  BOARD_PASSWORD
 *   2) agents/jarvis/board.config.local.json   { "apiUrl": "...", "password": "..." }
 *   3) backend/.env   (keys: BOARD_API_URL or API_URL or VITE_API_URL; BOARD_PASSWORD)
 *
 * Network: honors an HTTP proxy if the environment sets https_proxy / HTTPS_PROXY
 * (the Cowork sandbox routes egress through one). Falls back to a direct TLS
 * connection when no proxy is set, so it also works on a normal network.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import https from "node:https";
import tls from "node:tls";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const TIMEOUT_MS = 15000;

function readEnvFile(path) {
  try {
    const out = {};
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}

function loadConfig() {
  let apiUrl = process.env.BOARD_API_URL || "";
  let password = process.env.BOARD_PASSWORD || "";
  if (!apiUrl || !password) {
    try {
      const j = JSON.parse(readFileSync(join(__dirname, "board.config.local.json"), "utf8"));
      apiUrl = apiUrl || j.apiUrl || j.BOARD_API_URL || "";
      password = password || j.password || j.BOARD_PASSWORD || "";
    } catch {}
  }
  if (!apiUrl || !password) {
    const env = readEnvFile(join(REPO_ROOT, "backend", ".env"));
    apiUrl = apiUrl || env.BOARD_API_URL || env.API_URL || env.VITE_API_URL || "";
    password = password || env.BOARD_PASSWORD || "";
  }
  apiUrl = (apiUrl || "").replace(/\/+$/, "");
  return { apiUrl, password };
}

function notConfigured(reason) {
  console.error("BOARD: NOT CONFIGURED — " + reason);
  console.error("Set BOARD_API_URL + BOARD_PASSWORD or create agents/jarvis/board.config.local.json (copy the .example). Until then Jarvis uses backend/seed-data.json and labels numbers 'historical seed, not live.'");
  process.exit(2);
}

function proxyConnect(proxyUrl, host, port) {
  return new Promise((resolve, reject) => {
    const p = new URL(proxyUrl);
    const req = http.request({
      host: p.hostname,
      port: Number(p.port) || 80,
      method: "CONNECT",
      path: host + ":" + port,
      timeout: TIMEOUT_MS,
    });
    req.on("connect", (res, socket) => {
      if (res.statusCode !== 200) { reject(new Error("proxy CONNECT returned " + res.statusCode)); return; }
      resolve(socket);
    });
    req.on("timeout", () => req.destroy(new Error("proxy CONNECT timeout")));
    req.on("error", reject);
    req.end();
  });
}

async function request(method, urlStr, headers = {}, body) {
  const u = new URL(urlStr);
  const port = Number(u.port) || 443;
  const proxy = process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.HTTP_PROXY || "";
  let createConnection;
  if (proxy && u.protocol === "https:") {
    const socket = await proxyConnect(proxy, u.hostname, port);
    const tlsSocket = tls.connect({ socket, servername: u.hostname });
    createConnection = () => tlsSocket;
  }
  return new Promise((resolve, reject) => {
    const opts = { host: u.hostname, port, method, path: u.pathname + u.search, headers: { ...headers }, timeout: TIMEOUT_MS };
    if (createConnection) opts.createConnection = createConnection;
    const req = https.request(opts, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (data += d));
      res.on("end", () => resolve({ status: res.statusCode, text: data }));
    });
    req.on("timeout", () => req.destroy(new Error("request timeout")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getJSON(url, headers) {
  const r = await request("GET", url, headers);
  if (r.status === 401) throw new Error("401 unauthorized (check BOARD_PASSWORD)");
  if (r.status < 200 || r.status >= 300) throw new Error("HTTP " + r.status + " on " + url);
  return JSON.parse(r.text);
}

async function login(apiUrl, password) {
  const r = await request("POST", apiUrl + "/api/login", { "Content-Type": "application/json" }, JSON.stringify({ password }));
  if (r.status < 200 || r.status >= 300) throw new Error("login failed: HTTP " + r.status);
  const d = JSON.parse(r.text);
  if (!d.token) throw new Error("login returned no token");
  return d.token;
}

function num(x) { const n = Number(x); return Number.isFinite(n) ? n : null; }
function rpmOf(l) {
  const stored = num(l.rpm);
  if (stored) return stored;
  const rate = num(l.rate), miles = num(l.miles);
  if (rate && miles) return rate / miles;
  return null;
}
function summarizeLoads(loads) {
  const byStatus = {};
  let thin = 0, rated = 0;
  for (const l of loads) {
    byStatus[l.status || "?"] = (byStatus[l.status || "?"] || 0) + 1;
    const r = rpmOf(l);
    if (r != null) { rated++; if (r < 1.8) thin++; }
  }
  console.log("LOADS: " + loads.length + " total");
  console.log("  by status: " + Object.entries(byStatus).map(([k, v]) => k + "=" + v).join(", "));
  console.log("  with computable RPM: " + rated + "; thin (<1.80): " + thin);
}

async function main() {
  const cmd = (process.argv[2] || "loads").toLowerCase();
  const { apiUrl, password } = loadConfig();
  if (!apiUrl) return notConfigured("no API URL found");
  if (cmd === "health") {
    const h = await getJSON(apiUrl + "/api/health", {});
    console.log(JSON.stringify(h, null, 2));
    return;
  }
  if (!password) return notConfigured("no BOARD_PASSWORD found");
  const token = await login(apiUrl, password);
  const auth = { Authorization: "Bearer " + token };
  if (cmd === "loads") {
    const loads = await getJSON(apiUrl + "/api/loads", auth);
    summarizeLoads(loads);
    console.log(JSON.stringify(loads, null, 2));
  } else if (cmd === "messages") {
    const msgs = await getJSON(apiUrl + "/api/messages", auth);
    console.log(JSON.stringify(msgs, null, 2));
  } else if (cmd === "raw") {
    const path = process.argv[3];
    if (!path || !/^\/api\//.test(path)) throw new Error("raw needs a /api/... GET path");
    const data = await getJSON(apiUrl + path, auth);
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.error("Unknown command: " + cmd + ". Use health | loads | messages | raw <path>.");
    process.exit(1);
  }
}

main().catch((e) => {
  const msg = e && e.message ? e.message : String(e);
  console.error("BOARD ERROR: " + msg);
  if (/CONNECT returned 403|EAI_AGAIN|ENOTFOUND|ECONNREFUSED|timeout/i.test(msg)) {
    console.error("HINT: looks like a network-egress block, not a credential problem. The backend may be healthy but unreachable from this environment's proxy. Run from a normal network (Joe's own terminal) where it will work, or allowlist the backend domain. Meanwhile fall back to backend/seed-data.json + the live Gmail inbox and label board numbers 'not live.'");
  }
  process.exit(1);
});
