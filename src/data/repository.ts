import type { Expense, ExpenseSplit, Member, Settlement } from '../domain/types'
import type { Group } from './rows'

export interface LedgerSnapshot {
  group: Group
  members: Member[]
  expenses: Expense[]
  splits: ExpenseSplit[]
  settlements: Settlement[]
}

/**
 * Data-access contract for the ledger. Iteration 1 implements it directly
 * against Supabase; iteration 2 swaps in a Dexie + outbox implementation
 * without touching the UI.
 *
 * All writes are upserts keyed by client-generated UUIDs (idempotent), and
 * soft deletes are just upserts with deletedAt set.
 */
export interface ExpenseRepository {
  loadSnapshot(): Promise<LedgerSnapshot>
  /** Upserts the expense and replaces its splits atomically-enough for MVP. */
  upsertExpense(expense: Expense, splits: ExpenseSplit[]): Promise<void>
  upsertSettlement(settlement: Settlement): Promise<void>
  /** Notifies when other devices change the ledger. Returns unsubscribe. */
  subscribeToRemoteChanges(onChange: () => void): () => void
}
