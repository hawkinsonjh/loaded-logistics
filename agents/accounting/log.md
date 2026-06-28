# Accounting Agent — Run Log

Append-only. One entry per run: date, what was reviewed, what was found, what was flagged.

---

## 2026-06-28

**Reviewed:** `agents/accounting/playbook.md` (full) + `log.md`, one web search on trucking
revenue seasonality / produce-season rate patterns for 2026, and `backend/seed-data.json`
(215 historical loads) — computed monthly revenue/$-per-mile trend (all loads) plus monthly
and broker-level net margin on the 118 complete pay+fuel loads. All numbers from file.

**Found:**
- External: trucking is strongly seasonal — Jan–mid-Feb is the trough (spot −15–25% vs
  Oct–Nov peak), then rates ramp through produce season (Mar–Oct) and spring retail. For
  2026: early produce season + tightening market, spot rates projected 20–25% above prior
  year for the rest of the year; reefer can swing 30–50¢/mi peak-to-trough. [Sources:
  Truckstop, FreightWaves, TT News, RXO Q2-2026 forecast — June 2026 search.] New to playbook.
- Internal (historical seed, not live): the book inflected hard in early 2026. May 2025–Jan
  2026 = $48,870 / 55 loads; **Feb 2026 onward = $279,704 / 160 loads = 85% of all-time
  revenue**. Volume ~7 loads/mo (2025) → 29–40/mo (Feb 2026+). $/mi climbed with the season:
  Jan $1.81 → Feb $2.45 → Mar $2.49 → Apr $2.84 → **May $3.28** → Jun $3.25. Monthly net
  margin (complete-cost loads) went from negative in late 2025 to a steady 27–41% Feb–Jun 2026.
- Side note (not led with): broker NET margin on complete-cost loads — **Armstrong is the
  most profitable at 45.1%** (n=14, $896/load), ahead of TQL's 37.6% (n=22, $755/load)
  despite TQL's higher volume; PVG 29.3%, Norfleet 25.2%. Flagged for a future revenue-mix pass.

**Flagged for Joe:** This is now a real, repeatable freight book, not a side hustle — but the
seasonal data warns against extrapolating May/Jun's $3.25+/mi into Q3/Q4. Plan cash around a
late-summer rate fade and the Jan–mid-Feb trough (exactly when 2025 lost money): bank margin
now, secure factoring/credit before January, and lean into produce/reefer lanes while rates
stay elevated through the rest of 2026.

---

## 2026-06-26

**Reviewed:** `agents/accounting/playbook.md` (full), one web search on current (2026)
freight-factoring rates / cash flow for small carriers, and `backend/seed-data.json`
(215 historical loads) — computed dispatch-fee burden, deadhead ratio, and the net impact
of dispatch fees on the loads with complete pay+fuel data. All numbers verified from file.

**Found:**
- External: 2026 factoring rates are 1–5% of invoice (most 2–3.5%; small fleets target
  2–2.5%), ~85% recourse, hidden ACH/wire fees can add $100–600/mo. Industry avg broker
  pay cycle ~40 days, so net-30 brokers are above-average and earn better factoring rates.
  [Sources: AtoB, ResolvePay, Porter Freight Funding — June 2026 search.] New to playbook.
- Internal (historical seed, not live): dispatch fee is the largest controllable cost.
  62/215 loads (29%) carry a dispatch fee = $17,316.75 total; **median fee = exactly 30.0%
  of rate**, with 44 of 62 at ~30%. On the 19 dispatch-fee loads with complete pay+fuel:
  pre-dispatch net **+$5,935**, dispatch paid **$6,580**, final net **-$645** — the fee alone
  erased all operating profit on that slice. Worst: h167 (Destination Transport, dispatch
  $950 on $1,450 rate = 66%, net -$288).
- (Deadhead also notable — 64.7% dh-to-loaded ratio — but only 22 loads carry dh data, so
  too small/biased to lead with this run; noted for a future pass.)

**Flagged for Joe:** The flat ~30% dispatch split is unsustainable on thin-RPM freight.
Renegotiate the dispatch split, set a minimum-RPM floor before accepting dispatched loads,
or price out bringing dispatch in-house. Separately, if factoring, target a 2–2.5% rate
and watch hidden transfer fees — that's a distinct cost from the 30% dispatch fee.

---

## 2026-06-25

**Reviewed:** `agents/accounting/playbook.md` (domain conventions + prior research), one
web search on current trucking cost-per-mile/P&L benchmarks, and
`backend/seed-data.json` (215 historical loads) — computed RPM distribution and
per-driver net-per-load (`rate - pay - fuel - dispatch - repair`) across the 118 loads
that have complete pay+fuel data.

**Found:**
- External: ATRI's latest benchmark — average truck operating cost $2.26/mile (2024),
  non-fuel costs $1.78/mile (record high). Not previously in the playbook; added as a
  reference yardstick.
- Internal: across all 215 seed loads, RPM distribution is 14.4% thin (<1.80), 33.5% ok
  (1.80–2.49), 52.2% strong (2.50+) — fleet skews healthy on rate, but RPM alone hides
  cost-side losses.
- Internal, more specific: of the 118 loads with complete pay+fuel data, 17 (14.4%) are
  net-negative. **All 4 of Derek's complete-data loads are net-negative** (avg
  -$1,205/load), notably h31 (C Cross Logistics, 2025-11-05, RPM 1.69, net -$1,959) and
  h39 (CH Robinson, 2025-12-03, RPM 1.31, net -$1,784). Derek's loads only span
  Oct–Dec 2025 in the dataset, so small sample — flagged for Joe to check if this
  reflects a real cost issue or a short/discontinued assignment.

**Flagged for Joe:** Look at why Derek's settled loads (small n=4, but 100% negative)
lost money even at "ok" RPM (1.69, 1.31, 1.97, 1.08) — pay+fuel costs were unusually
high relative to rate on those specific loads. Worth confirming whether this was a
one-off lane/equipment issue or something to watch if Derek returns to rotation.

---
