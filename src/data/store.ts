import { useSyncExternalStore } from 'react'
import type { Expense, ExpenseSplit, Settlement } from '../domain/types'
import type { ExpenseRepository, LedgerSnapshot } from './repository'
import type { SyncStatus } from './sync'

export interface LedgerState {
  status: 'loading' | 'error' | 'ready'
  snapshot: LedgerSnapshot | null
  /** Fatal load error (no data at all). */
  loadError: string | null
  /** Last failed write, shown as a dismissible banner. */
  writeError: string | null
  /** Connectivity / pending-writes info from the repository, if available. */
  sync: SyncStatus | null
}

type Listener = () => void

const REFETCH_DEBOUNCE_MS = 300

/**
 * In-memory ledger store with optimistic writes.
 *
 * Reads are served from the last snapshot. Writes apply to the snapshot
 * immediately, then push to the repository in the background; while a push
 * is in flight the entity is kept in a pending map so that a concurrent
 * remote refetch cannot make it flicker away.
 */
class LedgerStore {
  private repository: ExpenseRepository | null = null
  private state: LedgerState = {
    status: 'loading',
    snapshot: null,
    loadError: null,
    writeError: null,
    sync: null,
  }
  private listeners = new Set<Listener>()
  private pendingExpenses = new Map<string, { expense: Expense; splits: ExpenseSplit[] }>()
  private pendingSettlements = new Map<string, Settlement>()
  private refetchTimer: ReturnType<typeof setTimeout> | null = null
  private unsubscribeRemote: (() => void) | null = null
  private unsubscribeStatus: (() => void) | null = null

  init(repository: ExpenseRepository): void {
    if (this.repository) return
    this.repository = repository
    void this.loadInitial()
    this.unsubscribeRemote = repository.subscribeToRemoteChanges(() => this.scheduleRefetch())
    this.unsubscribeStatus =
      repository.subscribeToSyncStatus?.((sync) => this.setState({ sync })) ?? null
  }

  dispose(): void {
    this.unsubscribeRemote?.()
    this.unsubscribeRemote = null
    this.unsubscribeStatus?.()
    this.unsubscribeStatus = null
    this.repository = null
  }

  getState = (): LedgerState => this.state

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dismissWriteError = (): void => {
    this.setState({ writeError: null })
  }

  async saveExpense(expense: Expense, splits: ExpenseSplit[]): Promise<void> {
    this.applyExpenseLocally(expense, splits)
    this.pendingExpenses.set(expense.id, { expense, splits })
    try {
      await this.repository!.upsertExpense(expense, splits)
    } catch (error) {
      this.setState({ writeError: messageOf(error) })
    } finally {
      this.pendingExpenses.delete(expense.id)
    }
  }

  async saveSettlement(settlement: Settlement): Promise<void> {
    this.applySettlementLocally(settlement)
    this.pendingSettlements.set(settlement.id, settlement)
    try {
      await this.repository!.upsertSettlement(settlement)
    } catch (error) {
      this.setState({ writeError: messageOf(error) })
    } finally {
      this.pendingSettlements.delete(settlement.id)
    }
  }

  retryLoad = (): void => {
    this.setState({ status: 'loading', loadError: null })
    void this.loadInitial()
  }

  private async loadInitial(): Promise<void> {
    try {
      const snapshot = await this.repository!.loadSnapshot()
      this.setState({ status: 'ready', snapshot: this.withPending(snapshot), loadError: null })
    } catch (error) {
      this.setState({ status: 'error', loadError: messageOf(error) })
    }
  }

  private scheduleRefetch(): void {
    if (this.refetchTimer) clearTimeout(this.refetchTimer)
    this.refetchTimer = setTimeout(() => {
      this.refetchTimer = null
      void this.refetch()
    }, REFETCH_DEBOUNCE_MS)
  }

  private async refetch(): Promise<void> {
    if (!this.repository || this.state.status !== 'ready') return
    try {
      const snapshot = await this.repository.loadSnapshot()
      this.setState({ snapshot: this.withPending(snapshot) })
    } catch {
      // Transient refetch failures are fine; realtime will trigger another.
    }
  }

  /** Overlay in-flight optimistic writes on a freshly fetched snapshot. */
  private withPending(snapshot: LedgerSnapshot): LedgerSnapshot {
    let result = snapshot
    for (const { expense, splits } of this.pendingExpenses.values()) {
      result = upsertExpenseIn(result, expense, splits)
    }
    for (const settlement of this.pendingSettlements.values()) {
      result = upsertSettlementIn(result, settlement)
    }
    return result
  }

  private applyExpenseLocally(expense: Expense, splits: ExpenseSplit[]): void {
    if (!this.state.snapshot) return
    this.setState({ snapshot: upsertExpenseIn(this.state.snapshot, expense, splits) })
  }

  private applySettlementLocally(settlement: Settlement): void {
    if (!this.state.snapshot) return
    this.setState({ snapshot: upsertSettlementIn(this.state.snapshot, settlement) })
  }

  private setState(partial: Partial<LedgerState>): void {
    this.state = { ...this.state, ...partial }
    for (const listener of this.listeners) listener()
  }
}

function upsertExpenseIn(
  snapshot: LedgerSnapshot,
  expense: Expense,
  splits: ExpenseSplit[],
): LedgerSnapshot {
  return {
    ...snapshot,
    expenses: [...snapshot.expenses.filter((e) => e.id !== expense.id), expense],
    splits: [...snapshot.splits.filter((s) => s.expenseId !== expense.id), ...splits],
  }
}

function upsertSettlementIn(snapshot: LedgerSnapshot, settlement: Settlement): LedgerSnapshot {
  return {
    ...snapshot,
    settlements: [...snapshot.settlements.filter((s) => s.id !== settlement.id), settlement],
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const ledgerStore = new LedgerStore()

export function useLedger(): LedgerState {
  return useSyncExternalStore(ledgerStore.subscribe, ledgerStore.getState)
}
