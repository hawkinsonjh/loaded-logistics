// Owner dashboard — reachable at /owner (or /#owner).
//
// A phone-first "how's the business right now" view for Joe, over the same team
// auth + GET /api/loads the board uses. Performance KPIs (revenue, net, RPM,
// active) respect a 7d/30d/all period; A/R and the action list are always
// current-state (money owed / things to chase don't belong to a window). Also
// surfaces the per-broker access codes (GET /api/broker/codes) so the owner can
// hand them to brokers for the broker portal.

import React, { useState, useEffect, useMemo } from "react";
import * as api from "./api";
import {
  C, mono, sans, money, fmt0, computeRpm, rpmColor,
  netOf, billableOf, ageDays,
} from "./theme";

function daysAgoISO(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
const PERIODS = [["7", "7 days"], ["30", "30 days"], ["all", "All time"]] as const;

/* ----------------------------- small pieces ------------------------------- */
function Kpi({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: C.panel, padding: "13px 14px" }}>
      <div style={{ fontFamily: sans, fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: C.faint }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 600, color: color || C.ink, marginTop: 5, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: mono, fontSize: 10.5, color: C.dim, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 22 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 700, letterSpacing: .3, color: C.ink }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

function ActionRow({ color, label, detail, count }: { color: string; label: string; detail: string; count: number }) {
  const active = count > 0;
  return (
    <div className="flex items-center" style={{ gap: 12, background: C.panel, border: `1px solid ${C.line}`,
      borderRadius: 10, padding: "12px 14px", opacity: active ? 1 : .6 }}>
      <div style={{ width: 10, height: 10, borderRadius: 9, background: active ? color : C.faint, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: sans, fontSize: 13.5, fontWeight: 600, color: C.ink }}>{label}</div>
        <div style={{ fontFamily: mono, fontSize: 11, color: C.dim, marginTop: 1 }}>{detail}</div>
      </div>
      <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: active ? color : C.faint }}>{count}</div>
    </div>
  );
}

