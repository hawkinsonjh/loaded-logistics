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

/* ============================ RECRUITING ============================ */
const CAND_STATUSES=["New","Contacted","Interview","Offer","Hired","Rejected"];
const CAND_STATUS_COLOR={New:C.faint,Contacted:C.amber,Interview:C.blue,Offer:C.purple,Hired:C.green,Rejected:C.red};
const CAND_ADVANCE={New:["Contact","Contacted"],Contacted:["Set Interview","Interview"],Interview:["Make Offer","Offer"],Offer:["Hire","Hired"]};
const PLATFORMS=["Facebook","Instagram","LinkedIn","Twitter/X"];
const TOPICS=["Driver Recruiting","Performance Highlight","Lane Spotlight","Company Culture","Milestone"];

function AddCandidateModal({onClose,onSave}){
  const [f,setF]=useState({name:"",phone:"",cdl_class:"A",experience:"",source:"Facebook",notes:""});
  const set=(k,v)=>setF({...f,[k]:v});
  const inp={width:"100%",background:C.bg,border:`1px solid ${C.line}`,borderRadius:6,color:C.ink,padding:"8px 10px",fontFamily:mono,fontSize:12.5};
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#000000aa",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:12,padding:18,width:"100%",maxWidth:420}}>
        <div style={{fontFamily:sans,fontSize:15,fontWeight:700,color:C.ink,marginBottom:14}}>Add candidate</div>
        <div className="grid grid-cols-2" style={{gap:10}}>
          <div className="col-span-2"><Label style={{marginBottom:4}}>Name *</Label><input style={inp} value={f.name} onChange={e=>set("name",e.target.value)} autoFocus/></div>
          <div><Label style={{marginBottom:4}}>Phone</Label><input style={inp} value={f.phone} onChange={e=>set("phone",e.target.value)} inputMode="tel"/></div>
          <div><Label style={{marginBottom:4}}>Source</Label>
            <select style={{...inp,color:C.ink}} value={f.source} onChange={e=>set("source",e.target.value)}>
              {["Facebook","Indeed","Referral","LinkedIn","Walk-in","Other"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div><Label style={{marginBottom:4}}>CDL class</Label>
            <select style={{...inp,color:C.ink}} value={f.cdl_class} onChange={e=>set("cdl_class",e.target.value)}>
              <option value="A">Class A</option><option value="B">Class B</option>
            </select>
          </div>
          <div><Label style={{marginBottom:4}}>Experience (yrs)</Label><input style={inp} value={f.experience} onChange={e=>set("experience",e.target.value)} inputMode="numeric"/></div>
          <div className="col-span-2"><Label style={{marginBottom:4}}>Notes</Label><textarea style={{...inp,resize:"vertical"}} rows={2} value={f.notes} onChange={e=>set("notes",e.target.value)}/></div>
        </div>
        <div className="flex justify-end" style={{gap:8,marginTop:14}}>
          <button onClick={onClose} style={{fontFamily:mono,fontSize:12,color:C.dim,background:C.raised,border:`1px solid ${C.line}`,borderRadius:7,padding:"8px 14px",cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>f.name.trim()&&onSave(f)} disabled={!f.name.trim()}
            style={{fontFamily:mono,fontSize:12,fontWeight:700,color:C.bg,background:f.name.trim()?C.amber:C.faint,border:"none",borderRadius:7,padding:"8px 18px",cursor:f.name.trim()?"pointer":"default"}}>
            Add to pipeline
          </button>
        </div>
      </div>
    </div>
  );
}

function CandidateRow({c,onPatch,onDelete}){
  const col=CAND_STATUS_COLOR[c.status]||C.faint;
  const advance=CAND_ADVANCE[c.status];
  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 54px 48px 80px 1fr auto",gap:8,padding:"9px 12px",
      alignItems:"center",borderTop:`1px solid ${C.lineSoft}`,borderLeft:`3px solid ${col}`}}>
      <div>
        <div style={{fontFamily:sans,fontSize:13,fontWeight:600,color:C.ink}}>{c.name}</div>
        {c.notes && <div style={{fontFamily:mono,fontSize:10.5,color:C.faint,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:200}}>{c.notes}</div>}
      </div>
      <Pill color={C.dim}>CDL-{c.cdl_class||"A"}</Pill>
      <div style={{fontFamily:mono,fontSize:11,color:C.faint,textAlign:"center"}}>{c.experience!=null?c.experience+"yr":"—"}</div>
      <div style={{fontFamily:mono,fontSize:11,color:C.dim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.source||"—"}</div>
      <div style={{fontFamily:mono,fontSize:11,color:C.faint,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.notes||""}</div>
      <div className="flex items-center" style={{gap:5}}>
        {advance && (
          <button onClick={()=>onPatch(c.id,{status:advance[1]})}
            style={{fontFamily:mono,fontSize:10.5,fontWeight:700,color:C.bg,background:CAND_STATUS_COLOR[advance[1]]||C.amber,
              border:"none",borderRadius:5,padding:"4px 8px",cursor:"pointer",whiteSpace:"nowrap"}}>
            {advance[0]} ›
          </button>
        )}
        {c.status!=="Hired"&&c.status!=="Rejected"&&(
          <button onClick={()=>onPatch(c.id,{status:"Rejected"})}
            style={{fontFamily:mono,fontSize:10.5,color:C.red,background:C.raised,border:`1px solid ${C.line}`,borderRadius:5,padding:"4px 7px",cursor:"pointer"}}>
            ✕
          </button>
        )}
        <IconBtn title="Remove" onClick={()=>onDelete(c.id)} danger>×</IconBtn>
      </div>
    </div>
  );
}

function Recruiting({loads}){
  const [section,setSection]=useState("pipeline");

  /* --- pipeline --- */
  const [candidates,setCandidates]=useState([]);
  const [statusFilter,setStatusFilter]=useState("active");
  const [showAdd,setShowAdd]=useState(false);
  const [cLoading,setCLoading]=useState(true);

  useEffect(()=>{ loadCands(); },[]);
  async function loadCands(){
    setCLoading(true);
    try{ setCandidates(await api.getCandidates()); }catch(e){}
    setCLoading(false);
  }
  async function addCand(data){
    try{ const row=await api.createCandidate({...data,experience:data.experience?parseInt(data.experience):null}); setCandidates(cs=>[row,...cs]); }
    catch(e){}
    setShowAdd(false);
  }
  async function patchCand(id,patch){
    setCandidates(cs=>cs.map(c=>c.id===id?{...c,...patch}:c));
    try{ const row=await api.patchCandidate(id,patch); setCandidates(cs=>cs.map(c=>c.id===id?row:c)); }
    catch{ loadCands(); }
  }
  async function deleteCand(id){
    setCandidates(cs=>cs.filter(c=>c.id!==id));
    try{ await api.deleteCandidate(id); }catch{ loadCands(); }
  }
  const filtered=useMemo(()=>{
    if(statusFilter==="active") return candidates.filter(c=>c.status!=="Hired"&&c.status!=="Rejected");
    return candidates.filter(c=>c.status===statusFilter);
  },[candidates,statusFilter]);
  const counts=useMemo(()=>{
    const m={active:0};
    candidates.forEach(c=>{ m[c.status]=(m[c.status]||0)+1; if(c.status!=="Hired"&&c.status!=="Rejected") m.active++; });
    return m;
  },[candidates]);

  /* --- social content --- */
  const [platform,setPlatform]=useState("Facebook");
  const [topic,setTopic]=useState("Driver Recruiting");
  const [generating,setGenerating]=useState(false);
  const [genResult,setGenResult]=useState(null);
  const [genErr,setGenErr]=useState("");
  const [copied,setCopied]=useState(false);

  async function generate(){
    setGenerating(true); setGenErr(""); setGenResult(null); setCopied(false);
    try{ setGenResult(await api.generateSocialPost(platform,topic)); }
    catch{ setGenErr("Generation failed — check that ANTHROPIC_API_KEY is set."); }
    setGenerating(false);
  }
  function copyPost(){
    if(!genResult) return;
    const text=genResult.post+(genResult.hashtags.length?"\n\n"+genResult.hashtags.join(" "):"");
    navigator.clipboard.writeText(text).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000); });
  }

  /* --- recruiting agent --- */
  const [goal,setGoal]=useState("");
  const [executing,setExecuting]=useState(false);
  const [execResult,setExecResult]=useState(null);
  const [execErr,setExecErr]=useState("");
  const [showTrace,setShowTrace]=useState(false);

  async function execute(){
    if(!goal.trim()||executing) return;
    setExecuting(true); setExecErr(""); setExecResult(null); setShowTrace(false);
    try{ const r=await api.runRecruitingAgent(goal.trim()); setExecResult(r); loadCands(); }
    catch{ setExecErr("Agent failed — check that ANTHROPIC_API_KEY is set."); }
    setExecuting(false);
  }

  /* section nav */
  const tabs=[["pipeline","Pipeline"],["content","Social Content"],["agent","Recruiting Agent"]];

  return (
    <div>
      {/* Section nav */}
      <div className="flex" style={{gap:3,background:C.panel,border:`1px solid ${C.line}`,borderRadius:9,padding:3,marginBottom:14,width:"fit-content"}}>
        {tabs.map(([id,label])=>(
          <button key={id} onClick={()=>setSection(id)} style={{fontFamily:mono,fontSize:12,fontWeight:700,letterSpacing:.3,
            color:section===id?C.bg:C.dim,background:section===id?C.amber:"transparent",
            border:"none",borderRadius:6,padding:"6px 14px",cursor:"pointer",whiteSpace:"nowrap"}}>
            {label}
          </button>
        ))}
      </div>

      {/* ===================== PIPELINE ===================== */}
      {section==="pipeline" && (
        <div>
          <div className="flex flex-wrap items-center justify-between" style={{gap:10,marginBottom:12}}>
            <div className="flex flex-wrap items-center" style={{gap:6}}>
              {[["active","Active"],["New","New"],["Contacted","Contacted"],["Interview","Interview"],["Offer","Offer"],["Hired","Hired"],["Rejected","Rejected"]].map(([v,label])=>{
                const on=statusFilter===v;
                const c=v==="active"?C.amber:(CAND_STATUS_COLOR[v]||C.faint);
                return (
                  <button key={v} onClick={()=>setStatusFilter(v)}
                    style={{fontFamily:mono,fontSize:11,fontWeight:600,letterSpacing:.3,
                      color:on?C.bg:C.dim,background:on?c:C.panel,border:`1px solid ${on?c:C.line}`,
                      borderRadius:20,padding:"4px 10px",cursor:"pointer",whiteSpace:"nowrap"}}>
                    {label}{counts[v]!=null?` · ${counts[v]}`:""}
                  </button>
                );
              })}
            </div>
            <button onClick={()=>setShowAdd(true)}
              style={{fontFamily:mono,fontSize:12,fontWeight:700,color:C.bg,background:C.amber,
                border:"none",borderRadius:6,padding:"7px 13px",cursor:"pointer"}}>
              + Add candidate
            </button>
          </div>

          <div style={{border:`1px solid ${C.line}`,borderRadius:9,overflow:"hidden"}}>
            <div className="hidden md:grid" style={{gridTemplateColumns:"1fr 54px 48px 80px 1fr auto",
              background:C.panel2,padding:"8px 12px",gap:8}}>
              {["Name","CDL","Exp","Source","Notes",""].map((h,i)=>(
                <div key={i} style={{fontFamily:sans,fontSize:10,letterSpacing:1,textTransform:"uppercase",color:C.faint}}>{h}</div>
              ))}
            </div>
            {cLoading && (
              <div style={{fontFamily:mono,fontSize:12,color:C.faint,textAlign:"center",padding:"28px 0"}}>Loading…</div>
            )}
            {!cLoading && filtered.length===0 && (
              <div style={{fontFamily:mono,fontSize:12,color:C.faint,textAlign:"center",padding:"28px 0",background:C.panel}}>
                {statusFilter==="active"?"No active candidates — add one above.":"Nothing here."}
              </div>
            )}
            {filtered.map((c,i)=>(
              <div key={c.id} style={{background:i%2?C.bg:C.panel}}>
                <CandidateRow c={c} onPatch={patchCand} onDelete={deleteCand}/>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================== SOCIAL CONTENT ===================== */}
      {section==="content" && (
        <div className="flex flex-col lg:flex-row" style={{gap:14,alignItems:"flex-start"}}>
          <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:14,flex:1,minWidth:0}}>
            <div style={{fontFamily:sans,fontSize:15,fontWeight:700,color:C.ink,marginBottom:4}}>Social content generator</div>
            <div style={{fontFamily:sans,fontSize:12.5,color:C.dim,marginBottom:14,lineHeight:1.4}}>
              Generates platform-specific posts using your real fleet metrics — actual RPM, lane data, driver count. Copy and post directly to your accounts.
            </div>

            <Label style={{marginBottom:8}}>Platform</Label>
            <div className="flex flex-wrap" style={{gap:6,marginBottom:14}}>
              {PLATFORMS.map(p=>(
                <button key={p} onClick={()=>setPlatform(p)}
                  style={{fontFamily:mono,fontSize:12,fontWeight:600,color:platform===p?C.bg:C.dim,
                    background:platform===p?C.blue:C.panel2,border:`1px solid ${platform===p?C.blue:C.line}`,
                    borderRadius:20,padding:"5px 13px",cursor:"pointer"}}>
                  {p}
                </button>
              ))}
            </div>

            <Label style={{marginBottom:8}}>Topic</Label>
            <div className="flex flex-wrap" style={{gap:6,marginBottom:16}}>
              {TOPICS.map(t=>(
                <button key={t} onClick={()=>setTopic(t)}
                  style={{fontFamily:mono,fontSize:11.5,fontWeight:600,color:topic===t?C.bg:C.dim,
                    background:topic===t?C.amber:C.panel2,border:`1px solid ${topic===t?C.amber:C.line}`,
                    borderRadius:20,padding:"5px 13px",cursor:"pointer"}}>
                  {t}
                </button>
              ))}
            </div>

            <button onClick={generate} disabled={generating}
              style={{fontFamily:mono,fontSize:12.5,fontWeight:700,color:C.bg,
                background:generating?C.faint:C.purple,border:"none",borderRadius:7,
                padding:"9px 20px",cursor:generating?"default":"pointer"}}>
              {generating?"Generating…":"Generate post"}
            </button>

            {genErr && <div style={{color:C.red,fontFamily:mono,fontSize:11.5,marginTop:10}}>{genErr}</div>}

            {genResult && (
              <div style={{marginTop:14,display:"flex",flexDirection:"column",gap:10}}>
                <div style={{background:C.panel2,border:`1px solid ${C.line}`,borderRadius:8,padding:"12px 14px"}}>
                  <div className="flex items-center justify-between" style={{marginBottom:8}}>
                    <Pill color={C.blue}>{platform}</Pill>
                    <button onClick={copyPost}
                      style={{fontFamily:mono,fontSize:11,fontWeight:700,color:copied?C.green:C.dim,
                        background:C.raised,border:`1px solid ${C.line}`,borderRadius:6,padding:"4px 10px",cursor:"pointer"}}>
                      {copied?"✓ Copied":"Copy"}
                    </button>
                  </div>
                  <div style={{fontFamily:sans,fontSize:13.5,color:C.ink,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{genResult.post}</div>
                </div>
                {genResult.hashtags.length>0 && (
                  <div style={{background:C.panel2,border:`1px solid ${C.line}`,borderRadius:8,padding:"10px 12px"}}>
                    <Label style={{marginBottom:8}}>Hashtags</Label>
                    <div className="flex flex-wrap" style={{gap:5}}>
                      {genResult.hashtags.map((h,i)=>(
                        <span key={i} style={{fontFamily:mono,fontSize:11,color:C.blue,background:C.blue+"15",
                          border:`1px solid ${C.blue}33`,borderRadius:4,padding:"3px 7px"}}>{h}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{width:"100%",maxWidth:280,background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:14,flexShrink:0}}>
            <Label style={{marginBottom:10}}>Post ideas by platform</Label>
            {[
              ["Facebook","Driver Recruiting","Best for reaching local CDL holders"],
              ["Instagram","Lane Spotlight","Visual appeal — tag your region"],
              ["LinkedIn","Performance Highlight","Attracts experienced O/O and fleet buyers"],
              ["Twitter/X","Driver Recruiting","Fast reach — keep it punchy"],
            ].map(([pl,tp,note],i)=>(
              <div key={i} onClick={()=>{ setPlatform(pl); setTopic(tp); }}
                style={{padding:"8px 10px",background:C.panel2,border:`1px solid ${C.line}`,borderRadius:7,
                  marginBottom:7,cursor:"pointer"}}>
                <div style={{fontFamily:mono,fontSize:11.5,color:C.amber,fontWeight:700}}>{pl} · {tp}</div>
                <div style={{fontFamily:sans,fontSize:11,color:C.faint,marginTop:2}}>{note}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================== RECRUITING AGENT ===================== */}
      {section==="agent" && (
        <div className="flex flex-col lg:flex-row" style={{gap:14,alignItems:"flex-start"}}>
          <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:14,flex:1,minWidth:0}}>
            <div style={{fontFamily:sans,fontSize:15,fontWeight:700,color:C.ink,marginBottom:4}}>Recruiting agent</div>
            <div style={{fontFamily:sans,fontSize:12.5,color:C.dim,marginBottom:12,lineHeight:1.4}}>
              Give a goal. The agent reviews your candidate pipeline, analyzes fleet hiring needs, advances candidates through the pipeline, and drafts personalised outreach — all autonomously.
            </div>

            <div style={{background:C.raised,border:`1px solid ${C.amber}55`,borderRadius:8,padding:"8px 10px",marginBottom:12}}>
              <div style={{fontFamily:mono,fontSize:10,letterSpacing:.8,textTransform:"uppercase",color:C.amber,marginBottom:3}}>Makes real changes</div>
              <div style={{fontFamily:sans,fontSize:11.5,color:C.dim,lineHeight:1.4}}>
                Can add or update candidates, draft outreach messages, and flag hiring needs. Actions take effect immediately.
              </div>
            </div>

            <textarea value={goal} onChange={e=>setGoal(e.target.value)} rows={4}
              placeholder={"Examples:\n• Review all New candidates and advance the most promising ones\n• Draft outreach texts for everyone in the Contacted stage\n• Analyze how many drivers we need and prioritise the best candidates"}
              style={{width:"100%",background:C.bg,border:`1px solid ${C.line}`,borderRadius:7,color:C.ink,
                padding:10,fontFamily:mono,fontSize:12,resize:"vertical",lineHeight:1.5}}/>

            <button onClick={execute} disabled={executing||!goal.trim()}
              style={{width:"100%",marginTop:8,fontFamily:mono,fontSize:12.5,fontWeight:700,
                color:C.bg,background:(executing||!goal.trim())?C.faint:C.purple,
                border:"none",borderRadius:7,padding:"9px",cursor:(executing||!goal.trim())?"default":"pointer"}}>
              {executing?"Running agent…":"Run recruiting agent"}
            </button>

            {execErr && <div style={{color:C.red,fontFamily:mono,fontSize:11.5,marginTop:8}}>{execErr}</div>}

            {execResult && (
              <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
                <div style={{background:C.panel2,border:`1px solid ${C.green}55`,borderRadius:8,padding:"10px 12px"}}>
                  <Label style={{marginBottom:6,color:C.green}}>Completed</Label>
                  <div style={{fontFamily:sans,fontSize:13,color:C.ink,lineHeight:1.5,whiteSpace:"pre-wrap"}}>{execResult.summary}</div>
                </div>

                {execResult.actions.length>0 && (
                  <div style={{background:C.panel2,border:`1px solid ${C.line}`,borderRadius:8,padding:"10px 12px"}}>
                    <Label style={{marginBottom:8}}>Actions taken · {execResult.actions.length}</Label>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {execResult.actions.map((a,i)=>(
                        <div key={i} style={{background:C.bg,borderRadius:6,padding:"6px 9px",fontFamily:mono,fontSize:11,lineHeight:1.4}}>
                          <div>
                            <span style={{color:C.amber}}>
                              {a.type==="add_candidate"?"Added candidate":
                               a.type==="update_candidate"?"Updated candidate":
                               a.type==="draft_outreach"?"Drafted outreach":a.type}
                            </span>
                            {(a.data?.name||a.name) && <span style={{color:C.ink}}> · {a.data?.name||a.name}</span>}
                          </div>
                          {a.reason && <div style={{color:C.dim,marginTop:2}}>{a.reason}</div>}
                          {a.patch?.status && <div style={{color:C.faint,marginTop:1}}>→ {a.patch.status}</div>}
                          {a.message && (
                            <div style={{color:C.dim,marginTop:3,fontFamily:sans,fontSize:11.5,
                              background:C.panel,borderRadius:4,padding:"4px 7px",whiteSpace:"pre-wrap",lineHeight:1.4}}>
                              "{a.message}"
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {execResult.trace.length>0 && (
                  <>
                    <button onClick={()=>setShowTrace(!showTrace)}
                      style={{fontFamily:mono,fontSize:11,color:C.dim,background:C.panel2,
                        border:`1px solid ${C.line}`,borderRadius:6,padding:"6px 10px",cursor:"pointer",textAlign:"left"}}>
                      {showTrace?"▾":"▸"} Tool call trace · {execResult.trace.length} steps
                    </button>
                    {showTrace && (
                      <div style={{background:C.bg,border:`1px solid ${C.line}`,borderRadius:8,padding:10,
                        maxHeight:240,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
                        {execResult.trace.map((t,i)=>(
                          <div key={i} style={{fontFamily:mono,fontSize:10.5,
                            borderBottom:i<execResult.trace.length-1?`1px solid ${C.lineSoft}`:"none",paddingBottom:6}}>
                            <span style={{color:C.purple}}>{i+1}. {t.tool}</span>
                            <div style={{color:C.faint,marginTop:2,wordBreak:"break-all"}}>
                              in: {JSON.stringify(t.input).slice(0,80)}{JSON.stringify(t.input).length>80?"…":""}
                            </div>
                            <div style={{color:C.dim,marginTop:2,wordBreak:"break-all"}}>
                              → {String(t.result).slice(0,100)}{String(t.result).length>100?"…":""}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* side tip card */}
          <div style={{width:"100%",maxWidth:280,background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:14,flexShrink:0}}>
            <Label style={{marginBottom:10}}>What the agent can do</Label>
            {[
              ["Review pipeline","Check all candidates and advance the strongest ones to Interview or Offer."],
              ["Draft outreach","Write personalised texts, emails, or DMs for each candidate using real fleet data."],
              ["Analyse hiring needs","Compare truck count vs active drivers to determine how many seats to fill."],
              ["Add candidates","Create new pipeline entries from a sourcing run or job fair list."],
            ].map(([title,desc],i)=>(
              <div key={i} style={{padding:"8px 10px",background:C.panel2,border:`1px solid ${C.line}`,borderRadius:7,marginBottom:7}}>
                <div style={{fontFamily:mono,fontSize:11.5,color:C.amber,fontWeight:700}}>{title}</div>
                <div style={{fontFamily:sans,fontSize:11,color:C.faint,marginTop:2,lineHeight:1.4}}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAdd && <AddCandidateModal onClose={()=>setShowAdd(false)} onSave={addCand}/>}
    </div>
  );
}

/* ============================ EMAIL ============================ */
function Email({loads}){
  const [inbox,setInbox]=useState([]);
  const [loading,setLoading]=useState(false);
  const [selectedId,setSelectedId]=useState(null);
  const [thread,setThread]=useState(null);
  const [threadLoading,setThreadLoading]=useState(false);
  const [showCompose,setShowCompose]=useState(false);
  const [composeBroker,setComposeBroker]=useState("");
  const [composeTo,setComposeTo]=useState("");
  const [composeSubject,setComposeSubject]=useState("");
  const [composeContext,setComposeContext]=useState("");
  const [draftText,setDraftText]=useState("");
  const [drafting,setDrafting]=useState(false);
  const [saving,setSaving]=useState(false);
  const [saveMsg,setSaveMsg]=useState("");
  const [searchQ,setSearchQ]=useState("");
  const [err,setErr]=useState("");

  const boardBrokers=useMemo(()=>{
    const seen=new Set();
    return loads.filter(l=>l.broker&&!seen.has(l.broker)&&seen.add(l.broker)).map(l=>l.broker);
  },[loads]);

  async function loadInbox(q=""){
    setLoading(true); setErr("");
    try{ const data=await api.getGmailInbox(q,20); setInbox(data); }
    catch(e){ setErr("Gmail: "+String(e).replace("Error: ","")); }
    setLoading(false);
  }

  useEffect(()=>{ loadInbox(); },[]);

  async function openThread(t){
    setSelectedId(t.id); setShowCompose(false); setThread(null); setThreadLoading(true); setErr("");
    try{
      const data=await api.getGmailThread(t.id); setThread(data);
    }catch(e){ setErr(String(e)); }
    setThreadLoading(false);
  }

  function startReply(){
    if(!thread) return;
    const brokerMsg=thread.messages.find(m=>!m.isFromMe);
    const fromAddr=brokerMsg?.from||thread.fromAddr||"";
    const email=fromAddr.match(/<(.+)>/)?.[1]||fromAddr;
    setComposeTo(email);
    setComposeSubject("Re: "+thread.subject);
    setComposeBroker(thread.broker||"");
    setComposeContext(""); setDraftText(""); setSaveMsg("");
    setShowCompose(true);
  }

  function startCompose(){
    setSelectedId(null); setThread(null);
    setComposeBroker(""); setComposeTo(""); setComposeSubject(""); setComposeContext(""); setDraftText(""); setSaveMsg("");
    setShowCompose(true);
  }

  async function doDraft(){
    setDrafting(true); setDraftText(""); setErr("");
    try{
      const res=await api.composeEmail(composeBroker,composeTo,composeContext,undefined);
      setDraftText(res.text);
    }catch(e){ setErr(String(e)); }
    setDrafting(false);
  }

  async function doSaveDraft(){
    setSaving(true); setErr("");
    try{
      await api.saveGmailDraft(composeTo,composeSubject||"(Loaded Logistics)",draftText,thread?.id);
      setSaveMsg("Draft saved to Gmail!"); setTimeout(()=>setSaveMsg(""),4000);
    }catch(e){ setErr(String(e)); }
    setSaving(false);
  }

  const panelH={background:C.panel,borderRadius:10,overflow:"hidden",display:"flex",flexDirection:"column" as const};

  return (
    <div style={{display:"flex",gap:12,height:"calc(100vh - 220px)",minHeight:480}}>
      {/* ---- Sidebar: inbox ---- */}
      <div style={{width:300,flexShrink:0,...panelH}}>
        {/* header */}
        <div style={{padding:"11px 13px",borderBottom:`1px solid ${C.line}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
          <Label>Broker Inbox</Label>
          <button onClick={startCompose}
            style={{fontFamily:mono,fontSize:11,color:C.bg,background:C.amber,border:"none",borderRadius:5,padding:"4px 10px",cursor:"pointer"}}>
            + Compose
          </button>
        </div>
        {/* search */}
        <div style={{padding:"8px 12px",borderBottom:`1px solid ${C.lineSoft}`}}>
          <input value={searchQ} onChange={e=>setSearchQ(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&loadInbox(searchQ)}
            placeholder="Search broker emails…"
            style={{width:"100%",background:C.panel2,border:`1px solid ${C.line}`,borderRadius:6,padding:"6px 10px",
              fontFamily:mono,fontSize:11.5,color:C.ink,outline:"none",boxSizing:"border-box"}}/>
        </div>
        {/* list */}
        <div style={{flex:1,overflowY:"auto"}}>
          {loading && <div style={{padding:"14px 14px",fontFamily:mono,fontSize:12,color:C.dim}}>Loading inbox…</div>}
          {!loading && inbox.length===0 && (
            <div style={{padding:16,fontFamily:mono,fontSize:11.5,color:C.faint,lineHeight:1.5}}>
              {err ? err : "No broker threads found. Check Gmail env vars in backend."}
            </div>
          )}
          {inbox.map(t=>(
            <div key={t.id} onClick={()=>openThread(t)}
              style={{padding:"9px 13px",borderBottom:`1px solid ${C.lineSoft}`,cursor:"pointer",
                background:selectedId===t.id?C.panel2:"transparent",
                borderLeft:selectedId===t.id?`3px solid ${C.amber}`:"3px solid transparent",
                transition:"background .1s"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6,marginBottom:2}}>
                <span style={{fontFamily:sans,fontSize:12.5,fontWeight:600,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {t.broker||t.fromAddr.split("<")[0].trim().split("@")[0]}
                </span>
                {t.broker && <Pill color={C.amber} style={{flexShrink:0}}>{t.broker}</Pill>}
              </div>
              <div style={{fontFamily:sans,fontSize:11.5,color:C.dim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.subject}</div>
              <div style={{fontFamily:mono,fontSize:10,color:C.faint,marginTop:2}}>{t.snippet?.slice(0,55)}{t.snippet?.length>55?"…":""}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ---- Main panel ---- */}
      <div style={{flex:1,...panelH}}>
        {/* Error banner */}
        {err && (
          <div style={{padding:"8px 14px",background:C.redDim,borderBottom:`1px solid ${C.red}44`,fontFamily:mono,fontSize:11.5,color:C.red}}>
            {err}
          </div>
        )}

        {/* Thread view */}
        {thread && !showCompose && (
          <>
            <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.line}`,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
              <div style={{minWidth:0}}>
                <div style={{fontFamily:sans,fontSize:14,fontWeight:700,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{thread.subject}</div>
                <div style={{fontFamily:mono,fontSize:10.5,color:C.dim,marginTop:2}}>{thread.fromAddr} · {thread.messageCount} messages</div>
              </div>
              <button onClick={startReply}
                style={{flexShrink:0,fontFamily:mono,fontSize:11.5,fontWeight:700,color:C.bg,background:C.green,
                  border:"none",borderRadius:6,padding:"7px 14px",cursor:"pointer"}}>
                Draft Reply with AI
              </button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
              {thread.messages.map((m,i)=>(
                <div key={m.id} style={{
                  alignSelf:m.isFromMe?"flex-end":"flex-start",
                  maxWidth:"82%",
                  background:m.isFromMe?C.greenDim:C.panel2,
                  borderRadius:8,
                  padding:"9px 13px",
                  border:`1px solid ${m.isFromMe?C.green+"44":C.line}`,
                }}>
                  <div style={{fontFamily:mono,fontSize:9.5,color:C.faint,marginBottom:4,letterSpacing:.3}}>
                    {m.isFromMe?"You":"Broker"} · {m.date?.slice(0,22)||""}
                  </div>
                  <div style={{fontFamily:sans,fontSize:12.5,color:C.ink,whiteSpace:"pre-wrap",wordBreak:"break-word",lineHeight:1.45}}>
                    {m.body.length>1200?m.body.slice(0,1200)+"…":m.body}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Thread loading */}
        {threadLoading && (
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:mono,fontSize:12,color:C.dim}}>
            Loading thread…
          </div>
        )}

        {/* Compose panel */}
        {showCompose && (
          <div style={{flex:1,overflowY:"auto",padding:"16px 20px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <Label>Compose Email</Label>
              <button onClick={()=>{setShowCompose(false);}}
                style={{fontFamily:mono,fontSize:11,color:C.dim,background:"transparent",border:`1px solid ${C.line}`,
                  borderRadius:5,padding:"3px 9px",cursor:"pointer"}}>✕ Close</button>
            </div>

            {/* Broker picker from board */}
            <div style={{marginBottom:12}}>
              <Label style={{marginBottom:5}}>From your board</Label>
              <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
                {boardBrokers.slice(0,10).map(b=>(
                  <button key={b} onClick={()=>setComposeBroker(b)}
                    style={{fontFamily:mono,fontSize:11,color:composeBroker===b?C.bg:C.ink,
                      background:composeBroker===b?C.amber:C.panel2,
                      border:`1px solid ${composeBroker===b?C.amber:C.line}`,
                      borderRadius:5,padding:"4px 10px",cursor:"pointer"}}>
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* To / Subject */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <div>
                <Label style={{marginBottom:4}}>To (email)</Label>
                <input value={composeTo} onChange={e=>setComposeTo(e.target.value)} placeholder="broker@tql.com"
                  style={{width:"100%",background:C.panel2,border:`1px solid ${C.line}`,borderRadius:7,
                    padding:"8px 11px",fontFamily:mono,fontSize:12,color:C.ink,outline:"none",boxSizing:"border-box"}}/>
              </div>
              <div>
                <Label style={{marginBottom:4}}>Subject</Label>
                <input value={composeSubject} onChange={e=>setComposeSubject(e.target.value)} placeholder="Load inquiry"
                  style={{width:"100%",background:C.panel2,border:`1px solid ${C.line}`,borderRadius:7,
                    padding:"8px 11px",fontFamily:mono,fontSize:12,color:C.ink,outline:"none",boxSizing:"border-box"}}/>
              </div>
            </div>

            {/* Context */}
            <div style={{marginBottom:12}}>
              <Label style={{marginBottom:4}}>What do you want to say?</Label>
              <textarea value={composeContext} onChange={e=>setComposeContext(e.target.value)}
                placeholder="e.g., Ask about load from Charlotte to Atlanta on Monday, rate around $1,800…"
                rows={3}
                style={{width:"100%",background:C.panel2,border:`1px solid ${C.line}`,borderRadius:7,
                  padding:"8px 11px",fontFamily:sans,fontSize:13,color:C.ink,outline:"none",
                  resize:"vertical",boxSizing:"border-box"}}/>
            </div>

            <button onClick={doDraft} disabled={drafting||!composeContext.trim()}
              style={{fontFamily:mono,fontSize:13,fontWeight:700,color:C.bg,
                background:(drafting||!composeContext.trim())?C.faint:C.amber,
                border:"none",borderRadius:7,padding:"9px 22px",cursor:(drafting||!composeContext.trim())?"default":"pointer",marginBottom:16}}>
              {drafting?"Drafting…":"Draft with AI"}
            </button>

            {/* Draft result */}
            {draftText && (
              <div>
                <Label style={{marginBottom:6}}>Draft — edit before saving</Label>
                <textarea value={draftText} onChange={e=>setDraftText(e.target.value)}
                  rows={12}
                  style={{width:"100%",background:C.bg,border:`1px solid ${C.line}`,borderRadius:7,
                    padding:"10px 14px",fontFamily:mono,fontSize:12.5,color:C.ink,outline:"none",
                    resize:"vertical",lineHeight:1.5,boxSizing:"border-box"}}/>
                <div style={{display:"flex",alignItems:"center",gap:12,marginTop:8}}>
                  <button onClick={doSaveDraft} disabled={saving}
                    style={{fontFamily:mono,fontSize:13,fontWeight:700,color:C.bg,
                      background:saving?C.faint:C.green,border:"none",borderRadius:7,
                      padding:"9px 20px",cursor:saving?"default":"pointer"}}>
                    {saving?"Saving…":"Save to Gmail Drafts"}
                  </button>
                  {saveMsg && <span style={{fontFamily:mono,fontSize:12,color:C.green}}>{saveMsg}</span>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!thread && !threadLoading && !showCompose && (
          <div style={{flex:1,display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",gap:10}}>
            <div style={{fontFamily:mono,fontSize:13,color:C.faint}}>Select a thread or compose a new email</div>
            <div style={{fontFamily:mono,fontSize:11,color:C.faint,maxWidth:320,textAlign:"center" as const,lineHeight:1.5}}>
              Cross-references your board brokers with Gmail. AI drafts replies in your voice using your past emails as examples.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ AGENTS ============================ */
function Agents({onRefresh}){
  const [analysis,setAnalysis]=useState(null);
  const [analyzing,setAnalyzing]=useState(false);
  const [analysisErr,setAnalysisErr]=useState("");

  const [goal,setGoal]=useState("");
  const [executing,setExecuting]=useState(false);
  const [execResult,setExecResult]=useState(null);
  const [execErr,setExecErr]=useState("");
  const [showTrace,setShowTrace]=useState(false);

  async function analyze(){
    setAnalyzing(true); setAnalysisErr(""); setAnalysis(null);
    try{ setAnalysis(await api.runAnalysis()); }
    catch(e){ setAnalysisErr("Analysis failed — check that ANTHROPIC_API_KEY is set on the backend."); }
    setAnalyzing(false);
  }

  async function execute(){
    if(!goal.trim()||executing) return;
    setExecuting(true); setExecErr(""); setExecResult(null); setShowTrace(false);
    try{
      const r=await api.runExecutorWorkflow(goal.trim());
      setExecResult(r);
      onRefresh();
    }catch(e){ setExecErr("Execution failed — check that ANTHROPIC_API_KEY is set on the backend."); }
    setExecuting(false);
  }

  return (
    <div className="flex flex-col lg:flex-row" style={{gap:14,alignItems:"flex-start"}}>

      {/* ---- Analyst ---- */}
      <div className="flex-1" style={{minWidth:0}}>
        <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:14}}>
          <div className="flex items-start justify-between" style={{marginBottom:12,gap:10}}>
            <div>
              <div style={{fontFamily:sans,fontSize:15,fontWeight:700,color:C.ink}}>Operations analyst</div>
              <div style={{fontFamily:sans,fontSize:12.5,color:C.dim,marginTop:3,lineHeight:1.4}}>
                Reads the full load history and active board, returns a structured critique — flags, risks, and opportunities.
                Read-only: makes no changes.
              </div>
            </div>
            <button onClick={analyze} disabled={analyzing}
              style={{fontFamily:mono,fontSize:12,fontWeight:700,color:C.bg,
                background:analyzing?C.faint:C.amber,border:"none",borderRadius:7,
                padding:"8px 14px",cursor:analyzing?"default":"pointer",whiteSpace:"nowrap",flexShrink:0}}>
              {analyzing?"Analyzing…":"Run analysis"}
            </button>
          </div>

          {analysisErr && <div style={{color:C.red,fontFamily:mono,fontSize:11.5,marginBottom:10}}>{analysisErr}</div>}

          {!analysis && !analyzing && (
            <div style={{fontFamily:mono,fontSize:12,color:C.faint,textAlign:"center",padding:"32px 0",
              border:`1px dashed ${C.line}`,borderRadius:8}}>
              Click "Run analysis" to get an AI critique of current operations.
            </div>
          )}

          {analysis && (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{background:C.panel2,border:`1px solid ${C.line}`,borderRadius:8,padding:"10px 12px"}}>
                <Label style={{marginBottom:6}}>Executive summary</Label>
                <div style={{fontFamily:sans,fontSize:13.5,color:C.ink,lineHeight:1.55}}>{analysis.summary}</div>
              </div>

              {analysis.flags.length>0 && (
                <div style={{background:C.panel2,border:`1px solid ${C.red}44`,borderRadius:8,padding:"10px 12px"}}>
                  <Label style={{marginBottom:8,color:C.red}}>Flags · risks</Label>
                  <div style={{display:"flex",flexDirection:"column",gap:7}}>
                    {analysis.flags.map((f,i)=>(
                      <div key={i} className="flex items-start" style={{gap:9}}>
                        <div style={{width:6,height:6,borderRadius:9,background:C.red,flexShrink:0,marginTop:6}}/>
                        <span style={{fontFamily:sans,fontSize:13,color:C.ink,lineHeight:1.4}}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.opportunities.length>0 && (
                <div style={{background:C.panel2,border:`1px solid ${C.green}44`,borderRadius:8,padding:"10px 12px"}}>
                  <Label style={{marginBottom:8,color:C.green}}>Opportunities</Label>
                  <div style={{display:"flex",flexDirection:"column",gap:7}}>
                    {analysis.opportunities.map((o,i)=>(
                      <div key={i} className="flex items-start" style={{gap:9}}>
                        <div style={{width:6,height:6,borderRadius:9,background:C.green,flexShrink:0,marginTop:6}}/>
                        <span style={{fontFamily:sans,fontSize:13,color:C.ink,lineHeight:1.4}}>{o}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---- Executor ---- */}
      <div style={{width:"100%",maxWidth:400,flexShrink:0}}>
        <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:14}}>
          <div style={{marginBottom:10}}>
            <div style={{fontFamily:sans,fontSize:15,fontWeight:700,color:C.ink}}>Workflow executor</div>
            <div style={{fontFamily:sans,fontSize:12.5,color:C.dim,marginTop:3,lineHeight:1.4}}>
              Give a high-level goal. The agent reads the live board, decides what to do, and executes the changes.
            </div>
          </div>

          <div style={{background:C.raised,border:`1px solid ${C.amber}55`,borderRadius:8,padding:"8px 10px",marginBottom:10}}>
            <div style={{fontFamily:mono,fontSize:10,letterSpacing:.8,textTransform:"uppercase",color:C.amber,marginBottom:3}}>
              Makes real changes
            </div>
            <div style={{fontFamily:sans,fontSize:11.5,color:C.dim,lineHeight:1.4}}>
              This agent can assign drivers, advance statuses, and post team messages. All actions take effect immediately and refresh the board on completion.
            </div>
          </div>

          <textarea value={goal} onChange={e=>setGoal(e.target.value)} rows={5}
            placeholder={"Examples:\n• Assign all available loads to drivers with matching lanes\n• Flag thin-margin active loads and post a warning to the team\n• Post a daily summary of active loads to the team channel"}
            style={{width:"100%",background:C.bg,border:`1px solid ${C.line}`,borderRadius:7,color:C.ink,
              padding:10,fontFamily:mono,fontSize:12,resize:"vertical",lineHeight:1.5}}/>

          <button onClick={execute} disabled={executing||!goal.trim()}
            style={{width:"100%",marginTop:8,fontFamily:mono,fontSize:12.5,fontWeight:700,
              color:C.bg,background:(executing||!goal.trim())?C.faint:C.purple,
              border:"none",borderRadius:7,padding:"9px",cursor:(executing||!goal.trim())?"default":"pointer"}}>
            {executing?"Executing workflow…":"Execute workflow"}
          </button>

          {execErr && <div style={{color:C.red,fontFamily:mono,fontSize:11.5,marginTop:8}}>{execErr}</div>}

          {execResult && (
            <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
              <div style={{background:C.panel2,border:`1px solid ${C.green}55`,borderRadius:8,padding:"10px 12px"}}>
                <Label style={{marginBottom:6,color:C.green}}>Completed</Label>
                <div style={{fontFamily:sans,fontSize:13,color:C.ink,lineHeight:1.45,whiteSpace:"pre-wrap"}}>{execResult.summary}</div>
              </div>

              {execResult.actions.length>0 && (
                <div style={{background:C.panel2,border:`1px solid ${C.line}`,borderRadius:8,padding:"10px 12px"}}>
                  <Label style={{marginBottom:8}}>Actions taken · {execResult.actions.length}</Label>
                  <div style={{display:"flex",flexDirection:"column",gap:5}}>
                    {execResult.actions.map((a,i)=>(
                      <div key={i} style={{fontFamily:mono,fontSize:11,background:C.bg,borderRadius:5,padding:"5px 8px",lineHeight:1.4}}>
                        <span style={{color:C.amber}}>
                          {a.type==="patch_load"?"Updated load":a.type==="post_message"?"Posted message":a.type}
                        </span>
                        {a.reason && <span style={{color:C.dim}}> · {a.reason}</span>}
                        {a.patch && <div style={{color:C.faint,marginTop:2}}>{Object.entries(a.patch).map(([k,v])=>`${k}=${v}`).join(", ")}</div>}
                        {a.body && <div style={{color:C.faint,marginTop:2}}>"{String(a.body).slice(0,60)}{String(a.body).length>60?"…":""}"</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {execResult.trace.length>0 && (
                <>
                  <button onClick={()=>setShowTrace(!showTrace)}
                    style={{fontFamily:mono,fontSize:11,color:C.dim,background:C.panel2,
                      border:`1px solid ${C.line}`,borderRadius:6,padding:"6px 10px",cursor:"pointer",textAlign:"left"}}>
                    {showTrace?"▾":"▸"} Tool call trace · {execResult.trace.length} steps
                  </button>
                  {showTrace && (
                    <div style={{background:C.bg,border:`1px solid ${C.line}`,borderRadius:8,padding:10,
                      maxHeight:260,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
                      {execResult.trace.map((t,i)=>(
                        <div key={i} style={{fontFamily:mono,fontSize:10.5,
                          borderBottom:i<execResult.trace.length-1?`1px solid ${C.lineSoft}`:"none",paddingBottom:6}}>
                          <div><span style={{color:C.purple}}>{i+1}. {t.tool}</span></div>
                          <div style={{color:C.faint,marginTop:2,wordBreak:"break-all"}}>
                            in: {JSON.stringify(t.input).slice(0,80)}{JSON.stringify(t.input).length>80?"…":""}
                          </div>
                          <div style={{color:C.dim,marginTop:2,wordBreak:"break-all"}}>
                            → {String(t.result).slice(0,100)}{String(t.result).length>100?"…":""}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================ APP ============================ */
const NAV=[["board","Board"],["loads","Loads"],["drivers","Drivers"],["pnl","Weekly P&L"],["monthly","Monthly P&L"],["lanes","Lane Book"],["inbox","Rate Cons"],["email","Email"],["chat","Team"],["copilot","Copilot"],["agents","Agents"],["recruiting","Recruiting"]];
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
        {view==="email" && <Email loads={loads}/>}
        {view==="chat" && <Chat loads={loads}/>}
        {view==="copilot" && <Copilot loads={loads}/>}
        {view==="agents" && <Agents onRefresh={refresh}/>}
        {view==="recruiting" && <Recruiting loads={loads}/>}

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
