import React, { useState, useEffect, useMemo, useRef } from "react";
import * as api from "./api";

/* ============================ DATA ============================ */
const SEED: any[] = [];

/* ============================ TOKENS ============================ */
const C = {
  bg:"#0E1116", panel:"#161B22", panel2:"#1C222B", raised:"#222933",
  line:"#2A323D", lineSoft:"#222932",
  ink:"#E9ECF1", dim:"#8B95A3", faint:"#6E7886",
  amber:"#F2A413", amberHi:"#FFB740",
  green:"#36D399", greenDim:"#1f6b50",
  red:"#F0594C", redDim:"#6b2722",
  blue:"#4DA3FF", purple:"#A78BFA",
};
const LANES = ["Available","Assigned","In Transit","Delivered"];
const DRIVER_ORDER = ["TJ","John","Chris","Jeremy","Derek"];
const mono = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const sans = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

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

/* ---- Phase 3 helpers: billing / detention / IFTA ---- */
// Total billed to the broker = linehaul + accessorials. RPM/P&L stay linehaul-based.
function billableOf(l){ return (l.rate||0)+(l.detention_pay||0)+(l.lumper||0)+(l.accessorial||0); }
function accessorialOf(l){ return (l.detention_pay||0)+(l.lumper||0)+(l.accessorial||0); }
function daysBetween(aISO,bISO){ if(!aISO||!bISO) return null; const a=new Date(aISO+"T00:00:00").getTime(), b=new Date(bISO+"T00:00:00").getTime(); return Math.round((b-a)/864e5); }
function ageDays(iso){ if(!iso) return null; return daysBetween(iso, todayISO()); }
function quarterOf(iso){ if(!iso||iso.length<7) return null; const mo=parseInt(iso.slice(5,7),10); return iso.slice(0,4)+"-Q"+(Math.floor((mo-1)/3)+1); }
function quarterLabel(q){ if(!q) return "—"; const [y,n]=q.split("-Q"); const a=MON[(parseInt(n,10)-1)*3]; const b=MON[(parseInt(n,10)-1)*3+2]; return `Q${n} ${y} · ${a}–${b}`; }
const US_STATES=["AL","AR","AZ","CA","CO","CT","DE","FL","GA","IA","ID","IL","IN","KS","KY","LA","MA","MD","ME","MI","MN","MO","MS","MT","NC","ND","NE","NH","NJ","NM","NV","NY","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VA","VT","WA","WI","WV","WY"];

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
function Ledger({loads, patchLoad}){
  const [q,setQ]=useState(""); const [drv,setDrv]=useState("all"); const [sort,setSort]=useState("date");
  const [open,setOpen]=useState({}); const toggle=id=>setOpen(o=>({...o,[id]:!o[id]}));
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
          {rows.map((l,idx)=>{const rpm=computeRpm(l); const isOpen=open[l.id];
            const bill=l.billing_status==="paid"?["paid",C.green]:l.billing_status==="invoiced"?["invoiced",C.amber]:null;
            return(
            <div key={l.id} style={{borderTop:`1px solid ${C.lineSoft}`,background:isOpen?C.panel2:(idx%2?C.bg:C.panel)}}>
              <div onClick={()=>toggle(l.id)} className="grid grid-cols-2 md:grid-cols-none" style={{gridTemplateColumns:"80px 1fr 92px 56px 52px 70px 64px 64px 60px 66px",
                gap:8,padding:"9px 12px",alignItems:"center",cursor:"pointer"}}>
                <div style={{fontFamily:mono,fontSize:11.5,color:C.dim}}><span style={{color:C.faint,marginRight:4}}>{isOpen?"▾":"▸"}</span>{(l.date||"").slice(5)}</div>
                <div style={{fontFamily:sans,fontSize:12.5,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {l.broker||"—"}
                  {bill && <span style={{marginLeft:6,fontFamily:mono,fontSize:9,color:bill[1]}}>● {bill[0]}</span>}
                  {l.pod_received && <span title="POD received" style={{marginLeft:6,fontFamily:mono,fontSize:9,color:C.green}}>✓POD</span>}
                  {accessorialOf(l)>0 && <span title="accessorials" style={{marginLeft:6,fontFamily:mono,fontSize:9,color:C.blue}}>+{money(accessorialOf(l))}</span>}
                </div>
                <div style={{fontFamily:mono,fontSize:11.5,color:C.dim}}>{l.driver||"—"}{l.unit?(" · "+l.unit):""}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,fontWeight:600,color:rpmColor(rpm)}}>{rpm!=null?"$"+rpm.toFixed(2):"—"}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{fmt0(l.miles)}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:C.ink}}>{money(l.rate)}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(l.pay)}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(l.fuel)}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:C.dim}}>{l.dispatch?money(l.dispatch):"—"}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:l.repair?C.amber:C.dim}}>{l.repair?money(l.repair):"—"}</div>
              </div>
              {isOpen && patchLoad && (
                <div style={{padding:"0 12px 12px"}}>
                  <div className="flex items-center" style={{gap:7,flexWrap:"wrap",marginBottom:2}}>
                    {l.status==="Delivered" && l.billing_status!=="invoiced" && l.billing_status!=="paid" &&
                      <button onClick={e=>{e.stopPropagation();patchLoad(l.id,{billing_status:"invoiced",invoiced_at:todayISO()});}} style={{fontFamily:mono,fontSize:10.5,fontWeight:700,color:C.bg,background:C.blue,border:"none",borderRadius:5,padding:"5px 10px",cursor:"pointer"}}>Mark invoiced</button>}
                    {l.billing_status==="invoiced" &&
                      <button onClick={e=>{e.stopPropagation();patchLoad(l.id,{billing_status:"paid",paid_at:todayISO()});}} style={{fontFamily:mono,fontSize:10.5,fontWeight:700,color:C.bg,background:C.green,border:"none",borderRadius:5,padding:"5px 10px",cursor:"pointer"}}>Mark paid</button>}
                    {l.doc_link && <a href={l.doc_link} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{fontFamily:mono,fontSize:10.5,color:C.blue}}>open paperwork ↗</a>}
                  </div>
                  <PaperRow l={l} patchLoad={patchLoad}/>
                </div>
              )}
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

/* ============================ RATE CONS TAB ============================ */
// Composes the live Gmail ingest feed (Phase 2) + the manual paste extractor.
function RateCons({onAdd, onChanged}){
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <GmailFeed onChanged={onChanged}/>
      <div>
        <Label style={{marginBottom:8}}>Or paste one in manually</Label>
        <PasteExtract onAdd={onAdd}/>
      </div>
    </div>
  );
}

