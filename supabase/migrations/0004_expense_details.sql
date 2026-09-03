-- Expense details, receipt capture and basic authorship/audit metadata.
-- Nullable author columns preserve rows created before authenticated identity
-- was recorded by the client.

alter table expenses
  add column category text not null default 'other'
    check (category in ('food', 'transport', 'lodging', 'activities', 'shopping', 'other')),
  add column receipt_data_url text,
  add column created_by uuid references members (id),
  add column updated_by uuid references members (id),
  add column change_log jsonb not null default '[]'::jsonb
    check (jsonb_typeof(change_log) = 'array');

alter table settlements
  add column settlement_date date,
  add column created_by uuid references members (id),
  add column updated_by uuid references members (id),
  add column change_log jsonb not null default '[]'::jsonb
    check (jsonb_typeof(change_log) = 'array');

update settlements
set settlement_date = created_at::date
where settlement_date is null;

alter table settlements alter column settlement_date set not null;

-- Keep compressed inline receipts bounded. The client targets substantially
-- less than this, while the check protects sync payloads from accidental
-- full-resolution files.
alter table expenses add constraint receipt_data_url_size
  check (receipt_data_url is null or octet_length(receipt_data_url) <= 1500000);
