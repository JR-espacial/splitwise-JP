import type { LedgerDB } from './db'
import { rebasePending } from './rebasePending'
import type { RemoteApi } from './remote'

export interface SyncStatus {
  online: boolean
  pendingCount: number
  error?: string | null
}

const BACKOFF_MS = [2000, 4000, 8000, 16000, 30000] as const
const META_EXPENSES_SINCE = 'expensesSince'
const META_SETTLEMENTS_SINCE = 'settlementsSince'

function syncErrorMessage(error: unknown): string {
  // PostgREST errors are plain objects, not Error instances.
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return 'No se pudo sincronizar. Se volverá a intentar automáticamente.'
}

/** navigator.onLine is unreliable-but-useful; absent (tests) means online. */
function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

function maxISO(values: string[]): string | null {
  return values.length === 0 ? null : values.reduce((a, b) => (a > b ? a : b))
}

/**
 * Outbox push + incremental pull between the local Dexie store and the
 * remote API.
 *
 * Push: drains the outbox in order with exponential backoff on failure;
 * retriggered by new writes, the browser 'online' event and reconnects.
 *
 * Pull: fetches expenses/settlements with updated_at >= the last cursor
 * (server-assigned timestamps, see migration 0002) and applies them with
 * last-write-wins — except entities that still have a pending outbox
 * entry, where the local unsent edit wins until pushed; the server echo
 * then comes back with a newer timestamp on a later pull.
 */
export class SyncEngine {
  private syncError: string | null = null
  private pushing = false
  private pushAttempt = 0
  private pushTimer: ReturnType<typeof setTimeout> | null = null
  private pulling = false
  private pullQueued = false
  private onDataChange: (() => void) | null = null
  private statusListeners = new Set<(status: SyncStatus) => void>()

  constructor(
    private readonly db: LedgerDB,
    private readonly remote: RemoteApi,
  ) {}

