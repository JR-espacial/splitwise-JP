import type { Expense, ExpenseSplit, Member, Settlement } from '../domain/types'
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
  type Group,
  type GroupRow,
  type MemberRow,
  type SettlementRow,
} from './rows'
import { getSupabase } from './supabaseClient'

export interface RemotePullResult {
  group: Group | null
  members: Member[]
  /** Expenses with updated_at >= the cursor, plus their splits. */
  expenses: Expense[]
  splits: ExpenseSplit[]
  settlements: Settlement[]
}

/**
 * Thin network boundary used by the sync engine. Injected so tests can
 * fake the server.
 */
export interface RemoteApi {
  pullSince(expensesSince: string | null, settlementsSince: string | null): Promise<RemotePullResult>
  pushExpense(expense: Expense, splits: ExpenseSplit[]): Promise<void>
  pushSettlement(settlement: Settlement): Promise<void>
  /** Fires on remote row changes and on (re)connect. Returns unsubscribe. */
  subscribe(onRemoteChange: () => void): () => void
}

const REALTIME_TABLES = ['expenses', 'expense_splits', 'settlements'] as const
const SPLIT_FETCH_CHUNK = 100

export class SupabaseRemoteApi implements RemoteApi {
  async pullSince(
    expensesSince: string | null,
    settlementsSince: string | null,
  ): Promise<RemotePullResult> {
    const supabase = getSupabase()

    const groupResult = await supabase.from('groups').select('*').limit(1).maybeSingle()
    if (groupResult.error) throw groupResult.error
    const group = groupResult.data ? groupFromRow(groupResult.data as GroupRow) : null
    if (!group) return { group: null, members: [], expenses: [], splits: [], settlements: [] }

    let expensesQuery = supabase.from('expenses').select('*').eq('group_id', group.id)
    if (expensesSince) expensesQuery = expensesQuery.gte('updated_at', expensesSince)
    let settlementsQuery = supabase.from('settlements').select('*').eq('group_id', group.id)
    if (settlementsSince) settlementsQuery = settlementsQuery.gte('updated_at', settlementsSince)

    const [members, expenses, settlements] = await Promise.all([
      supabase.from('members').select('*').eq('group_id', group.id).order('created_at'),
      expensesQuery,
      settlementsQuery,
    ])
    const firstError = members.error ?? expenses.error ?? settlements.error
    if (firstError) throw firstError

    const pulledExpenses = (expenses.data as ExpenseRow[]).map(expenseFromRow)
    const splits = expensesSince
      ? await this.fetchSplitsFor(pulledExpenses.map((e) => e.id))
      : await this.fetchAllSplits()

    return {
      group,
      members: (members.data as MemberRow[]).map(memberFromRow),
      expenses: pulledExpenses,
      splits,
      settlements: (settlements.data as SettlementRow[]).map(settlementFromRow),
    }
  }

  private async fetchAllSplits(): Promise<ExpenseSplit[]> {
    const result = await getSupabase().from('expense_splits').select('*')
    if (result.error) throw result.error
    return (result.data as ExpenseSplitRow[]).map(splitFromRow)
  }

  private async fetchSplitsFor(expenseIds: string[]): Promise<ExpenseSplit[]> {
    const supabase = getSupabase()
    const splits: ExpenseSplit[] = []
    for (let i = 0; i < expenseIds.length; i += SPLIT_FETCH_CHUNK) {
      const chunk = expenseIds.slice(i, i + SPLIT_FETCH_CHUNK)
      const result = await supabase.from('expense_splits').select('*').in('expense_id', chunk)
      if (result.error) throw result.error
      splits.push(...(result.data as ExpenseSplitRow[]).map(splitFromRow))
    }
    return splits
  }

  async pushExpense(expense: Expense, splits: ExpenseSplit[]): Promise<void> {
    const supabase = getSupabase()
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

  async pushSettlement(settlement: Settlement): Promise<void> {
    const result = await getSupabase().from('settlements').upsert(settlementToRow(settlement))
    if (result.error) throw result.error
  }

  subscribe(onRemoteChange: () => void): () => void {
    const supabase = getSupabase()
    let channel = supabase.channel('ledger-changes')
    for (const table of REALTIME_TABLES) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => onRemoteChange(),
      )
    }
    channel.subscribe((status) => {
      // Pull on (re)connect to cover anything missed while offline.
      if (status === 'SUBSCRIBED') onRemoteChange()
    })
    return () => {
      void supabase.removeChannel(channel)
    }
  }
}
