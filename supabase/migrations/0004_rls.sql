-- Row-level security. anon = public web readers; authenticated = app users.

alter table profiles enable row level security;
alter table pumps enable row level security;
alter table reports enable row level security;
alter table report_photos enable row level security;
alter table complaints enable row level security;
alter table dealer_accounts enable row level security;
alter table dealer_responses enable row level security;
alter table pump_scores enable row level security;

-- Profiles: owners read/update their own row; display fields are exposed
-- through views/joins server-side, not by direct table reads.
create policy profiles_self_select on profiles
  for select using (auth.uid() = id);
create policy profiles_self_update on profiles
  for update using (auth.uid() = id);

-- Pumps and scores are public data.
create policy pumps_public_read on pumps
  for select using (true);
create policy pump_scores_public_read on pump_scores
  for select using (true);

-- Reports: everyone reads published ones; authors read their own regardless;
-- authors insert as themselves (verification/status are set server-side via
-- Edge Function using the service role, so clients cannot self-verify).
create policy reports_public_read on reports
  for select using (status = 'published' or auth.uid() = user_id);
create policy reports_insert_own on reports
  for insert with check (
    auth.uid() = user_id
    and verification = 'unverified'
    and status = 'pending_moderation'
  );

-- Photos: readable when the parent report is published; inserted by owner.
create policy report_photos_read on report_photos
  for select using (
    exists (select 1 from reports r
            where r.id = report_id
              and (r.status = 'published' or r.user_id = auth.uid()))
  );
create policy report_photos_insert_own on report_photos
  for insert with check (
    exists (select 1 from reports r
            where r.id = report_id and r.user_id = auth.uid())
  );

-- Complaints are private to their author.
create policy complaints_own on complaints
  for select using (auth.uid() = user_id);
create policy complaints_insert_own on complaints
  for insert with check (auth.uid() = user_id);
create policy complaints_update_own on complaints
  for update using (auth.uid() = user_id);

-- Dealer accounts: owner reads own; claims verified by staff (service role).
create policy dealer_accounts_own on dealer_accounts
  for select using (auth.uid() = user_id);
create policy dealer_accounts_insert_own on dealer_accounts
  for insert with check (auth.uid() = user_id);

-- Dealer responses are public; only the verified dealer of the pump inserts.
create policy dealer_responses_public_read on dealer_responses
  for select using (true);
create policy dealer_responses_insert_dealer on dealer_responses
  for insert with check (
    exists (
      select 1
      from dealer_accounts da
      join reports r on r.id = report_id and r.pump_id = da.pump_id
      where da.id = dealer_account_id
        and da.user_id = auth.uid()
        and da.verified
    )
  );
