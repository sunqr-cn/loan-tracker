import { useLoanStore } from '@/stores/loanStore';
import { formatMoney } from '@/utils/calculator';

export default function ProgressOverview() {
  const { schedule } = useLoanStore();

  const totalPaid = schedule.filter((s) => s.paid).length;
  const totalPeriods = schedule.length;
  const paidPrincipal = schedule
    .filter((s) => s.paid)
    .reduce((sum, s) => sum + s.principal, 0);
  const paidInterest = schedule
    .filter((s) => s.paid)
    .reduce((sum, s) => sum + s.interest, 0);
  const remainingPrincipal = schedule.length > 0
    ? schedule[schedule.length - 1].remainingPrincipal
    : 0;
  const totalPrincipal = schedule.length > 0
    ? schedule[0].remainingPrincipal + schedule[0].principal
    : 0;
  const nextPayment = schedule.find((s) => !s.paid);

  const cards = [
    {
      label: '已还 / 总期数',
      value: `${totalPaid} / ${totalPeriods}`,
      sub: `${totalPeriods > 0 ? Math.round((totalPaid / totalPeriods) * 100) : 0}%`,
      color: '#4ecca3',
    },
    {
      label: '剩余本金',
      value: `¥${formatMoney(remainingPrincipal)}`,
      sub: `${totalPrincipal > 0 ? Math.round((remainingPrincipal / totalPrincipal) * 100) : 0}%`,
      color: '#e2b04a',
    },
    {
      label: '已还利息',
      value: `¥${formatMoney(paidInterest)}`,
      sub: `已还本金 ¥${formatMoney(paidPrincipal)}`,
      color: '#f0a500',
    },
    {
      label: '下期应还',
      value: nextPayment ? `¥${formatMoney(nextPayment.monthlyPayment)}` : '—',
      sub: nextPayment ? nextPayment.date : '已全部还清',
      color: '#4e9efc',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl p-4 shadow-lg transition-transform duration-200 hover:scale-[1.02]"
          style={{ background: 'linear-gradient(135deg, #16213e 0%, #1a1a2e 100%)', border: '1px solid rgba(226,176,74,0.1)' }}
        >
          <div className="text-xs text-gray-500 mb-1">{card.label}</div>
          <div className="text-xl font-bold text-white tracking-tight">{card.value}</div>
          <div className="text-xs mt-1" style={{ color: card.color }}>{card.sub}</div>
        </div>
      ))}
    </div>
  );
}