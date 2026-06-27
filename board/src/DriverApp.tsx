// Mobile driver view — reachable at /driver (or /#driver on static hosting).
//
// A phone-first surface over the SAME backend the dispatch board uses: the
// driver signs in with the team password, picks their name, and works their
// own active loads — advancing status, logging paperwork (BOL/POD + a photo
// link) and detention. Every write goes through the existing
// PATCH /api/loads/:id, so dispatch sees it on the board within one poll.
//
// Auth note: this reuses the one shared team password for now (prototype).
// Production should issue per-driver PINs so a driver can't see siblings' loads
// or sign loads as someone else.

import React, { useState, useEffect, useMemo } from "react";
import * as api from "./api";
import {
  C, mono, sans, LANES, DRIVER_ORDER,
  money, fmt0, computeRpm, rpmColor, rpmLabel, laneColor,
  nextLane, prevLane,
} from "./theme";

const DKEY = "ll_driver";

/* ----------------------------- status timeline ---------------------------- */
function StatusTrail({ status }: { status: string }) {
  const idx = LANES.indexOf(status);
  return (
    <div className="flex items-start" style={{ gap: 0 }}>
      {LANES.map((ln, i) => {
        const done = i < idx, here = i === idx;
        const col = here ? laneColor(ln) : done ? C.green : C.line;
        return (
          <React.Fragment key={ln}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flex: "0 0 auto", width: 58 }}>
              <div style={{ width: here ? 16 : 12, height: here ? 16 : 12, borderRadius: 9, background: col,
                boxShadow: here ? `0 0 0 5px ${col}22` : "none", transition: "all .2s" }} />
              <div style={{ fontFamily: mono, fontSize: 8.5, letterSpacing: .3, textTransform: "uppercase", textAlign: "center",
                color: here ? C.ink : done ? C.dim : C.faint, lineHeight: 1.2 }}>{ln}</div>
            </div>
            {i < LANES.length - 1 && (
              <div style={{ flex: 1, height: 2, background: i < idx ? C.green : C.line, marginTop: 7 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ---------------------- image compression (client-side) ------------------- */
// Phone photos are 3–8 MB; we downscale + re-encode to JPEG before upload so the
// payload stays small and the backend's bytea column doesn't balloon. Falls back
// to the raw bytes if the browser can't decode the file (e.g. some HEIC).
function rawBase64(file: File): Promise<{ dataBase64: string; mime: string }> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res({ dataBase64: String(fr.result).split(",")[1] || "", mime: file.type || "image/jpeg" });
    fr.onerror = () => rej(new Error("read failed"));
    fr.readAsDataURL(file);
  });
}
async function compressImage(file: File, maxDim = 1400, quality = 0.7): Promise<{ dataBase64: string; mime: string }> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = () => rej(new Error("read failed"));
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("decode failed"));
    im.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return rawBase64(file);
  ctx.drawImage(img, 0, 0, w, h);
  return { dataBase64: canvas.toDataURL("image/jpeg", quality).split(",")[1] || "", mime: "image/jpeg" };
}
const fmtKB = (b: number) => !b ? "" : b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.round(b / 1024) + " KB";

/* ------------------------------- small parts ------------------------------ */
function CameraIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9a2 2 0 0 1 2-2h2l1.5-2h7L19 7h0a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}
function Spinner() {
  // Tailwind Play CDN (loaded in index.html) provides the `animate-spin` keyframes.
  return <div className="animate-spin" style={{ width: 14, height: 14, borderRadius: 9, border: `2px solid ${C.line}`, borderTopColor: C.amber }} />;
}
function PhotoButton({ kind, label, received, busy, onPick }: { kind: string; label: string; received: boolean; busy: boolean; onPick: (kind: string, file: File) => void }) {
  return (
    <label style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
      background: received ? `${C.green}1a` : C.raised, border: `1px solid ${received ? C.green : C.line}`,
      borderRadius: 10, padding: "12px 8px", cursor: busy ? "default" : "pointer",
      color: received ? C.green : C.ink, fontFamily: mono, fontSize: 12, fontWeight: 600,
    }}>
      <input type="file" accept="image/*" capture="environment" disabled={busy} style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onPick(kind, f); (e.target as HTMLInputElement).value = ""; }} />
      {busy ? <Spinner /> : received ? <span style={{ fontSize: 14 }}>✓</span> : <CameraIcon />}
      <span>{busy ? "Uploading…" : received ? label : `${label} photo`}</span>
    </label>
  );
}
function ThumbStrip({ docs }: { docs: any[] }) {
  if (!docs.length) return null;
  return (
    <div className="flex" style={{ gap: 8, flexWrap: "wrap" }}>
      {docs.map(d => (
        <a key={d.id} href={d.url} target="_blank" rel="noreferrer" title={`${String(d.kind).toUpperCase()} · ${fmtKB(d.size_bytes)}`}
          style={{ position: "relative", width: 56, height: 56, borderRadius: 9, overflow: "hidden", border: `1px solid ${C.line}`, display: "block" }}>
          <img src={d.url} alt={d.kind} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, fontFamily: mono, fontSize: 9, textAlign: "center",
            color: C.ink, background: "rgba(14,17,22,.72)", textTransform: "uppercase", letterSpacing: .5, padding: "2px 0" }}>{d.kind}</span>
        </a>
      ))}
    </div>
  );
}

