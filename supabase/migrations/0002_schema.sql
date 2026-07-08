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