  /** Wires realtime + browser connectivity events. Returns stop. */
  start(onDataChange: () => void): () => void {
    this.onDataChange = onDataChange
    const unsubscribeRemote = this.remote.subscribe(() => void this.requestPull())

    const handleOnline = () => {
      this.requestPush()
      void this.requestPull()
      void this.emitStatus()
    }
    const handleOffline = () => void this.emitStatus()
    const handleVisible = () => {
      if (document.visibilityState === 'visible') void this.requestPull()
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
      document.addEventListener('visibilitychange', handleVisible)
    }

    void this.requestPull() // Recover base changes even without a realtime connection.
    this.requestPush() // drain anything left over from a previous session
    void this.emitStatus()

    return () => {
      unsubscribeRemote()
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
        document.removeEventListener('visibilitychange', handleVisible)
      }
      if (this.pushTimer) clearTimeout(this.pushTimer)
      this.onDataChange = null
    }
  }

  subscribeToStatus(listener: (status: SyncStatus) => void): () => void {
    this.statusListeners.add(listener)
    void this.emitStatus()
    return () => this.statusListeners.delete(listener)
  }

  /** Call after enqueueing an outbox entry. */
  requestPush(): void {
    if (this.pushTimer) {
      clearTimeout(this.pushTimer)
      this.pushTimer = null
    }
    void this.drainOutbox()
  }

  async requestPull(): Promise<void> {
    if (this.pulling) {
      this.pullQueued = true
      return
    }
    this.pulling = true
    try {
      await this.pull()
    } catch (error) {
      this.syncError = syncErrorMessage(error)
      await this.emitStatus()
    } finally {
      this.pulling = false
      if (this.pullQueued) {
        this.pullQueued = false
        void this.requestPull()
      }
    }
  }

  private async drainOutbox(): Promise<void> {
    if (this.pushing) return
    this.pushing = true
    let pushedSomething = false
    try {
      for (;;) {
        const entry = await this.db.outbox.orderBy('seq').first()
        if (!entry) break
        if (entry.kind === 'expense') {
          await this.remote.pushExpense(entry.expense, entry.splits)
        } else {
          await this.remote.pushSettlement(entry.settlement)
        }
        await this.db.outbox.delete(entry.seq!)
        pushedSomething = true
        await this.emitStatus()
      }
      this.pushAttempt = 0
      this.syncError = null
      // Reconcile server-assigned updated_at timestamps.
      if (pushedSomething) void this.requestPull()
    } catch (error) {
      this.syncError = syncErrorMessage(error)
      // A rejected EUR write may mean the server migrated to MXN while offline.
      void this.requestPull()
      const delay = BACKOFF_MS[Math.min(this.pushAttempt, BACKOFF_MS.length - 1)]!
      this.pushAttempt += 1
      this.pushTimer = setTimeout(() => {
        this.pushTimer = null
        void this.drainOutbox()
      }, delay)
    } finally {
      this.pushing = false
      await this.emitStatus()
    }
  }

  async pull(): Promise<void> {
    const expensesSince = (await this.db.meta.get(META_EXPENSES_SINCE))?.value ?? null
    const settlementsSince = (await this.db.meta.get(META_SETTLEMENTS_SINCE))?.value ?? null

    let result = await this.remote.pullSince(expensesSince, settlementsSince)
    const localGroup = await this.db.groups.toCollection().first()
    if (result.group && localGroup && result.group.baseCurrency !== localGroup.baseCurrency) {
      // A base switch affects every frozen rate and payment, including older rows.
      result = await this.remote.pullSince(null, null)
    }
    if (!result.group) return

    let rebasedCount = 0

    await this.db.transaction(
      'rw',
      [
        this.db.groups,
        this.db.members,
        this.db.expenses,
        this.db.splits,
        this.db.settlements,
        this.db.meta,
        this.db.outbox,
      ],
      async () => {
        // Read the latest queue inside the same transaction as the group switch;
        // a concurrent user edit must not be dropped or left in the old base.
        const pending = await this.db.outbox.toArray()
        const pendingIds = new Set(pending.map((entry) => entry.entityId))
        for (const entry of pending) {
          const rebased = rebasePending(entry, result.group!)
          if (rebased === entry) continue
          await this.db.outbox.put(rebased)
          if (rebased.kind === 'expense') {
            await this.db.expenses.put(rebased.expense)
            await this.db.splits.where('expenseId').equals(rebased.entityId).delete()
            await this.db.splits.bulkPut(rebased.splits)
          } else {
            await this.db.settlements.put(rebased.settlement)
          }
          rebasedCount += 1
        }
        await this.db.groups.put(result.group!)
        if (result.members.length > 0) await this.db.members.bulkPut(result.members)

        const applicableExpenses = result.expenses.filter((e) => !pendingIds.has(e.id))
        if (applicableExpenses.length > 0) {
          const ids = applicableExpenses.map((e) => e.id)
          const idSet = new Set(ids)
          await this.db.splits.where('expenseId').anyOf(ids).delete()
          await this.db.expenses.bulkPut(applicableExpenses)
          await this.db.splits.bulkPut(result.splits.filter((s) => idSet.has(s.expenseId)))
        }

        const applicableSettlements = result.settlements.filter((s) => !pendingIds.has(s.id))
        if (applicableSettlements.length > 0) {
          await this.db.settlements.bulkPut(applicableSettlements)
        }

        // Advance cursors past skipped pending entities too: after their
        // push, the server trigger re-bumps updated_at beyond the cursor.
        const maxExpenses = maxISO(result.expenses.map((e) => e.updatedAt))
        if (maxExpenses) await this.db.meta.put({ key: META_EXPENSES_SINCE, value: maxExpenses })
        const maxSettlements = maxISO(result.settlements.map((s) => s.updatedAt))
        if (maxSettlements) {
          await this.db.meta.put({ key: META_SETTLEMENTS_SINCE, value: maxSettlements })
        }
      },
    )

    if (rebasedCount > 0) this.syncError = null
    this.onDataChange?.()
    if (rebasedCount > 0) this.requestPush()
    await this.emitStatus()
  }

  async emitStatus(): Promise<void> {
    if (this.statusListeners.size === 0) return
    const pendingCount = await this.db.outbox.count()
    const status: SyncStatus = { online: isOnline(), pendingCount, error: this.syncError }
    for (const listener of this.statusListeners) listener(status)
  }
}
