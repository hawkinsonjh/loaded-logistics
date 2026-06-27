// Broker portal — reachable at /broker (or /#broker).
//
// Authenticated, but with a SEPARATE credential from the dispatch team: a broker
// signs in with its company name + a 6-char access code dispatch gives it, gets
// a token scoped to that one company (api.brokerToken, stored apart from the team
// token), and sees only its own shipments. The backend sanitizes the payload —
// the broker sees the agreed rate, accessorials, status, paperwork and billing
// state, but never our pay/fuel/dispatch/margin/RPM.
//
// Prototype scope: one shared code per company (no per-contact accounts), and the
// access code is derived from the company name, so production wants a real broker
// table with rotatable, per-user credentials.

import React, { useState, useEffect, useMemo } from "react";
import * as api from "./api";
import { C, mono, sans, LANES, money, fmt0, laneColor, fmtDate, fmtAgo, accessorialOf } from "./theme";

/* compact horizontal status trail */
function Trail({ status }: { status: string }) {
  const idx = LANES.indexOf(status);
  return (
    <div className="flex items-center" style={{ gap: 0, maxWidth: 240 }}>
      {LANES.map((ln, i) => {
        const done = i < idx, here = i === idx;
        const col = here ? laneColor(ln) : done ? C.green : C.line;
        return (
          <React.Fragment key={ln}>
            <div style={{ width: here ? 11 : 8, height: here ? 11 : 8, borderRadius: 9, background: col, flexShrink: 0 }} />
            {i < LANES.length - 1 && <div style={{ flex: 1, height: 2, background: i < idx ? C.green : C.line }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function billPill(l: any): { label: string; color: string } | null {
  if (l.billing_status === "paid") return { label: "Paid", color: C.green };
  if (l.billing_status === "invoiced") return { label: "Invoiced", color: C.amber };
  return null;
}

function BrokerCard({ l }: { l: any }) {
  const acc = accessorialOf(l);
  const bp = billPill(l);
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 13, padding: "15px 17px" }}>
      <div className="flex items-start justify-between" style={{ gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: sans, fontSize: 16, fontWeight: 700, color: C.ink }}>
            {l.origin || "?"} <span style={{ color: C.faint, fontWeight: 400 }}>→</span> {l.dest || "?"}
          </div>
          <div className="flex items-center" style={{ gap: 10, marginTop: 5, flexWrap: "wrap" }}>
            {l.ref && <span style={{ fontFamily: mono, fontSize: 11, color: C.faint }}>REF {l.ref}</span>}
            {l.commodity && <span style={{ fontFamily: mono, fontSize: 11, color: C.dim }}>{l.commodity}</span>}
            <span style={{ fontFamily: mono, fontSize: 11, color: C.dim }}>Pickup {fmtDate(l.date)}</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, letterSpacing: .5, textTransform: "uppercase",
            color: laneColor(l.status), background: `${laneColor(l.status)}1a`, border: `1px solid ${laneColor(l.status)}55`,
            borderRadius: 20, padding: "3px 11px", display: "inline-block" }}>{l.status}</div>
          {l.driver && <div style={{ fontFamily: mono, fontSize: 11, color: C.dim, marginTop: 6 }}>Driver: {l.driver}</div>}
        </div>
      </div>

      <div style={{ margin: "14px 0 12px" }}><Trail status={l.status} /></div>

      <div className="flex items-center justify-between" style={{ gap: 12, flexWrap: "wrap" }}>
        <div className="flex items-center" style={{ gap: 18, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: sans, fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: C.faint }}>Rate</div>
            <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: C.ink, marginTop: 2 }}>{money(l.rate)}</div>
          </div>
          {acc > 0 && (
            <div>
              <div style={{ fontFamily: sans, fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: C.faint }}>Accessorials</div>
              <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: C.amberHi, marginTop: 2 }}>+{money(acc)}</div>
            </div>
          )}
          <div>
            <div style={{ fontFamily: sans, fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: C.faint }}>Miles</div>
            <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: C.dim, marginTop: 2 }}>{fmt0(l.miles)}</div>
          </div>
        </div>
        <div className="flex items-center" style={{ gap: 8 }}>
          {bp && <span style={{ fontFamily: mono, fontSize: 10.5, fontWeight: 700, letterSpacing: .5, textTransform: "uppercase",
            color: bp.color, background: `${bp.color}1a`, border: `1px solid ${bp.color}55`, borderRadius: 6, padding: "4px 9px" }}>● {bp.label}</span>}
          {l.pod_received && <span style={{ fontFamily: mono, fontSize: 10.5, color: C.green }}>✓ POD</span>}
          {l.doc_link && <a href={l.doc_link} target="_blank" rel="noreferrer" style={{ fontFamily: mono, fontSize: 11,
            color: C.blue, textDecoration: "none", border: `1px solid ${C.line}`, borderRadius: 6, padding: "4px 9px" }}>Documents ↗</a>}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: C.panel, padding: "13px 15px" }}>
      <div style={{ fontFamily: sans, fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: C.faint }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 21, fontWeight: 600, color: color || C.ink, marginTop: 5, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function BrokerLogin({ onAuthed }: { onAuthed: () => void }) {
  const [broker, setBroker] = useState(""), [code, setCode] = useState("");
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function go() {
    if (!broker || !code) return;
    setBusy(true); setErr("");
    try { await api.brokerLogin(broker, code); onAuthed(); }
    catch (e: any) { setErr(e.message || "Login failed"); }
    finally { setBusy(false); }
  }
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: sans, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <div style={{ width: "100%", maxWidth: 380, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 26 }}>
        <div className="flex items-center" style={{ gap: 12, marginBottom: 20 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: C.amber, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: mono, fontWeight: 800, color: C.bg, fontSize: 19 }}>L</span>
          </div>
          <div>
            <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 16, letterSpacing: .5 }}>LOADED LOGISTICS</div>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: C.faint }}>Broker portal</div>
          </div>
        </div>
        <div style={{ fontFamily: sans, fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: C.faint, marginBottom: 6 }}>Company name</div>
        <input value={broker} autoFocus onChange={e => setBroker(e.target.value)} onKeyDown={e => e.key === "Enter" && go()}
          placeholder="e.g. Ashley Furniture" style={{ width: "100%", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, color: C.ink, padding: "11px 13px", fontFamily: sans, fontSize: 14, marginBottom: 12 }} />
        <div style={{ fontFamily: sans, fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: C.faint, marginBottom: 6 }}>Access code</div>
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && go()}
          placeholder="6-character code" maxLength={6} style={{ width: "100%", background: C.bg, border: `1px solid ${err ? C.red : C.line}`, borderRadius: 8, color: C.ink, padding: "11px 13px", fontFamily: mono, fontSize: 15, letterSpacing: 3 }} />
        {err && <div style={{ color: C.red, fontFamily: mono, fontSize: 11.5, marginTop: 8 }}>{err}</div>}
        <button onClick={go} disabled={busy} style={{ width: "100%", marginTop: 16, fontFamily: sans, fontSize: 14, fontWeight: 700, color: C.bg, background: busy ? C.faint : C.amber, border: "none", borderRadius: 8, padding: "12px", cursor: busy ? "default" : "pointer" }}>
          {busy ? "Checking…" : "View my shipments"}</button>
        <div style={{ fontFamily: sans, fontSize: 11.5, color: C.faint, marginTop: 16, lineHeight: 1.5 }}>
          Don't have a code? Contact dispatch at dispatch@loadedlogisticsnc.com to get access to your shipments.
        </div>
      </div>
    </div>
  );
}

