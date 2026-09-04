import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Expense, ExpenseSplit, Member, Settlement } from '../../domain/types'
import { LedgerDB } from '../db'
import { LocalFirstRepository } from '../localFirstRepository'
import type { RemoteApi, RemotePullResult } from '../remote'
import type { Group } from '../rows'
import { SyncEngine } from '../sync'

const GROUP: Group = {
  id: 'g1',
  name: 'Roadtrip',
  baseCurrency: 'EUR',
  createdAt: '2026-06-01T00:00:00+00:00',
}

const MEMBERS: Member[] = ['a', 'b'].map((id, i) => ({
  id,
  groupId: 'g1',
  name: id.toUpperCase(),
  color: '#fff',
  email: `${id}@example.com`,
  createdAt: `2026-06-01T00:00:0${i}+00:00`,
}))

function makeExpense(id: string, updatedAt: string, description = 'test'): Expense {
  return {
    id,
    groupId: 'g1',
    paidBy: 'a',
    amountCents: 1000,
    currency: 'EUR',
    fxRateToBase: 1,
    description,
    expenseDate: '2026-06-10',
    splitType: 'equal',
    createdAt: updatedAt,
    updatedAt,
    deletedAt: null,
  }
}

function splitsOf(expense: Expense): ExpenseSplit[] {
  return [
    { expenseId: expense.id, memberId: 'a', shareCents: 500 },
    { expenseId: expense.id, memberId: 'b', shareCents: 500 },
  ]
}

function makeSettlement(id: string, updatedAt: string): Settlement {
  return {
    id,
    groupId: 'g1',
    fromMember: 'b',
    toMember: 'a',
    amountCents: 500,
    createdAt: updatedAt,
    updatedAt,
    deletedAt: null,
  }
}

/** In-memory fake server: records pushes, serves pulls filtered by cursor. */
class FakeRemote implements RemoteApi {
  expenses = new Map<string, { expense: Expense; splits: ExpenseSplit[] }>()
  settlements = new Map<string, Settlement>()
  pushedExpenseIds: string[] = []
  failPushes = false
  pullCalls: Array<{ expensesSince: string | null; settlementsSince: string | null }> = []

  async pullSince(
    expensesSince: string | null,
    settlementsSince: string | null,
  ): Promise<RemotePullResult> {
    this.pullCalls.push({ expensesSince, settlementsSince })
    const expenses = [...this.expenses.values()]
      .map((e) => e.expense)
      .filter((e) => !expensesSince || e.updatedAt >= expensesSince)
    const ids = new Set(expenses.map((e) => e.id))
    return {
      group: GROUP,
      members: MEMBERS,
      expenses,
      splits: [...this.expenses.values()]
        .flatMap((e) => e.splits)
        .filter((s) => ids.has(s.expenseId)),
      settlements: [...this.settlements.values()].filter(
        (s) => !settlementsSince || s.updatedAt >= settlementsSince,
      ),
    }
  }

  async pushExpense(expense: Expense, splits: ExpenseSplit[]): Promise<void> {
    if (this.failPushes) throw new Error('network down')
    // The 0002 trigger makes updated_at server-assigned on insert/update.
    const serverCopy = { ...expense, updatedAt: new Date().toISOString() }
    this.expenses.set(expense.id, { expense: serverCopy, splits })
    this.pushedExpenseIds.push(expense.id)
  }

  async pushSettlement(settlement: Settlement): Promise<void> {
    if (this.failPushes) throw new Error('network down')
    this.settlements.set(settlement.id, {
      ...settlement,
      updatedAt: new Date().toISOString(),
    })
  }

  subscribe(): () => void {
    return () => {}
  }
}

let dbCounter = 0
function makeDb(): LedgerDB {
  return new LedgerDB(`test-ledger-${++dbCounter}`)
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 20))

