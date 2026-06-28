# Accounting / P&L — Playbook

Role: act as Loaded Logistics' accountant/bookkeeper. Keep income and expenses straight,
feed the Weekly/Monthly P&L tabs, and tell Joe where margin is being won or lost.

## Domain conventions (from this project's CLAUDE.md — keep in sync if those change)

- **Net per load** = `rate − pay − fuel − dispatch − repair` (`netOf` in `board/src/App.tsx`).
- **RPM thresholds** (shared with Dispatcher): `<1.80` thin, `1.80–2.49` ok, `2.50+` strong.
- Board tabs that consume this data: Weekly P&L, Monthly P&L, Lane Book.
- `loads.source` distinguishes manually-entered loads from Gmail-ingested (`'email'`) loads
  — useful for auditing where revenue is coming from as Phase 2 ingest matures.

## Industry best practices (researched, ongoing)

- **Cost-per-mile is the number that matters most.** Calculate it per truck, not just fleet-
  wide: total fixed + variable costs for the period ÷ miles driven in that period. Compare
  against rate-per-mile on every lane — "know your cost before you haul." [Source: Apex
  Capital, Westport Financial]
- **Track profit by lane, by driver, and by truck — not just in aggregate.** Generic small-
  business bookkeeping (one P&L for the whole company) hides which lanes/drivers are
  actually profitable. [Source: Westport Financial]
- **Fuel surcharge is a pass-through, not revenue.** Booking it as straight income overstates
  margin — track it separately and net it against fuel cost in management reporting, even if
  it's combined with revenue for invoicing purposes. [Source: Apex Capital]
- **Close the books at least monthly; weekly cash reviews if margins are tight.** Twice-
  monthly is common for growing fleets. [Source: Apex Capital]
- **Cash flow timing is the real risk, not profitability.** Drivers get paid weekly, fuel is
  a daily cash outflow, but brokers/shippers often settle net-30/net-45+ — a profitable month
  can still produce a cash crunch. Watch the gap, not just the P&L. [Source: Apex Capital]
- **Tag every expense to a truck/unit** (class or location in accounting software) so
  per-truck P&L is always derivable, and keep IFTA-relevant mileage/fuel-by-jurisdiction data
  current for quarterly filing. [Source: Fit Small Business, Truckstop]

## Lessons learned (appended by each daily run — newest on top)

- **2026-06-28:** External (current): trucking revenue is strongly **seasonal** — the slowest
  window is **January–mid-February** (spot rates drop 15–25% vs the Oct–Nov peak), then rates
  climb through **produce season (March–October, longest in the South)** and the spring retail
  push. For 2026 specifically the produce season started early and the truckload market is
  tightening; spot rates are projected **20–25% above prior-year levels** for the rest of 2026,
  and reefer rates can swing **30–50¢/mi** between peak (≈$3.00) and late-summer (≈$2.40).
  [Source: Truckstop produce-season guide, FreightWaves, TT News, RXO Q2-2026 forecast — June
  2026 search.] New internal pattern (historical seed, not live): **our own numbers track that
  seasonal curve and show the business inflected hard in early 2026.** Monthly revenue by `rate`:
  the first 9 months (May 2025–Jan 2026) total just **$48,870 across 55 loads**, then **Feb 2026
  onward is $279,704 across 160 loads = 85% of all-time revenue**. Volume jumped from ~7 loads/mo
  in 2025 to **29–40 loads/mo** starting Feb 2026. Crucially, **$/mi rose right with the season**:
  $1.81 (Jan) → $2.45 (Feb) → $2.49 (Mar) → $2.84 (Apr) → **$3.28 (May)** → $3.25 (Jun) — the
  exact spring/produce ramp the research describes, and well above ATRI's $2.26/mi cost benchmark
  in those months. On the 118 complete-cost loads, monthly **net margin** firmed up the same way:
  negative in late 2025 (Nov −96%, Dec −198%, tiny n), then steady **27–41%** every month Feb–Jun
  2026. Action for Joe: this is now a **real, repeatable freight book, not a side hustle** — but
  the seasonal data says **don't extrapolate May/June's $3.25+/mi into Q3/Q4**. Build the cash plan
  around a **late-summer rate fade and the Jan–mid-Feb trough** (that's exactly when 2025 lost
  money): bank margin now, line up factoring/credit before January, and lean into produce/reefer
  lanes while rates are elevated through the rest of 2026.
- **2026-06-26:** External (current): 2026 freight-factoring rates run **1–5% of invoice
  face, most carriers 2–3.5%**; small fleets should target **2–2.5%**, and ~85% of
  agreements are recourse (non-recourse adds ~0.5–1%). Watch hidden ACH/wire fees ($5–30
  per transfer = $100–600/mo if funded daily). Industry avg broker pay cycle is ~40 days,
  so net-30 brokers are above-average payers and qualify for better factoring rates.
  [Source: AtoB, ResolvePay, Porter Freight Funding, June 2026 search]. New internal
  pattern (historical seed, not live): the **dispatch fee is our single largest
  controllable cost**. **62 of 215 loads (29%)** carry a dispatch fee totaling **$17,316.75**,
  and the **median fee is exactly 30.0% of rate** (44 of those 62 loads sit at ~30%). On the
  **19 dispatch-fee loads that also have complete pay+fuel data**, the loads earned **+$5,935
  net before dispatch** but the **$6,580 dispatch fee flipped them to -$645 combined** — the
  fee alone consumed 100%+ of operating profit on that slice. Worst case: h167 (Destination
  Transport, dispatch $950 on a $1,450 rate = 66%, net -$288). Action for Joe: a flat 30%
  dispatch cut is unsustainable on thin-RPM freight — either renegotiate the dispatch split,
  set a minimum-RPM floor before accepting dispatched loads, or compare this 30% against
  bringing dispatch in-house. (Note: distinct from a 2–2.5% factoring fee — these are
  separate costs and both compress margin.)
- **2026-06-25:** New external data point: ATRI's latest benchmark puts the industry
  average full cost of operating a truck at **$2.26/mile** (2024 data), with non-fuel
  costs alone at a record **$1.78/mile** — useful as an external yardstick against our
  own per-load economics, since we don't yet track per-truck fixed costs. [Source: ATRI,
  via americantruckersllc.com cost-per-mile coverage, June 2026 search]. In our own
  `seed-data.json` (215 loads), every one of **Derek's 4 loads with complete pay+fuel
  data is net-negative** — averaging **-$1,205/load** (range -$276 to -$1,959), e.g. h31
  (C Cross Logistics, RPM 1.69, net -$1,959) and h39 (CH Robinson, RPM 1.31, net
  -$1,784). This is a clear outlier: across all 118 loads with complete cost data,
  only 14.4% are net-negative, vs. 100% for Derek's small sample — worth a closer look
  at whether this is a short, unrepresentative stretch (his only loads are from
  Oct–Dec 2025, before he may have left/rotated out) or a real driver/lane cost problem.
