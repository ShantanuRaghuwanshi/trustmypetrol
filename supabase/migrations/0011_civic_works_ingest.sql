-- Works ingestion support (Phase 5): official-record imports must be
-- idempotent, so a (source, source_ref) pair identifies a record uniquely —
-- scripts/import-works.ts upserts on it. Rows without a source_ref (e.g.
-- moderated board snaps) are exempt.

create unique index civic_works_source_ref_uidx
  on civic_works (source, source_ref)
  where source_ref is not null;