/* ---- Phase 2: live inbox feed ---- */
function GmailFeed({onChanged}){
  const [status,setStatus]=useState(null);
  const [emails,setEmails]=useState([]);
  const [busy,setBusy]=useState(false);
  const [sweep,setSweep]=useState(null);
  const [err,setErr]=useState("");
  const [promoting,setPromoting]=useState({});

  async function load(){
    try{
      const [s,e]=await Promise.all([api.getIngestStatus(), api.getEmails()]);
      setStatus(s); setEmails(e);
    }catch(_){ /* leave as-is */ }
  }
  useEffect(()=>{ load(); const id=setInterval(load,15000); return ()=>clearInterval(id); },[]);

  async function runSweep(){
    setBusy(true); setErr(""); setSweep(null);
    try{ const r=await api.runIngest(); setSweep(r); await load(); if(r.loadsAdded) onChanged&&onChanged(); }
    catch(e){ setErr("Couldn't reach the inbox worker."); }
    setBusy(false);
  }
  async function promote(id){
    setPromoting(p=>({...p,[id]:true}));
    try{ await api.promoteEmail(id); await load(); onChanged&&onChanged(); }
    catch(e){ setErr("Promote failed — it may already be on the board."); }
    setPromoting(p=>({...p,[id]:false}));
  }

  const on = status && status.enabled && status.configured;
  const minConf = status?.minConfidence ?? 0.6;
  return (
    <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:14}}>
      <div className="flex items-center justify-between" style={{gap:10,flexWrap:"wrap"}}>
        <div className="flex items-center" style={{gap:10}}>
          <div style={{width:8,height:8,borderRadius:9,background:on?C.green:(status?.enabled?C.amber:C.faint)}}/>
          <div>
            <Label>Inbox auto-pull</Label>
            <div style={{fontFamily:sans,fontSize:13,color:C.ink,marginTop:2}}>
              {!status ? "Checking…"
                : on ? `Watching ${(status.accounts||[]).length} inbox${(status.accounts||[]).length===1?"":"es"} · sweeps every ${status.pollSeconds}s`
                : status.enabled ? "Enabled but not configured — set Google creds (PHASE2-SETUP.md)."
                : "Off — turn on GMAIL_INGEST in the backend to auto-pull rate cons. Pasting still works."}
            </div>
            {status?.lastRunAt && <div style={{fontFamily:mono,fontSize:10.5,color:C.faint,marginTop:2}}>last sweep {new Date(status.lastRunAt).toLocaleString()}{status.lastResult?` · +${status.lastResult.loadsAdded} added, ${status.lastResult.skipped} skipped`:""}</div>}
          </div>
        </div>
        <button onClick={runSweep} disabled={busy} style={{fontFamily:mono,fontSize:12,fontWeight:700,color:C.bg,
          background:busy?C.faint:C.blue,border:"none",borderRadius:7,padding:"8px 13px",cursor:busy?"default":"pointer",whiteSpace:"nowrap"}}>
          {busy?"Checking…":"Check inboxes now"}</button>
      </div>
      {err && <div style={{marginTop:8,color:C.red,fontFamily:mono,fontSize:11.5}}>{err}</div>}
      {sweep && <div style={{marginTop:8,fontFamily:mono,fontSize:11,color:C.dim}}>Swept {sweep.scanned} · fetched {sweep.fetched} · +{sweep.loadsAdded} added · {sweep.skipped} skipped{sweep.errors?` · ${sweep.errors} errors`:""}</div>}

      <div style={{marginTop:12,borderTop:`1px solid ${C.lineSoft}`,paddingTop:10}}>
        <Label style={{marginBottom:8}}>Recently read ({emails.length})</Label>
        {emails.length===0 && <div style={{fontFamily:mono,fontSize:11,color:C.faint,padding:"6px 2px"}}>Nothing yet. Rate cons the worker reads show up here — added automatically, or promote a skipped one by hand.</div>}
        <div style={{display:"flex",flexDirection:"column",gap:7,maxHeight:340,overflowY:"auto"}}>
          {emails.map(m=>{
            const x=m.extract_json||{};
            const added=!!m.parsed_load_id;
            const conf=m.confidence!=null?Math.round(m.confidence*100):null;
            const state=m.error?["error",C.red]:added?["added",C.green]:["skipped",C.amber];
            const lane=[x.origin,x.dest].filter(Boolean).join(" → ");
            return (
              <div key={m.id} style={{background:C.panel2,border:`1px solid ${C.line}`,borderLeft:`3px solid ${state[1]}`,borderRadius:7,padding:"8px 10px"}}>
                <div className="flex items-center justify-between" style={{gap:8}}>
                  <div style={{minWidth:0,flex:1}}>
                    <div style={{fontFamily:sans,fontSize:12.5,color:C.ink,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.subject||"(no subject)"}</div>
                    <div style={{fontFamily:mono,fontSize:10,color:C.faint,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.from_addr||m.mailbox}</div>
                  </div>
                  <div className="flex items-center" style={{gap:6,flexShrink:0}}>
                    {conf!=null && <span style={{fontFamily:mono,fontSize:10,color:conf>=minConf*100?C.green:C.dim}}>{conf}%</span>}
                    <Pill color={state[1]} bg={state[1]+"14"}>{state[0]}</Pill>
                  </div>
                </div>
                {(x.broker||lane||x.rate!=null) && (
                  <div style={{fontFamily:mono,fontSize:10.5,color:C.dim,marginTop:5}}>
                    {x.broker||"—"}{lane?(" · "+lane):""}{x.rate!=null?(" · "+money(x.rate)):""}{x.miles?(" · "+fmt0(x.miles)+"mi"):""}
                  </div>
                )}
                {m.error && <div style={{fontFamily:mono,fontSize:10,color:C.red,marginTop:4}}>{m.error}</div>}
                {!added && !m.error && (
                  <button onClick={()=>promote(m.id)} disabled={promoting[m.id]} style={{marginTop:7,fontFamily:mono,fontSize:10.5,fontWeight:700,
                    color:C.bg,background:promoting[m.id]?C.faint:C.green,border:"none",borderRadius:5,padding:"5px 10px",cursor:promoting[m.id]?"default":"pointer"}}>
                    {promoting[m.id]?"Adding…":"+ Promote to board"}</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---- manual paste-to-extract ---- */
function PasteExtract({onAdd}){
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
    // Billing snapshot so the copilot can answer "who owes me money / what's overdue / uncollected detention".
    let arOpen=0, detOwed=0; const overdue=[];
    loads.forEach(l=>{
      if(l.billing_status==="invoiced"){ arOpen+=billableOf(l); const age=ageDays(l.invoiced_at);
        if(age!=null&&age>30) overdue.push({broker:l.broker,amount:Math.round(billableOf(l)),daysOut:age}); }
      if((l.detention_pay||0)>0 && l.billing_status!=="paid") detOwed+=l.detention_pay;
    });
    const billing={openAR:Math.round(arOpen),uncollectedDetention:Math.round(detOwed),overdueInvoices:overdue.sort((a,b)=>b.daysOut-a.daysOut).slice(0,8)};
    return {active,drivers,billing};
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

/* ============================ BILLING & A/R ============================ */
function ageColor(d){ if(d==null) return C.faint; if(d>60) return C.red; if(d>30) return C.amber; return C.green; }
function NumIn({value,onCommit,placeholder,width}){
  const [v,setV]=useState(value??"");
  useEffect(()=>{ setV(value??""); },[value]);
  return <input value={v} placeholder={placeholder||"0"} inputMode="decimal"
    onChange={e=>setV(e.target.value)} onBlur={()=>onCommit(v)}
    style={{width:width||72,background:C.bg,border:`1px solid ${C.line}`,borderRadius:5,color:C.ink,padding:"6px 8px",fontFamily:mono,fontSize:12}}/>;
}
function DocChip({on,label,onClick}){
  return <button onClick={onClick} title="toggle received" style={{fontFamily:mono,fontSize:10,letterSpacing:.3,
    color:on?C.bg:C.dim,background:on?C.green:C.raised,border:`1px solid ${on?C.green:C.line}`,
    borderRadius:5,padding:"4px 8px",cursor:"pointer",fontWeight:700}}>{on?"✓ ":""}{label}</button>;
}
function PaperRow({l,patchLoad}){
  const commitNum=k=>v=>patchLoad(l.id,{[k]: v===""?"":(isNaN(parseFloat(v))?"":parseFloat(v))});
  return (
    <div style={{marginTop:8,padding:"10px 11px",background:C.bg,border:`1px solid ${C.line}`,borderRadius:7,display:"flex",flexDirection:"column",gap:10}}>
      <div className="flex items-center" style={{gap:7,flexWrap:"wrap"}}>
        <Label style={{fontSize:9,marginRight:2}}>Paperwork</Label>
        <DocChip label="Rate con" on={l.ratecon_received} onClick={()=>patchLoad(l.id,{ratecon_received:!l.ratecon_received})}/>
        <DocChip label="BOL" on={l.bol_received} onClick={()=>patchLoad(l.id,{bol_received:!l.bol_received})}/>
        <DocChip label="POD" on={l.pod_received} onClick={()=>patchLoad(l.id,{pod_received:!l.pod_received})}/>
        <input defaultValue={l.doc_link||""} placeholder="paperwork link (Drive/Dropbox)…"
          onBlur={e=>{ const v=e.target.value.trim(); if(v!==(l.doc_link||"")) patchLoad(l.id,{doc_link:v||""}); }}
          style={{flex:"1 1 180px",minWidth:120,background:C.bg,border:`1px solid ${C.line}`,borderRadius:5,color:C.blue,padding:"6px 8px",fontFamily:mono,fontSize:11}}/>
      </div>
      <div className="flex items-center" style={{gap:12,flexWrap:"wrap"}}>
        <Label style={{fontSize:9}}>Accessorials</Label>
        <div className="flex items-center" style={{gap:5}}><span style={{fontFamily:mono,fontSize:10.5,color:C.faint}}>det hrs</span><NumIn value={l.detention_hours} onCommit={commitNum("detention_hours")} width={54}/></div>
        <div className="flex items-center" style={{gap:5}}><span style={{fontFamily:mono,fontSize:10.5,color:C.faint}}>det $</span><NumIn value={l.detention_pay} onCommit={commitNum("detention_pay")}/></div>
        <div className="flex items-center" style={{gap:5}}><span style={{fontFamily:mono,fontSize:10.5,color:C.faint}}>lumper $</span><NumIn value={l.lumper} onCommit={commitNum("lumper")}/></div>
        <div className="flex items-center" style={{gap:5}}><span style={{fontFamily:mono,fontSize:10.5,color:C.faint}}>other $</span><NumIn value={l.accessorial} onCommit={commitNum("accessorial")}/></div>
        {accessorialOf(l)>0 && <Pill color={C.green}>billable {money(billableOf(l))}</Pill>}
      </div>
    </div>
  );
}
function Billing({loads, patchLoad}){
  const [scope,setScope]=useState("recent");
  const [open,setOpen]=useState({});
  const toggle=id=>setOpen(o=>({...o,[id]:!o[id]}));
  const delivered=useMemo(()=>loads.filter(l=>l.status==="Delivered"),[loads]);

  const m=useMemo(()=>{
    let ar=0,det=0,dN=0,dC=0,rN=0,rAmt=0,overdue=0;
    delivered.forEach(l=>{
      if(l.billing_status==="invoiced"){ ar+=billableOf(l); if((ageDays(l.invoiced_at)||0)>30) overdue+=billableOf(l); }
      if((l.detention_pay||0)>0 && l.billing_status!=="paid") det+=l.detention_pay;
      if(l.billing_status==="paid"){ const d=daysBetween(l.invoiced_at,l.paid_at); if(d!=null){dN+=d;dC++;} }
      if(l.billing_status!=="invoiced"&&l.billing_status!=="paid"){ rN++; rAmt+=billableOf(l); }
    });
    return {ar,det,avgDtp:dC?dN/dC:null,rN,rAmt,overdue};
  },[delivered]);

  const ready=useMemo(()=>{
    let r=delivered.filter(l=>l.billing_status!=="invoiced"&&l.billing_status!=="paid");
    if(scope==="recent") r=r.filter(l=>(ageDays(l.date)??999)<=60);
    return r.sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  },[delivered,scope]);
  const awaiting=useMemo(()=>delivered.filter(l=>l.billing_status==="invoiced").sort((a,b)=>(a.invoiced_at||"").localeCompare(b.invoiced_at||"")),[delivered]);

  const brokers=useMemo(()=>{
    const b={};
    delivered.forEach(l=>{ if(!l.broker) return; const e=b[l.broker]||(b[l.broker]={broker:l.broker,paidN:0,dN:0,dC:0,outstanding:0});
      if(l.billing_status==="paid"){ e.paidN++; const d=daysBetween(l.invoiced_at,l.paid_at); if(d!=null){e.dN+=d;e.dC++;} }
      if(l.billing_status==="invoiced") e.outstanding+=billableOf(l); });
    return Object.values(b).map(e=>({...e,avg:e.dC?e.dN/e.dC:null})).filter(e=>e.dC||e.outstanding>0)
      .sort((a,b)=>b.outstanding-a.outstanding||(b.avg||0)-(a.avg||0));
  },[delivered]);

  const RDIM="74px 1fr 120px 96px 150px";
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px" style={{background:C.line,border:`1px solid ${C.line}`,borderRadius:8,overflow:"hidden",marginBottom:14}}>
        {[["Outstanding A/R",money(m.ar),m.ar>0?C.amber:C.dim,m.overdue>0?`${money(m.overdue)} over 30d`:"all current"],
          ["Avg days to pay",m.avgDtp!=null?m.avgDtp.toFixed(0)+"d":"—",ageColor(m.avgDtp),"invoice → paid"],
          ["Uncollected detention",money(m.det),m.det>0?C.red:C.green,m.det>0?"chase these":"none owed"],
          ["Ready to invoice",fmt0(m.rN),m.rN>0?C.blue:C.dim,money(m.rAmt)]].map((it,i)=>(
          <div key={i} style={{background:C.panel,padding:"12px 14px"}}>
            <Label>{it[0]}</Label>
            <div style={{fontFamily:mono,fontSize:20,fontWeight:600,color:it[2],marginTop:5,lineHeight:1}}>{it[1]}</div>
            <div style={{fontFamily:mono,fontSize:10,color:C.faint,marginTop:4}}>{it[3]}</div>
          </div>
        ))}
      </div>

      {/* Ready to invoice */}
      <div className="flex items-center justify-between" style={{marginBottom:8}}>
        <Label style={{fontSize:11}}>Ready to invoice · delivered, not yet billed</Label>
        <div className="flex" style={{gap:3,background:C.panel,border:`1px solid ${C.line}`,borderRadius:8,padding:3}}>
          {[["recent","Last 60d"],["all","All"]].map(([k,lbl])=>(
            <button key={k} onClick={()=>setScope(k)} style={{fontFamily:mono,fontSize:11,fontWeight:700,color:scope===k?C.bg:C.dim,background:scope===k?C.amber:"transparent",border:"none",borderRadius:6,padding:"5px 11px",cursor:"pointer"}}>{lbl}</button>
          ))}
        </div>
      </div>
      <div style={{border:`1px solid ${C.line}`,borderRadius:10,overflow:"hidden",marginBottom:18}}>
        {ready.length===0 && <Empty msg="Nothing waiting to be invoiced. Deliver a load and it lands here."/>}
        {ready.slice(0,40).map((l,i)=>(
          <div key={l.id} style={{borderTop:i?`1px solid ${C.lineSoft}`:"none",background:i%2?C.bg:C.panel}}>
            <div className="grid" style={{gridTemplateColumns:RDIM,gap:8,padding:"10px 12px",alignItems:"center"}}>
              <div style={{fontFamily:mono,fontSize:11.5,color:C.dim}}>{(l.date||"").slice(5)}</div>
              <div style={{minWidth:0}}>
                <div style={{fontFamily:sans,fontSize:13,color:C.ink,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.broker||"—"}</div>
                <div style={{fontFamily:mono,fontSize:10.5,color:C.faint}}>{(l.origin||l.dest)?`${l.origin||"?"} → ${l.dest||"?"}`:(l.driver||"")}</div>
              </div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:13,color:C.ink}}>{money(billableOf(l))}</div>
              <div style={{textAlign:"center"}}>{l.pod_received?<Pill color={C.green}>POD in</Pill>:<Pill color={C.amber}>no POD</Pill>}</div>
              <div className="flex items-center justify-end" style={{gap:6}}>
                <button onClick={()=>toggle(l.id)} style={iconBtnS}>{open[l.id]?"▾":"⋯"}</button>
                <button onClick={()=>patchLoad(l.id,{billing_status:"invoiced",invoiced_at:todayISO()})}
                  style={{fontFamily:mono,fontSize:11,fontWeight:700,color:C.bg,background:C.blue,border:"none",borderRadius:6,padding:"6px 11px",cursor:"pointer",whiteSpace:"nowrap"}}>Mark invoiced</button>
              </div>
            </div>
            {open[l.id] && <div style={{padding:"0 12px 12px"}}><PaperRow l={l} patchLoad={patchLoad}/></div>}
          </div>
        ))}
        {ready.length>40 && <div style={{fontFamily:mono,fontSize:11,color:C.faint,textAlign:"center",padding:8,background:C.panel}}>+{ready.length-40} more — switch to a tighter range or invoice these first</div>}
      </div>

      {/* Awaiting payment */}
      <Label style={{fontSize:11,marginBottom:8}}>Awaiting payment · {awaiting.length} invoice{awaiting.length===1?"":"s"} · {money(m.ar)} out</Label>
      <div style={{border:`1px solid ${C.line}`,borderRadius:10,overflow:"hidden",marginBottom:18}}>
        {awaiting.length===0 && <Empty msg="No open invoices. Marked-invoiced loads show here until paid."/>}
        {awaiting.map((l,i)=>{ const age=ageDays(l.invoiced_at);
          return (
            <div key={l.id} className="grid" style={{gridTemplateColumns:RDIM,gap:8,padding:"10px 12px",alignItems:"center",borderTop:i?`1px solid ${C.lineSoft}`:"none",background:i%2?C.bg:C.panel}}>
              <div style={{fontFamily:mono,fontSize:11,color:ageColor(age)}}>{age!=null?age+"d":"—"}</div>
              <div style={{minWidth:0}}>
                <div style={{fontFamily:sans,fontSize:13,color:C.ink,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.broker||"—"}</div>
                <div style={{fontFamily:mono,fontSize:10.5,color:C.faint}}>inv {l.invoiced_at||"—"}{(l.detention_pay||0)>0?` · det ${money(l.detention_pay)}`:""}</div>
              </div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:13,color:C.ink}}>{money(billableOf(l))}</div>
              <div style={{textAlign:"center"}}>{age!=null&&age>30?<Pill color={C.red}>overdue</Pill>:<Pill color={C.green}>current</Pill>}</div>
              <div className="flex items-center justify-end" style={{gap:6}}>
                <button onClick={()=>patchLoad(l.id,{billing_status:"unbilled",invoiced_at:""})} title="Un-invoice" style={iconBtnS}>↩</button>
                <button onClick={()=>patchLoad(l.id,{billing_status:"paid",paid_at:todayISO()})}
                  style={{fontFamily:mono,fontSize:11,fontWeight:700,color:C.bg,background:C.green,border:"none",borderRadius:6,padding:"6px 14px",cursor:"pointer"}}>Mark paid</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Broker pay performance */}
      <Label style={{fontSize:11,marginBottom:8}}>Broker pay performance · who pays fast, who's slow</Label>
      <div style={{border:`1px solid ${C.line}`,borderRadius:10,overflow:"hidden"}}>
        <div className="hidden md:grid" style={{gridTemplateColumns:"1fr 110px 96px 110px",background:C.panel2,padding:"9px 13px",gap:8}}>
          {["Broker","Avg days to pay","Paid loads","Outstanding"].map((h,i)=><div key={i} style={{fontFamily:sans,fontSize:10,letterSpacing:1,textTransform:"uppercase",color:C.faint,textAlign:i?"right":"left"}}>{h}</div>)}
        </div>
        {brokers.length===0 && <Empty msg="No payment history yet — mark a few invoices paid and broker timing builds here."/>}
        {brokers.map((e,i)=>(
          <div key={e.broker} className="grid" style={{gridTemplateColumns:"1fr 110px 96px 110px",gap:8,padding:"9px 13px",background:i%2?C.bg:C.panel,borderTop:`1px solid ${C.lineSoft}`,alignItems:"center"}}>
            <div style={{fontFamily:sans,fontSize:12.5,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.broker}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,fontWeight:600,color:ageColor(e.avg)}}>{e.avg!=null?e.avg.toFixed(0)+"d":"—"}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{e.paidN||"—"}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:e.outstanding>0?C.amber:C.faint}}>{e.outstanding>0?money(e.outstanding):"—"}</div>
          </div>
        ))}
      </div>
      <div style={{fontFamily:sans,fontSize:11,color:C.faint,marginTop:10}}>Billable = linehaul + detention + lumper + accessorials. A/R aging counts from the invoice date. RPM and P&L stay linehaul-based, as they should. Older delivered loads start as “unbilled” — invoice or ignore them.</div>
    </div>
  );
}
const iconBtnS={width:28,height:28,borderRadius:6,background:C.raised,border:`1px solid ${C.line}`,color:C.dim,cursor:"pointer",fontFamily:mono,fontSize:13,lineHeight:1};

/* ============================ DRIVER SETTLEMENTS ============================ */
function AdvanceIn({l,patchLoad}){
  const [v,setV]=useState(l.advance??"");
  useEffect(()=>{ setV(l.advance??""); },[l.advance]);
  return <input value={v} placeholder="0" inputMode="decimal" onChange={e=>setV(e.target.value)}
    onBlur={()=>{ const send=v===""?"":(isNaN(parseFloat(v))?"":parseFloat(v)); patchLoad(l.id,{advance:send}); }}
    style={{width:80,background:C.bg,border:`1px solid ${C.line}`,borderRadius:5,color:C.ink,padding:"6px 8px",fontFamily:mono,fontSize:12,textAlign:"right"}}/>;
}
function Settlements({loads, patchLoad}){
  const delivered=useMemo(()=>loads.filter(l=>l.status==="Delivered"&&l.driver&&l.date),[loads]);
  const weeks=useMemo(()=>Array.from(new Set(delivered.map(l=>isoMonday(l.date)))).sort((a,b)=>b.localeCompare(a)),[delivered]);
  const [wk,setWk]=useState(""); useEffect(()=>{ if(weeks.length&&!weeks.includes(wk)) setWk(weeks[0]||""); },[weeks]);
  const inWeek=useMemo(()=>delivered.filter(l=>isoMonday(l.date)===wk),[delivered,wk]);

  const perDriver=useMemo(()=>{
    const m={};
    inWeek.forEach(l=>{ const d=m[l.driver]||(m[l.driver]={driver:l.driver,pay:0,adv:0,miles:0,n:0});
      d.pay+=l.pay||0; d.adv+=l.advance||0; d.miles+=l.miles||0; d.n++; });
    return Object.values(m).map(d=>({...d,net:d.pay-d.adv}))
      .sort((a,b)=>{const ia=DRIVER_ORDER.indexOf(a.driver),ib=DRIVER_ORDER.indexOf(b.driver);return (ia<0?99:ia)-(ib<0?99:ib);});
  },[inWeek]);
  const [drv,setDrv]=useState(""); useEffect(()=>{ if(perDriver.length&&!perDriver.find(d=>d.driver===drv)) setDrv(perDriver[0]?.driver||""); },[perDriver]);
  const rows=useMemo(()=>inWeek.filter(l=>l.driver===drv).sort((a,b)=>(a.date||"").localeCompare(b.date||"")),[inWeek,drv]);
  const cur=perDriver.find(d=>d.driver===drv);

  if(!weeks.length) return <Empty msg="No delivered, driver-assigned loads yet — settlements build per week as loads complete."/>;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between" style={{gap:10,marginBottom:14}}>
        <div className="flex items-center" style={{gap:10}}>
          <Label>Week of</Label>
          <select value={wk} onChange={e=>setWk(e.target.value)} style={{...selStyle,fontSize:13}}>
            {weeks.map(w=><option key={w} value={w}>{weekLabel(w)}, {w.slice(0,4)}</option>)}
          </select>
        </div>
        <Pill color={C.dim}>{perDriver.length} driver{perDriver.length===1?"":"s"} ran this week</Pill>
      </div>

      <div className="flex" style={{gap:8,flexWrap:"wrap",marginBottom:14}}>
        {perDriver.map(d=>(
          <button key={d.driver} onClick={()=>setDrv(d.driver)} style={{textAlign:"left",cursor:"pointer",
            background:d.driver===drv?C.panel2:C.panel,border:`1px solid ${d.driver===drv?C.amber:C.line}`,borderRadius:9,padding:"10px 13px",minWidth:130}}>
            <div style={{fontFamily:sans,fontSize:13,fontWeight:700,color:C.ink}}>{d.driver}</div>
            <div style={{fontFamily:mono,fontSize:15,fontWeight:700,color:d.net>=0?C.green:C.red,marginTop:3}}>{money(d.net)}</div>
            <div style={{fontFamily:mono,fontSize:10,color:C.faint}}>{d.n} load{d.n===1?"":"s"} · {fmt0(d.miles)}mi</div>
          </button>
        ))}
      </div>

      {cur && (
        <div style={{border:`1px solid ${C.line}`,borderRadius:10,overflow:"hidden"}}>
          <div style={{padding:"11px 13px",background:C.panel2,borderBottom:`1px solid ${C.line}`}} className="flex items-center justify-between">
            <div style={{fontFamily:sans,fontSize:14,fontWeight:700,color:C.ink}}>{drv} · settlement for {weekLabel(wk)}</div>
            <Pill color={C.faint}>edit advances inline</Pill>
          </div>
          <div className="hidden md:grid" style={{gridTemplateColumns:"78px 1fr 90px 80px 92px 96px",background:C.panel,padding:"8px 13px",gap:8,borderBottom:`1px solid ${C.lineSoft}`}}>
            {["Date","Broker / lane","Miles","Gross pay","Advance","Net"].map((h,i)=><div key={i} style={{fontFamily:sans,fontSize:10,letterSpacing:1,textTransform:"uppercase",color:C.faint,textAlign:i>1?"right":"left"}}>{h}</div>)}
          </div>
          {rows.map((l,i)=>(
            <div key={l.id} className="grid" style={{gridTemplateColumns:"78px 1fr 90px 80px 92px 96px",gap:8,padding:"9px 13px",alignItems:"center",background:i%2?C.bg:C.panel,borderTop:`1px solid ${C.lineSoft}`}}>
              <div style={{fontFamily:mono,fontSize:11.5,color:C.dim}}>{(l.date||"").slice(5)}</div>
              <div style={{fontFamily:sans,fontSize:12.5,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.broker||"—"}{(l.origin)?` · ${l.origin}→${l.dest||"?"}`:""}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{fmt0(l.miles)}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:C.ink}}>{money(l.pay)}</div>
              <div style={{textAlign:"right"}} className="flex justify-end"><AdvanceIn l={l} patchLoad={patchLoad}/></div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,fontWeight:600,color:C.ink}}>{money((l.pay||0)-(l.advance||0))}</div>
            </div>
          ))}
          <div className="grid" style={{gridTemplateColumns:"78px 1fr 90px 80px 92px 96px",gap:8,padding:"11px 13px",background:C.panel2,borderTop:`2px solid ${C.line}`,alignItems:"center"}}>
            <div style={{fontFamily:sans,fontSize:11,letterSpacing:.6,textTransform:"uppercase",color:C.amber,fontWeight:700,gridColumn:"1 / 3"}}>Take-home</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{fmt0(cur.miles)}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:C.ink}}>{money(cur.pay)}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:cur.adv>0?C.amber:C.dim}}>{cur.adv>0?"−"+money(cur.adv):"—"}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:14,fontWeight:700,color:cur.net>=0?C.green:C.red}}>{money(cur.net)}</div>
          </div>
        </div>
      )}
      <div style={{fontFamily:sans,fontSize:11,color:C.faint,marginTop:10}}>Net settlement = gross driver pay − advances (cash/fuel advanced against the week). Enter an advance on any line; the take-home updates live. Pay per load is set in the load record.</div>
    </div>
  );
}

