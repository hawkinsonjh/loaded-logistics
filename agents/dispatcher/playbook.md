# Dispatcher / Load Planner — Playbook

Role: act as Loaded Logistics' dispatcher. Match drivers to freight, protect margin on
every load, keep the board (Available → Assigned → In Transit → Delivered) accurate, and
flag anything that needs Joe's attention.

## Domain conventions (from this project's CLAUDE.md — keep in sync if those change)

- **Load lifecycle:** `Available -> Assigned -> In Transit -> Delivered`.
- **Drivers:** TJ, John, Chris, Jeremy, Derek (free-text field today, no driver table).
- **RPM (rate per mile) is the core health metric:**
  - `< 1.80` = thin (red) — should not be booked without a strong reason (deadhead recovery,
    repositioning, relationship load).
  - `1.80–2.49` = ok (amber).
  - `2.50+` = strong (green).
  - Computed as `rate / miles` when not stored directly on the load.
- **Net per load** = `rate − pay − fuel − dispatch − repair`.
- `loads.source` is `'manual'` or `'email'` (Phase 2 Gmail ingest auto-creates `'email'` loads).

## Industry best practices (researched, ongoing)

- **Check real RPM before confirming, not the headline rate.** Two loads at the same rate
  can have very different RPM once deadhead and operational cost are factored in — run the
  rate/miles/deadhead math before committing a truck. [Source: LoadConnect]
- **Look ahead at driver capacity, not just current status.** Track expected availability in
  rolling windows (next 2/4/8 hours) based on real load-completion and rest-period timing,
  so the next load is being lined up before a driver goes empty — proactive dispatch beats
  reactive dispatch. [Source: FleetRabbit]
- **Score candidate loads on margin fit, not just on being available.** When choosing between
  multiple loads for one truck, weigh margin potential and reload/deadhead fit, not just
  "what's open" — this is what load-scoring tools do under the hood, and it's worth doing by
  hand at this fleet size too. [Source: Upper, PCS Software]
- **Trailer/space utilization matters even for full truckload** — better load planning
  reduces empty miles and turnaround time at the dock.

## Lessons learned (appended by each daily run — newest on top)

- **2026-06-28:** New from research (June 2026): the dry-van spot market hit a cycle high of
  **$2.82/mi** on the DAT National Truckload Index (7-day avg, fuel included), with spot rates
  running **20–25% above prior-year** and **15–25% above contract** on most lanes through 2026
  — confirming this is a carrier's market where holding out for a better number pays. [Source:
  Truck Dispatch Experts, "2026 Freight Rate Recovery"; TT News]. **Fresh data angle —
  day-of-week RPM** (historical seed, not live; using each load's `date`). Two clean signals,
  both pointing the same way: (1) **Thin loads cluster mid-week.** Tuesday + Wednesday pickups
  run **20% thin (18/90 loads <1.80 RPM)** vs **10% (12/120)** on every other day — **60% of
  all 30 thin loads in the file fall on Tue/Wed**. (2) **Weekend freight is consistently
  strong.** All **22 Sat/Sun loads cleared the thin line (0 thin)**, median **3.01 RPM**, lowest
  was 1.84 — vs the 2.76 fleet average. Caveat: ignore the raw Wednesday *mean* (3.49) — it's a
  mirage from outliers like h33 ($150 / 4 mi = 37.5 RPM) and h200 ($2,600 / 710 mi = 7.04); the
  honest Wednesday number is the **2.44 median**. Action for Joe: (a) on Tue/Wed, hold the line
  harder — that's exactly when we've historically caved to thin rates, so don't book <1.80
  without a real reason; (b) keep at least one truck available into the weekend — Sat/Sun has
  never produced a thin load for us and pays a premium, so don't auto-park Friday afternoon.
- **2026-06-26:** New from research (June 2026): deadhead % is one of the few cost levers a
  fleet directly controls, and the 2026 best-practice target is **under 15% empty miles** —
  start the backhaul search before the current load delivers; every ~10% cut in deadhead is
  worth roughly $8k–$12k/yr per truck. [Source: FleetRabbit, "Reducing Deadhead Miles… 2026"].
  Tied to a finding in `seed-data.json` (historical seed, not live): two problems with our
  deadhead data. (1) **We stopped tracking it.** Only 22 of 215 loads have any `dh` value and
  the last one is dated **2025-12-18** — zero of the 117 loads since carry a deadhead figure,
  so we currently have no visibility into empty miles at all. (2) When it *was* tracked it was
  ugly: across those 22 loads, empty miles totaled 3,766 vs 5,821 loaded = a **39.3% aggregate
  deadhead ratio** (target <15%), and **14 of the 22 ran deadhead ≥ loaded miles** (a truck
  driving as far empty as paid), e.g. h11 Cleveland Logistics 276 dh / 276 loaded @ 1.26 RPM,
  h41 RTS 168/168 @ 1.19. Those 14 averaged **1.95 RPM vs the 2.76 fleet average** — high
  deadhead and thin rates traveled together. Action for Joe: (a) start logging `dh` on every
  load again so we can actually manage it, and (b) treat any load whose deadhead approaches
  its loaded miles as a margin red flag, not just the headline rate.
- **2026-06-25:** New from research (not previously in this playbook): with the load-to-truck
  ratio around 7.73 as of March 2026 and spot van rates near $2.41/mi, carrier pricing power
  is up — dispatchers should be quoting *above* posted broker rates and leading with
  performance data (on-time %, detention history) rather than accepting the first number.
  [Source: Truck Dispatch Experts, O Trucking / Truckstop.com]. Separately, in `seed-data.json`
  all 11 **Norfleet Logistics** loads (2026-01-20 through 2026-02-12) ran thin — RPMs of
  1.10, 1.55, 1.66, 1.72, 1.75, 1.84, 1.84, 1.85, 2.00, 2.02, 2.03 (9 of 11 below the 1.80
  "thin" threshold, none above 2.03) — and then Norfleet vanishes from the books entirely
  after mid-February despite being the #4 broker by load count (11 loads, ~$15.9k revenue).
  Worth flagging to Joe: either Norfleet was a low-margin relationship lane that rightly got
  dropped, or it's worth re-quoting if that freight is still available, since at those RPMs it
  was barely above cost on longer hauls (e.g. h52: $725/656mi = 1.10).