/* -------------------------------- load card ------------------------------- */
function DriverCard({ l, me, onPatch, onLoadUpdate }: { l: any; me: string; onPatch: (id: string, p: any) => void; onLoadUpdate: (row: any) => void }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [busyKind, setBusyKind] = useState("");
  const [err, setErr] = useState("");
  const rpm = computeRpm(l), col = rpmColor(rpm);
  const nl = nextLane(l.status), pl = prevLane(l.status);
  const delivered = l.status === "Delivered";

  const cta = l.status === "Available" ? "Accept this load"
    : l.status === "Assigned" ? "Picked up — start transit"
    : l.status === "In Transit" ? "Mark delivered" : null;

  useEffect(() => {
    let alive = true;
    api.getLoadDocs(l.id).then(d => { if (alive) setDocs(d); }).catch(() => {});
    return () => { alive = false; };
  }, [l.id]);

  function advance() {
    if (!nl) return;
    const patch: any = { status: nl };
    if (l.status === "Available") patch.driver = l.driver || me;   // accepting claims it
    onPatch(l.id, patch);
  }
  function back() { if (pl) onPatch(l.id, { status: pl }); }
  function logDetention() { onPatch(l.id, { detention_hours: (Number(l.detention_hours) || 0) + 1 }); }

  async function pickPhoto(kind: string, file: File) {
    setBusyKind(kind); setErr("");
    try {
      let payload: { dataBase64: string; mime: string };
      try { payload = await compressImage(file); } catch { payload = await rawBase64(file); }
      const out = await api.uploadDoc(l.id, { kind, filename: file.name || `${kind}.jpg`, mime: payload.mime, dataBase64: payload.dataBase64, uploadedBy: me });
      if (out?.load) onLoadUpdate(out.load);
      if (out?.doc) setDocs(d => [out.doc, ...d]);
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
    } finally {
      setBusyKind("");
    }
  }

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>

      {/* header: broker + lane + rate */}
      <div className="flex items-start justify-between" style={{ gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: sans, fontSize: 17, fontWeight: 700, color: C.ink, lineHeight: 1.2 }}>{l.broker || "—"}</div>
          <div style={{ fontFamily: mono, fontSize: 13, color: C.dim, marginTop: 4 }}>
            {l.origin || "?"} <span style={{ color: C.dim }}>→</span> {l.dest || "?"}
          </div>
          {l.ref && <div style={{ fontFamily: mono, fontSize: 10.5, color: C.dim, marginTop: 3 }}>REF {l.ref}</div>}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: C.ink, lineHeight: 1 }}>{money(l.rate)}</div>
          <div style={{ fontFamily: mono, fontSize: 11, color: C.dim, marginTop: 3 }}>{fmt0(l.miles)} mi</div>
          {rpm != null && <div style={{ fontFamily: mono, fontSize: 11, color: col, marginTop: 2 }}>${rpm.toFixed(2)} · {rpmLabel(rpm)}</div>}
        </div>
      </div>

      {/* status timeline */}
      <div style={{ padding: "4px 2px" }}><StatusTrail status={l.status} /></div>

      {/* primary action */}
      {cta && (
        <button onClick={advance} style={{
          width: "100%", fontFamily: sans, fontSize: 15, fontWeight: 700, color: C.bg,
          background: laneColor(nl || l.status), border: "none", borderRadius: 11, padding: "15px",
          cursor: "pointer", letterSpacing: .2,
        }}>{cta}</button>
      )}
      {delivered && (
        <div style={{ width: "100%", textAlign: "center", fontFamily: mono, fontSize: 13, color: C.green,
          background: `${C.green}14`, border: `1px solid ${C.green}55`, borderRadius: 11, padding: "13px" }}>
          ✓ Delivered{!l.pod_received ? " — POD still needed" : ""}
        </div>
      )}

      {/* paperwork — capture a photo of the BOL/POD (sets the flag automatically) */}
      <div className="flex" style={{ gap: 8 }}>
        <PhotoButton kind="bol" label="BOL" received={!!l.bol_received} busy={busyKind === "bol"} onPick={pickPhoto} />
        <PhotoButton kind="pod" label="POD" received={!!l.pod_received} busy={busyKind === "pod"} onPick={pickPhoto} />
        <button onClick={logDetention} style={{
          flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          background: Number(l.detention_hours) > 0 ? `${C.amber}1a` : C.raised,
          border: `1px solid ${Number(l.detention_hours) > 0 ? C.amber : C.line}`, borderRadius: 10, padding: "12px 14px",
          cursor: "pointer", color: Number(l.detention_hours) > 0 ? C.amberHi : C.dim, fontFamily: mono, fontSize: 12, fontWeight: 600,
        }}>+ Det{Number(l.detention_hours) > 0 ? ` ${Number(l.detention_hours)}h` : ""}</button>
      </div>
      {err && <div style={{ fontFamily: mono, fontSize: 11, color: C.red }}>{err}</div>}

      {/* uploaded photos */}
      <ThumbStrip docs={docs} />

      {/* back link */}
      {pl && (
        <button onClick={back} style={{ alignSelf: "flex-start", fontFamily: mono, fontSize: 11, color: C.dim,
          background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>‹ back to {pl}</button>
      )}
    </div>
  );
}