/* ============================ IFTA WORKSHEET ============================ */
function Ifta({loads}){
  const [fuel,setFuel]=useState([]);
  const [miles,setMiles]=useState({});
  const [q,setQ]=useState("");
  const [form,setForm]=useState({date:todayISO(),state:"",gallons:"",amount:"",unit:"",driver:""});
  const [busy,setBusy]=useState(false);
  const [addState,setAddState]=useState("");

  const quarters=useMemo(()=>{
    const s=new Set(); loads.forEach(l=>{ const qq=quarterOf(l.date); if(qq)s.add(qq); });
    fuel.forEach(f=>{ const qq=quarterOf(f.date); if(qq)s.add(qq); });
    const cur=quarterOf(todayISO()); if(cur)s.add(cur);
    return Array.from(s).sort((a,b)=>b.localeCompare(a));
  },[loads,fuel]);
  useEffect(()=>{ if(quarters.length&&!quarters.includes(q)) setQ(quarters[0]); },[quarters]);

  async function loadFuel(){ try{ setFuel(await api.getFuel()); }catch(_){} }
  useEffect(()=>{ loadFuel(); },[]);
  useEffect(()=>{ if(!q) return; let on=true; api.getIftaMiles(q).then(rows=>{ if(!on)return; const m={}; rows.forEach(r=>m[r.jurisdiction]=r.miles); setMiles(m); }).catch(()=>{}); return ()=>{on=false;}; },[q]);

  const qFuel=useMemo(()=>fuel.filter(f=>quarterOf(f.date)===q),[fuel,q]);
  const totalMiles=useMemo(()=>loads.filter(l=>quarterOf(l.date)===q).reduce((s,l)=>s+(l.miles||0),0),[loads,q]);
  const totGal=qFuel.reduce((s,f)=>s+(f.gallons||0),0);
  const totSpend=qFuel.reduce((s,f)=>s+(f.amount||0),0);
  const mpg=totGal?totalMiles/totGal:0;
  const milesEntered=Object.values(miles).reduce((s,v)=>s+(v||0),0);

  const byState=useMemo(()=>{ const m={}; qFuel.forEach(f=>{ const k=(f.state||"—"); const e=m[k]||(m[k]={gal:0,amt:0}); e.gal+=f.gallons||0; e.amt+=f.amount||0; }); return m; },[qFuel]);
  const juris=useMemo(()=>{ const s=new Set(); Object.keys(byState).forEach(k=>{ if(k!=="—")s.add(k); }); Object.keys(miles).forEach(k=>s.add(k)); return Array.from(s).sort(); },[byState,miles]);

  async function submitFuel(){ if(!form.state||!form.gallons){ return; } setBusy(true);
    try{ const r=await api.addFuel({...form,state:form.state.toUpperCase()}); setFuel(f=>[r,...f]); setForm(s=>({...s,state:"",gallons:"",amount:""})); }catch(_){} setBusy(false); }
  async function removeFuel(id){ setFuel(f=>f.filter(x=>x.id!==id)); try{ await api.deleteFuel(id); }catch(_){ loadFuel(); } }
  function setMi(state,val){ const n=val===""?0:Math.max(0,Math.round(parseFloat(val)||0)); setMiles(m=>({...m,[state]:val===""?"":n})); }
  async function commitMi(state){ const n=Math.max(0,Math.round(parseFloat(miles[state])||0)); try{ await api.setIftaMiles(q,state,n);}catch(_){} }
  function addJuris(){ if(addState && !(addState in miles)){ setMiles(m=>({...m,[addState]:0})); api.setIftaMiles(q,addState,0).catch(()=>{}); } setAddState(""); }

  const inp={background:C.bg,border:`1px solid ${C.line}`,borderRadius:6,color:C.ink,padding:"8px 10px",fontFamily:mono,fontSize:12};
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between" style={{gap:10,marginBottom:14}}>
        <div className="flex items-center" style={{gap:10}}>
          <Label>Quarter</Label>
          <select value={q} onChange={e=>setQ(e.target.value)} style={{...selStyle,fontSize:13}}>
            {quarters.map(x=><option key={x} value={x}>{quarterLabel(x)}</option>)}
          </select>
        </div>
        <Pill color={C.dim}>IFTA prep worksheet</Pill>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px" style={{background:C.line,border:`1px solid ${C.line}`,borderRadius:8,overflow:"hidden",marginBottom:14}}>
        {[["Fleet miles",fmt0(totalMiles),C.ink,"from loads this quarter"],
          ["Gallons bought",totGal?totGal.toFixed(1):"—",C.ink,"from fuel log"],
          ["Fuel spend",money(totSpend),C.ink,totGal?("$"+(totSpend/totGal).toFixed(2)+"/gal"):"—"],
          ["Fleet MPG",mpg?mpg.toFixed(2):"—",mpg&&mpg<5?C.red:C.green,"miles ÷ gallons"]].map((it,i)=>(
          <div key={i} style={{background:C.panel,padding:"12px 14px"}}>
            <Label>{it[0]}</Label>
            <div style={{fontFamily:mono,fontSize:20,fontWeight:600,color:it[2],marginTop:5,lineHeight:1}}>{it[1]}</div>
            <div style={{fontFamily:mono,fontSize:10,color:C.faint,marginTop:4}}>{it[3]}</div>
          </div>
        ))}
      </div>

      {/* By-jurisdiction worksheet */}
      <Label style={{fontSize:11,marginBottom:8}}>By jurisdiction · gallons bought vs. taxable miles</Label>
      <div style={{border:`1px solid ${C.line}`,borderRadius:10,overflow:"hidden",marginBottom:8}}>
        <div className="grid" style={{gridTemplateColumns:"70px 1fr 110px 110px 110px 90px",background:C.panel2,padding:"9px 13px",gap:8}}>
          {["State","","Taxable miles","Gal bought","Taxable gal","Net gal"].map((h,i)=><div key={i} style={{fontFamily:sans,fontSize:10,letterSpacing:1,textTransform:"uppercase",color:C.faint,textAlign:i>1?"right":"left"}}>{h}</div>)}
        </div>
        {juris.length===0 && <Empty msg="Add fuel purchases below (and miles per state) to build the jurisdiction table."/>}
        {juris.map((st,i)=>{ const gal=byState[st]?.gal||0; const mi=miles[st]; const miN=parseFloat(mi)||0;
          const taxGal=mpg?miN/mpg:0; const net=taxGal-gal;
          return (
            <div key={st} className="grid" style={{gridTemplateColumns:"70px 1fr 110px 110px 110px 90px",gap:8,padding:"8px 13px",alignItems:"center",background:i%2?C.bg:C.panel,borderTop:`1px solid ${C.lineSoft}`}}>
              <div style={{fontFamily:mono,fontSize:13,fontWeight:700,color:C.amber}}>{st}</div>
              <div/>
              <div style={{textAlign:"right"}} className="flex justify-end">
                <input value={mi===undefined?"":mi} onChange={e=>setMi(st,e.target.value)} onBlur={()=>commitMi(st)} inputMode="numeric"
                  style={{width:90,textAlign:"right",background:C.bg,border:`1px solid ${C.line}`,borderRadius:5,color:C.ink,padding:"6px 8px",fontFamily:mono,fontSize:12}}/>
              </div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{gal?gal.toFixed(1):"—"}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{taxGal?taxGal.toFixed(1):"—"}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,fontWeight:600,color:net>0?C.red:C.green}}>{net?(net>0?"+":"")+net.toFixed(1):"—"}</div>
            </div>
          );
        })}
        <div className="grid" style={{gridTemplateColumns:"70px 1fr 110px 110px 110px 90px",gap:8,padding:"10px 13px",background:C.panel2,borderTop:`2px solid ${C.line}`,alignItems:"center"}}>
          <div style={{fontFamily:sans,fontSize:11,letterSpacing:.6,textTransform:"uppercase",color:C.amber,fontWeight:700,gridColumn:"1 / 3"}}>Total</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:milesEntered!==totalMiles?C.amber:C.dim}}>{fmt0(milesEntered)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{totGal?totGal.toFixed(1):"—"}</div>
          <div/><div/>
        </div>
      </div>
      <div className="flex items-center" style={{gap:8,marginBottom:18}}>
        <select value={addState} onChange={e=>setAddState(e.target.value)} style={{...selStyle}}>
          <option value="">Add a state…</option>
          {US_STATES.filter(s=>!(s in miles)).map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={addJuris} disabled={!addState} style={{fontFamily:mono,fontSize:11.5,fontWeight:700,color:C.bg,background:addState?C.amber:C.faint,border:"none",borderRadius:6,padding:"8px 13px",cursor:addState?"pointer":"default"}}>Add</button>
        {milesEntered>0 && milesEntered!==totalMiles && <span style={{fontFamily:mono,fontSize:10.5,color:C.amber}}>miles entered ({fmt0(milesEntered)}) ≠ loaded miles ({fmt0(totalMiles)})</span>}
      </div>

      {/* Fuel log */}
      <Label style={{fontSize:11,marginBottom:8}}>Fuel log · {quarterLabel(q)}</Label>
      <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:12,marginBottom:10}}>
        <div className="flex" style={{gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={{...inp,width:140}}/>
          <select value={form.state} onChange={e=>setForm({...form,state:e.target.value})} style={{...inp}}>
            <option value="">State</option>{US_STATES.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <input value={form.gallons} onChange={e=>setForm({...form,gallons:e.target.value})} placeholder="gallons" inputMode="decimal" style={{...inp,width:90}}/>
          <input value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="$ amount" inputMode="decimal" style={{...inp,width:100}}/>
          <input value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} placeholder="unit" style={{...inp,width:70}}/>
          <button onClick={submitFuel} disabled={busy||!form.state||!form.gallons} style={{fontFamily:mono,fontSize:12,fontWeight:700,color:C.bg,background:(busy||!form.state||!form.gallons)?C.faint:C.green,border:"none",borderRadius:6,padding:"8px 14px",cursor:"pointer"}}>{busy?"Adding…":"+ Add fuel"}</button>
        </div>
      </div>
      <div style={{border:`1px solid ${C.line}`,borderRadius:10,overflow:"hidden"}}>
        {qFuel.length===0 && <Empty msg="No fuel logged for this quarter yet."/>}
        {qFuel.map((f,i)=>(
          <div key={f.id} className="grid" style={{gridTemplateColumns:"96px 60px 90px 100px 70px 1fr 40px",gap:8,padding:"8px 13px",alignItems:"center",background:i%2?C.bg:C.panel,borderTop:i?`1px solid ${C.lineSoft}`:"none"}}>
            <div style={{fontFamily:mono,fontSize:11.5,color:C.dim}}>{f.date||"—"}</div>
            <div style={{fontFamily:mono,fontSize:12,fontWeight:700,color:C.amber}}>{f.state||"—"}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.ink}}>{f.gallons!=null?Number(f.gallons).toFixed(1)+"g":"—"}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{f.amount!=null?money(f.amount):"—"}</div>
            <div style={{fontFamily:mono,fontSize:11,color:C.faint}}>{f.unit?("#"+f.unit):""}</div>
            <div style={{fontFamily:mono,fontSize:11,color:C.faint,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.driver||""}</div>
            <button onClick={()=>removeFuel(f.id)} style={{...iconBtnS,color:C.red,width:26,height:26}}>×</button>
          </div>
        ))}
      </div>
      <div style={{fontFamily:sans,fontSize:11,color:C.faint,marginTop:10,lineHeight:1.5}}>
        A prep worksheet, not a filing. Taxable gallons = your miles in a state ÷ fleet MPG. Net gal = taxable − bought: <span style={{color:C.red}}>+red</span> means you burned more there than you bought (you likely owe that state), <span style={{color:C.green}}>−green</span> means a credit. Hand these numbers to your filer or enter them in your state portal — per-state tax rates change quarterly and aren't applied here.
      </div>
    </div>
  );
}

