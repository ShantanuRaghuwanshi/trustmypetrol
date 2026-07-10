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
