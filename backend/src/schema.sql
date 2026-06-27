-- Loaded Logistics — Phase 1 schema
-- Safe to run repeatedly.

create extension if not exists "pgcrypto";

create table if not exists loads (
  id              uuid primary key default gen_random_uuid(),
  date            date,
  broker          text,
  rate            numeric,
  miles           integer,
  rpm             numeric,                 -- stored as-given when present; else computed in app
  origin          text,
  dest            text,
  driver          text,
  unit            text,
  pay             numeric,
  fuel            numeric,
  dispatch        numeric,
  repair          numeric,
  dh              integer,
  ref             text,
  commodity       text,
  status          text not null default 'Available',
  source          text not null default 'manual',   -- 'manual' | 'email'
  source_email_id text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists loads_broker_idx on loads (broker);
create index if not exists loads_origin_idx on loads (origin);
create index if not exists loads_date_idx   on loads (date);
create index if not exists loads_status_idx on loads (status);

-- expense columns (idempotent for already-deployed databases)
alter table loads add column if not exists dispatch numeric;
alter table loads add column if not exists repair numeric;
alter table loads add column if not exists dh integer;

-- ── Billing & A/R (Phase 3) ────────────────────────────────────────────────
-- The single biggest gap competitors leave open: no invoice/payment visibility.
-- billing_status: 'unbilled' -> 'invoiced' -> 'paid'. Days-to-pay = paid_at - invoiced_at.
alter table loads add column if not exists billing_status text not null default 'unbilled';
alter table loads add column if not exists invoiced_at date;
alter table loads add column if not exists paid_at date;

-- ── Detention & accessorials ───────────────────────────────────────────────
-- Industry loses ~$15B/yr to uncollected detention. Tracked separately from the
-- linehaul rate so RPM/P&L stay linehaul-based (standard); these roll into the
-- billable total and an "uncollected detention" metric instead.
alter table loads add column if not exists detention_hours numeric;
alter table loads add column if not exists detention_pay   numeric;
alter table loads add column if not exists lumper          numeric;
alter table loads add column if not exists accessorial     numeric;

-- ── Paperwork tracking ─────────────────────────────────────────────────────
-- "Where's the POD?" is the #1 universal complaint. Status + one optional link
-- (Drive/Dropbox) — no file hosting needed. A load is invoice-ready at POD.
alter table loads add column if not exists ratecon_received boolean not null default false;
alter table loads add column if not exists bol_received     boolean not null default false;
alter table loads add column if not exists pod_received     boolean not null default false;
alter table loads add column if not exists doc_link         text;

-- ── Driver settlements ─────────────────────────────────────────────────────
-- Competitors notoriously have "no place to deduct cash advances." One field;
-- settlement = sum(pay) - sum(advance) per driver per week.
alter table loads add column if not exists advance numeric;

create index if not exists loads_billing_idx on loads (billing_status);

create table if not exists messages (
  id        uuid primary key default gen_random_uuid(),
  who       text not null default 'Dispatch',
  body      text not null,
  tag       uuid,                          -- optional load id this message is about
  ts        timestamptz not null default now()
);
create index if not exists messages_ts_idx on messages (ts);

-- Phase 2/3 placeholders (created now so the email service has a home later)
create table if not exists emails (
  id             uuid primary key default gen_random_uuid(),
  mailbox        text,
  gmail_id       text unique,
  from_addr      text,
  subject        text,
  received_at    timestamptz,
  is_rate_con    boolean,
  parsed_load_id uuid references loads(id),
  raw_excerpt    text,
  created_at     timestamptz not null default now()
);

-- Phase 2 ingest columns (idempotent for already-deployed databases)
alter table emails add column if not exists confidence       numeric;
alter table emails add column if not exists attachment_count integer default 0;
alter table emails add column if not exists processed_at      timestamptz;
alter table emails add column if not exists error             text;
-- Full extracted load (so the Inbox can preview parsed fields and "promote" a
-- skipped/low-confidence email into a load with one click — no re-fetch needed).
alter table emails add column if not exists extract_json     jsonb;
create index if not exists emails_received_idx     on emails (received_at);
create index if not exists loads_source_email_idx  on loads (source_email_id);

-- ── IFTA / fuel (Phase 3) ──────────────────────────────────────────────────
-- Fuel receipt log (gallons + $ by jurisdiction) and per-quarter taxable miles
-- by jurisdiction. Together these produce a quarterly IFTA prep worksheet —
-- which competitors charge extra per-truck for, or omit entirely.
create table if not exists fuel_purchases (
  id         uuid primary key default gen_random_uuid(),
  date       date,
  state      text,                -- 2-letter jurisdiction, e.g. 'NC'
  gallons    numeric,
  amount     numeric,             -- total $ paid
  unit       text,                -- truck unit number
  driver     text,
  created_at timestamptz not null default now()
);
create index if not exists fuel_date_idx on fuel_purchases (date);

create table if not exists ifta_miles (
  id           uuid primary key default gen_random_uuid(),
  quarter      text not null,     -- 'YYYY-Qn', e.g. '2026-Q2'
  jurisdiction text not null,     -- 2-letter state
  miles        integer not null default 0,
  updated_at   timestamptz not null default now(),
  unique (quarter, jurisdiction)
);

-- ── Load documents (Phase: POD photo upload) ───────────────────────────────
-- Drivers snap a photo of the BOL/POD on delivery; the (client-compressed) image
-- is stored here as bytea so there's no external bucket to provision. Serving the
-- image sets the load's paperwork flag + doc_link, so the board/broker/owner views
-- light up automatically. Prototype tradeoff: images in Postgres is fine for ~5
-- drivers; production should move bytes to object storage (S3/Cloudinary) and keep
-- only the URL here.
create table if not exists documents (
  id          uuid primary key default gen_random_uuid(),
  load_id     uuid references loads(id) on delete cascade,
  kind        text not null default 'pod',     -- 'pod' | 'bol' | 'ratecon' | 'other'
  filename    text,
  mime        text,
  bytes       bytea,                            -- the (compressed) image itself
  size_bytes  integer,
  uploaded_by text,
  created_at  timestamptz not null default now()
);
create index if not exists documents_load_idx on documents (load_id);

create table if not exists digests (
  id           uuid primary key default gen_random_uuid(),
  for_date     date unique,
  summary_md   text,
  metrics_json jsonb,
  created_at   timestamptz not null default now()
);