/* ----------------------------- driver picker ------------------------------ */
function DriverPicker({ onPick }: { onPick: (d: string) => void }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontFamily: sans, fontSize: 22, fontWeight: 800, color: C.ink, marginBottom: 4 }}>Who's driving?</div>
      <div style={{ fontFamily: sans, fontSize: 13.5, color: C.dim, marginBottom: 20 }}>Tap your name to see your loads.</div>
      <div className="flex" style={{ flexDirection: "column", gap: 10 }}>
        {DRIVER_ORDER.map(d => (
          <button key={d} onClick={() => onPick(d)} style={{
            display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left",
            background: C.panel, border: `1px solid ${C.line}`, borderRadius: 13, padding: "16px 18px", cursor: "pointer",
          }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: C.raised, display: "flex",
              alignItems: "center", justifyContent: "center", fontFamily: mono, fontWeight: 800, fontSize: 17, color: C.amber }}>
              {d[0]}
            </div>
            <div style={{ fontFamily: sans, fontSize: 17, fontWeight: 700, color: C.ink }}>{d}</div>
            <div style={{ marginLeft: "auto", color: C.faint, fontSize: 20 }}>›</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- login ----------------------------------- */
function DriverLogin({ onAuthed }: { onAuthed: () => void }) {
  const [pw, setPw] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function go() {
    if (!pw) return;
    setBusy(true); setErr("");
    const t = await api.login(pw); setBusy(false);
    if (t) onAuthed(); else setErr("Wrong password");
  }
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 14, padding: "0 4px" }}>
      <div style={{ fontFamily: sans, fontSize: 22, fontWeight: 800, color: C.ink }}>Driver sign-in</div>
      <div style={{ fontFamily: sans, fontSize: 13.5, color: C.dim, marginTop: -8 }}>Use the team password.</div>
      <input type="password" value={pw} autoFocus onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && go()}
        placeholder="Team password" style={{ background: C.bg, border: `1px solid ${err ? C.red : C.line}`, borderRadius: 11,
          color: C.ink, padding: "15px 14px", fontFamily: mono, fontSize: 15 }} />
      {err && <div style={{ color: C.red, fontFamily: mono, fontSize: 12 }}>{err}</div>}
      <button onClick={go} disabled={busy} style={{ fontFamily: sans, fontSize: 15, fontWeight: 700, color: C.bg,
        background: busy ? C.faint : C.amber, border: "none", borderRadius: 11, padding: "15px", cursor: busy ? "default" : "pointer" }}>
        {busy ? "Checking…" : "Sign in"}</button>
    </div>
  );
}