const FILTERS = [["all", "All"], ["active", "Active"], ["delivered", "Delivered"]] as const;

export default function BrokerPortal() {
  const [authed, setAuthed] = useState(!!api.brokerToken());
  const [loads, setLoads] = useState<any[]>([]);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<string>("active");

  async function refresh() {
    try { setLoads(await api.getBrokerLoads()); setReady(true); }
    catch (e) { if (String(e).includes("401")) setAuthed(false); }
  }
  useEffect(() => {
    if (!authed) return;
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [authed]);

  const k = useMemo(() => {
    let inTransit = 0, delivered = 0, awaiting = 0, spend = 0;
    loads.forEach(l => {
      if (l.status === "In Transit") inTransit++;
      if (l.status === "Delivered") delivered++;
      if (l.billing_status === "invoiced") awaiting++;
      spend += (l.rate || 0) + accessorialOf(l);
    });
    return { total: loads.length, inTransit, delivered, awaiting, spend };
  }, [loads]);

  const shown = useMemo(() => loads.filter(l =>
    filter === "all" ? true : filter === "delivered" ? l.status === "Delivered" : l.status !== "Delivered"
  ), [loads, filter]);

  const lastUpdated = useMemo(() => loads.reduce((m, l) => Math.max(m, Number(l.updated || 0)), 0), [loads]);

  if (!authed) return <BrokerLogin onAuthed={() => setAuthed(true)} />;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: sans }}>
      <div style={{ borderBottom: `1px solid ${C.line}`, background: C.panel, position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "13px 18px" }} className="flex items-center justify-between">
          <div className="flex items-center" style={{ gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: C.amber, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: mono, fontWeight: 800, color: C.bg, fontSize: 17 }}>L</span>
            </div>
            <div>
              <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 15, letterSpacing: .5 }}>{api.brokerName() || "Broker portal"}</div>
              <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: C.faint }}>Loaded Logistics · shipments</div>
            </div>
          </div>
          <button onClick={() => { api.brokerLogout(); setAuthed(false); }} style={{ fontFamily: mono, fontSize: 10.5, color: C.dim, background: "transparent", border: `1px solid ${C.line}`, borderRadius: 6, padding: "5px 10px", cursor: "pointer" }}>Sign out</button>
        </div>
      </div>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "18px 18px 60px" }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px" style={{ background: C.line, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden", marginBottom: 18 }}>
          <Kpi label="Shipments" value={fmt0(k.total)} />
          <Kpi label="In transit" value={fmt0(k.inTransit)} color={C.blue} />
          <Kpi label="Delivered" value={fmt0(k.delivered)} color={C.green} />
          <Kpi label="Awaiting payment" value={fmt0(k.awaiting)} color={k.awaiting ? C.amber : C.dim} />
        </div>

        <div className="flex items-center justify-between" style={{ marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
          <div className="flex" style={{ gap: 6 }}>
            {FILTERS.map(([id, label]) => (
              <button key={id} onClick={() => setFilter(id)} style={{ fontFamily: mono, fontSize: 12, color: filter === id ? C.bg : C.dim, background: filter === id ? C.amber : "transparent", border: `1px solid ${filter === id ? C.amber : C.line}`, borderRadius: 7, padding: "6px 13px", cursor: "pointer" }}>{label}</button>
            ))}
          </div>
          <div className="flex items-center" style={{ gap: 7 }}>
            <div style={{ width: 7, height: 7, borderRadius: 9, background: ready ? C.green : C.amber }} />
            <span style={{ fontFamily: mono, fontSize: 10.5, color: C.faint }}>{ready ? (lastUpdated ? `updated ${fmtAgo(lastUpdated)}` : "live") : "connecting"}</span>
          </div>
        </div>

        {shown.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: C.faint, fontFamily: sans, fontSize: 14 }}>
            No {filter === "all" ? "" : filter + " "}shipments to show.
          </div>
        ) : (
          <div className="flex" style={{ flexDirection: "column", gap: 12 }}>
            {shown.map(l => <BrokerCard key={l.id} l={l} />)}
          </div>
        )}
      </div>
    </div>
  );
}
