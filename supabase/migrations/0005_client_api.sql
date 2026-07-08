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