/* ============================== DRIVER APP ================================= */
export default function DriverApp() {
  const [authed, setAuthed] = useState(!!api.token());
  const [driver, setDriver] = useState<string>(() => localStorage.getItem(DKEY) || "");
  const [loads, setLoads] = useState<any[]>([]);
  const [ready, setReady] = useState(false);
  const [showDone, setShowDone] = useState(false);

  async function refresh() {
    try { const rows = await api.getLoads(); setLoads(rows); setReady(true); }
    catch (e) { if (String(e).includes("401")) setAuthed(false); }
  }
  useEffect(() => {
    if (!authed) return;
    refresh();
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, [authed]);

  function updateLoad(row: any) { setLoads(ls => ls.map(l => l.id === row.id ? row : l)); }
  function patchLoad(id: string, patch: any) {
    setLoads(ls => ls.map(l => l.id === id ? { ...l, ...patch } : l));   // optimistic
    api.patchLoad(id, patch).then(row => setLoads(ls => ls.map(l => l.id === id ? row : l))).catch(() => refresh());
  }
  function pickDriver(d: string) { localStorage.setItem(DKEY, d); setDriver(d); }
  function switchDriver() { localStorage.removeItem(DKEY); setDriver(""); }

  const mine = useMemo(() => loads.filter(l => l.driver === driver), [loads, driver]);
  const active = mine.filter(l => l.status !== "Delivered");
  const done = mine.filter(l => l.status === "Delivered")
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

  const shell = (inner: React.ReactNode, header = true) => (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: sans, display: "flex", flexDirection: "column" }}>
      <div style={{ width: "100%", maxWidth: 480, margin: "0 auto", flex: 1, display: "flex", flexDirection: "column",
        padding: "16px 16px 40px" }}>
        {header && (
          <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
            <div className="flex items-center" style={{ gap: 11 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: C.amber, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: mono, fontWeight: 800, color: C.bg, fontSize: 17 }}>L</span>
              </div>
              <div>
                <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 14, letterSpacing: .4 }}>LOADED LOGISTICS</div>
                <div style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: 1.4, textTransform: "uppercase", color: C.faint }}>Driver</div>
              </div>
            </div>
            <div className="flex items-center" style={{ gap: 7 }}>
              <div style={{ width: 7, height: 7, borderRadius: 9, background: ready ? C.green : C.amber }} />
              <span style={{ fontFamily: mono, fontSize: 10, color: C.dim }}>{ready ? "live" : "…"}</span>
            </div>
          </div>
        )}
        {inner}
      </div>
    </div>
  );

  if (!authed) return shell(<DriverLogin onAuthed={() => setAuthed(true)} />, false);
  if (!driver) return shell(<DriverPicker onPick={pickDriver} />);

  return shell(
    <>
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: sans, fontSize: 22, fontWeight: 800, color: C.ink }}>Hi, {driver}</div>
          <div style={{ fontFamily: sans, fontSize: 13, color: C.dim, marginTop: 2 }}>
            {active.length ? `${active.length} active load${active.length > 1 ? "s" : ""}` : "No active loads"}
          </div>
        </div>
        <button onClick={switchDriver} style={{ fontFamily: mono, fontSize: 11, color: C.dim, background: "transparent",
          border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 11px", cursor: "pointer" }}>Switch</button>
      </div>

      {active.length === 0 && done.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: C.faint, fontFamily: sans, fontSize: 14 }}>
          Nothing assigned to you yet.<br />New loads from dispatch show up here automatically.
        </div>
      )}

      <div className="flex" style={{ flexDirection: "column", gap: 14 }}>
        {active.map(l => <DriverCard key={l.id} l={l} me={driver} onPatch={patchLoad} onLoadUpdate={updateLoad} />)}
      </div>

      {done.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <button onClick={() => setShowDone(s => !s)} style={{ fontFamily: mono, fontSize: 11, letterSpacing: .5,
            textTransform: "uppercase", color: C.dim, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
            {showDone ? "▾" : "▸"} Delivered ({done.length})
          </button>
          {showDone && (
            <div className="flex" style={{ flexDirection: "column", gap: 14, marginTop: 12 }}>
              {done.map(l => <DriverCard key={l.id} l={l} me={driver} onPatch={patchLoad} onLoadUpdate={updateLoad} />)}
            </div>
          )}
        </div>
      )}
    </>
  );
}
