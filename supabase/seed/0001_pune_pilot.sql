-- Pune pilot pumps. Names and dealer codes are illustrative placeholders —
-- replace with the OMC locator dataset before public launch. UUIDs match
-- packages/shared/src/seed.ts so the app's offline fallback stays consistent.

insert into pumps (id, omc, dealer_code, name, address, district, state, location, blends, status) values
  ('0b8f1c2e-1111-4a01-9a01-000000000001', 'IOCL', '41-C-118', 'Shree Ganesh Fuels',
   'Baner Road, near Sakal Nagar', 'Pune', 'Maharashtra',
   st_setsrid(st_makepoint(73.7868, 18.5590), 4326)::geography,
   '{"e10":false,"e20":true,"e100":false,"premium":false,"cng":false}', 'active'),
  ('0b8f1c2e-1111-4a01-9a01-000000000002', 'HPCL', 'MH-PN-2214', 'Aundh Service Station',
   'DP Road, Aundh', 'Pune', 'Maharashtra',
   st_setsrid(st_makepoint(73.8079, 18.5628), 4326)::geography,
   '{"e10":true,"e20":true,"e100":false,"premium":true,"cng":false}', 'active'),
  ('0b8f1c2e-1111-4a01-9a01-000000000003', 'BPCL', 'BP-41-0672', 'Kothrud Highway Services',
   'Paud Road, Kothrud', 'Pune', 'Maharashtra',
   st_setsrid(st_makepoint(73.8077, 18.5074), 4326)::geography,
   '{"e10":false,"e20":true,"e100":false,"premium":true,"cng":true}', 'active'),
  ('0b8f1c2e-1111-4a01-9a01-000000000004', 'IOCL', '41-C-231', 'Hinjewadi Fuel Point',
   'Phase 1, Hinjewadi IT Park Road', 'Pune', 'Maharashtra',
   st_setsrid(st_makepoint(73.7389, 18.5913), 4326)::geography,
   '{"e10":false,"e20":true,"e100":true,"premium":false,"cng":false}', 'active'),
  ('0b8f1c2e-1111-4a01-9a01-000000000005', 'HPCL', 'MH-PN-1830', 'Deccan Petro Services',
   'FC Road, Deccan Gymkhana', 'Pune', 'Maharashtra',
   st_setsrid(st_makepoint(73.8415, 18.5177), 4326)::geography,
   '{"e10":true,"e20":true,"e100":false,"premium":true,"cng":false}', 'active'),
  ('0b8f1c2e-1111-4a01-9a01-000000000006', 'NAYARA', 'NY-PN-0410', 'Hadapsar Auto Fuels',
   'Pune–Solapur Road, Hadapsar', 'Pune', 'Maharashtra',
   st_setsrid(st_makepoint(73.9260, 18.5089), 4326)::geography,
   '{"e10":false,"e20":true,"e100":false,"premium":false,"cng":true}', 'active'),
  ('0b8f1c2e-1111-4a01-9a01-000000000007', 'BPCL', 'BP-41-0951', 'Viman Nagar Fuel Stop',
   'Airport Road, Viman Nagar', 'Pune', 'Maharashtra',
   st_setsrid(st_makepoint(73.9143, 18.5679), 4326)::geography,
   '{"e10":false,"e20":true,"e100":false,"premium":true,"cng":false}', 'active'),
  ('0b8f1c2e-1111-4a01-9a01-000000000008', 'JIO_BP', 'JB-PN-0087', 'Wakad Mobility Station',
   'Hinjewadi–Wakad Road', 'Pune', 'Maharashtra',
   st_setsrid(st_makepoint(73.7707, 18.5989), 4326)::geography,
   '{"e10":true,"e20":true,"e100":false,"premium":true,"cng":false}', 'active');

insert into pump_scores (pump_id) select id from pumps
on conflict (pump_id) do nothing;
