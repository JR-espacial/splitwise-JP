-- User confirmed the existing ledger contains test data only.
-- Preserve it using the ECB reference rate from 2026-09-03:
-- https://api.frankfurter.dev/v1/2026-09-03?base=EUR&symbols=MXN
-- 1 EUR = 19.7593 MXN. This is a one-time rebase, not ongoing repricing.
begin;
lock table public.groups, public.expenses, public.settlements in share row exclusive mode;
do $$
declare
  target_group constant uuid := '11111111-1111-4111-8111-111111111111';
  eur_to_mxn constant numeric := 19.7593;
  old_base text;
begin
  select base_currency into old_base from public.groups where id = target_group;
  if old_base is null or old_base = 'MXN' then return; end if;
  if old_base <> 'EUR' then
    raise exception 'La migración requiere base EUR o MXN; se encontró %', old_base;
  end if;
  if exists (select 1 from public.expenses where group_id = target_group and base_currency <> 'EUR')
    or exists (select 1 from public.settlements where group_id = target_group and base_currency <> 'EUR') then
    raise exception 'Hay monedas base inconsistentes. No se modificó ningún movimiento.';
  end if;

  -- Update group first so the denomination guards accept the rebased rows.
  -- The transaction makes this switch visible atomically to other clients.
  update public.groups set base_currency = 'MXN' where id = target_group;
  update public.expenses
    set fx_rate_to_base = case when currency = 'MXN' then 1
      else round(fx_rate_to_base * eur_to_mxn, 8) end,
      base_currency = 'MXN'
    where group_id = target_group;
  update public.settlements
    set amount_cents = round(amount_cents * eur_to_mxn)::bigint,
      base_currency = 'MXN'
    where group_id = target_group;
  -- Include soft-deleted rows so undo never restores an EUR-denominated amount.
  -- Original expense amounts, currencies, splits, receipts and identities stay intact.
end;
$$;
commit;
