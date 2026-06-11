-- Initial schema for the shared-expenses app.
-- Money is always integer cents; fx_rate_to_base is frozen at capture time.
-- Ledger rows (expenses, settlements) are never physically deleted: there is
-- no DELETE policy for them, so soft delete via deleted_at is enforced at the
-- database level. expense_splits are derived rows and may be replaced on edit.

create table groups (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  base_currency text not null check (base_currency in ('EUR', 'CZK', 'MXN', 'USD', 'CHF')),
  created_at    timestamptz not null default now()
);

create table members (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references groups (id),
  name       text not null,
  color      text not null,
  created_at timestamptz not null default now()
);

create table expenses (
  id              uuid primary key, -- client-generated for idempotent upserts
  group_id        uuid not null references groups (id),
  paid_by         uuid not null references members (id),
  amount_cents    bigint not null check (amount_cents > 0),
  currency        text not null check (currency in ('EUR', 'CZK', 'MXN', 'USD', 'CHF')),
  fx_rate_to_base numeric(14, 8) not null check (fx_rate_to_base > 0),
  description     text not null,
  expense_date    date not null,
  split_type      text not null check (split_type in ('equal', 'subset', 'exact')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create table expense_splits (
  expense_id  uuid not null references expenses (id) on delete cascade,
  member_id   uuid not null references members (id),
  share_cents bigint not null check (share_cents >= 0),
  primary key (expense_id, member_id)
);

create table settlements (
  id           uuid primary key, -- client-generated, denominated in base currency
  group_id     uuid not null references groups (id),
  from_member  uuid not null references members (id),
  to_member    uuid not null references members (id),
  amount_cents bigint not null check (amount_cents > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  check (from_member <> to_member)
);

-- Indexes sized for the iteration-2 incremental pull by updated_at.
create index idx_expenses_group_updated on expenses (group_id, updated_at);
create index idx_settlements_group_updated on settlements (group_id, updated_at);

create function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger expenses_set_updated_at
  before update on expenses
  for each row execute function set_updated_at();

create trigger settlements_set_updated_at
  before update on settlements
  for each row execute function set_updated_at();

-- Permissive RLS for the no-auth MVP (anon key). Tightened in iteration 3.
alter table groups enable row level security;
alter table members enable row level security;
alter table expenses enable row level security;
alter table expense_splits enable row level security;
alter table settlements enable row level security;

create policy anon_select on groups for select using (true);
create policy anon_select on members for select using (true);

create policy anon_select on expenses for select using (true);
create policy anon_insert on expenses for insert with check (true);
create policy anon_update on expenses for update using (true);

create policy anon_select on expense_splits for select using (true);
create policy anon_insert on expense_splits for insert with check (true);
create policy anon_update on expense_splits for update using (true);
create policy anon_delete on expense_splits for delete using (true);

create policy anon_select on settlements for select using (true);
create policy anon_insert on settlements for insert with check (true);
create policy anon_update on settlements for update using (true);

-- Realtime: broadcast row changes to connected clients.
alter publication supabase_realtime add table expenses, expense_splits, settlements;
alter table expenses replica identity full;
alter table expense_splits replica identity full;
alter table settlements replica identity full;