/* ============================ NEW LOAD MODAL ============================ */
function NewLoad({onClose,onSave,drivers}){
  const [f,setF]=useState({broker:"",rate:"",miles:"",origin:"",dest:"",driver:"",date:todayISO(),ref:"",
    detention_hours:"",detention_pay:"",lumper:"",accessorial:"",ratecon_received:false,bol_received:false,pod_received:false,doc_link:""});
  const [more,setMore]=useState(false);
  const set=(k,v)=>setF({...f,[k]:v});
  const numOr=(v)=>v!==""&&!isNaN(parseFloat(v))?parseFloat(v):null;
  const rpm=(f.rate&&f.miles)?(parseFloat(f.rate)/parseFloat(f.miles)):null;
  function save(){
    const l={id:uid(),status:f.driver?"Assigned":"Available",date:f.date,broker:f.broker||"Unknown broker",
      rate:numOr(f.rate),miles:numOr(f.miles),
      rpm:rpm,origin:f.origin||null,dest:f.dest||null,driver:f.driver||null,unit:null,pay:null,fuel:null,ref:f.ref||null,
      detention_hours:numOr(f.detention_hours),detention_pay:numOr(f.detention_pay),lumper:numOr(f.lumper),accessorial:numOr(f.accessorial),
      ratecon_received:f.ratecon_received,bol_received:f.bol_received,pod_received:f.pod_received,doc_link:f.doc_link||null};
    onSave(l);
  }
  const inp={width:"100%",background:C.bg,border:`1px solid ${C.line}`,borderRadius:6,color:C.ink,padding:"9px 11px",fontFamily:mono,fontSize:12.5};
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#000000aa",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:12,padding:18,width:"100%",maxWidth:440,maxHeight:"90vh",overflowY:"auto"}}>
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
          <div className="col-span-2"><Label style={{marginBottom:4}}>Ref / load #</Label><input style={inp} value={f.ref} onChange={e=>set("ref",e.target.value)} placeholder="PO / pro number"/></div>
        </div>

        <button onClick={()=>setMore(!more)} style={{marginTop:14,fontFamily:sans,fontSize:12,fontWeight:600,color:C.dim,background:C.panel2,border:`1px solid ${C.line}`,borderRadius:8,padding:"9px 12px",cursor:"pointer",width:"100%",textAlign:"left"}}>
          {more?"▾":"▸"} Paperwork &amp; extras (optional)
        </button>
        {more && (
          <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:10}}>
            <div className="flex items-center" style={{gap:7,flexWrap:"wrap"}}>
              <Label style={{fontSize:9,marginRight:2}}>Received</Label>
              <DocChip label="Rate con" on={f.ratecon_received} onClick={()=>set("ratecon_received",!f.ratecon_received)}/>
              <DocChip label="BOL" on={f.bol_received} onClick={()=>set("bol_received",!f.bol_received)}/>
              <DocChip label="POD" on={f.pod_received} onClick={()=>set("pod_received",!f.pod_received)}/>
            </div>
            <div className="grid grid-cols-2" style={{gap:10}}>
              <div><Label style={{marginBottom:4}}>Detention hrs</Label><input style={inp} value={f.detention_hours} onChange={e=>set("detention_hours",e.target.value)} inputMode="decimal"/></div>
              <div><Label style={{marginBottom:4}}>Detention $</Label><input style={inp} value={f.detention_pay} onChange={e=>set("detention_pay",e.target.value)} inputMode="decimal"/></div>
              <div><Label style={{marginBottom:4}}>Lumper $</Label><input style={inp} value={f.lumper} onChange={e=>set("lumper",e.target.value)} inputMode="decimal"/></div>
              <div><Label style={{marginBottom:4}}>Other accessorial $</Label><input style={inp} value={f.accessorial} onChange={e=>set("accessorial",e.target.value)} inputMode="decimal"/></div>
              <div className="col-span-2"><Label style={{marginBottom:4}}>Paperwork link</Label><input style={inp} value={f.doc_link} onChange={e=>set("doc_link",e.target.value)} placeholder="Drive / Dropbox URL"/></div>
            </div>
            {(numOr(f.detention_pay)||numOr(f.lumper)||numOr(f.accessorial)) && f.rate &&
              <div style={{fontFamily:mono,fontSize:11,color:C.green}}>Billable incl. extras: {money((numOr(f.rate)||0)+(numOr(f.detention_pay)||0)+(numOr(f.lumper)||0)+(numOr(f.accessorial)||0))}</div>}
          </div>
        )}

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
const NAV=[["board","Board"],["loads","Loads"],["drivers","Drivers"],["pnl","Weekly P&L"],["monthly","Monthly P&L"],["billing","Billing"],["settlements","Settlements"],["ifta","IFTA"],["lanes","Lane Book"],["inbox","Rate Cons"],["chat","Team"],["copilot","Copilot"]];
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
        {view==="loads" && <Ledger loads={loads} patchLoad={patchLoad}/>}
        {view==="drivers" && <Drivers loads={loads}/>}
        {view==="pnl" && <WeeklyPnL loads={loads}/>}
        {view==="monthly" && <MonthlyPnL loads={loads}/>}
        {view==="billing" && <Billing loads={loads} patchLoad={patchLoad}/>}
        {view==="settlements" && <Settlements loads={loads} patchLoad={patchLoad}/>}
        {view==="ifta" && <Ifta loads={loads}/>}
        {view==="lanes" && <LaneBook loads={loads}/>}
        {view==="inbox" && <RateCons onAdd={addLoad} onChanged={refresh}/>}
        {view==="chat" && <Chat loads={loads}/>}
        {view==="copilot" && <Copilot loads={loads}/>}
      </div>

      {showNew && <NewLoad drivers={drivers} onClose={()=>setShowNew(false)} onSave={l=>{addLoad(l);setShowNew(false);setView("board");}}/>}
    </div>
  );
}
