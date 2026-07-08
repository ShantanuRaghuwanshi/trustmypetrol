-- TrustMyPetrol: full schema + Pune seed. Safe to run once on a fresh project.

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
