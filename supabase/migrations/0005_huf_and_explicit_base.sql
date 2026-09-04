-- Keep original expense amounts/currencies and their frozen rate denomination explicit.
-- Adds HUF and denomination metadata without changing historical values.
-- The base switch is a separate guarded migration (0006).
begin;
lock table public.groups, public.expenses, public.settlements in share row exclusive mode;

alter table public.groups drop constraint if exists groups_base_currency_check;
alter table public.groups add constraint groups_base_currency_check
  check (base_currency in ('MXN', 'EUR', 'CZK', 'CHF', 'HUF', 'USD'));
alter table public.expenses drop constraint if exists expenses_currency_check;
alter table public.expenses add constraint expenses_currency_check
  check (currency in ('MXN', 'EUR', 'CZK', 'CHF', 'HUF', 'USD'));

alter table public.expenses add column if not exists base_currency text;
alter table public.settlements add column if not exists base_currency text;
update public.expenses e set base_currency = g.base_currency
  from public.groups g where e.group_id = g.id and e.base_currency is null;
update public.settlements s set base_currency = g.base_currency
  from public.groups g where s.group_id = g.id and s.base_currency is null;
-- An older app omits this column; EUR is intentional so it cannot silently
-- submit an EUR-based rate/payment to the new MXN group.
alter table public.expenses alter column base_currency set default 'EUR';
alter table public.expenses alter column base_currency set not null;
alter table public.settlements alter column base_currency set default 'EUR';
alter table public.settlements alter column base_currency set not null;

create or replace function public.check_ledger_base_currency()
returns trigger language plpgsql set search_path = public as $$
declare expected_base text;
begin
  select base_currency into expected_base from public.groups where id = new.group_id;
  if new.base_currency is distinct from expected_base then
    raise exception 'La moneda base cambió. Actualiza la app y revisa los cambios pendientes antes de sincronizar.';
  end if;
  return new;
end;
$$;
drop trigger if exists expenses_check_base_currency on public.expenses;
create trigger expenses_check_base_currency before insert or update on public.expenses
  for each row execute function public.check_ledger_base_currency();
drop trigger if exists settlements_check_base_currency on public.settlements;
create trigger settlements_check_base_currency before insert or update on public.settlements
  for each row execute function public.check_ledger_base_currency();
commit;
