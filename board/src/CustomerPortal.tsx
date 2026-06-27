// Customer / broker tracking portal — reachable at /track (or /#track).
//
// PUBLIC, no login. A shipper or broker enters a reference number and sees the
// shipment's lane + live status only — never rate, pay, margin, or any internal
// financials (the backend's GET /api/track/:ref is the gatekeeper, returning a
// sanitized record). This is the brand's customer-facing surface, so it leans
// cleaner and more marketing-grade than the internal dispatch terminal while
// keeping the Loaded amber.

import React, { useState } from "react";
import * as api from "./api";
import { C, mono, sans, LANES, laneColor } from "./theme";

function fmtDate(iso?: string) {
  if (!iso) return "—";
  try { return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
  catch { return iso; }
}
function fmtAgo(ms?: number) {
  if (!ms) return "";
  const mins = Math.round((Date.now() - Number(ms)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

/* big vertical status timeline for the result card */
function Timeline({ status }: { status: string }) {
  const idx = LANES.indexOf(status);
  const copy: Record<string, string> = {
    "Available": "Booked — awaiting carrier assignment",
    "Assigned": "Driver assigned, heading to pickup",
    "In Transit": "Picked up and on the road",
    "Delivered": "Delivered",
  };
  return (
    <div className="flex" style={{ flexDirection: "column" }}>
      {LANES.map((ln, i) => {
        const done = i < idx, here = i === idx;
        const col = here ? laneColor(ln) : done ? C.green : C.line;
        const last = i === LANES.length - 1;
        return (
          <div key={ln} className="flex" style={{ gap: 14, minHeight: last ? "auto" : 56 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: here ? 20 : 15, height: here ? 20 : 15, borderRadius: 12, background: col,
                boxShadow: here ? `0 0 0 6px ${col}22` : "none", display: "flex", alignItems: "center", justifyContent: "center",
                marginTop: here ? 0 : 2 }}>
                {done && <span style={{ color: C.bg, fontSize: 9, fontWeight: 900 }}>✓</span>}
              </div>
              {!last && <div style={{ flex: 1, width: 2, background: i < idx ? C.green : C.line, marginTop: 3 }} />}
            </div>
            <div style={{ paddingBottom: 18 }}>
              <div style={{ fontFamily: sans, fontSize: 15, fontWeight: here ? 800 : 600,
                color: here ? C.ink : done ? C.dim : C.faint }}>{ln}</div>
              <div style={{ fontFamily: sans, fontSize: 12.5, color: here ? C.dim : C.faint, marginTop: 2 }}>{copy[ln]}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ResultCard({ s }: { s: any }) {
  const pct = (LANES.indexOf(s.status) / (LANES.length - 1)) * 100;
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, overflow: "hidden" }}>
      {/* banner */}
      <div style={{ padding: "20px 22px", borderBottom: `1px solid ${C.line}`, background: `linear-gradient(135deg, ${laneColor(s.status)}14, transparent)` }}>
        <div className="flex items-center justify-between" style={{ gap: 12 }}>
          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: C.faint }}>
            REF {s.ref}
          </div>
          <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, letterSpacing: .5, textTransform: "uppercase",
            color: laneColor(s.status), background: `${laneColor(s.status)}1a`, border: `1px solid ${laneColor(s.status)}55`,
            borderRadius: 20, padding: "4px 12px" }}>{s.status}</div>
        </div>
        <div style={{ fontFamily: sans, fontSize: 24, fontWeight: 800, color: C.ink, marginTop: 10, lineHeight: 1.15 }}>
          {s.origin || "?"} <span style={{ color: C.faint, fontWeight: 400 }}>→</span> {s.dest || "?"}
        </div>
        {/* progress bar */}
        <div style={{ height: 6, background: C.line, borderRadius: 6, marginTop: 16, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: laneColor(s.status), borderRadius: 6, transition: "width .4s" }} />
        </div>
      </div>

      {/* facts */}
      <div className="grid grid-cols-2" style={{ borderBottom: `1px solid ${C.line}` }}>
        {[
          ["Carrier", s.carrier],
          ["Broker", s.broker || "—"],
          ["Commodity", s.commodity || "—"],
          ["Pickup date", fmtDate(s.pickup_date)],
        ].map(([k, v], i) => (
          <div key={i} style={{ padding: "14px 22px", borderTop: i >= 2 ? `1px solid ${C.line}` : "none",
            borderRight: i % 2 === 0 ? `1px solid ${C.line}` : "none" }}>
            <div style={{ fontFamily: sans, fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: C.faint }}>{k}</div>
            <div style={{ fontFamily: sans, fontSize: 14.5, fontWeight: 600, color: C.ink, marginTop: 4 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* timeline */}
      <div style={{ padding: "22px" }}>
        <Timeline status={s.status} />
        {s.updated && (
          <div style={{ fontFamily: mono, fontSize: 11, color: C.faint, marginTop: 6 }}>Last updated {fmtAgo(s.updated)}</div>
        )}
      </div>
    </div>
  );
}

export default function CustomerPortal() {
  const [ref, setRef] = useState("");
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function track() {
    const r = ref.trim();
    if (!r) return;
    setBusy(true); setErr(""); setResult(null);
    try { setResult(await api.trackLoad(r)); }
    catch (e: any) { setErr(e.message || "Shipment not found"); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: sans,
      display: "flex", flexDirection: "column", alignItems: "center", padding: "0 18px 60px" }}>
      <div style={{ width: "100%", maxWidth: 560 }}>

        {/* brand header */}
        <div className="flex items-center justify-between" style={{ padding: "22px 0 36px" }}>
          <div className="flex items-center" style={{ gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: C.amber, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: mono, fontWeight: 800, color: C.bg, fontSize: 19 }}>L</span>
            </div>
            <div>
              <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 16, letterSpacing: .5 }}>LOADED LOGISTICS</div>
              <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: C.faint }}>Shipment tracking</div>
            </div>
          </div>
        </div>

        {/* hero + search */}
        <div style={{ fontFamily: sans, fontSize: 30, fontWeight: 800, color: C.ink, lineHeight: 1.15, letterSpacing: -.5 }}>
          Track your shipment
        </div>
        <div style={{ fontFamily: sans, fontSize: 15, color: C.dim, marginTop: 8 }}>
          Enter your reference or load number for a live status update.
        </div>

        <div className="flex" style={{ gap: 10, marginTop: 22 }}>
          <input value={ref} autoFocus onChange={e => setRef(e.target.value)} onKeyDown={e => e.key === "Enter" && track()}
            placeholder="e.g. 4471-A" style={{ flex: 1, background: C.panel, border: `1px solid ${err ? C.red : C.line}`,
              borderRadius: 12, color: C.ink, padding: "16px 16px", fontFamily: mono, fontSize: 15 }} />
          <button onClick={track} disabled={busy} style={{ fontFamily: sans, fontSize: 15, fontWeight: 700, color: C.bg,
            background: busy ? C.faint : C.amber, border: "none", borderRadius: 12, padding: "0 24px", cursor: busy ? "default" : "pointer" }}>
            {busy ? "…" : "Track"}</button>
        </div>
        {err && (
          <div style={{ fontFamily: sans, fontSize: 13.5, color: C.red, marginTop: 12,
            background: `${C.red}12`, border: `1px solid ${C.red}44`, borderRadius: 10, padding: "12px 14px" }}>{err}</div>
        )}

        {/* result */}
        {result && <div style={{ marginTop: 26 }}><ResultCard s={result} /></div>}

        {/* footer / contact */}
        <div style={{ marginTop: 40, paddingTop: 22, borderTop: `1px solid ${C.line}`, textAlign: "center" }}>
          <div style={{ fontFamily: sans, fontSize: 13, color: C.dim }}>
            Questions about a shipment? Reach dispatch at{" "}
            <a href="mailto:dispatch@loadedlogisticsnc.com" style={{ color: C.amberHi, textDecoration: "none" }}>dispatch@loadedlogisticsnc.com</a>
          </div>
          <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: C.faint, marginTop: 12 }}>
            Loaded Logistics · North Carolina
          </div>
        </div>
      </div>
    </div>
  );
}
