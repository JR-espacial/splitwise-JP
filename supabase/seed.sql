-- Seed: one group with four hardcoded members. Fixed UUIDs so the seed is
-- idempotent and the data survives re-runs.

insert into groups (id, name, base_currency)
values ('11111111-1111-4111-8111-111111111111', 'Roadtrip Europa 2026', 'EUR')
on conflict (id) do nothing;

insert into members (id, group_id, name, color)
values
  ('22222222-2222-4222-8222-222222222221', '11111111-1111-4111-8111-111111111111', 'Jorge', '#34d399'),
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Ana',   '#f472b6'),
  ('22222222-2222-4222-8222-222222222223', '11111111-1111-4111-8111-111111111111', 'Luis',  '#60a5fa'),
  ('22222222-2222-4222-8222-222222222224', '11111111-1111-4111-8111-111111111111', 'Sofía', '#fbbf24')
on conflict (id) do nothing;