describe('LocalFirstRepository', () => {
  let db: LedgerDB
  let remote: FakeRemote
  let repo: LocalFirstRepository

  beforeEach(() => {
    db = makeDb()
    remote = new FakeRemote()
    repo = new LocalFirstRepository({ db, remote })
  })

  it('bootstraps from the network on first load and reads locally afterwards', async () => {
    remote.expenses.set('e1', {
      expense: makeExpense('e1', '2026-06-10T10:00:00+00:00'),
      splits: splitsOf(makeExpense('e1', '2026-06-10T10:00:00+00:00')),
    })
    const snapshot = await repo.loadSnapshot()
    expect(snapshot.group.id).toBe('g1')
    expect(snapshot.expenses).toHaveLength(1)
    expect(snapshot.splits).toHaveLength(2)

    // Second load must not hit the network.
    const pullsBefore = remote.pullCalls.length
    const again = await repo.loadSnapshot()
    expect(again.expenses).toHaveLength(1)
    expect(remote.pullCalls.length).toBe(pullsBefore)
  })

  it('keeps writes locally and queues them in the outbox when the push fails', async () => {
    await db.groups.put(GROUP)
    await db.members.bulkPut(MEMBERS)
    remote.failPushes = true

    const expense = makeExpense('e1', '2026-06-10T10:00:00+00:00')
    await repo.upsertExpense(expense, splitsOf(expense))
    await flush()

    const snapshot = await repo.loadSnapshot()
    expect(snapshot.expenses).toHaveLength(1) // visible offline
    expect(await db.outbox.count()).toBe(1) // still queued
    expect(remote.expenses.size).toBe(0)
  })

  it('coalesces repeated edits of the same entity in the outbox', async () => {
    await db.groups.put(GROUP)
    remote.failPushes = true

    const v1 = makeExpense('e1', '2026-06-10T10:00:00+00:00', 'first')
    const v2 = { ...v1, description: 'second', updatedAt: '2026-06-10T10:05:00+00:00' }
    await repo.upsertExpense(v1, splitsOf(v1))
    await repo.upsertExpense(v2, splitsOf(v2))
    await flush()

    const entries = await db.outbox.toArray()
    expect(entries).toHaveLength(1)
    expect(entries[0]!.kind === 'expense' && entries[0]!.expense.description).toBe('second')
  })

  it('drains the outbox in order once the network is back', async () => {
    await db.groups.put(GROUP)
    remote.failPushes = true

    const e1 = makeExpense('e1', '2026-06-10T10:00:00+00:00')
    const e2 = makeExpense('e2', '2026-06-10T11:00:00+00:00')
    await repo.upsertExpense(e1, splitsOf(e1))
    await repo.upsertExpense(e2, splitsOf(e2))
    await repo.upsertSettlement(makeSettlement('s1', '2026-06-10T12:00:00+00:00'))
    await flush()
    expect(await db.outbox.count()).toBe(3)

    remote.failPushes = false
    const engine = new SyncEngine(db, remote)
    const stop = engine.start(() => {})
    await flush()

    expect(await db.outbox.count()).toBe(0)
    expect(remote.pushedExpenseIds).toEqual(['e1', 'e2'])
    expect(remote.settlements.has('s1')).toBe(true)
    stop()
  })
})

