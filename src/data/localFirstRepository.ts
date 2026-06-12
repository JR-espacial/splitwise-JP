import type { Expense, ExpenseSplit, Settlement } from '../domain/types'
import { LedgerDB } from './db'
import { SupabaseRemoteApi, type RemoteApi } from './remote'
import type { ExpenseRepository, LedgerSnapshot } from './repository'
import { SyncEngine, type SyncStatus } from './sync'

/**
 * Local-first ExpenseRepository: the UI reads and writes IndexedDB (Dexie)
 * only; the SyncEngine pushes the outbox to Supabase in the background and
 * pulls remote changes incrementally.
 */
export class LocalFirstRepository implements ExpenseRepository {
  private readonly db: LedgerDB
  private readonly engine: SyncEngine

  constructor(deps?: { db?: LedgerDB; remote?: RemoteApi }) {
    this.db = deps?.db ?? new LedgerDB()
    this.engine = new SyncEngine(this.db, deps?.remote ?? new SupabaseRemoteApi())
  }

  async loadSnapshot(): Promise<LedgerSnapshot> {
    let group = await this.db.groups.toCollection().first()
    if (!group) {
      // First run on this device: bootstrap from the network.
      await this.engine.pull()
      group = await this.db.groups.toCollection().first()
      if (!group) {
        throw new Error('La primera carga necesita conexión para descargar el grupo.')
      }
    }

    const [members, expenses, splits, settlements] = await Promise.all([
      this.db.members.where('groupId').equals(group.id).sortBy('createdAt'),
      this.db.expenses.toArray(),
      this.db.splits.toArray(),
      this.db.settlements.toArray(),
    ])
    return { group, members, expenses, splits, settlements }
  }

  async upsertExpense(expense: Expense, splits: ExpenseSplit[]): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.expenses, this.db.splits, this.db.outbox],
      async () => {
        await this.db.expenses.put(expense)
        await this.db.splits.where('expenseId').equals(expense.id).delete()
        await this.db.splits.bulkPut(splits)
        // Coalesce: a newer edit replaces any queued write for this entity.
        await this.db.outbox.where('entityId').equals(expense.id).delete()
        await this.db.outbox.add({ kind: 'expense', entityId: expense.id, expense, splits })
      },
    )
    this.engine.requestPush()
  }

  async upsertSettlement(settlement: Settlement): Promise<void> {
    await this.db.transaction('rw', [this.db.settlements, this.db.outbox], async () => {
      await this.db.settlements.put(settlement)
      await this.db.outbox.where('entityId').equals(settlement.id).delete()
      await this.db.outbox.add({ kind: 'settlement', entityId: settlement.id, settlement })
    })
    this.engine.requestPush()
  }

  subscribeToRemoteChanges(onChange: () => void): () => void {
    return this.engine.start(onChange)
  }

  subscribeToSyncStatus(onStatus: (status: SyncStatus) => void): () => void {
    return this.engine.subscribeToStatus(onStatus)
  }
}
