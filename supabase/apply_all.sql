-- TrustMyPetrol: full schema + Pune seed. Safe to run once on a fresh project.
-- GENERATED: cat migrations/*.sql seed/0001_pune_pilot.sql — regenerate after adding a migration.

-- Extensions required by the schema.
create extension if not exists postgis;
create extension if not exists pgcrypto; -- gen_random_uuid
-- Core schema. See docs/MVP-ARCHITECTURE.md for the model rationale.

create type omc as enum ('IOCL','BPCL','HPCL','NAYARA','JIO_BP','SHELL','OTHER');
create type pump_status as enum ('active','closed','unverified');
create type verification as enum ('geo_verified','location_mismatch','unverified');
create type report_status as enum ('published','pending_moderation','removed');
create type complaint_channel as enum ('cpgrams','omc_portal','other');
create type complaint_status as enum ('drafted','filed','responded','closed');

-- Profile row per auth user (Supabase auth.users holds phone/google identity).
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Anonymous',
  trust_level int not null default 0 check (trust_level between 0 and 2),
  is_banned boolean not null default false,
  created_at timestamptz not null default now()
);

create table pumps (
  id uuid primary key default gen_random_uuid(),
  omc omc not null,
  dealer_code text not null,
  name text not null,
  address text not null,
  district text not null,
  state text not null,
  location geography(point, 4326) not null,
  blends jsonb not null default '{"e10":false,"e20":true,"e100":false,"premium":false,"cng":false}',
  status pump_status not null default 'active',
  claimed_by uuid,
  created_at timestamptz not null default now(),
  unique (omc, dealer_code)
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  pump_id uuid not null references pumps(id),
  signals text[] not null check (
    array_length(signals, 1) between 1 and 6
    and signals <@ array[
      'mileage_drop','engine_trouble','short_fuelling','meter_issue',
      'density_check_refused','no_e20_labelling','overcharge',
      'good_experience','blend_update'
    ]
  ),
  free_text text check (char_length(free_text) <= 500),
  odo_km int check (odo_km > 0),
  litres numeric(7,2) check (litres > 0),
  amount_inr numeric(9,2) check (amount_inr > 0),
  verification verification not null default 'unverified',
  device_lat double precision,
  device_lng double precision,
  distance_to_pump_m numeric(8,1),
  status report_status not null default 'pending_moderation',
  reported_at timestamptz not null default now()
);

create table report_photos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  storage_path text not null,
  sha256 text not null,
  captured_at timestamptz not null,
  received_at timestamptz not null default now(),
  device_lat double precision,
  device_lng double precision,
  mock_location boolean not null default false,
  exif_stripped boolean not null default false
);

create table complaints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  pump_id uuid not null references pumps(id),
  report_id uuid references reports(id),
  channel complaint_channel not null,
  reference_no text,
  status complaint_status not null default 'drafted',
  filed_at timestamptz,
  last_nudged_at timestamptz,
  created_at timestamptz not null default now()
);

create table dealer_accounts (
  id uuid primary key default gen_random_uuid(),
  pump_id uuid not null references pumps(id) unique,
  user_id uuid not null references profiles(id),
  contact_phone text,
  verification_doc_path text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

alter table pumps
  add constraint pumps_claimed_by_fkey
  foreign key (claimed_by) references dealer_accounts(id);

create table dealer_responses (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) unique,
  dealer_account_id uuid not null references dealer_accounts(id),
  body text not null check (char_length(body) <= 500),
  created_at timestamptz not null default now()
);

-- Scores are computed in application code (packages/shared is the single
-- source of truth for the maths) and persisted here by a scheduled job /
-- Edge Function after each report insert.
create table pump_scores (
  pump_id uuid primary key references pumps(id) on delete cascade,
  score int check (score between 0 and 100), -- null = not enough data
  report_count_90d int not null default 0,
  counted_reports int not null default 0,
  geo_verified_ratio numeric(4,3) not null default 0,
  signal_counts jsonb not null default '{}',
  computed_at timestamptz not null default now()
);
-- Indexes and geo helpers.

create index pumps_location_gix on pumps using gist (location);
create index pumps_district_idx on pumps (state, district);
create index reports_pump_recent_idx on reports (pump_id, reported_at desc)
  where status = 'published';
create index reports_user_pump_idx on reports (user_id, pump_id, reported_at desc);
create index complaints_user_idx on complaints (user_id, created_at desc);

-- Nearby-pump lookup for the map viewport.
create or replace function pumps_near(
  in_lat double precision,
  in_lng double precision,
  in_radius_m double precision default 5000
)
returns setof pumps
language sql stable
as $$
  select *
  from pumps
  where status = 'active'
    and st_dwithin(
      location,
      st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography,
      in_radius_m
    )
  order by location <-> st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography
  limit 200;
$$;

-- Server-side capture classification: mirrors classifyCapture() in
-- packages/shared (150 m radius, 10 min capture-to-upload gap, mock flag).
create or replace function classify_capture(
  in_pump_id uuid,
  in_lat double precision,
  in_lng double precision,
  in_captured_at timestamptz,
  in_mock boolean
)
returns table (verification verification, distance_m numeric)
language plpgsql stable
as $$
declare
  d numeric;
  gap_min numeric;
begin
  select st_distance(
           p.location,
           st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography
         )::numeric
    into d
    from pumps p where p.id = in_pump_id;

  if d is null then
    raise exception 'unknown pump %', in_pump_id;
  end if;

  gap_min := extract(epoch from (now() - in_captured_at)) / 60.0;

  if in_mock or gap_min < 0 or gap_min > 10 then
    return query select 'unverified'::verification, round(d, 1);
  elsif d > 150 then
    return query select 'location_mismatch'::verification, round(d, 1);
  else
    return query select 'geo_verified'::verification, round(d, 1);
  end if;
end;
$$;

-- Rate-limit guard: at most 5 reports per user per day, 1 per pump per 7 days.
create or replace function enforce_report_limits()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from reports
      where user_id = new.user_id
        and reported_at > now() - interval '1 day') >= 5 then
    raise exception 'daily report limit reached';
  end if;
  if exists (select 1 from reports
      where user_id = new.user_id
        and pump_id = new.pump_id
        and reported_at > now() - interval '7 days') then
    raise exception 'already reported this pump in the last 7 days';
  end if;
  return new;
end;
$$;

create trigger reports_rate_limit
  before insert on reports
  for each row execute function enforce_report_limits();
-- Row-level security. anon = public web readers; authenticated = app users.

alter table profiles enable row level security;
alter table pumps enable row level security;
alter table reports enable row level security;
alter table report_photos enable row level security;
alter table complaints enable row level security;
alter table dealer_accounts enable row level security;
alter table dealer_responses enable row level security;
alter table pump_scores enable row level security;

-- Profiles: owners read/update their own row; display fields are exposed
-- through views/joins server-side, not by direct table reads.
create policy profiles_self_select on profiles
  for select using (auth.uid() = id);
create policy profiles_self_update on profiles
  for update using (auth.uid() = id);

-- Pumps and scores are public data.
create policy pumps_public_read on pumps
  for select using (true);
create policy pump_scores_public_read on pump_scores
  for select using (true);

-- Reports: everyone reads published ones; authors read their own regardless;
-- authors insert as themselves (verification/status are set server-side via
-- Edge Function using the service role, so clients cannot self-verify).
create policy reports_public_read on reports
  for select using (status = 'published' or auth.uid() = user_id);
create policy reports_insert_own on reports
  for insert with check (
    auth.uid() = user_id
    and verification = 'unverified'
    and status = 'pending_moderation'
  );

-- Photos: readable when the parent report is published; inserted by owner.
create policy report_photos_read on report_photos
  for select using (
    exists (select 1 from reports r
            where r.id = report_id
              and (r.status = 'published' or r.user_id = auth.uid()))
  );
create policy report_photos_insert_own on report_photos
  for insert with check (
    exists (select 1 from reports r
            where r.id = report_id and r.user_id = auth.uid())
  );

-- Complaints are private to their author.
create policy complaints_own on complaints
  for select using (auth.uid() = user_id);
create policy complaints_insert_own on complaints
  for insert with check (auth.uid() = user_id);
create policy complaints_update_own on complaints
  for update using (auth.uid() = user_id);

-- Dealer accounts: owner reads own; claims verified by staff (service role).
create policy dealer_accounts_own on dealer_accounts
  for select using (auth.uid() = user_id);
create policy dealer_accounts_insert_own on dealer_accounts
  for insert with check (auth.uid() = user_id);

-- Dealer responses are public; only the verified dealer of the pump inserts.
create policy dealer_responses_public_read on dealer_responses
  for select using (true);
create policy dealer_responses_insert_dealer on dealer_responses
  for insert with check (
    exists (
      select 1
      from dealer_accounts da
      join reports r on r.id = report_id and r.pump_id = da.pump_id
      where da.id = dealer_account_id
        and da.user_id = auth.uid()
        and da.verified
    )
  );
-- Client-facing API surface: everything the apps need without Edge Functions.

-- Plain lat/lng for PostgREST clients (geography serialises as WKB otherwise).
alter table pumps
  add column lat double precision generated always as (st_y(location::geometry)) stored,
  add column lng double precision generated always as (st_x(location::geometry)) stored;

-- Auto-create a profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Server-side report submission. SECURITY DEFINER so verification is
-- classified on the server from capture evidence — clients can never
-- self-verify (the RLS insert policy stays locked down for direct writes).
-- v1 publishes immediately; a moderation queue can flip the default later.
create or replace function public.submit_report(
  in_pump_id uuid,
  in_signals text[],
  in_free_text text default null,
  in_litres numeric default null,
  in_amount_inr numeric default null,
  in_odo_km int default null,
  in_lat double precision default null,
  in_lng double precision default null,
  in_captured_at timestamptz default null,
  in_mock boolean default false
)
returns table (report_id uuid, verification verification, distance_m numeric)
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v verification := 'unverified';
  d numeric := null;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  insert into profiles (id) values (uid) on conflict (id) do nothing;

  if (select is_banned from profiles where id = uid) then
    raise exception 'account suspended';
  end if;

  if in_lat is not null and in_lng is not null and in_captured_at is not null then
    select c.verification, c.distance_m into v, d
    from classify_capture(in_pump_id, in_lat, in_lng, in_captured_at, in_mock) c;
  end if;

  return query
  insert into reports (
    user_id, pump_id, signals, free_text, litres, amount_inr, odo_km,
    verification, device_lat, device_lng, distance_to_pump_m, status
  ) values (
    uid, in_pump_id, in_signals, nullif(trim(in_free_text), ''),
    in_litres, in_amount_inr, in_odo_km,
    v, in_lat, in_lng, d, 'published'
  )
  returning reports.id, reports.verification, reports.distance_to_pump_m;
end;
$$;

revoke all on function public.submit_report from public;
grant execute on function public.submit_report to authenticated;

-- Private evidence bucket: reporters write and read only their own folder
-- (photos serve complaints as evidence; public display comes later, after
-- EXIF stripping is in place).
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;

create policy evidence_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy evidence_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
-- Post-E20-rollout updates (E20 mandatory nationwide since April 2026;
-- E22–E30 standards notified as IS 19850:2026).

-- New observable signal: water contamination / phase separation — the
-- second-biggest complaint category with universal ethanol blending.
alter table reports drop constraint if exists reports_signals_check;
alter table reports add constraint reports_signals_check check (
  array_length(signals, 1) between 1 and 6
  and signals <@ array[
    'mileage_drop','engine_trouble','short_fuelling','meter_issue',
    'density_check_refused','no_e20_labelling','water_in_fuel','overcharge',
    'good_experience','blend_update'
  ]
);

-- Blends model: e10 is gone from the market; track higher blends (E25+)
-- and unblended super-premium instead. Data migration for existing rows.
alter table pumps alter column blends set default
  '{"e20":true,"higherBlends":false,"e100":false,"premium":false,"cng":false}';

update pumps
set blends = (blends - 'e10')
  || jsonb_build_object(
       'higherBlends',
       coalesce((blends->>'higherBlends')::boolean, false)
     )
where blends ? 'e10' or not (blends ? 'higherBlends');
-- Civic infrastructure reporting (Phase 1): jurisdiction resolution + the
-- pothole/drainage report flow. Domain logic mirrors packages/civic — that
-- package is the single source of truth for vocabulary, precedence rules,
-- and constants; keep the mirrors noted below in sync with it.
-- See docs/CIVIC-INFRA-EXPANSION.md for the model rationale.

create type agency_kind as enum ('ulb','state_pwd','nhai','pmgsy');
create type civic_issue_status as enum ('open','in_progress','resolved','reopened');
create type civic_report_kind as enum ('report','resolved_confirmation');

-- ── Reference data ─────────────────────────────────────────────────────────

-- Mirrors ISSUE_TYPES in packages/civic/src/issues.ts. Kept as a table (not a
-- check constraint) so submit_civic_report() reads cluster radii from here and
-- new types ship as data, not DDL.
create table civic_issue_types (
  slug text primary key,
  label text not null,
  category text not null check (category in ('roads','drainage','lighting','sanitation')),
  safety_critical boolean not null default false,
  cluster_radius_m int not null check (cluster_radius_m between 1 and 500)
);

insert into civic_issue_types (slug, label, category, safety_critical, cluster_radius_m) values
  ('pothole',             'Pothole',                     'roads',      false, 25),
  ('road_surface_damage', 'Damaged road surface',        'roads',      false, 50),
  ('broken_footpath',     'Broken footpath',             'roads',      false, 50),
  ('debris_on_road',      'Debris / material on road',   'roads',      false, 75),
  ('open_manhole',        'Open / broken manhole',       'drainage',   true,  25),
  ('choked_drain',        'Choked drain',                'drainage',   false, 50),
  ('sewage_overflow',     'Sewage overflow',             'drainage',   false, 75),
  ('waterlogging',        'Waterlogging',                'drainage',   false, 150),
  ('streetlight_out',     'Streetlight not working',     'lighting',   false, 30),
  ('exposed_wiring',      'Exposed electrical wiring',   'lighting',   true,  30),
  ('garbage_blackspot',   'Garbage black-spot',          'sanitation', false, 75);

-- Mirrors AGENCIES in packages/civic/src/agencies.ts. Portal data is real and
-- source-verified there; null portal means "file via CPGRAMS" — never invented.
create table civic_agencies (
  slug text primary key,
  kind agency_kind not null,
  name text not null,
  state text not null,
  city text,
  portal jsonb,      -- {name, url|null, appName?, helpline?}
  escalation jsonb,  -- state grievance portal, same shape
  created_at timestamptz not null default now()
);

insert into civic_agencies (slug, kind, name, state, city, portal, escalation) values
  ('ulb-pune','ulb','Pune Municipal Corporation','Maharashtra','Pune',
   '{"name":"PMC Complaint Management System","url":"https://complaint.pmc.gov.in/","appName":"PMC CARE"}',
   '{"name":"Aaple Sarkar Grievance Redressal","url":"https://grievances.maharashtra.gov.in/"}'),
  ('ulb-mumbai','ulb','Brihanmumbai Municipal Corporation','Maharashtra','Mumbai',
   '{"name":"MyBMC Complaint Registration","url":"https://portal.mcgm.gov.in/irj/portal/anonymous/qlcomplaintreg","appName":"MyBMC","helpline":"1916"}',
   '{"name":"Aaple Sarkar Grievance Redressal","url":"https://grievances.maharashtra.gov.in/"}'),
  ('ulb-delhi','ulb','Municipal Corporation of Delhi','Delhi','Delhi',
   '{"name":"MCD311","url":"https://mcdonline.nic.in/","appName":"MCD311","helpline":"1800-110-093"}', null),
  ('ulb-bengaluru','ulb','Bruhat Bengaluru Mahanagara Palike','Karnataka','Bengaluru',
   '{"name":"BBMP Sahaaya","url":"https://bbmp.sahaaya.in/","appName":"Sahaaya 2.0","helpline":"1533"}', null),
  ('ulb-hyderabad','ulb','Greater Hyderabad Municipal Corporation','Telangana','Hyderabad',
   '{"name":"GHMC Grievances","url":"https://www.ghmc.gov.in/","appName":"MyGHMC","helpline":"040-21111111"}', null),
  ('ulb-chennai','ulb','Greater Chennai Corporation','Tamil Nadu','Chennai',
   '{"name":"GCC Grievances","url":"https://chennaicorporation.gov.in/","appName":"Namma Chennai","helpline":"1913"}', null),
  ('ulb-kolkata','ulb','Kolkata Municipal Corporation','West Bengal','Kolkata',
   '{"name":"KMC Grievance Redressal","url":"https://www.kmcgov.in/KMCPortal/ComplaintFormAction.do"}', null),
  ('ulb-ahmedabad','ulb','Amdavad Municipal Corporation','Gujarat','Ahmedabad',
   '{"name":"AMC Comprehensive Complaint Redressal System","url":"http://www.amccrs.com/","appName":"AMC CCRS Official","helpline":"155303"}', null),
  ('pwd-maharashtra','state_pwd','Maharashtra Public Works Department','Maharashtra',null,
   '{"name":"Maharashtra PWD Grievance Redressal","url":"https://pwd.maharashtra.gov.in/en/grievance-redressal/"}',
   '{"name":"Aaple Sarkar Grievance Redressal","url":"https://grievances.maharashtra.gov.in/"}'),
  ('pwd-delhi','state_pwd','Public Works Department, Delhi','Delhi',null,
   '{"name":"PWD Sewa","url":null,"appName":"PWD Sewa"}', null),
  ('pwd-karnataka','state_pwd','Karnataka Public Works Department','Karnataka',null, null, null),
  ('pwd-telangana','state_pwd','Telangana Roads & Buildings Department','Telangana',null, null, null),
  ('pwd-tamil-nadu','state_pwd','Tamil Nadu Highways Department','Tamil Nadu',null, null, null),
  ('pwd-west-bengal','state_pwd','West Bengal Public Works Department','West Bengal',null, null, null),
  ('pwd-gujarat','state_pwd','Gujarat Roads & Buildings Department','Gujarat',null, null, null),
  ('nhai','nhai','National Highways Authority of India','India',null,
   '{"name":"NHAI Rajmargyatra","url":"https://nhai.gov.in/","appName":"Rajmargyatra","helpline":"1033"}', null),
  ('pmgsy','pmgsy','Pradhan Mantri Gram Sadak Yojana (NRIDA)','India',null,
   '{"name":"Meri Sadak","url":"https://rural.nic.in/en/services/meri-sadak-pmgsy","appName":"Meri Sadak"}', null);

-- ── Boundary geometry (loaded from real OSM data, see scripts/import-boundaries.ts) ──

-- ULB municipal limits. Rows are inserted by supabase/seed/0004_boundaries.sql,
-- generated from OpenStreetMap/Nominatim (© OpenStreetMap contributors, ODbL —
-- attribution required wherever displayed). Tables stay empty rather than ever
-- holding fabricated geometry; the resolver degrades to 'unresolved'.
create table admin_boundaries (
  id uuid primary key default gen_random_uuid(),
  agency_slug text not null references civic_agencies(slug),
  name text not null,
  boundary geography(multipolygon, 4326) not null,
  source text not null default 'osm',
  source_ref text,          -- OSM relation id
  source_url text,
  fetched_at timestamptz not null,
  unique (agency_slug)
);

-- National Highway centrelines near the pilot metros (OSM ways, ref=NH*).
create table nh_routes (
  id uuid primary key default gen_random_uuid(),
  ref text not null,        -- normalised, e.g. 'NH 48'
  geom geography(linestring, 4326) not null,
  source text not null default 'osm',
  source_ref text,          -- OSM way id
  fetched_at timestamptz not null
);

-- ── Issues & reports ───────────────────────────────────────────────────────

-- A deduplicated, mapped issue. Individual reports attach to exactly one
-- issue; report_count is the crowd-severity signal.
create table civic_issues (
  id uuid primary key default gen_random_uuid(),
  issue_type text not null references civic_issue_types(slug),
  status civic_issue_status not null default 'open',
  location geography(point, 4326) not null, -- first report's capture point
  agency_kind agency_kind,                  -- null = unresolved jurisdiction
  agency_slug text references civic_agencies(slug),
  road_ref text,                            -- NH ref when matched via road geometry
  report_count int not null default 0,
  first_reported_at timestamptz not null default now(),
  last_reported_at timestamptz not null default now(),
  resolved_at timestamptz,
  check ((agency_kind is null) = (agency_slug is null))
);

create table civic_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  issue_id uuid not null references civic_issues(id),
  kind civic_report_kind not null default 'report',
  issue_type text not null references civic_issue_types(slug),
  description text check (char_length(description) <= 500),
  severity text check (severity in ('minor','major','severe')),
  verification verification not null default 'unverified',
  device_lat double precision not null,
  device_lng double precision not null,
  accuracy_m numeric(7,1) not null,
  status report_status not null default 'pending_moderation',
  reported_at timestamptz not null default now()
);

create table civic_report_photos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references civic_reports(id) on delete cascade,
  storage_path text not null,
  sha256 text not null,
  captured_at timestamptz not null,
  received_at timestamptz not null default now(),
  device_lat double precision,
  device_lng double precision,
  mock_location boolean not null default false,
  exif_stripped boolean not null default false
);

-- Plain lat/lng for PostgREST clients (geography serialises as WKB otherwise).
alter table civic_issues
  add column lat double precision generated always as (st_y(location::geometry)) stored,
  add column lng double precision generated always as (st_x(location::geometry)) stored;

-- ── Indexes ────────────────────────────────────────────────────────────────

create index admin_boundaries_gix on admin_boundaries using gist (boundary);
create index nh_routes_gix on nh_routes using gist (geom);
create index civic_issues_location_gix on civic_issues using gist (location);
create index civic_issues_open_by_type_idx on civic_issues (issue_type, status);
create index civic_issues_agency_idx on civic_issues (agency_slug, status);
create index civic_reports_issue_idx on civic_reports (issue_id, reported_at desc)
  where status = 'published';
create index civic_reports_user_idx on civic_reports (user_id, reported_at desc);

-- ── Jurisdiction resolution ────────────────────────────────────────────────

-- Mirrors classifyJurisdiction() in packages/civic/src/resolver.ts.
-- Constants shared with the TS side: NH buffer 60 m, state-PWD fallback 25 km.
-- Precedence: NH proximity → ULB containment → peri-urban state PWD → unresolved.
create or replace function public.resolve_jurisdiction(
  in_lat double precision,
  in_lng double precision
)
returns table (kind agency_kind, agency_slug text, road_ref text)
language plpgsql stable
as $$
declare
  pt geography := st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography;
  nh text;
  ulb text;
  nearest_state text;
begin
  -- 1. On a National Highway (within 60 m of the centreline)?
  select r.ref into nh
  from nh_routes r
  where st_dwithin(r.geom, pt, 60)
  order by r.geom <-> pt
  limit 1;
  if nh is not null then
    return query select 'nhai'::agency_kind, 'nhai'::text, nh;
    return;
  end if;

  -- 2. Inside a ULB municipal boundary?
  select b.agency_slug into ulb
  from admin_boundaries b
  where st_covers(b.boundary, pt)
  limit 1;
  if ulb is not null then
    return query select 'ulb'::agency_kind, ulb, null::text;
    return;
  end if;

  -- 3. Peri-urban band (within 25 km of a ULB limit) → that state's PWD.
  select a.state into nearest_state
  from admin_boundaries b
  join civic_agencies a on a.slug = b.agency_slug
  where st_dwithin(b.boundary, pt, 25000)
  order by b.boundary <-> pt
  limit 1;
  if nearest_state is not null then
    return query
      select 'state_pwd'::agency_kind, a.slug, null::text
      from civic_agencies a
      where a.kind = 'state_pwd' and a.state = nearest_state
      limit 1;
    if found then
      return;
    end if;
  end if;

  -- 4. Unresolved — the report is still accepted; CPGRAMS routes internally.
  return query select null::agency_kind, null::text, null::text;
end;
$$;

-- Mirrors classifyCivicCapture() in packages/civic/src/resolver.ts
-- (10 min capture-to-upload gap from @tmp/shared, 100 m accuracy ceiling).
create or replace function public.classify_civic_capture(
  in_accuracy_m double precision,
  in_captured_at timestamptz,
  in_mock boolean
)
returns verification
language plpgsql stable
as $$
declare
  gap_min numeric := extract(epoch from (now() - in_captured_at)) / 60.0;
begin
  if in_mock or gap_min < 0 or gap_min > 10 then
    return 'unverified';
  elsif in_accuracy_m > 100 then
    return 'location_mismatch';
  else
    return 'geo_verified';
  end if;
end;
$$;

-- ── Submission (the only write path) ───────────────────────────────────────

-- SECURITY DEFINER: verification, jurisdiction, and clustering are all
-- derived server-side — clients can never self-verify, pick an agency, or
-- choose which issue to inflate. There is deliberately no direct-insert RLS
-- policy on civic_reports/civic_issues.
--
-- Clustering: attach to the nearest open issue of the same type within the
-- type's cluster radius (from civic_issue_types); otherwise open a new issue.
-- A 'resolved_confirmation' requires an existing issue — it can never open one.
create or replace function public.submit_civic_report(
  in_issue_type text,
  in_lat double precision,
  in_lng double precision,
  in_accuracy_m double precision,
  in_captured_at timestamptz,
  in_mock boolean default false,
  in_kind civic_report_kind default 'report',
  in_description text default null,
  in_severity text default null
)
returns table (report_id uuid, issue_id uuid, verification verification, agency_slug text)
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pt geography := st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography;
  radius_m int;
  v verification;
  j record;
  target_issue uuid;
  out_agency text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if in_lat is null or in_lng is null or in_accuracy_m is null or in_captured_at is null then
    raise exception 'capture evidence is required';
  end if;

  insert into profiles (id) values (uid) on conflict (id) do nothing;
  if (select is_banned from profiles where id = uid) then
    raise exception 'account suspended';
  end if;

  select t.cluster_radius_m into radius_m
  from civic_issue_types t where t.slug = in_issue_type;
  if radius_m is null then
    raise exception 'unknown issue type %', in_issue_type;
  end if;

  v := classify_civic_capture(in_accuracy_m, in_captured_at, in_mock);

  -- Nearest matching open issue within the type's cluster radius.
  select i.id into target_issue
  from civic_issues i
  where i.issue_type = in_issue_type
    and i.status in ('open','in_progress','reopened')
    and st_dwithin(i.location, pt, radius_m)
  order by i.location <-> pt
  limit 1;

  if target_issue is null then
    if in_kind = 'resolved_confirmation' then
      raise exception 'no open issue here to confirm as resolved';
    end if;
    select * into j from resolve_jurisdiction(in_lat, in_lng);
    insert into civic_issues (issue_type, location, agency_kind, agency_slug, road_ref)
    values (in_issue_type, pt, j.kind, j.agency_slug, j.road_ref)
    returning id into target_issue;
  end if;

  update civic_issues
     set report_count = report_count + 1,
         last_reported_at = now()
   where id = target_issue
  returning civic_issues.agency_slug into out_agency;

  return query
  insert into civic_reports (
    user_id, issue_id, kind, issue_type, description, severity,
    verification, device_lat, device_lng, accuracy_m, status
  ) values (
    uid, target_issue, in_kind, in_issue_type,
    nullif(trim(in_description), ''),
    case when in_severity in ('minor','major','severe') then in_severity end,
    v, in_lat, in_lng, round(in_accuracy_m::numeric, 1), 'published'
  )
  returning civic_reports.id, civic_reports.issue_id, civic_reports.verification, out_agency;
end;
$$;

revoke all on function public.submit_civic_report from public;
grant execute on function public.submit_civic_report to authenticated;
-- resolve_jurisdiction is safe read-only metadata — useful to the web map.
grant execute on function public.resolve_jurisdiction to anon, authenticated;

-- Rate limits mirror fuel reports: 10 civic reports/user/day; one report per
-- user per issue per 24 h (re-reporting the same issue daily is noise).
create or replace function enforce_civic_report_limits()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from civic_reports
      where user_id = new.user_id
        and reported_at > now() - interval '1 day') >= 10 then
    raise exception 'daily civic report limit reached';
  end if;
  if exists (select 1 from civic_reports
      where user_id = new.user_id
        and issue_id = new.issue_id
        and reported_at > now() - interval '1 day') then
    raise exception 'already reported this issue in the last 24 hours';
  end if;
  return new;
end;
$$;

create trigger civic_reports_rate_limit
  before insert on civic_reports
  for each row execute function enforce_civic_report_limits();

-- ── Nearby-issue lookup for the map viewport ───────────────────────────────

create or replace function public.civic_issues_near(
  in_lat double precision,
  in_lng double precision,
  in_radius_m double precision default 5000
)
returns setof civic_issues
language sql stable
as $$
  select *
  from civic_issues
  where st_dwithin(
      location,
      st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography,
      in_radius_m
    )
  order by location <-> st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography
  limit 500;
$$;

-- ── Row-level security ─────────────────────────────────────────────────────

alter table civic_issue_types enable row level security;
alter table civic_agencies enable row level security;
alter table admin_boundaries enable row level security;
alter table nh_routes enable row level security;
alter table civic_issues enable row level security;
alter table civic_reports enable row level security;
alter table civic_report_photos enable row level security;

-- Reference and geometry data are public reads; writes are service-role only
-- (no insert/update policies).
create policy civic_issue_types_public_read on civic_issue_types
  for select using (true);
create policy civic_agencies_public_read on civic_agencies
  for select using (true);
create policy admin_boundaries_public_read on admin_boundaries
  for select using (true);
create policy nh_routes_public_read on nh_routes
  for select using (true);

-- Issues are the public map surface.
create policy civic_issues_public_read on civic_issues
  for select using (true);

-- Reports: published ones are public; authors always see their own. All
-- writes go through submit_civic_report() — no direct-insert policy.
create policy civic_reports_public_read on civic_reports
  for select using (status = 'published' or auth.uid() = user_id);

-- Photos mirror report visibility; owners upload against their own reports.
create policy civic_report_photos_read on civic_report_photos
  for select using (
    exists (select 1 from civic_reports r
            where r.id = report_id
              and (r.status = 'published' or r.user_id = auth.uid()))
  );
create policy civic_report_photos_insert_own on civic_report_photos
  for insert with check (
    exists (select 1 from civic_reports r
            where r.id = report_id and r.user_id = auth.uid())
  );
-- Civic complaints (Phase 2): assisted filing + token tracking + SLA timers.
-- Ladder and draft logic live in packages/civic/src/complaint.ts (single
-- source of truth); this migration stores the citizen's filing trail.
-- "Prepare, don't submit": rows record what the citizen filed and where —
-- the app never files on their behalf.

create type civic_complaint_channel as enum ('agency_portal','state_portal','cpgrams');
create type civic_complaint_status as enum ('drafted','filed','responded','escalated','closed');

create table civic_complaints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  issue_id uuid not null references civic_issues(id),
  report_id uuid references civic_reports(id),
  channel civic_complaint_channel not null,
  -- Agency the ladder step targets; null for the CPGRAMS backstop.
  agency_slug text references civic_agencies(slug),
  reference_no text check (reference_no ~ '^[A-Za-z0-9/\-]{4,40}$'),
  status civic_complaint_status not null default 'drafted',
  filed_at timestamptz,
  -- Reminder deadline: filed_at + 30 days (CPGRAMS' published SLA, used as
  -- the nudge default for all channels — see packages/civic CPGRAMS_SLA_DAYS).
  sla_due_at timestamptz,
  last_nudged_at timestamptz,
  escalated_from uuid references civic_complaints(id),
  created_at timestamptz not null default now(),
  check (escalated_from is distinct from id)
);

create index civic_complaints_user_idx on civic_complaints (user_id, created_at desc);
create index civic_complaints_issue_idx on civic_complaints (issue_id);
-- The nudge job scans for filed complaints past their SLA.
create index civic_complaints_sla_idx on civic_complaints (sla_due_at)
  where status = 'filed';

-- filed_at / sla_due_at are set server-side the moment a complaint moves to
-- 'filed', so SLA timers cannot be back- or forward-dated by clients.
create or replace function set_civic_complaint_sla()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'filed' and old.status = 'drafted' then
    new.filed_at := now();
    new.sla_due_at := new.filed_at + interval '30 days';
  end if;
  -- filing metadata is immutable once set
  if old.status <> 'drafted' then
    new.filed_at := old.filed_at;
    new.sla_due_at := old.sla_due_at;
  end if;
  return new;
end;
$$;

create trigger civic_complaints_sla
  before update on civic_complaints
  for each row execute function set_civic_complaint_sla();

-- When an issue gains a filed complaint, reflect activity on the issue row
-- (agencies and the public map both read this as "someone escalated").
create or replace function mark_issue_in_progress()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'filed' then
    update civic_issues set status = 'in_progress'
     where id = new.issue_id and status = 'open';
  end if;
  return new;
end;
$$;

create trigger civic_complaints_issue_progress
  after update on civic_complaints
  for each row execute function mark_issue_in_progress();

-- ── Row-level security: complaints are private to their author ────────────

alter table civic_complaints enable row level security;

create policy civic_complaints_own on civic_complaints
  for select using (auth.uid() = user_id);
create policy civic_complaints_insert_own on civic_complaints
  for insert with check (
    auth.uid() = user_id
    and status = 'drafted'          -- filing happens via update, so the SLA
    and filed_at is null            -- trigger is the only path to 'filed'
    and sla_due_at is null
  );
create policy civic_complaints_update_own on civic_complaints
  for update using (auth.uid() = user_id);
-- Community resolution loop (Phase 3): replaces submit_civic_report so that
--   1. a fresh 'report' near a *resolved* issue REOPENS it (fake-closure
--      catch — the map never forgets a recurring pothole), and
--   2. an issue flips to 'resolved' once 2 distinct reporters file a
--      'resolved_confirmation' on the spot (RESOLVED_CONFIRMATIONS_REQUIRED
--      in packages/civic/src/stats.ts — keep in sync).
-- Clustering now considers resolved issues too, so history accumulates on
-- one issue instead of spawning duplicates at the same location.

create or replace function public.submit_civic_report(
  in_issue_type text,
  in_lat double precision,
  in_lng double precision,
  in_accuracy_m double precision,
  in_captured_at timestamptz,
  in_mock boolean default false,
  in_kind civic_report_kind default 'report',
  in_description text default null,
  in_severity text default null
)
returns table (report_id uuid, issue_id uuid, verification verification, agency_slug text)
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pt geography := st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography;
  radius_m int;
  v verification;
  j record;
  target_issue uuid;
  target_status civic_issue_status;
  out_agency text;
  new_report uuid;
  confirmers int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if in_lat is null or in_lng is null or in_accuracy_m is null or in_captured_at is null then
    raise exception 'capture evidence is required';
  end if;

  insert into profiles (id) values (uid) on conflict (id) do nothing;
  if (select is_banned from profiles where id = uid) then
    raise exception 'account suspended';
  end if;

  select t.cluster_radius_m into radius_m
  from civic_issue_types t where t.slug = in_issue_type;
  if radius_m is null then
    raise exception 'unknown issue type %', in_issue_type;
  end if;

  v := classify_civic_capture(in_accuracy_m, in_captured_at, in_mock);

  -- Nearest issue of this type within the cluster radius, any status:
  -- resolved issues can be reopened or further confirmed, never duplicated.
  select i.id, i.status into target_issue, target_status
  from civic_issues i
  where i.issue_type = in_issue_type
    and st_dwithin(i.location, pt, radius_m)
  order by i.location <-> pt
  limit 1;

  if target_issue is null then
    if in_kind = 'resolved_confirmation' then
      raise exception 'no open issue here to confirm as resolved';
    end if;
    select * into j from resolve_jurisdiction(in_lat, in_lng);
    insert into civic_issues (issue_type, location, agency_kind, agency_slug, road_ref)
    values (in_issue_type, pt, j.kind, j.agency_slug, j.road_ref)
    returning id into target_issue;
    target_status := 'open';
  end if;

  update civic_issues
     set report_count = report_count + 1,
         last_reported_at = now()
   where id = target_issue
  returning civic_issues.agency_slug into out_agency;

  insert into civic_reports (
    user_id, issue_id, kind, issue_type, description, severity,
    verification, device_lat, device_lng, accuracy_m, status
  ) values (
    uid, target_issue, in_kind, in_issue_type,
    nullif(trim(in_description), ''),
    case when in_severity in ('minor','major','severe') then in_severity end,
    v, in_lat, in_lng, round(in_accuracy_m::numeric, 1), 'published'
  )
  returning civic_reports.id into new_report;

  if in_kind = 'report' and target_status = 'resolved' then
    -- The condition is back: reopen, and clear the stale resolution stamp.
    update civic_issues
       set status = 'reopened', resolved_at = null
     where id = target_issue;
  elsif in_kind = 'resolved_confirmation' and target_status <> 'resolved' then
    select count(distinct r.user_id) into confirmers
    from civic_reports r
    where r.issue_id = target_issue
      and r.kind = 'resolved_confirmation'
      and r.status = 'published';
    if confirmers >= 2 then
      update civic_issues
         set status = 'resolved', resolved_at = now()
       where id = target_issue;
    end if;
  end if;

  return query
  select new_report, target_issue, v, out_agency;
end;
$$;

-- Same grants as before (create or replace preserves them, restated for
-- clarity when this file is read standalone).
revoke all on function public.submit_civic_report from public;
grant execute on function public.submit_civic_report to authenticated;
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
-- Works ingestion support (Phase 5): official-record imports must be
-- idempotent, so a (source, source_ref) pair identifies a record uniquely —
-- scripts/import-works.ts upserts on it. Rows without a source_ref (e.g.
-- moderated board snaps) are exempt.

create unique index civic_works_source_ref_uidx
  on civic_works (source, source_ref)
  where source_ref is not null;
-- Pune pilot pumps. Names and dealer codes are illustrative placeholders —
-- replace with the OMC locator dataset before public launch. UUIDs match
-- packages/shared/src/seed.ts so the app's offline fallback stays consistent.

insert into pumps (id, omc, dealer_code, name, address, district, state, location, blends, status) values
  ('0b8f1c2e-1111-4a01-9a01-000000000001', 'IOCL', '41-C-118', 'Shree Ganesh Fuels',
   'Baner Road, near Sakal Nagar', 'Pune', 'Maharashtra',
   st_setsrid(st_makepoint(73.7868, 18.5590), 4326)::geography,
   '{"e10":false,"e20":true,"e100":false,"premium":false,"cng":false}', 'active'),
  ('0b8f1c2e-1111-4a01-9a01-000000000002', 'HPCL', 'MH-PN-2214', 'Aundh Service Station',
   'DP Road, Aundh', 'Pune', 'Maharashtra',
   st_setsrid(st_makepoint(73.8079, 18.5628), 4326)::geography,
   '{"e10":true,"e20":true,"e100":false,"premium":true,"cng":false}', 'active'),
  ('0b8f1c2e-1111-4a01-9a01-000000000003', 'BPCL', 'BP-41-0672', 'Kothrud Highway Services',
   'Paud Road, Kothrud', 'Pune', 'Maharashtra',
   st_setsrid(st_makepoint(73.8077, 18.5074), 4326)::geography,
   '{"e10":false,"e20":true,"e100":false,"premium":true,"cng":true}', 'active'),
  ('0b8f1c2e-1111-4a01-9a01-000000000004', 'IOCL', '41-C-231', 'Hinjewadi Fuel Point',
   'Phase 1, Hinjewadi IT Park Road', 'Pune', 'Maharashtra',
   st_setsrid(st_makepoint(73.7389, 18.5913), 4326)::geography,
   '{"e10":false,"e20":true,"e100":true,"premium":false,"cng":false}', 'active'),
  ('0b8f1c2e-1111-4a01-9a01-000000000005', 'HPCL', 'MH-PN-1830', 'Deccan Petro Services',
   'FC Road, Deccan Gymkhana', 'Pune', 'Maharashtra',
   st_setsrid(st_makepoint(73.8415, 18.5177), 4326)::geography,
   '{"e10":true,"e20":true,"e100":false,"premium":true,"cng":false}', 'active'),
  ('0b8f1c2e-1111-4a01-9a01-000000000006', 'NAYARA', 'NY-PN-0410', 'Hadapsar Auto Fuels',
   'Pune–Solapur Road, Hadapsar', 'Pune', 'Maharashtra',
   st_setsrid(st_makepoint(73.9260, 18.5089), 4326)::geography,
   '{"e10":false,"e20":true,"e100":false,"premium":false,"cng":true}', 'active'),
  ('0b8f1c2e-1111-4a01-9a01-000000000007', 'BPCL', 'BP-41-0951', 'Viman Nagar Fuel Stop',
   'Airport Road, Viman Nagar', 'Pune', 'Maharashtra',
   st_setsrid(st_makepoint(73.9143, 18.5679), 4326)::geography,
   '{"e10":false,"e20":true,"e100":false,"premium":true,"cng":false}', 'active'),
  ('0b8f1c2e-1111-4a01-9a01-000000000008', 'JIO_BP', 'JB-PN-0087', 'Wakad Mobility Station',
   'Hinjewadi–Wakad Road', 'Pune', 'Maharashtra',
   st_setsrid(st_makepoint(73.7707, 18.5989), 4326)::geography,
   '{"e10":true,"e20":true,"e100":false,"premium":true,"cng":false}', 'active');

insert into pump_scores (pump_id) select id from pumps
on conflict (pump_id) do nothing;
