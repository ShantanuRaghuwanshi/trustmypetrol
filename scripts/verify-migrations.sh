#!/usr/bin/env bash
# Applies all migrations + seed against a throwaway PostGIS container and runs
# smoke queries. Requires Docker. Usage: pnpm db:verify
set -euo pipefail
cd "$(dirname "$0")/.."

CONTAINER=tmp-db-verify
PORT=54329

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

echo "▸ starting postgis container…"
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres \
  -p "$PORT:5432" postgis/postgis:16-3.4 >/dev/null

echo "▸ waiting for postgres…"
# the image's init process starts and restarts the server once; wait for the
# init to finish, then for the final server to accept connections
for i in $(seq 1 120); do
  if docker logs "$CONTAINER" 2>&1 | grep -q "PostgreSQL init process complete" \
     && docker exec "$CONTAINER" pg_isready -U postgres -q 2>/dev/null; then
    break
  fi
  sleep 1
  [ "$i" = 120 ] && { echo "postgres did not come up"; exit 1; }
done

psql_run() { docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "▸ shimming supabase auth schema…"
psql_run <<'SQL'
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid());
create or replace function auth.uid() returns uuid
  language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create role anon nologin;
create role authenticated nologin;
-- storage schema shim (real Supabase provides this)
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean default false
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
SQL

