-- Iteration 3: magic-link auth + real RLS.
--
-- Identity model: each member has an email; a signed-in user "is" the member
-- whose email matches their JWT. Access to the whole ledger requires being a
-- member of the (single) group.
--
-- ⚠️ EDIT THE PLACEHOLDER EMAILS below before running, and enable the Email
-- provider in Supabase Auth settings (see README).

alter table members add column email text unique;

update members set email = 'jorgealanramirezelias@gmail.com'
  where id = '22222222-2222-4222-8222-222222222221'; -- Jorge
update members set email = 'ana@example.com'
  where id = '22222222-2222-4222-8222-222222222222'; -- Ana   ← EDIT
update members set email = 'luis@example.com'
  where id = '22222222-2222-4222-8222-222222222223'; -- Luis  ← EDIT
update members set email = 'sofia@example.com'
  where id = '22222222-2222-4222-8222-222222222224'; -- Sofía ← EDIT

alter table members alter column email set not null;

-- security definer so the members policy can call it without RLS recursion
create function is_group_member()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from members
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Drop the permissive no-auth policies from migration 0001.
drop policy anon_select on groups;
drop policy anon_select on members;
drop policy anon_select on expenses;
drop policy anon_insert on expenses;
drop policy anon_update on expenses;
drop policy anon_select on expense_splits;
drop policy anon_insert on expense_splits;
drop policy anon_update on expense_splits;
drop policy anon_delete on expense_splits;
drop policy anon_select on settlements;
drop policy anon_insert on settlements;
drop policy anon_update on settlements;

-- Real policies: only authenticated group members. Still no DELETE policy on
-- expenses/settlements (soft delete enforced by the database).
create policy member_select on groups for select to authenticated using (is_group_member());
create policy member_select on members for select to authenticated using (is_group_member());

create policy member_select on expenses for select to authenticated using (is_group_member());
create policy member_insert on expenses for insert to authenticated with check (is_group_member());
create policy member_update on expenses for update to authenticated using (is_group_member());

create policy member_select on expense_splits for select to authenticated using (is_group_member());
create policy member_insert on expense_splits for insert to authenticated with check (is_group_member());
create policy member_update on expense_splits for update to authenticated using (is_group_member());
create policy member_delete on expense_splits for delete to authenticated using (is_group_member());

create policy member_select on settlements for select to authenticated using (is_group_member());
create policy member_insert on settlements for insert to authenticated with check (is_group_member());
create policy member_update on settlements for update to authenticated using (is_group_member());
