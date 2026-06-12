-- Make updated_at fully server-assigned (INSERT as well as UPDATE).
--
-- The iteration-2 incremental pull uses updated_at as its cursor, so the
-- value must come from a single clock. Without this, a row created offline
-- carries the client's (possibly skewed, older) timestamp and other devices
-- whose cursor already moved past it would never pull it.

create trigger expenses_set_updated_at_on_insert
  before insert on expenses
  for each row execute function set_updated_at();

create trigger settlements_set_updated_at_on_insert
  before insert on settlements
  for each row execute function set_updated_at();
