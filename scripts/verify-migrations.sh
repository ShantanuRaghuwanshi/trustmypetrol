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

echo "✅ migrations, seed, and smoke checks all passed"
