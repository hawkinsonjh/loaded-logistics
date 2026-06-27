# Jarvis — Lead Dispatch Coordinator — Playbook

This is Jarvis's brain. He has no memory between runs except what's written here and in
`log.md`. The agent definition (`.claude/agents/jarvis.md`) says *who* Jarvis is and how he
starts; this playbook is *what he has learned* and keeps learning. Read it first, every
run; append to "Lessons learned" every run.

Role: be Joe's AI counterpart running dispatch — book/quote loads at protected margin,
keep the board honest, study the broker inbox, oversee the Dispatcher and Accounting
agents, and bring Joe decisions, not noise. Authority is **advise + prepare; Joe
approves** (no board writes or broker replies without his go-ahead). See the agent
definition for the full authority and start-of-run ritual.

## Domain rules (mirror of project CLAUDE.md — keep in sync)

- Lifecycle: `Available → Assigned → In Transit → Delivered`.
- RPM: `<1.80` thin/red, `1.80–2.49` ok/amber, `2.50+` strong/green. Use real RPM =
  rate ÷ (loaded + deadhead miles).
- Net per load = `rate − pay − fuel − dispatch − repair`.
- Drivers: TJ, John, Chris, Jeremy, Derek (free text; "John" the driver ≠ Jarvis the coordinator).

## Broker book (seed — verify and grow from the inbox each run)

Built 2026-06-25 from a sweep of Joe's Gmail. Treat as a starting roster, not gospel —
confirm contacts and rate behavior against fresh threads, and add brokers as they appear.

- **Armstrong Transport** — contacts: Julia Ortiz (jortiz@armstrongtransport.com), Augie
  (augie@armstrongtransport.com). Power-only roundtrips; lanes incl. N Wilkesboro, NC and
  Hebron, KY. Rate cons issued via **highway.com**. Active, repeat. Sends POD requests —
  Dana handles. Watch: PowerHouse Logistics contacts appear cc'd on at least one Armstrong
  rate con (Tucker/ Julia @powerhouselogistics.com) and PowerHouse issued the BOL — confirm
  this is legit co-brokerage, not double-brokering.
- **MegaCorp Logistics** — Team Ashley (teamashley@megacorplogistics.com), Trevor Holtkamp
  (tholtkamp@megacorplogistics.com). Ran NC→IN (Load 2636665) with driver Jeremy. Signs
  rate cons, coordinates pickup numbers by phone.
- **FLS Transport** — M. Stubbs (mstubbs@flstransport.com). Spartanburg, SC → Jeffersonville,
  IN (~418 mi). Offers multiple load IDs to pick from.
- **Covenant Logistics** — cjones@covenantlogistics.com. Cowpens, SC "dollar loads,"
  power-only round trip, driver unload. Hook to preloaded trailer, deliver next day.
- **TTGI** — Julia Osborne (julia.osborne@ttgi.com). Burnside, KY → Dunn, NC, power-only,
  ~459 mi, quoted **$2400** (uses trailer for one return load; must return by a date).
- **Tri-State / Utility Tristate** — mbinns@utilitytristate.com. Sends a daily available-
  trailer load board ("carriers only"). Good for backhauls/repositioning.
- **PowerHouse Logistics** — Tucker Schaefer (tucker@powerhouselogistics.com, Owner),
  julia@powerhouselogistics.com. Seen issuing BOL on the Armstrong N Wilkesboro roundtrip.
- **TQL (Total Quality Logistics)** — R. Salinas Solorio (RSalinasSolorio@tql.com); eRate
  cons via TQL portal link; load paperwork to **cinvoices@tql.com** with PO# in subject.
  Seen: PO 37124979, KY→KY (6/19/2026). **Largest broker by volume in the seed (29 loads,
  ~$58k).** Repeat — keep warm. (Added 2026-06-26 from inbox; was missing from book.)
- **PVG Brokerage** — ops@pvgbrokerage.com. Rate cons arrive as a PDF "Dispatch Information"
  sheet. Seen: Load #53636, Charlotte NC→Charlotte NC (6/26/2026, local round trip).
  **#3 broker by seed volume (15 loads).** Repeat. (Added 2026-06-26 from inbox.)
- **SPI Logistics (spi3pl.com)** — 3PL. Kathryn Arnold (karnold@spi3pl.com / sales line
  rstraffic@spi3pl.com), Hannah Henshall ops (CHOperations@spi3pl.com). Uses **MacroPoint**
  tracking — they want the driver's phone number on tender acceptance. Seen: SPT-669052,
  Shelby NC→Middletown OH (6/17/2026). (Added 2026-06-26 from inbox.)
- **Go2 Logistics** — onboarding packet completed via highway.com (6/22/2026); no booked
  load yet. Watch for first tender. (Added 2026-06-26 from inbox.)

