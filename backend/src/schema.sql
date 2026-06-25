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

-- Rate con agent pipeline columns (idempotent)
alter table emails add column if not exists extracted_json    jsonb;
alter table emails add column if not exists reviewer_confidence numeric;
alter table emails add column if not exists reviewer_flags    jsonb;
alter table emails add column if not exists review_status     text not null default 'pending';

create index if not exists emails_review_status_idx on emails (review_status);
create index if not exists emails_received_idx      on emails (received_at desc);

create table if not exists digests (
  id           uuid primary key default gen_random_uuid(),
  for_date     date unique,
  summary_md   text,
  metrics_json jsonb,
  created_at   timestamptz not null default now()
);

-- Driver recruiting pipeline
create table if not exists candidates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  email       text,
  cdl_class   text not null default 'A',   -- 'A' | 'B'
  experience  integer,                       -- years of CDL experience
  status      text not null default 'New',  -- New | Contacted | Interview | Offer | Hired | Rejected
  source      text,                          -- Facebook | Indeed | Referral | LinkedIn | Walk-in | Other
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists candidates_status_idx on candidates (status);
