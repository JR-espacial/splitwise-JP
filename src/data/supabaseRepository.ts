import type { Expense, ExpenseSplit, Settlement } from '../domain/types'
import type { ExpenseRepository, LedgerSnapshot } from './repository'
import {
  expenseFromRow,
  expenseToRow,
  groupFromRow,
  memberFromRow,
  settlementFromRow,
  settlementToRow,
  splitFromRow,
  splitToRow,
  type ExpenseRow,
  type ExpenseSplitRow,
  type GroupRow,
  type MemberRow,
  type SettlementRow,
} from './rows'
import { supabase } from './supabaseClient'

const REALTIME_TABLES = ['expenses', 'expense_splits', 'settlements'] as const

export class SupabaseExpenseRepository implements ExpenseRepository {
  async loadSnapshot(): Promise<LedgerSnapshot> {
    const groupResult = await supabase.from('groups').select('*').limit(1).single()
    if (groupResult.error) throw groupResult.error
    const group = groupFromRow(groupResult.data as GroupRow)

    const [members, expenses, splits, settlements] = await Promise.all([
      supabase.from('members').select('*').eq('group_id', group.id).order('created_at'),
      supabase.from('expenses').select('*').eq('group_id', group.id),
      supabase.from('expense_splits').select('*'),
      supabase.from('settlements').select('*').eq('group_id', group.id),
    ])
    const firstError = members.error ?? expenses.error ?? splits.error ?? settlements.error
    if (firstError) throw firstError

    return {
      group,
      members: (members.data as MemberRow[]).map(memberFromRow),
      expenses: (expenses.data as ExpenseRow[]).map(expenseFromRow),
      splits: (splits.data as ExpenseSplitRow[]).map(splitFromRow),
      settlements: (settlements.data as SettlementRow[]).map(settlementFromRow),
    }
  }

  async upsertExpense(expense: Expense, splits: ExpenseSplit[]): Promise<void> {
    const expenseResult = await supabase.from('expenses').upsert(expenseToRow(expense))
    if (expenseResult.error) throw expenseResult.error

    const upsertResult = await supabase.from('expense_splits').upsert(splits.map(splitToRow))
    if (upsertResult.error) throw upsertResult.error

    // Drop stale splits left over from a previous participant set.
    const keepIds = splits.map((s) => s.memberId)
    const deleteResult = await supabase
      .from('expense_splits')
      .delete()
      .eq('expense_id', expense.id)
      .not('member_id', 'in', `(${keepIds.join(',')})`)
    if (deleteResult.error) throw deleteResult.error
  }

  async upsertSettlement(settlement: Settlement): Promise<void> {
    const result = await supabase.from('settlements').upsert(settlementToRow(settlement))
    if (result.error) throw result.error
  }

  subscribeToRemoteChanges(onChange: () => void): () => void {
    let channel = supabase.channel('ledger-changes')
    for (const table of REALTIME_TABLES) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => onChange(),
      )
    }
    channel.subscribe((status) => {
      // Refetch on (re)connect to cover anything missed while offline.
      if (status === 'SUBSCRIBED') onChange()
    })
    return () => {
      void supabase.removeChannel(channel)
    }
  }
}
