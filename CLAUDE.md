# CLAUDE.md

Shared-expenses PWA (Splitwise-style) for a 4-person Europe roadtrip.
UI copy is Spanish; code, commits and identifiers are English.

## Stack

- **Frontend**: React 18 + Vite + TypeScript (strict) + Tailwind v4, mobile-first (~390px), React Router.
- **Backend**: Supabase (Postgres + Realtime), anon key with permissive RLS for now. No custom backend.
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

## Money rules (non-negotiable)

- **All amounts are integer cents** (`amount_cents`, `share_cents`). Never use
  floats for money. User input is parsed with string math
  (`parseAmountToCents`), never `parseFloat(x) * 100`.
- **Multi-currency**: EUR, CZK, MXN, USD, CHF. Each expense stores its original
  currency plus `fx_rate_to_base` **frozen at capture time** (manual input,
  editable default per currency remembered in localStorage). The rate itself is
  not money, so float multiplication + `Math.round` is fine (`toBaseCents`).
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
- `updated_at` is bumped by a Postgres trigger on UPDATE (and set client-side
  for the optimistic copy).

## Architecture

- `src/domain/` — pure money/split/balance/settle logic + types.
- `src/data/` — `ExpenseRepository` interface (`repository.ts`) and the
  Supabase implementation. **The UI must only talk to the repository through
  `ledgerStore`**, never to Supabase directly: iteration 2 swaps in a
  Dexie/IndexedDB + outbox implementation behind the same interface.
- `ledgerStore` (`src/data/store.ts`) holds an in-memory snapshot, applies
  writes optimistically, pushes in the background, and refetches (debounced)
  on Supabase Realtime events; in-flight writes are overlaid on refetched
  snapshots to avoid flicker.
- `src/views/` + `src/ui/` — React. Identity (no real auth yet) is a member id
  in localStorage.

## Roadmap context

Iteration 1 (current): online-only core. Iteration 2: local-first with Dexie +
outbox + service worker (vite-plugin-pwa), incremental pull by `updated_at`,
last-write-wins. Iteration 3: Supabase magic-link auth + real RLS, automatic FX
rates, history filters. Don't build ahead, but don't block these either.

## UX ground rules

- Mobile-first, one-hand use; touch targets ≥ 44px; readable in sunlight.
- Capturing a typical expense must stay ≤ 5 taps (defaults: payer = me,
  date = today, split = equal, currency = last used).
- Expense capture must feel instant (optimistic UI).
