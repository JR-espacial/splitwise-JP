import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { computeBalances } from '../domain/balances'
import { DesignIcon } from '../ui/DesignIcon'
import { downloadLedgerCsv } from '../data/exportCsv'
import { computeTripTotals } from '../domain/totals'
import { formatCents } from '../domain/money'
import { suggestSettlements } from '../domain/settle'
import type { LedgerSnapshot } from '../data/repository'
import { MemberAvatar } from '../ui/MemberAvatar'
import { useIdentity } from '../ui/identityContext'

export function BalancesView({ snapshot }: { snapshot: LedgerSnapshot }) {
  const { currentMemberId } = useIdentity()
  const { group, members, expenses, splits, settlements } = snapshot

  const balances = useMemo(
    () =>
      computeBalances(
        members.map((m) => m.id),
        expenses,
        splits,
        settlements,
      ),
    [members, expenses, splits, settlements],
  )
  const transfers = useMemo(() => suggestSettlements(balances), [balances])
  const balanceByMember = new Map(balances.map((b) => [b.memberId, b.balanceCents]))
  const memberById = new Map(members.map((m) => [m.id, m]))

  const myBalance = balanceByMember.get(currentMemberId) ?? 0
  const totals = computeTripTotals(expenses, splits)

  return (
    <div className="animate-rise flex flex-col gap-6">
      <section className="balance-hero" aria-label="Resumen de tu balance">
        <div className="flex items-center justify-between gap-2">
          <span className="hero-badge"><DesignIcon name="check" size={12} />{myBalance > 0 ? 'TE DEBEN · CUENTAS CLARAS' : myBalance < 0 ? 'POR PAGAR · SALDO PENDIENTE' : 'ESTÁS AL DÍA · DISFRUTA EL VIAJE 🎉'}</span>
          <button type="button" aria-label="Exportar resumen del viaje" className="hero-export" onClick={() => downloadLedgerCsv(snapshot)}><DesignIcon name="share" size={16} /></button>
        </div>
        <div className="personal-balance"><p>Tu balance personal</p><strong>{formatCents(Math.abs(myBalance), group.baseCurrency)}</strong><span>{group.baseCurrency}</span></div>
        <div className="hero-total"><div><p>TOTAL DEL VIAJE</p><strong>{formatCents(totals.totalBaseCents, group.baseCurrency)}</strong></div><span><DesignIcon name="receipt" size={12} />{totals.expenseCount} gastos · {members.length} viajeros</span></div>
      </section>
      <Link to="/expense/new" className="add-expense-card"><span className="add-expense-icon"><DesignIcon name="plus" size={18} /></span><span className="min-w-0 flex-1"><strong>Agregar nuevo gasto</strong><small>Dividir cena, gasolina, alojamiento...</small></span><span className="arrow-circle"><DesignIcon name="arrow" size={14} /></span></Link>
      <section aria-labelledby="settle-heading">
        <div className="section-heading"><h2 id="settle-heading"><DesignIcon name="settle" size={18} />Liquidar deudas</h2><Link to="/settlement/new" className="small-action"><DesignIcon name="payment" size={14} />Registrar otro pago</Link></div>
        {transfers.length === 0 ? <p className="surface-card py-6 text-center text-slate-500">Todos al día 🎉</p> : (
          <ul className="flex flex-col gap-3">{transfers.map((transfer) => {
            const from = memberById.get(transfer.fromMember)
            const to = memberById.get(transfer.toMember)
            if (!from || !to) return null
            const paymentUrl = `/settlement/new?from=${transfer.fromMember}&to=${transfer.toMember}`
            return <li key={`${transfer.fromMember}-${transfer.toMember}`} className="surface-card transfer-card">
              <div className="transfer-people"><div><MemberAvatar member={from} /><span><strong>{from.name}</strong><small className="text-danger">Transfiere</small></span></div><DesignIcon name="flow" size={18} /><div><span className="text-right"><strong>{to.name}</strong><small className="text-success">Recibe</small></span><MemberAvatar member={to} /></div></div>
              <div className="transfer-amount"><div><small>Monto sugerido</small><strong>{formatCents(transfer.amountCents, group.baseCurrency)}</strong></div><Link to={paymentUrl}><DesignIcon name="register" size={14} />Registrar</Link></div>
              <div className="transfer-foot"><span><DesignIcon name="magic" size={14} />{transfers.length} {transfers.length === 1 ? 'transferencia sugerida' : 'transferencias sugeridas'}</span><Link to="/history">Ver movimientos</Link></div>
            </li>
          })}</ul>
        )}
      </section>
      <section aria-labelledby="balances-heading">
        <div className="section-heading"><h2 id="balances-heading"><DesignIcon name="group" size={20} />El grupo ({members.length})</h2></div>
        <ul className="flex flex-col gap-2">{members.map((member) => {
          const cents = balanceByMember.get(member.id) ?? 0
          const isMe = member.id === currentMemberId
          return <li key={member.id} className="member-balance surface-card">
            <span className="relative"><MemberAvatar member={member} size={44} />{isMe && <small className="me-badge">Tú</small>}</span>
            <span className="min-w-0 flex-1 font-semibold">{member.name}</span>
            <span className={`member-amount ${cents > 0 ? 'text-success' : cents < 0 ? 'text-danger' : 'text-slate-600'}`}><strong>{cents > 0 ? '+' : ''}{formatCents(cents, group.baseCurrency)}</strong><small className={cents > 0 ? 'status-credit' : cents < 0 ? 'status-debt' : 'status-clear'}>{cents > 0 ? 'Le deben' : cents < 0 ? 'Debe' : 'Al día'}</small></span>
          </li>
        })}</ul>
      </section>
    </div>
  )
}
