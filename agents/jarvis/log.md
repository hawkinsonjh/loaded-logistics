# Jarvis — Lead Coordinator — Run Log

Append-only. One entry per run: date, what was reviewed (board state, inbox, role-agent
reports), what was decided/prepared, what was flagged for Joe. Newest at the bottom.

---

- **2026-06-25 — Setup run.** Created Jarvis as lead dispatch coordinator: agent definition
  at `.claude/agents/jarvis.md`, this playbook + log under `agents/jarvis/`. Studied Joe's broker
  inbox and seeded the broker book (Armstrong, MegaCorp, FLS, Covenant, TTGI, Tri-State,
  PowerHouse) and recurring lanes (Burnside↔Dunn weekly power-only). Flagged for Joe: DSCO
  Logistics claim #M1-1-253251, RTS held-invoice "review required," and a possible
  double-brokering signal on the Armstrong/PowerHouse N Wilkesboro roundtrip. Live board not
  yet credentialed — analysis based on inbox + historical seed, labeled as such. Set to lead
  the `daily-ops-digest` run going forward.

- **2026-06-26 — Daily run.** Board: live pull still blocked from Cowork (`board.mjs` →
  proxy CONNECT 403), so worked from `backend/seed-data.json` (215 Delivered loads,
  2025-05-27→2026-06-19, $328,573.75 total rate, avg RPM 2.76) labeled historical, + live
  Gmail. Inbox (newer_than:7d): (1) NEW rate con from **PVG Brokerage** Load #53636 Charlotte
  NC→Charlotte NC, pickup 6/26, still UNREAD — a load to prepare; detail is in an attached PDF
  not yet read. (2) Armstrong/PowerHouse N Wilkesboro roundtrip **4450526-1** active — Dana
  sent trailer-pickup photos 6/25, Tucker (PowerHouse) issued BOL 6/26 ("must be printed +
  hand-signed at delivery"); double-broker signal persists (PowerHouse cc'd + issuing BOL on
  Armstrong's rate con). (3) Armstrong POD 4422224-1 was requested 6/23 and Dana already sent
  it — resolved. New brokers seen in inbox not yet in the book: PVG, TQL (KY-KY eRC), SPI
  Logistics (spi3pl), Go2 Logistics (Highway onboarding). Notable: **PVG (15 seed loads, #3)
  and TQL (29, #1) are top brokers but were missing from the broker book** — folding in next.
  Role agents: Dispatcher flagged deadhead — only 22/215 seed loads carry `dh`, last 2025-12-18
  (blind on empty miles since), and on those 22, empty 3,766 / loaded 5,821 = 39.3% of total
  miles, 14 ran dh≥loaded at 1.95 avg RPM vs 2.76 fleet. Accounting flagged the dispatch fee:
  62/215 loads (29%) paid it, $17,316.75 total, median exactly 30% of rate; on 19 fee loads
  with full cost data the $6,580 in fees turned +$5,935 into −$645. **Cross-check:** recomputed
  every figure against seed-data.json — all verified; Dispatcher's "39.3%" is empty÷total-miles
  (standard convention; = 64.7% if empty÷loaded). No fabrications. Flags carried for Joe: DSCO
  claim #M1-1-253251 (still open), RTS held invoices "review required" (still open, cash),
  PVG #53636 to prep, dispatch-fee economics, resume `dh` logging.

- **2026-06-28 — Daily run.** Board: live pull still blocked from Cowork (`board.mjs` →
  proxy CONNECT 403); worked from `backend/seed-data.json` (215 Delivered loads,
  2025-05-27→2026-06-19, $328,574 total, avg RPM 2.76; bands 30 thin / 70 ok / 110 strong),
  labeled historical, + live Gmail. (No run was logged 6/27 — one-day gap.) Inbox
  (newer_than:7d): (1) **PVG #53636** Charlotte→Charlotte round trip is now **CLOSED** — Dana
  delivered trailer 583673 to Charlotte 6/27 with POD photos + scale ticket (it was a fresh
  unread rate con at last run). Clean close. (2) **Armstrong/PowerHouse N Wilkesboro 4450526-1**
  active w/ driver Jeremy — Tucker (PowerHouse) again issued the BOL on Armstrong's rate con;
  **double-broker signal persists**. (3) **MegaCorp NC→IN 2636665** (Jeremy) signed 6/23,
  in transit. (4) **SPOT Inc invoice #S4042566** — Joe replied 6/27 disputing repeated
  no-reply POD requests on an empty-trailer move he says was already submitted; may hold that
  invoice. (5) Go2 Logistics onboarded (Highway), still no booked load. Role agents:
  **Dispatcher** found a day-of-week pattern — 60% of the 30 thin loads land Tue/Wed (20%
  thin rate vs 10% other days); all 22 Sat/Sun loads cleared the thin line. **Accounting**
  found seasonality — Feb-2026-onward is 85% of all-time revenue ($279,704/160 vs $48,870/55
  before); rate/mile rose $1.81 (Jan) → ~$3.03 weighted (May/Jun), above ATRI's $2.26 cost;
  Armstrong best net margin 45.1% vs TQL 37.6%. **Cross-check:** recomputed all against
  seed-data.json — revenue split ($48,870+$279,704=$328,574) and broker margins verified
  exactly; two methodology notes only — weekend median RPM is ~2.9 (agent wrote 3.01), and
  Accounting's "$3.28/$3.25 per mile" for May/Jun is the simple mean of per-load RPM (weighted
  $/mi ≈ $3.03), conclusion unchanged. No fabrications. Flags carried for Joe: DSCO claim
  #M1-1-253251 (still open), RTS held invoices "review required" (still open, cash), Armstrong/
  PowerHouse double-broker signal, SPOT #S4042566 POD-nag (possible held invoice).
