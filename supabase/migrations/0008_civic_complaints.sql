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
