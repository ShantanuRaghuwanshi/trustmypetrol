-- Accountability data layer (Phase 4): the asset→contract registry that the
-- DLP engine (packages/civic/src/works.ts) and Phase-5 contractor scorecards
-- read. Rows enter civic_works only from real sources — moderated citizen
-- board snaps, RTI responses, tender award notices, OMMAS — never fabricated.

-- ── Works registry (public read; service-role writes) ──────────────────────

create table civic_works (
  id uuid primary key default gen_random_uuid(),
  agency_slug text references civic_agencies(slug),
  title text not null,
  contractor_name text,
  cost_inr numeric(14,2) check (cost_inr > 0),
  work_order_no text,
  start_date date,
  completion_date date,
  dlp_months int check (dlp_months between 1 and 600),
  -- Reference point (e.g. where the display board stands); null = unlocated.
  location geography(point, 4326),
  coverage_radius_m int not null default 500 check (coverage_radius_m between 10 and 10000),
  source text not null check (source in ('display_board','rti_response','tender_portal','ommas')),
  source_ref text,
  source_url text,
  verified boolean not null default false, -- cross-checked against a 2nd source
  created_at timestamptz not null default now()
);

alter table civic_works
  add column lat double precision generated always as (st_y(location::geometry)) stored,
  add column lng double precision generated always as (st_x(location::geometry)) stored;

create index civic_works_location_gix on civic_works using gist (location);
create index civic_works_contractor_idx on civic_works (contractor_name);

-- Works whose coverage circle contains the point — the issue-page lookup.
create or replace function public.civic_works_near(
  in_lat double precision,
  in_lng double precision
)
returns setof civic_works
language sql stable
as $$
  select *
  from civic_works
  where location is not null
    and st_dwithin(
      location,
      st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography,
      coverage_radius_m
    )
  order by location <-> st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography
  limit 10;
$$;

-- ── Citizen board snaps ("snap the project board") ─────────────────────────
-- Display boards are mandated at work sites (project, cost, dates,
-- contractor). Citizens photograph and transcribe them; moderation promotes
-- approved submissions into civic_works (service role sets work_id + status).

create table civic_work_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  device_lat double precision not null,
  device_lng double precision not null,
  accuracy_m numeric(7,1),
  photo_path text,             -- evidence bucket path
  raw_text text check (char_length(raw_text) <= 4000), -- board transcription
  title text,
  contractor_name text,
  cost_inr numeric(14,2) check (cost_inr > 0),
  work_order_no text,
  start_date date,
  completion_date date,
  dlp_months int check (dlp_months between 1 and 600),
  status text not null default 'pending_review'
    check (status in ('pending_review','approved','rejected')),
  work_id uuid references civic_works(id), -- set on promotion
  created_at timestamptz not null default now()
);

create index civic_work_submissions_user_idx
  on civic_work_submissions (user_id, created_at desc);
create index civic_work_submissions_review_idx
  on civic_work_submissions (status, created_at)
  where status = 'pending_review';

-- ── RTI request tracker ─────────────────────────────────────────────────────
-- Prepare, don't submit: the draft is generated client-side
-- (draftRtiApplication); the citizen files and records the registration
-- number. The 30-day clock is Section 7(1) of the RTI Act — statutory.

create table civic_rti_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  issue_id uuid references civic_issues(id),
  work_id uuid references civic_works(id),
  agency_slug text references civic_agencies(slug),
  application_text text check (char_length(application_text) <= 8000),
  reference_no text check (reference_no ~ '^[A-Za-z0-9/\-]{4,40}$'),
  status text not null default 'drafted'
    check (status in ('drafted','filed','responded','appealed','closed')),
  filed_at timestamptz,
  response_due_at timestamptz, -- filed_at + 30 days (RTI Act s.7(1))
  created_at timestamptz not null default now()
);

create index civic_rti_requests_user_idx
  on civic_rti_requests (user_id, created_at desc);
create index civic_rti_requests_issue_idx on civic_rti_requests (issue_id);

-- Statutory clock is stamped server-side and immutable after filing,
-- mirroring the civic_complaints SLA trigger.
create or replace function set_rti_response_due()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'filed' and old.status = 'drafted' then
    new.filed_at := now();
    new.response_due_at := new.filed_at + interval '30 days';
  end if;
  if old.status <> 'drafted' then
    new.filed_at := old.filed_at;
    new.response_due_at := old.response_due_at;
  end if;
  return new;
end;
$$;

create trigger civic_rti_requests_due
  before update on civic_rti_requests
  for each row execute function set_rti_response_due();

-- ── Row-level security ──────────────────────────────────────────────────────

alter table civic_works enable row level security;
alter table civic_work_submissions enable row level security;
alter table civic_rti_requests enable row level security;

-- The registry is public data; writes are service-role only (moderation,
-- scrapers, RTI-response ingestion).
create policy civic_works_public_read on civic_works
  for select using (true);

-- Board snaps are private to the submitter until promoted into civic_works.
create policy civic_work_submissions_own on civic_work_submissions
  for select using (auth.uid() = user_id);
create policy civic_work_submissions_insert_own on civic_work_submissions
  for insert with check (
    auth.uid() = user_id
    and status = 'pending_review'
    and work_id is null
  );

-- RTI requests are private to their author; the trigger owns the clock.
create policy civic_rti_requests_own on civic_rti_requests
  for select using (auth.uid() = user_id);
create policy civic_rti_requests_insert_own on civic_rti_requests
  for insert with check (
    auth.uid() = user_id
    and status = 'drafted'
    and filed_at is null
    and response_due_at is null
  );
create policy civic_rti_requests_update_own on civic_rti_requests
  for update using (auth.uid() = user_id);
