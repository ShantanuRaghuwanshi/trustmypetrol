-- Post-E20-rollout updates (E20 mandatory nationwide since April 2026;
-- E22–E30 standards notified as IS 19850:2026).

-- New observable signal: water contamination / phase separation — the
-- second-biggest complaint category with universal ethanol blending.
alter table reports drop constraint if exists reports_signals_check;
alter table reports add constraint reports_signals_check check (
  array_length(signals, 1) between 1 and 6
  and signals <@ array[
    'mileage_drop','engine_trouble','short_fuelling','meter_issue',
    'density_check_refused','no_e20_labelling','water_in_fuel','overcharge',
    'good_experience','blend_update'
  ]
);

-- Blends model: e10 is gone from the market; track higher blends (E25+)
-- and unblended super-premium instead. Data migration for existing rows.
alter table pumps alter column blends set default
  '{"e20":true,"higherBlends":false,"e100":false,"premium":false,"cng":false}';

update pumps
set blends = (blends - 'e10')
  || jsonb_build_object(
       'higherBlends',
       coalesce((blends->>'higherBlends')::boolean, false)
     )
where blends ? 'e10' or not (blends ? 'higherBlends');
