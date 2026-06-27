// Shared design tokens + pure helpers for the Loaded Logistics surfaces.
//
// App.tsx still carries its own copies of these (the live board predates this
// module); the newer surfaces — DriverApp, CustomerPortal — import from here so
// the brand stays in sync. Keep values identical to App.tsx's `C`/helpers; a
// later refactor can point App.tsx at this module too.

/* ============================ TOKENS ============================ */
export const C = {
  bg:"#0B0F1C", panel:"#141A2A", panel2:"#1A2035", raised:"#1F2840",
  line:"#2A3350", lineSoft:"#1A2035",
  ink:"#E9ECF1", dim:"#8B95A3", faint:"#6E7886",
  amber:"#16C7DE", amberHi:"#3DD8EC",
  green:"#36D399", greenDim:"#1f6b50",
  red:"#F0594C", redDim:"#6b2722",
  blue:"#4DA3FF", purple:"#8B5CFF",
};

export const LANES = ["Available","Assigned","In Transit","Delivered"];
export const DRIVER_ORDER = ["TJ","John","Chris","Jeremy","Derek"];
export const mono = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
export const sans = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
export const oswald = '"Oswald", "Inter", system-ui, sans-serif';

/* ============================ HELPERS ============================ */
export const fmt0  = (n:any) => (n==null||isNaN(n)) ? "—" : Math.round(n).toLocaleString();
export const money = (n:any) => (n==null||isNaN(n)) ? "—" : "$"+Math.round(n).toLocaleString();
export const money1= (n:any) => (n==null||isNaN(n)) ? "—" : "$"+Number(n).toFixed(2);
export const todayISO = () => new Date().toISOString().slice(0,10);

export function computeRpm(l:any){
  if(l.rpm!=null) return l.rpm;
  if(l.rate&&l.miles) return l.rate/l.miles;
  return null;
}
export function rpmColor(rpm:any){
  if(rpm==null||isNaN(rpm)) return C.faint;
  if(rpm>=2.5) return C.green;
  if(rpm>=1.8) return C.amber;
  return C.red;
}
export function rpmLabel(rpm:any){
  if(rpm==null||isNaN(rpm)) return "no rpm";
  if(rpm>=2.5) return "strong";
  if(rpm>=1.8) return "ok";
  return "thin";
}
export function laneColor(s:string){
  return s==="Available"?C.amber : s==="Assigned"?C.purple : s==="In Transit"?C.blue : C.green;
}

/* lane stepping — shared by the driver view's status controls */
export function nextLane(s:string){ const i=LANES.indexOf(s); return i>=0 && i<LANES.length-1 ? LANES[i+1] : null; }
export function prevLane(s:string){ const i=LANES.indexOf(s); return i>0 ? LANES[i-1] : null; }

/* ---- billing / P&L helpers (kept identical to App.tsx's copies) ---- */
export function netOf(l:any){ return (l.rate||0)-(l.pay||0)-(l.fuel||0)-(l.dispatch||0)-(l.repair||0); }
export function accessorialOf(l:any){ return (l.detention_pay||0)+(l.lumper||0)+(l.accessorial||0); }
export function billableOf(l:any){ return (l.rate||0)+accessorialOf(l); }
export function ageDays(iso:string){
  if(!iso) return null;
  const t = new Date(iso+"T00:00:00").getTime();
  if(isNaN(t)) return null;
  return Math.round((Date.now()-t)/864e5);
}

/* ---- display formatting ---- */
export function fmtDate(iso?:string){
  if(!iso) return "—";
  try { return new Date(iso+"T00:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}); }
  catch { return iso; }
}
export function fmtAgo(ms?:number){
  if(!ms) return "";
  const mins = Math.round((Date.now()-Number(ms))/60000);
  if(mins<1) return "just now";
  if(mins<60) return `${mins} min ago`;
  const hrs = Math.round(mins/60);
  if(hrs<24) return `${hrs} hr ago`;
  return `${Math.round(hrs/24)} d ago`;
}