for f in supabase/migrations/*.sql; do
  echo "▸ applying $f"
  psql_run < "$f"
done

for f in supabase/seed/*.sql; do
  echo "▸ seeding $f"
  psql_run < "$f"
done

echo "▸ smoke: pumps_near Baner (3 km)…"
psql_run -c "select name, omc from pumps_near(18.5590, 73.7868, 3000);"

echo "▸ smoke: classify_capture at / far from pump…"
psql_run -c "select * from classify_capture('0b8f1c2e-1111-4a01-9a01-000000000001', 18.5592, 73.7870, now(), false);"
psql_run -c "select * from classify_capture('0b8f1c2e-1111-4a01-9a01-000000000001', 18.5700, 73.7870, now(), false);"

echo "▸ smoke: submit_report RPC classifies and inserts…"
psql_run <<'SQL'
do $$
declare uid uuid; r record;
begin
  insert into auth.users default values returning id into uid;
  perform set_config('request.jwt.claim.sub', uid::text, true);
  select * into r from submit_report(
    '0b8f1c2e-1111-4a01-9a01-000000000001',
    array['mileage_drop','no_e20_labelling'],
    'test report', 4.96, 520, 31204,
    18.5592, 73.7870, now(), false
  );
  if r.verification <> 'geo_verified' then
    raise exception 'expected geo_verified, got %', r.verification;
  end if;
  if not exists (select 1 from profiles where id = uid) then
    raise exception 'profile was not auto-created';
  end if;
  if not exists (select 1 from reports where id = r.report_id and status = 'published') then
    raise exception 'report not published';
  end if;
  raise notice 'submit_report OK: % at % m', r.verification, r.distance_m;
end $$;
SQL

echo "▸ smoke: lat/lng generated columns…"
psql_run -c "select name, round(lat::numeric,4) lat, round(lng::numeric,4) lng from pumps limit 2;"

echo "▸ smoke: rate-limit trigger…"
psql_run <<'SQL'
do $$
declare uid uuid;
begin
  insert into auth.users default values returning id into uid;
  insert into profiles (id) values (uid) on conflict (id) do nothing;
  insert into reports (user_id, pump_id, signals)
    values (uid, '0b8f1c2e-1111-4a01-9a01-000000000001', array['mileage_drop']);
  begin
    insert into reports (user_id, pump_id, signals)
      values (uid, '0b8f1c2e-1111-4a01-9a01-000000000001', array['short_fuelling']);
    raise exception 'rate limit trigger did not fire';
  exception when others then
    if sqlerrm not like '%already reported%' then raise; end if;
    raise notice 'rate limit OK: %', sqlerrm;
  end;
end $$;
SQL

echo "▸ smoke: civic jurisdiction resolver…"
# Fixture geometry (throwaway container only): a square around central Pune
# for ulb-pune and one NH segment crossing it. Real geometry ships via
# scripts/import-boundaries.ts → supabase/seed/0004_boundaries.sql.
psql_run <<'SQL'
insert into admin_boundaries (agency_slug, name, boundary, source, fetched_at)
values ('ulb-pune', 'verify fixture: central Pune square',
  st_geogfromtext('MULTIPOLYGON(((73.80 18.48, 73.92 18.48, 73.92 18.56, 73.80 18.56, 73.80 18.48)))'),
  'verify-fixture', now());
insert into nh_routes (ref, geom, source, fetched_at)
values ('NH 48', st_geogfromtext('LINESTRING(73.85 18.50, 73.86 18.50)'),
  'verify-fixture', now());

do $$
declare r record;
begin
  -- on the NH inside the ULB square: NH precedence wins
  select * into r from resolve_jurisdiction(18.5000, 73.8550);
  if r.kind is distinct from 'nhai'::agency_kind or r.road_ref is distinct from 'NH 48' then
    raise exception 'expected nhai/NH 48, got %/%', r.kind, r.road_ref;
  end if;
  -- inside the square, off the highway: ULB
  select * into r from resolve_jurisdiction(18.5204, 73.8567);
  if r.agency_slug is distinct from 'ulb-pune' then
    raise exception 'expected ulb-pune, got %', r.agency_slug;
  end if;
  -- ~14 km east of the square: peri-urban state PWD fallback
  select * into r from resolve_jurisdiction(18.5200, 74.0500);
  if r.agency_slug is distinct from 'pwd-maharashtra' then
    raise exception 'expected pwd-maharashtra, got %', r.agency_slug;
  end if;
  -- open sea: unresolved, never guessed
  select * into r from resolve_jurisdiction(15.0000, 85.0000);
  if r.kind is not null then
    raise exception 'expected unresolved, got %', r.kind;
  end if;
  raise notice 'resolve_jurisdiction OK';
end $$;
SQL

echo "▸ smoke: submit_civic_report clusters duplicates…"
psql_run <<'SQL'
do $$
declare
  u1 uuid; u2 uuid;
  r1 record; r2 record; n int;
begin
  insert into auth.users default values returning id into u1;
  insert into auth.users default values returning id into u2;

  perform set_config('request.jwt.claim.sub', u1::text, true);
  select * into r1 from submit_civic_report(
    'pothole', 18.5204, 73.8567, 8.0, now(), false, 'report',
    'verify: deep pothole near bus stop', 'major');
  if r1.verification <> 'geo_verified' then
    raise exception 'expected geo_verified, got %', r1.verification;
  end if;
  if r1.agency_slug is distinct from 'ulb-pune' then
    raise exception 'expected ulb-pune routing, got %', r1.agency_slug;
  end if;

  -- second reporter ~11 m away: attaches to the same issue (25 m radius)
  perform set_config('request.jwt.claim.sub', u2::text, true);
  select * into r2 from submit_civic_report(
    'pothole', 18.5205, 73.8567, 10.0, now(), false);
  if r2.issue_id is distinct from r1.issue_id then
    raise exception 'duplicate pothole was not clustered';
  end if;
  select report_count into n from civic_issues where id = r1.issue_id;
  if n <> 2 then
    raise exception 'expected report_count 2, got %', n;
  end if;

  -- same user re-reporting the same issue within 24 h: rate-limited
  begin
    perform submit_civic_report('pothole', 18.5205, 73.8567, 10.0, now(), false);
    raise exception 'civic rate limit did not fire';
  exception when others then
    if sqlerrm not like '%already reported%' then raise; end if;
  end;

  -- resolved_confirmation with no nearby open issue: rejected
  begin
    perform submit_civic_report(
      'streetlight_out', 18.5300, 73.9000, 10.0, now(), false,
      'resolved_confirmation');
    raise exception 'orphan resolved_confirmation was accepted';
  exception when others then
    if sqlerrm not like '%no open issue%' then raise; end if;
  end;

  raise notice 'submit_civic_report OK: clustered % reports', n;
end $$;
SQL

echo "▸ smoke: civic lat/lng generated columns…"
psql_run -c "select issue_type, round(lat::numeric,4) lat, round(lng::numeric,4) lng, report_count from civic_issues limit 2;"

echo "▸ smoke: civic complaint SLA trigger + escalation trail…"
psql_run <<'SQL'
do $$
declare
  uid uuid; iss uuid; c uuid; c2 uuid; r record;
begin
  select user_id, issue_id into uid, iss
    from civic_reports order by reported_at limit 1;

  insert into civic_complaints (user_id, issue_id, channel, agency_slug)
    values (uid, iss, 'agency_portal', 'ulb-pune') returning id into c;

  -- filing sets the SLA server-side
  update civic_complaints
     set status = 'filed', reference_no = 'PMC/2026/TEST-001' where id = c;
  select * into r from civic_complaints where id = c;
  if r.filed_at is null or r.sla_due_at is null then
    raise exception 'SLA trigger did not set filed_at/sla_due_at';
  end if;
  if abs(extract(epoch from (r.sla_due_at - r.filed_at)) - 30*86400) > 1 then
    raise exception 'sla_due_at is not filed_at + 30 days';
  end if;

  -- issue reflects the escalation
  if (select status from civic_issues where id = iss) <> 'in_progress' then
    raise exception 'issue did not move to in_progress on filing';
  end if;

  -- filing metadata is immutable once filed
  update civic_complaints set filed_at = now() - interval '90 days',
                              sla_due_at = now() - interval '60 days'
   where id = c;
  if (select filed_at from civic_complaints where id = c)
     is distinct from r.filed_at then
    raise exception 'filed_at was client-mutable';
  end if;

  -- ladder step: escalate to the state portal
  update civic_complaints set status = 'escalated' where id = c;
  insert into civic_complaints (user_id, issue_id, channel, agency_slug, escalated_from)
    values (uid, iss, 'state_portal', 'ulb-pune', c) returning id into c2;
  if (select escalated_from from civic_complaints where id = c2) <> c then
    raise exception 'escalation trail broken';
  end if;

  raise notice 'civic complaints OK: SLA due %', r.sla_due_at;
end $$;
SQL

echo "▸ smoke: community resolution + reopen loop…"
psql_run <<'SQL'
do $$
declare
  u3 uuid; u4 uuid; u5 uuid; iss uuid; r record; st civic_issue_status;
begin
  select issue_id into iss from civic_reports
   where issue_type = 'pothole' order by reported_at limit 1;

  -- first confirmation: not enough on its own
  insert into auth.users default values returning id into u3;
  perform set_config('request.jwt.claim.sub', u3::text, true);
  perform submit_civic_report(
    'pothole', 18.5204, 73.8567, 9.0, now(), false, 'resolved_confirmation');
  select status into st from civic_issues where id = iss;
  if st = 'resolved' then
    raise exception 'issue resolved after a single confirmation';
  end if;

  -- second distinct confirmer: flips to resolved
  insert into auth.users default values returning id into u4;
  perform set_config('request.jwt.claim.sub', u4::text, true);
  perform submit_civic_report(
    'pothole', 18.5205, 73.8568, 9.0, now(), false, 'resolved_confirmation');
  select status into st from civic_issues where id = iss;
  if st <> 'resolved' then
    raise exception 'issue did not resolve after 2 distinct confirmations, got %', st;
  end if;
  if (select resolved_at from civic_issues where id = iss) is null then
    raise exception 'resolved_at not stamped';
  end if;

  -- the pothole is back: a fresh report reopens the same issue
  insert into auth.users default values returning id into u5;
  perform set_config('request.jwt.claim.sub', u5::text, true);
  select * into r from submit_civic_report(
    'pothole', 18.5204, 73.8567, 9.0, now(), false, 'report',
    'verify: it has reappeared', 'major');
  if r.issue_id is distinct from iss then
    raise exception 'reopening created a duplicate issue';
  end if;
  select status into st from civic_issues where id = iss;
  if st <> 'reopened' then
    raise exception 'issue did not reopen, got %', st;
  end if;
  if (select resolved_at from civic_issues where id = iss) is not null then
    raise exception 'stale resolved_at survived the reopen';
  end if;

  raise notice 'resolution loop OK: resolved by 2 confirmers, reopened on re-report';
end $$;
SQL

echo "▸ smoke: works registry, DLP lookup, RTI clock…"
psql_run <<'SQL'
do $$
declare
  u uuid; w uuid; sub uuid; rti uuid; r record; n int;
begin
  -- registry fixture (throwaway container only): a work covering central Pune
  insert into civic_works (agency_slug, title, contractor_name, cost_inr,
    work_order_no, start_date, completion_date, dlp_months, location, source, source_ref)
  values ('ulb-pune', 'verify fixture: Baner Road improvement',
    'M/s Example Infra Pvt Ltd', 42500000, 'PMC/RD/2024/0713',
    '2024-02-15', '2025-02-14', 36,
    st_setsrid(st_makepoint(73.8567, 18.5204), 4326)::geography,
    'display_board', 'verify-fixture')
  returning id into w;

  -- issue-page lookup: the pothole location falls inside the coverage circle
  select count(*) into n from civic_works_near(18.5204, 73.8567);
  if n < 1 then
    raise exception 'civic_works_near missed the covering work';
  end if;
  select count(*) into n from civic_works_near(15.0, 85.0);
  if n <> 0 then
    raise exception 'civic_works_near matched open sea';
  end if;

  -- board snap: private, pending review
  insert into auth.users default values returning id into u;
  insert into profiles (id) values (u) on conflict (id) do nothing;
  insert into civic_work_submissions (user_id, device_lat, device_lng,
    accuracy_m, raw_text, contractor_name, dlp_months)
  values (u, 18.5204, 73.8567, 9.0,
    'verify: Name of Contractor : M/s Example Infra Pvt Ltd',
    'M/s Example Infra Pvt Ltd', 36)
  returning id into sub;
  if (select status from civic_work_submissions where id = sub) <> 'pending_review' then
    raise exception 'board snap not pending review';
  end if;

  -- RTI clock: statutory 30 days stamped on filing, immutable after
  insert into civic_rti_requests (user_id, work_id, agency_slug, application_text)
  values (u, w, 'ulb-pune', 'verify: RTI application text') returning id into rti;
  update civic_rti_requests
     set status = 'filed', reference_no = 'MHRTI/2026/TEST-1' where id = rti;
  select * into r from civic_rti_requests where id = rti;
  if r.filed_at is null or r.response_due_at is null then
    raise exception 'RTI trigger did not stamp the clock';
  end if;
  if abs(extract(epoch from (r.response_due_at - r.filed_at)) - 30*86400) > 1 then
    raise exception 'RTI due date is not filed_at + 30 days';
  end if;
  update civic_rti_requests set response_due_at = now() where id = rti;
  if (select response_due_at from civic_rti_requests where id = rti)
     is distinct from r.response_due_at then
    raise exception 'RTI clock was client-mutable';
  end if;

  raise notice 'works + RTI OK: DLP lookup and statutory clock verified';
end $$;
SQL

echo "✅ migrations, seed, and smoke checks all passed"
