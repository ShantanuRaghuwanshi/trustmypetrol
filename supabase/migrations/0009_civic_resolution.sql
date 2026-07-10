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
