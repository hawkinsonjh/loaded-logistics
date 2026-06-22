import React, { useState, useEffect, useMemo, useRef } from "react";
import * as api from "./api";

/* ============================ DATA ============================ */
const SEED: any[] = [];

/* ============================ TOKENS ============================ */
const C = {
  bg:"#0E1116", panel:"#161B22", panel2:"#1C222B", raised:"#222933",
  line:"#2A323D", lineSoft:"#222932",
  ink:"#E9ECF1", dim:"#8B95A3", faint:"#5E6675",
  amber:"#F2A413", amberHi:"#FFB740",
  green:"#36D399", greenDim:"#1f6b50",
  red:"#F0594C", redDim:"#6b2722",
  blue:"#4DA3FF", purple:"#A78BFA",
};
const LANES = ["Available","Assigned","In Transit","Delivered"];
const DRIVER_ORDER = ["TJ","John","Chris","Jeremy","Derek"];
const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const sans = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

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
function Ledger({loads}){
  const [q,setQ]=useState(""); const [drv,setDrv]=useState("all"); const [sort,setSort]=useState("date");
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
          {rows.map((l,idx)=>{const rpm=computeRpm(l);return(
            <div key={l.id} className="grid grid-cols-2 md:grid-cols-none" style={{gridTemplateColumns:"80px 1fr 92px 56px 52px 70px 64px 64px 60px 66px",
              gap:8,padding:"9px 12px",background:idx%2?C.bg:C.panel,borderTop:`1px solid ${C.lineSoft}`,alignItems:"center"}}>
              <div style={{fontFamily:mono,fontSize:11.5,color:C.dim}}>{(l.date||"").slice(5)}</div>
              <div style={{fontFamily:sans,fontSize:12.5,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.broker||"—"}</div>
              <div style={{fontFamily:mono,fontSize:11.5,color:C.dim}}>{l.driver||"—"}{l.unit?(" · "+l.unit):""}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,fontWeight:600,color:rpmColor(rpm)}}>{rpm!=null?"$"+rpm.toFixed(2):"—"}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{fmt0(l.miles)}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:C.ink}}>{money(l.rate)}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(l.pay)}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(l.fuel)}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:C.dim}}>{l.dispatch?money(l.dispatch):"—"}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:l.repair?C.amber:C.dim}}>{l.repair?money(l.repair):"—"}</div>
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

/* ============================ RATE CON INBOX ============================ */
function Inbox({onAdd}){
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
    return {active,drivers};
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

/* ============================ NEW LOAD MODAL ============================ */
function NewLoad({onClose,onSave,drivers}){
  const [f,setF]=useState({broker:"",rate:"",miles:"",origin:"",dest:"",driver:"",date:todayISO()});
  const set=(k,v)=>setF({...f,[k]:v});
  const rpm=(f.rate&&f.miles)?(parseFloat(f.rate)/parseFloat(f.miles)):null;
  function save(){
    const l={id:uid(),status:f.driver?"Assigned":"Available",date:f.date,broker:f.broker||"Unknown broker",
      rate:f.rate?parseFloat(f.rate):null,miles:f.miles?parseFloat(f.miles):null,
      rpm:rpm,origin:f.origin||null,dest:f.dest||null,driver:f.driver||null,unit:null,pay:null,fuel:null,ref:null};
    onSave(l);
  }
  const inp={width:"100%",background:C.bg,border:`1px solid ${C.line}`,borderRadius:6,color:C.ink,padding:"9px 11px",fontFamily:mono,fontSize:12.5};
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#000000aa",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:12,padding:18,width:"100%",maxWidth:440}}>
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
        </div>
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
const NAV=[["board","Board"],["loads","Loads"],["drivers","Drivers"],["pnl","Weekly P&L"],["monthly","Monthly P&L"],["lanes","Lane Book"],["inbox","Rate Cons"],["chat","Team"],["copilot","Copilot"]];
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
        {view==="loads" && <Ledger loads={loads}/>}
        {view==="drivers" && <Drivers loads={loads}/>}
        {view==="pnl" && <WeeklyPnL loads={loads}/>}
        {view==="monthly" && <MonthlyPnL loads={loads}/>}
        {view==="lanes" && <LaneBook loads={loads}/>}
        {view==="inbox" && <Inbox onAdd={addLoad}/>}
        {view==="chat" && <Chat loads={loads}/>}
        {view==="copilot" && <Copilot loads={loads}/>}

        {view==="inbox" && (
          <div style={{marginTop:16,maxWidth:760,fontFamily:sans,fontSize:11.5,color:C.faint,lineHeight:1.5,borderTop:`1px solid ${C.lineSoft}`,paddingTop:12}}>
            Paste-to-extract works now. Phase 2 wires your two Gmail inboxes so rate cons land here automatically — the extractor here is the same parser the email worker will use.
          </div>
        )}
      </div>

      {showNew && <NewLoad drivers={drivers} onClose={()=>setShowNew(false)} onSave={l=>{addLoad(l);setShowNew(false);setView("board");}}/>}
    </div>
  );
}