function BarRow({ name, value, pct, color, meta }: { name: string; value: string; pct: number; color: string; meta?: string }) {
  return (
    <div style={{ padding: "9px 0" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 5 }}>
        <span style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: C.ink }}>{name}</span>
        <span style={{ fontFamily: mono, fontSize: 12.5, color: C.ink }}>{value}{meta && <span style={{ color: C.faint }}> · {meta}</span>}</span>
      </div>
      <div style={{ height: 6, background: C.line, borderRadius: 6, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.max(2, Math.min(100, pct))}%`, background: color, borderRadius: 6 }} />
      </div>
    </div>
  );
}

/* -------------------------------- login ----------------------------------- */
function OwnerLogin({ onAuthed }: { onAuthed: () => void }) {
  const [pw, setPw] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function go() {
    if (!pw) return;
    setBusy(true); setErr("");
    const t = await api.login(pw); setBusy(false);
    if (t) onAuthed(); else setErr("Wrong password");
  }
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: sans, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <div style={{ width: "100%", maxWidth: 360, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 24 }}>
        <div className="flex items-center" style={{ gap: 12, marginBottom: 18 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: C.amber, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: mono, fontWeight: 800, color: C.bg, fontSize: 19 }}>L</span>
          </div>
          <div>
            <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 16, letterSpacing: .5 }}>LOADED LOGISTICS</div>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: C.faint }}>Owner dashboard</div>
          </div>
        </div>
        <input type="password" value={pw} autoFocus onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && go()}
          placeholder="Team password" style={{ width: "100%", background: C.bg, border: `1px solid ${err ? C.red : C.line}`, borderRadius: 8, color: C.ink, padding: "12px 13px", fontFamily: mono, fontSize: 14 }} />
        {err && <div style={{ color: C.red, fontFamily: mono, fontSize: 11.5, marginTop: 8 }}>{err}</div>}
        <button onClick={go} disabled={busy} style={{ width: "100%", marginTop: 14, fontFamily: sans, fontSize: 14, fontWeight: 700, color: C.bg, background: busy ? C.faint : C.amber, border: "none", borderRadius: 8, padding: "12px", cursor: busy ? "default" : "pointer" }}>
          {busy ? "Checking…" : "Open dashboard"}</button>
      </div>
    </div>
  );
}

/* ============================== OWNER DASH ================================= */
export default function OwnerDash() {
  const [authed, setAuthed] = useState(!!api.token());
  const [loads, setLoads] = useState<any[]>([]);
  const [ready, setReady] = useState(false);
  const [period, setPeriod] = useState<string>("30");
  const [codes, setCodes] = useState<any[]>([]);
  const [showCodes, setShowCodes] = useState(false);

  async function refresh() {
    try { setLoads(await api.getLoads()); setReady(true); }
    catch (e) { if (String(e).includes("401")) setAuthed(false); }
  }
  useEffect(() => {
    if (!authed) return;
    refresh();
    const id = setInterval(refresh, 10000);
    api.getBrokerCodes().then(setCodes).catch(() => {});
    return () => clearInterval(id);
  }, [authed]);

  const cutoff = period === "all" ? "" : daysAgoISO(parseInt(period, 10));
  const inPeriod = useMemo(() => loads.filter(l => period === "all" || (l.date && l.date >= cutoff)), [loads, period, cutoff]);

  // performance KPIs (period-scoped)
  const perf = useMemo(() => {
    let rev = 0, net = 0, mi = 0, rpmN = 0, rpmC = 0, active = 0, thin = 0;
    inPeriod.forEach(l => {
      rev += l.rate || 0; net += netOf(l); mi += l.miles || 0;
      const r = computeRpm(l); if (r != null) { rpmN += r; rpmC++; if (r < 1.8) thin++; }
      if (l.status !== "Delivered") active++;
    });
    return { rev, net, mi, avgRpm: rpmC ? rpmN / rpmC : 0, active, thin, count: inPeriod.length };
  }, [inPeriod]);

  // A/R + action items (always current-state, all loads)
  const ar = useMemo(() => {
    let openAR = 0, uncollectedDet = 0, overdue = 0, readyToInvoice = 0, missingPOD = 0;
    loads.forEach(l => {
      if (l.billing_status === "invoiced") { openAR += billableOf(l); if ((ageDays(l.invoiced_at) || 0) > 30) overdue++; }
      if (l.billing_status !== "paid") uncollectedDet += l.detention_pay || 0;
      if (l.status === "Delivered" && l.pod_received && l.billing_status === "unbilled") readyToInvoice++;
      if (l.status === "Delivered" && !l.pod_received) missingPOD++;
    });
    return { openAR, uncollectedDet, overdue, readyToInvoice, missingPOD };
  }, [loads]);

  const drivers = useMemo(() => {
    const m: Record<string, { rev: number; rpmN: number; rpmC: number; n: number }> = {};
    inPeriod.forEach(l => {
      if (!l.driver) return;
      const d = (m[l.driver] ||= { rev: 0, rpmN: 0, rpmC: 0, n: 0 });
      d.rev += l.rate || 0; d.n++;
      const r = computeRpm(l); if (r != null) { d.rpmN += r; d.rpmC++; }
    });
    return Object.entries(m).map(([name, v]) => ({ name, rev: v.rev, avgRpm: v.rpmC ? v.rpmN / v.rpmC : 0, n: v.n }))
      .sort((a, b) => b.rev - a.rev);
  }, [inPeriod]);

  const brokers = useMemo(() => {
    const m: Record<string, { rev: number; n: number }> = {};
    inPeriod.forEach(l => {
      const key = l.broker || "—";
      const b = (m[key] ||= { rev: 0, n: 0 });
      b.rev += l.rate || 0; b.n++;
    });
    return Object.entries(m).map(([name, v]) => ({ name, rev: v.rev, n: v.n })).sort((a, b) => b.rev - a.rev).slice(0, 5);
  }, [inPeriod]);

  const maxDriverRev = Math.max(1, ...drivers.map(d => d.rev));
  const maxBrokerRev = Math.max(1, ...brokers.map(b => b.rev));

  if (!authed) return <OwnerLogin onAuthed={() => setAuthed(true)} />;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: sans }}>
      <div style={{ width: "100%", maxWidth: 480, margin: "0 auto", padding: "16px 16px 50px" }}>

        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <div className="flex items-center" style={{ gap: 11 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: C.amber, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: mono, fontWeight: 800, color: C.bg, fontSize: 17 }}>L</span>
            </div>
            <div>
              <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 14, letterSpacing: .4 }}>LOADED LOGISTICS</div>
              <div style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: 1.4, textTransform: "uppercase", color: C.faint }}>Owner</div>
            </div>
          </div>
          <div className="flex items-center" style={{ gap: 7 }}>
            <div style={{ width: 7, height: 7, borderRadius: 9, background: ready ? C.green : C.amber }} />
            <button onClick={() => { api.logout(); setAuthed(false); }} style={{ fontFamily: mono, fontSize: 10, color: C.dim, background: "transparent", border: `1px solid ${C.line}`, borderRadius: 7, padding: "5px 9px", cursor: "pointer" }}>Sign out</button>
          </div>
        </div>

        {/* period toggle */}
        <div className="flex" style={{ gap: 6, marginBottom: 14 }}>
          {PERIODS.map(([id, label]) => (
            <button key={id} onClick={() => setPeriod(id)} style={{ flex: 1, fontFamily: mono, fontSize: 12, color: period === id ? C.bg : C.dim, background: period === id ? C.amber : "transparent", border: `1px solid ${period === id ? C.amber : C.line}`, borderRadius: 8, padding: "8px", cursor: "pointer" }}>{label}</button>
          ))}
        </div>

        {/* performance KPIs */}
        <div className="grid grid-cols-2 gap-px" style={{ background: C.line, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
          <Kpi label="Revenue" value={money(perf.rev)} sub={`${fmt0(perf.count)} loads`} />
          <Kpi label="Net (after costs)" value={money(perf.net)} color={perf.net >= 0 ? C.green : C.red} />
          <Kpi label="Avg RPM" value={"$" + perf.avgRpm.toFixed(2)} color={rpmColor(perf.avgRpm)} sub={perf.thin ? `${perf.thin} thin` : "none thin"} />
          <Kpi label="Active loads" value={fmt0(perf.active)} color={C.amber} sub={`${fmt0(perf.mi)} mi`} />
        </div>

        {/* money owed */}
        <Section title="Money owed">
          <div className="grid grid-cols-2 gap-px" style={{ background: C.line, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
            <Kpi label="Open A/R" value={money(ar.openAR)} color={ar.openAR > 0 ? C.amber : C.dim} sub="invoiced, unpaid" />
            <Kpi label="Uncollected detention" value={money(ar.uncollectedDet)} color={ar.uncollectedDet > 0 ? C.amberHi : C.dim} />
          </div>
        </Section>

        {/* action items */}
        <Section title="Needs attention">
          <div className="flex" style={{ flexDirection: "column", gap: 8 }}>
            <ActionRow color={C.green} label="Ready to invoice" detail="delivered · POD in · unbilled" count={ar.readyToInvoice} />
            <ActionRow color={C.red} label="Overdue invoices" detail="invoiced over 30 days" count={ar.overdue} />
            <ActionRow color={C.amber} label="Missing POD" detail="delivered, no POD yet" count={ar.missingPOD} />
          </div>
        </Section>

        {/* drivers */}
        {drivers.length > 0 && (
          <Section title="Drivers" right={<span style={{ fontFamily: mono, fontSize: 10.5, color: C.faint }}>by revenue</span>}>
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "6px 14px" }}>
              {drivers.map(d => (
                <BarRow key={d.name} name={d.name} value={money(d.rev)} pct={(d.rev / maxDriverRev) * 100}
                  color={rpmColor(d.avgRpm)} meta={`${d.n} · $${d.avgRpm.toFixed(2)}`} />
              ))}
            </div>
          </Section>
        )}

        {/* brokers */}
        {brokers.length > 0 && (
          <Section title="Top brokers" right={<span style={{ fontFamily: mono, fontSize: 10.5, color: C.faint }}>by revenue</span>}>
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "6px 14px" }}>
              {brokers.map(b => (
                <BarRow key={b.name} name={b.name} value={money(b.rev)} pct={(b.rev / maxBrokerRev) * 100} color={C.blue} meta={`${b.n}`} />
              ))}
            </div>
          </Section>
        )}

        {/* broker access codes */}
        {codes.length > 0 && (
          <Section title="Broker portal codes" right={
            <button onClick={() => setShowCodes(s => !s)} style={{ fontFamily: mono, fontSize: 11, color: C.dim, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
              {showCodes ? "hide" : `show (${codes.length})`}
            </button>}>
            {showCodes && (
              <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
                {codes.map((c, i) => (
                  <div key={c.broker} className="flex items-center justify-between" style={{ padding: "11px 14px", borderTop: i ? `1px solid ${C.lineSoft}` : "none" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: sans, fontSize: 13, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.broker}</div>
                      <div style={{ fontFamily: mono, fontSize: 10, color: C.faint }}>{c.loads} load{c.loads === 1 ? "" : "s"}</div>
                    </div>
                    <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, letterSpacing: 2, color: C.amberHi }}>{c.code}</span>
                  </div>
                ))}
              </div>
            )}
            {showCodes && <div style={{ fontFamily: sans, fontSize: 11, color: C.faint, marginTop: 8 }}>Brokers sign in at /broker with their company name + this code.</div>}
          </Section>
        )}

      </div>
    </div>
  );
}