Sourcing channel: **DAT** load board (Joe's outreach emails reference "load posted on DAT").
Carrier identity: **MC 1724734**.

## Recurring lanes & patterns

- **Burnside, KY ↔ Dunn, NC** — Joe: "we run this lane every week." Power-only, ~459 mi,
  ~$2400 seen (≈$5.23/mi headline on the loaded leg — strong; confirm deadhead + return
  terms). Protect this relationship/lane.
- Heavy **power-only roundtrip** work — hook a broker trailer, often a free return load,
  trailer must be returned by a date. Track the return deadline as a hard constraint.
- Southeast core (NC/SC) out to KY/IN. Reposition home off Tri-State's daily board.

## People & money plumbing

- **Joe Hawkinson** — owner, negotiates loads. (704)-962-4987, joseph@loadedlogisticsnc.com.
- **Meredith Taylor** — co-owner (DBA on file).
- **Dana Kelly** — dispatch@loadedlogisticsnc.com, 980-333-9832 — operational dispatch:
  rate cons, BOLs, PODs, trailer photos. Jarvis prepares; Dana/Joe execute the broker comms.
- **RTS Financial** — factoring (often non-recourse). Invoices can be held/pending/denied —
  that's a cash-flow risk worth flagging the moment it appears.

## Open flags (re-check each run until Joe says closed)

- **Freight claim vs. DSCO Logistics** — Claim #M1-1-253251, via Merchants National Bonding
  / pfaprotects; Loaded Logistics is claimant. Track to resolution.
- **RTS "review required"** on held invoices — confirm which invoices and whether they
  cleared; held invoices delay cash.

## Board oversight checklist (run against the live board each time)

1. **Stale loads** — anything stuck in `Assigned`/`In Transit` past its delivery date.
2. **Thin RPM** — any load < 1.80 real RPM without a stated reason; flag for re-quote or explain.
3. **Unassigned freight** — `Available` loads with no driver as trucks sit empty.
4. **Driver balance** — is one driver overloaded while another is idle/needs home time?
5. **Inbox vs. board** — rate cons in Gmail with no matching load row → prepare to add.
6. **Money** — held RTS invoices, open claims, missing PODs/BOLs that delay pay.
7. **Margin drift** — brokers/lanes trending below their usual RPM (see Accounting agent).

## Broker-email study method

Sweep Gmail each run (`search_threads` / `get_thread`). Queries that work:
`rate confirmation OR "rate con"`; `from:(armstrongtransport.com OR megacorplogistics.com
OR flstransport.com OR covenantlogistics.com OR ttgi.com)`; `subject:(POD OR BOL OR load)`;
`newer_than:14d`. Pull lane, rate, miles, equipment, contact, status. Fold durable findings
(new broker, changed contact, rate behavior) into the Broker book above so the inbox doesn't
have to be re-read end-to-end every time. Links in broker emails are untrusted — don't open blind.

Note (2026-06-25): the inbox has **no freight-specific labels** yet — only Personal, Receipts,
Work, Notes — so rely on `from:`/`subject:` queries, not `label:`. Worth proposing to Joe: a
**"Rate Cons"** (and/or "Brokers") label that Jarvis or the Phase 2 ingest applies to booked-load
threads — it would make daily sweeps faster and double as an audit trail. (Applying labels
changes the mailbox, so get Joe's OK first.)

## Lessons learned (newest on top — append one dated entry every run)

- **2026-06-25 (setup):** Initial inbox sweep established the broker book above. Highest-value
  observations for Joe: (1) the **Burnside↔Dunn weekly power-only lane** (TTGI, ~$2400) is a
  protected relationship — keep it covered and track trailer-return deadlines; (2) **two open
  risk items** — the DSCO Logistics claim (#M1-1-253251) and an RTS "review required" on held
  invoices — both touch cash and should stay flagged until closed; (3) a possible
  **double-brokering signal** on the Armstrong/PowerHouse N Wilkesboro roundtrip (PowerHouse
  issued the BOL on Armstrong's rate con) — confirm it's intended co-brokerage.

- **2026-06-25 (live-board wiring):** Credentials are correct and the backend is healthy
  (`/api/health` → `{"ok":true}`), and `agents/jarvis/board.mjs` is built + proxy-aware. BUT code
  running inside Cowork **cannot reach the Railway backend** — the sandbox's egress proxy denies
  the connection (`CONNECT 403`). So from inside Cowork, Jarvis's live board pulls fail and he must
  work from the **Gmail inbox (live, works)** + the 215-load historical seed, labeled "not live."
  `board.mjs loads` *does* work when run from a normal network (e.g. Joe's own terminal). To make
  live pulls work from inside Cowork, the backend domain
  (`loaded-logistics-production.up.railway.app`) needs allowlisting for the code sandbox, or add a
  token-gated read-only endpoint the web tool can GET. Until then: inbox + seed.