describe('SyncEngine.pull', () => {
  let db: LedgerDB
  let remote: FakeRemote
  let engine: SyncEngine

  beforeEach(async () => {
    db = makeDb()
    remote = new FakeRemote()
    engine = new SyncEngine(db, remote)
    await db.groups.put(GROUP)
  })

  it('refreshes all cached rows atomically when the group changes to MXN', async () => {
    const old = makeExpense('e1', '2026-06-10T10:00:00+00:00')
    await db.expenses.put(old)
    await db.splits.bulkPut(splitsOf(old))
    await db.meta.put({ key: 'expensesSince', value: '2026-06-11T00:00:00+00:00' })
    remote.expenses.set(old.id, { expense: { ...old, baseCurrency: 'MXN', fxRateToBase: 19.7593 }, splits: splitsOf(old) })
    const pull = remote.pullSince.bind(remote)
    remote.pullSince = async (a, b) => ({ ...await pull(a, b), group: { ...GROUP, baseCurrency: 'MXN' } })
    await engine.pull()
    expect(remote.pullCalls).toHaveLength(2)
    expect(remote.pullCalls[1]).toEqual({ expensesSince: null, settlementsSince: null })
    expect((await db.groups.get(GROUP.id))?.baseCurrency).toBe('MXN')
    expect((await db.expenses.get(old.id))?.fxRateToBase).toBe(19.7593)
    expect((await db.expenses.get(old.id))?.amountCents).toBe(old.amountCents)
  })

  it('does not mix pending EUR writes with a newly migrated MXN group', async () => {
    const local = makeExpense('pending', '2026-06-10T10:00:00+00:00')
    await db.outbox.add({ kind: 'expense', entityId: local.id, expense: local, splits: splitsOf(local) })
    const pull = remote.pullSince.bind(remote)
    remote.pullSince = async (a, b) => ({ ...await pull(a, b), group: { ...GROUP, baseCurrency: 'MXN' } })
    await expect(engine.pull()).rejects.toThrow('otra moneda base')
    expect((await db.groups.get(GROUP.id))?.baseCurrency).toBe('EUR')
    expect(await db.outbox.count()).toBe(1)
  })

  it('rebases and sends an unsynced EUR expense after the real group migrates', async () => {
    const group = { ...GROUP, id: '11111111-1111-4111-8111-111111111111' }
    await db.groups.clear()
    await db.groups.put(group)
    const local = { ...makeExpense('pending', '2026-06-10T10:00:00+00:00'), groupId: group.id }
    await db.expenses.put(local)
    await db.splits.bulkPut(splitsOf(local))
    await db.outbox.add({ kind: 'expense', entityId: local.id, expense: local, splits: splitsOf(local) })
    const pull = remote.pullSince.bind(remote)
    remote.pullSince = async (a, b) => ({ ...await pull(a, b), group: { ...group, baseCurrency: 'MXN' } })
    await engine.pull()
    await flush()
    expect((await db.groups.get(group.id))?.baseCurrency).toBe('MXN')
    expect(await db.outbox.count()).toBe(0)
    expect(remote.pushedExpenseIds).toEqual(['pending'])
    const expense = remote.expenses.get('pending')!.expense
    expect(expense.amountCents).toBe(local.amountCents)
    expect(expense.fxRateToBase).toBe(19.7593)
    expect(expense.baseCurrency).toBe('MXN')
    expect(await db.splits.where('expenseId').equals(local.id).toArray()).toEqual(splitsOf(local))
    await engine.pull()
    expect((await db.expenses.get(local.id))?.fxRateToBase).toBe(19.7593)
  })

  it('pulls incrementally using the max updated_at as cursor', async () => {
    remote.expenses.set('e1', {
      expense: makeExpense('e1', '2026-06-10T10:00:00+00:00'),
      splits: splitsOf(makeExpense('e1', '2026-06-10T10:00:00+00:00')),
    })
    await engine.pull()
    expect(remote.pullCalls[0]!.expensesSince).toBeNull()

    await engine.pull()
    expect(remote.pullCalls[1]!.expensesSince).toBe('2026-06-10T10:00:00+00:00')
    expect(await db.expenses.count()).toBe(1)
  })

  it('applies remote changes with last-write-wins', async () => {
    await db.expenses.put(makeExpense('e1', '2026-06-10T10:00:00+00:00', 'local-old'))
    remote.expenses.set('e1', {
      expense: makeExpense('e1', '2026-06-10T11:00:00+00:00', 'remote-new'),
      splits: splitsOf(makeExpense('e1', '2026-06-10T11:00:00+00:00')),
    })
    await engine.pull()
    expect((await db.expenses.get('e1'))!.description).toBe('remote-new')
  })

  it('does not let a pull clobber an entity with a pending local edit', async () => {
    const local = makeExpense('e1', '2026-06-10T12:00:00+00:00', 'local-pending')
    await db.expenses.put(local)
    await db.outbox.add({ kind: 'expense', entityId: 'e1', expense: local, splits: splitsOf(local) })

    remote.expenses.set('e1', {
      expense: makeExpense('e1', '2026-06-10T11:00:00+00:00', 'remote-stale'),
      splits: splitsOf(makeExpense('e1', '2026-06-10T11:00:00+00:00')),
    })
    await engine.pull()
    expect((await db.expenses.get('e1'))!.description).toBe('local-pending')
  })

  it('replaces splits of pulled expenses (no stale rows after a participant change)', async () => {
    const old = makeExpense('e1', '2026-06-10T10:00:00+00:00')
    await db.expenses.put(old)
    await db.splits.bulkPut(splitsOf(old))

    const updated = makeExpense('e1', '2026-06-10T11:00:00+00:00')
    remote.expenses.set('e1', {
      expense: updated,
      splits: [{ expenseId: 'e1', memberId: 'a', shareCents: 1000 }],
    })
    await engine.pull()

    const splits = await db.splits.where('expenseId').equals('e1').toArray()
    expect(splits).toHaveLength(1)
    expect(splits[0]!.memberId).toBe('a')
  })

  it('round-trip: a pushed expense comes back with the server timestamp on the next pull', async () => {
    const repo = new LocalFirstRepository({ db, remote })
    const expense = makeExpense('e1', '2026-06-10T10:00:00+00:00')
    await repo.upsertExpense(expense, splitsOf(expense))
    await flush() // push drains, then reconciliation pull runs

    const stored = (await db.expenses.get('e1'))!
    expect(remote.pushedExpenseIds).toEqual(['e1'])
    expect(stored.updatedAt).not.toBe('2026-06-10T10:00:00+00:00') // server clock won
    expect(await db.outbox.count()).toBe(0)
  })
})
