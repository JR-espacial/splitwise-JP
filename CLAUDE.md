# CLAUDE.md

Shared-expenses PWA (Splitwise-style) for a 4-person Europe roadtrip.
UI copy is Spanish; code, commits and identifiers are English.

## Stack

- **Frontend**: React 18 + Vite + TypeScript (strict) + Tailwind v4, mobile-first (~390px), React Router.
- **Backend**: Supabase (Postgres + Realtime + magic-link Auth). RLS restricts
  the whole ledger to authenticated group members (`is_group_member()`,
  matched by JWT email — migration 0003). No custom backend.
- **Deploy**: Vercel (`vercel.json` has the SPA rewrite).
- **Tests**: Vitest, colocated under `src/domain/__tests__/`.

## Commands

```sh
npm run dev        # dev server (needs .env.local, see .env.example)
npm test           # unit tests (vitest run)
npm run typecheck  # tsc -b --noEmit
npm run build      # typecheck + production build
```

Migrations live in `supabase/migrations/` (plain SQL, run in order in the
Supabase SQL editor or via `supabase db push`). `supabase/seed.sql` creates
the single group and its 4 members with fixed UUIDs (idempotent).

Migration 0004 adds expense categories, compressed inline receipt images,
custom settlement dates and authorship/change-log metadata. Receipt images
are resized client-side and stored on the expense entity so they remain
available offline and follow the same outbox/LWW sync path.

## Money rules (non-negotiable)

- **All amounts are integer cents** (`amount_cents`, `share_cents`). Never use
  floats for money. User input is parsed with string math
  (`parseAmountToCents`), never `parseFloat(x) * 100`.
- **Multi-currency**: EUR, CZK, MXN, USD, CHF. Each expense stores its original
  currency plus `fx_rate_to_base` **frozen at capture time**. New expenses
  prefill the ECB daily rate (`fxService`, Frankfurter API, 12h localStorage
  cache, stale cache offline), falling back to the last manually used rate;
  always editable, and editing an expense never touches its frozen rate. The
  rate itself is not money, so float multiplication + `Math.round` is fine
  (`toBaseCents`).
- **Split rounding**: equal/subset shares are `floor(amount / n)`; the
  remainder goes to the payer, or to the first participant when the payer is
  not in the subset. Invariant: `sum(share_cents) === amount_cents`, enforced
  in `computeSplits` and covered by tests.
- **Balances are never stored.** They are derived in the client by the pure
  function `computeBalances` from non-deleted expenses + settlements. Each
  share is converted to base individually and the payer is credited with the
  sum of converted shares, so balances always sum to exactly zero.
- **Settlements** are always denominated in the group base currency (EUR).
- Settle-up suggestions come from `suggestSettlements` (greedy largest creditor
  vs largest debtor).

All money/balance logic is pure functions in `src/domain/` with tests. Keep it
free of React and Supabase imports.

## Persistence conventions

- **Client-generated UUIDs** (`crypto.randomUUID()`) for all user-created rows
  (expenses, settlements). All writes are **upserts**, so retries and the
  future offline outbox are idempotent.
- **Soft deletes only**: set `deleted_at`; undo sets it back to null. There is
  deliberately no DELETE policy on `expenses`/`settlements` (database-enforced).
  `expense_splits` are derived rows and are replaced when an expense is edited.
- Expense and settlement mutations append a client-generated entry to the
  entity `change_log`; `created_by`/`updated_by` provide quick attribution.
- `updated_at` is **server-assigned** by Postgres triggers on INSERT and
  UPDATE (migrations 0001 + 0002); the client-set value is only an optimistic
  placeholder. The incremental pull uses it as its cursor, so it must come
  from a single clock.

## Architecture

- `src/domain/` — pure money/split/balance/settle logic + types.
- `src/data/` — `ExpenseRepository` interface (`repository.ts`) implemented by
  `LocalFirstRepository`: the UI reads/writes **Dexie/IndexedDB only**
  (`db.ts`), never the network. **The UI must only talk to the repository
  through `ledgerStore`.**
- Sync (`sync.ts` + `remote.ts`): writes are queued in an **outbox**
  (coalesced per entity id) and pushed to Supabase as idempotent upserts with
  exponential backoff; pulls are **incremental by `updated_at` cursor** with
  last-write-wins, except entities with a pending outbox entry, where the
  local unsent edit wins until pushed. Pulls are triggered by Realtime
  events, reconnects, the `online` event and `visibilitychange`. First run on
  a device needs network to bootstrap the group.
- `ledgerStore` (`src/data/store.ts`) holds an in-memory snapshot, applies
  writes optimistically, and refetches (debounced) from Dexie when the sync
  engine reports changes; it also exposes `SyncStatus` (offline / pending
  count) shown as a banner in `Layout`.
- Service worker via `vite-plugin-pwa` (`generateSW`, autoUpdate): the app
  shell opens offline and is installable; data offline comes from Dexie.
- `src/views/` + `src/ui/` — React. Identity = the member whose `email`
  matches the Supabase session email (magic link, `src/data/auth.ts`); the
  session persists in localStorage so a signed-in device works offline.

## Roadmap context

Iterations 1 (online core), 2 (local-first: Dexie + outbox + service worker,
incremental pull by `updated_at`, last-write-wins) and 3 (magic-link auth +
real RLS, automatic FX rates, history filters + trip totals) are done.

## UX ground rules

- Mobile-first, one-hand use; touch targets ≥ 44px; readable in sunlight.
- Capturing a typical expense must stay ≤ 5 taps (defaults: payer = me,
  date = today, split = equal, currency = last used).
- Expense capture must feel instant (optimistic UI).
