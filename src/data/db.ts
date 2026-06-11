import Dexie, { type Table } from 'dexie'
import type { Expense, ExpenseSplit, Member, Settlement } from '../domain/types'
import type { Group } from './rows'

/**
 * Pending local write waiting to be pushed to Supabase. Entries are
 * coalesced by entityId (a newer edit replaces the queued one) and pushed
 * in seq order; pushes are idempotent upserts keyed by client UUIDs.
 */
export type OutboxEntry = (
  | { kind: 'expense'; expense: Expense; splits: ExpenseSplit[] }
  | { kind: 'settlement'; settlement: Settlement }
) & {
  seq?: number
  entityId: string
}

export interface MetaEntry {
  key: string
  value: string
}

/** Local-first store: the UI always reads from here, never from the network. */
export class LedgerDB extends Dexie {
  groups!: Table<Group, string>
  members!: Table<Member, string>
  expenses!: Table<Expense, string>
  splits!: Table<ExpenseSplit, [string, string]>
  settlements!: Table<Settlement, string>
  outbox!: Table<OutboxEntry, number>
  meta!: Table<MetaEntry, string>

  constructor(name = 'roadtrip-ledger') {
    super(name)
    this.version(1).stores({
      groups: 'id',
      members: 'id, groupId',
      expenses: 'id, updatedAt',
      splits: '[expenseId+memberId], expenseId',
      settlements: 'id, updatedAt',
      outbox: '++seq, entityId',
      meta: 'key',
    })
  }
}
