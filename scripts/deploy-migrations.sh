#!/usr/bin/env bash
# Applies any missing migrations to the LIVE Supabase database, in order,
# by probing a marker object per migration — safe to re-run.
#
# Usage:
#   SUPABASE_DB_URL='postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres' \
#     bash scripts/deploy-migrations.sh
#
# Get the connection string from: Supabase Dashboard → Project Settings →
# Database → Connection string (URI). The pooler URL (port 6543) also works.
# Requires psql (brew install libpq / apt install postgresql-client).
set -euo pipefail
cd "$(dirname "$0")/.."

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL to the project postgres connection string}"

run() { psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q "$@"; }
probe() { run -tAc "$1" | head -1; }

# migration file → SQL that returns 't' when it is already applied
declare -a MIGRATIONS=(
  "0001_extensions.sql|select exists(select 1 from pg_extension where extname='postgis')"
  "0002_schema.sql|select exists(select 1 from information_schema.tables where table_name='pumps')"
  "0003_indexes_functions.sql|select exists(select 1 from pg_proc where proname='pumps_near')"
  "0004_rls.sql|select exists(select 1 from pg_policies where policyname='pumps_public_read')"
  "0005_client_api.sql|select exists(select 1 from pg_proc where proname='submit_report')"
  "0006_post_e20_rollout.sql|select exists(select 1 from pumps where blends ? 'higherBlends' limit 1) or not exists(select 1 from pumps)"
  "0007_civic_infra.sql|select exists(select 1 from information_schema.tables where table_name='civic_issues')"
  "0008_civic_complaints.sql|select exists(select 1 from information_schema.tables where table_name='civic_complaints')"
  "0009_civic_resolution.sql|select exists(select 1 from pg_proc where proname='submit_civic_report' and pg_get_functiondef(oid) like '%reopened%')"
  "0010_civic_works.sql|select exists(select 1 from information_schema.tables where table_name='civic_works')"
  "0011_civic_works_ingest.sql|select exists(select 1 from pg_indexes where indexname='civic_works_source_ref_uidx')"
)

echo "▸ target: $(probe 'select current_database() || chr(64) || inet_server_addr()::text' 2>/dev/null || echo 'connected')"

applied=0
for entry in "${MIGRATIONS[@]}"; do
  file="${entry%%|*}"
  check="${entry#*|}"
  if [ "$(probe "$check")" = "t" ]; then
    echo "✓ ${file} already applied"
  else
    echo "▸ applying ${file}…"
    run < "supabase/migrations/${file}"
    applied=$((applied+1))
  fi
done

echo
echo "Done — ${applied} migration(s) applied."

if [ ! -f supabase/seed/0004_boundaries.sql ]; then
  echo "⚠ supabase/seed/0004_boundaries.sql not found — the jurisdiction"
  echo "  resolver returns 'unresolved' until real boundary geometry is loaded:"
  echo "    node scripts/import-boundaries.ts"
  echo "    psql \"\$SUPABASE_DB_URL\" -f supabase/seed/0004_boundaries.sql"
else
  echo "▸ boundary seed found; apply/refresh with:"
  echo "    psql \"\$SUPABASE_DB_URL\" -f supabase/seed/0004_boundaries.sql"
fi
