# Dispatcher Agent — Run Log

Append-only. One entry per run: date, what was reviewed, what was found, what was flagged.

---

## 2026-06-25

**Reviewed:** `agents/dispatcher/playbook.md` (full read), one web search on current
truckload dispatch/RPM practices, and `backend/seed-data.json` (215 historical loads).

**Web search:** First query ("load planning best practices 2026") returned mostly
trailer-stacking/space-utilization content already covered in the playbook. Ran a second,
more targeted query on spot-market rates and negotiation tactics and found something new:
load-to-truck ratio ~7.73 as of March 2026 and spot van rates ~$2.41/mi indicate carrier
pricing power is currently elevated — dispatchers should be quoting above posted rates and
leading with performance data, not accepting first offers. Sources: Truck Dispatch Experts
(truckdispatchexperts.com), O Trucking (otrucking.com), Truckstop.com.

**Data finding:** Broker concentration — TQL is the largest broker by load count (29 loads,
$57,950, 17.6% of total revenue across all 215 loads) and Armstrong Transport is #2 (19
loads, $37,100, 11.3%). Top 3 brokers (TQL + Armstrong + PVG Brokerage) account for 33.5% of
total revenue — a real concentration risk if any one relationship sours.

Separately found a more specific anomaly: all 11 Norfleet Logistics loads ran consecutively
from 2026-01-20 to 2026-02-12, then Norfleet never appears again in the dataset. RPMs for
those 11 loads: 1.72, 1.55, 1.10, 1.84, 2.00, 1.84, 1.85, 1.66, 2.02, 1.75, 2.03 — 9 of 11
below the 1.80 "thin" threshold, none reaching "strong" (2.50+). Total Norfleet revenue
~$15.9k. Worst single load: h52, $725/656mi = 1.10 RPM.

**Flagged for Joe:** Norfleet Logistics looks like it was either a low-margin relationship
lane that rightly got dropped after mid-February, or freight worth re-quoting at better rates
if it's still moving — worth a quick gut-check on whether that relationship should resume on
different terms. Also worth periodically checking broker mix doesn't drift further toward
TQL/Armstrong concentration without a backup plan.

**Playbook updated:** added one dated entry to "Lessons learned" (top of section) summarizing
both findings above.

---

## 2026-06-26

**Reviewed:** `agents/dispatcher/playbook.md` (full read), one web search on current
truckload deadhead/load-planning practices, and `backend/seed-data.json` (215 historical
loads, computed via node).

**Web search:** Query on June 2026 deadhead reduction / load planning. New (not in playbook):
deadhead % is one of the few cost levers a fleet controls directly; the 2026 best-practice
target is **under 15% empty miles**, achieved by starting the backhaul search before the
current load delivers and giving dispatch full visibility into every available truck. Cited
impact: every ~10% reduction in deadhead is worth roughly $8k–$12k/yr per truck. Source:
FleetRabbit, "Reducing Deadhead Miles in Trucking Fleets… 2026"
(fleetrabbit.com). Corroborating market context: C.H. Robinson June 2026 update and RXO Q2
2026 truckload guide show spot rates elevated (~$2.30–$2.80/mi), so empty miles cost more now.

**Data finding (historical seed, not live):** Two deadhead problems. (1) Tracking gap — only
**22 of 215 loads** carry any `dh` value, and the most recent is **2025-12-18**; zero of the
~117 loads since then have a deadhead figure, so empty miles are currently invisible. (2)
Quality when tracked — those 22 loads logged 3,766 empty miles vs 5,821 loaded =
**39.3% aggregate deadhead** (vs <15% target), and **14 of 22 ran deadhead ≥ loaded miles**
(e.g. h11 Cleveland 276/276 @ 1.26 RPM; h41 RTS 168/168 @ 1.19; h9 CH Robinson 199/199 @
1.75). Those 14 averaged **1.95 RPM vs the 2.76 fleet average** — high deadhead and thin
rates moved together. All figures computed directly from seed-data.json.

**Flagged for Joe:** (a) Resume logging `dh` on every load — we can't manage empty miles we
don't record, and we've been blind to them for 6+ months. (b) Treat any load whose deadhead
approaches its loaded miles as a margin red flag alongside RPM, and start backhaul searches
before delivery to push toward the <15% target.

**Playbook updated:** added one dated entry to top of "Lessons learned" (2026-06-25 entry
preserved below it).
