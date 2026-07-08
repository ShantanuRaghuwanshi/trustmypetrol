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
for i in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U postgres -q 2>/dev/null; then break; fi
  sleep 1
  [ "$i" = 60 ] && { echo "postgres did not come up"; exit 1; }
done
sleep 2

psql_run() { docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "▸ shimming supabase auth schema…"
psql_run <<'SQL'
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid());
create or replace function auth.uid() returns uuid
  language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create role anon nologin;
create role authenticated nologin;
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

echo "▸ smoke: rate-limit trigger…"
psql_run <<'SQL'
do $$
declare uid uuid;
begin
  insert into auth.users default values returning id into uid;
  insert into profiles (id) values (uid);
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
