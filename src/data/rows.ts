import type {
  Currency,
  Expense,
  ExpenseSplit,
  Member,
  Settlement,
  SplitType,
} from '../domain/types'

export interface Group {
  id: string
  name: string
  baseCurrency: Currency
  createdAt: string
}

export interface GroupRow {
  id: string
  name: string
  base_currency: Currency
  created_at: string
}

export interface MemberRow {
  id: string
  group_id: string
  name: string
  color: string
  email: string | null
  created_at: string
}

export interface ExpenseRow {
  id: string
  group_id: string
  paid_by: string
  amount_cents: number
  currency: Currency
  fx_rate_to_base: number | string
  description: string
  expense_date: string
  split_type: SplitType
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ExpenseSplitRow {
  expense_id: string
  member_id: string
  share_cents: number
}

export interface SettlementRow {
  id: string
  group_id: string
  from_member: string
  to_member: string
  amount_cents: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export const groupFromRow = (row: GroupRow): Group => ({
  id: row.id,
  name: row.name,
  baseCurrency: row.base_currency,
  createdAt: row.created_at,
})

export const memberFromRow = (row: MemberRow): Member => ({
  id: row.id,
  groupId: row.group_id,
  name: row.name,
  color: row.color,
  email: row.email ?? null,
  createdAt: row.created_at,
})

export const expenseFromRow = (row: ExpenseRow): Expense => ({
  id: row.id,
  groupId: row.group_id,
  paidBy: row.paid_by,
  amountCents: Number(row.amount_cents),
  currency: row.currency,
  // numeric comes back as a string from PostgREST
  fxRateToBase: Number(row.fx_rate_to_base),
  description: row.description,
  expenseDate: row.expense_date,
  splitType: row.split_type,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
})

export const expenseToRow = (expense: Expense): ExpenseRow => ({
  id: expense.id,
  group_id: expense.groupId,
  paid_by: expense.paidBy,
  amount_cents: expense.amountCents,
  currency: expense.currency,
  fx_rate_to_base: expense.fxRateToBase,
  description: expense.description,
  expense_date: expense.expenseDate,
  split_type: expense.splitType,
  created_at: expense.createdAt,
  updated_at: expense.updatedAt,
  deleted_at: expense.deletedAt,
})

export const splitFromRow = (row: ExpenseSplitRow): ExpenseSplit => ({
  expenseId: row.expense_id,
  memberId: row.member_id,
  shareCents: Number(row.share_cents),
})

export const splitToRow = (split: ExpenseSplit): ExpenseSplitRow => ({
  expense_id: split.expenseId,
  member_id: split.memberId,
  share_cents: split.shareCents,
})

export const settlementFromRow = (row: SettlementRow): Settlement => ({
  id: row.id,
  groupId: row.group_id,
  fromMember: row.from_member,
  toMember: row.to_member,
  amountCents: Number(row.amount_cents),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
})

export const settlementToRow = (settlement: Settlement): SettlementRow => ({
  id: settlement.id,
  group_id: settlement.groupId,
  from_member: settlement.fromMember,
  to_member: settlement.toMember,
  amount_cents: settlement.amountCents,
  created_at: settlement.createdAt,
  updated_at: settlement.updatedAt,
  deleted_at: settlement.deletedAt,
})
