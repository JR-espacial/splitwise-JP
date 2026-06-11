import type { Balance, Transfer } from './types'

/**
 * Greedy debt simplification: repeatedly match the largest creditor with
 * the largest debtor until everyone is settled. Input balances are
 * expected to sum to zero (computeBalances guarantees it); if they don't,
 * the residual is left unmatched rather than inventing a transfer.
 */
export function suggestSettlements(balances: Balance[]): Transfer[] {
  const creditors = balances
    .filter((b) => b.balanceCents > 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.balanceCents - a.balanceCents)
  const debtors = balances
    .filter((b) => b.balanceCents < 0)
    .map((b) => ({ memberId: b.memberId, balanceCents: -b.balanceCents }))
    .sort((a, b) => b.balanceCents - a.balanceCents)

  const transfers: Transfer[] = []
  let ci = 0
  let di = 0
  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci]!
    const debtor = debtors[di]!
    const amountCents = Math.min(creditor.balanceCents, debtor.balanceCents)
    if (amountCents > 0) {
      transfers.push({
        fromMember: debtor.memberId,
        toMember: creditor.memberId,
        amountCents,
      })
    }
    creditor.balanceCents -= amountCents
    debtor.balanceCents -= amountCents
    if (creditor.balanceCents === 0) ci++
    if (debtor.balanceCents === 0) di++
  }
  return transfers
}
