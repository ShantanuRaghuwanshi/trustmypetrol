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
