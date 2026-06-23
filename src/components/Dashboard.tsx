import { useLoanStore } from '@/stores/loanStore';
import { formatMoney } from '@/utils/calculator';

export default function Dashboard() {
  const { loanInfo, schedule, prepayments, rateChanges, setActiveTab } = useLoanStore();

  if (!loanInfo) return null;

  const totalInterest = schedule.reduce((sum, s) => sum + s.interest, 0);
  const totalPayment = schedule.reduce((sum, s) => sum + s.monthlyPayment, 0);
  const paidCount = schedule.filter(s => s.paid).length;
  const remainingPrincipal = schedule.length > 0
    ? schedule[schedule.length - 1].remainingPrincipal
    : 0;
  const currentMonthly = schedule.find(s => !s.paid)?.monthlyPayment || 0;
  const progress = schedule.length > 0 ? (paidCount / schedule.length) * 100 : 0;

  const stats = [
    { label: '贷款总额', value: `¥${formatMoney(loanInfo.totalAmount)}`, color: 'text-gray-800' },
    { label: '累计利息', value: `¥${formatMoney(totalInterest)}`, color: 'text-orange-500' },
    { label: '还款总额', value: `¥${formatMoney(totalPayment)}`, color: 'text-blue-600' },
    { label: '当前月供', value: `¥${formatMoney(currentMonthly)}`, color: 'text-indigo-600' },
    { label: '剩余本金', value: `¥${formatMoney(remainingPrincipal)}`, color: 'text-gray-600' },
    { label: '已还期数', value: `${paidCount} / ${schedule.length}`, color: 'text-green-600' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="text-xs text-gray-400 mb-1">{s.label}</div>
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">还款进度</span>
          <span className="text-xs text-gray-400">{progress.toFixed(1)}%</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }} />
        </div>
      </div>

      {(prepayments.length > 0 || rateChanges.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {prepayments.length > 0 && (
            <button onClick={() => setActiveTab('config')}
              className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-left hover:border-blue-200 transition-colors">
              <div className="text-xs text-gray-400 mb-1">提前还款</div>
              <div className="text-lg font-bold text-blue-600">{prepayments.length} 笔</div>
              <div className="text-xs text-gray-400 mt-1">
                合计 ¥{formatMoney(prepayments.reduce((s, p) => s + p.amount, 0))}
              </div>
            </button>
          )}
          {rateChanges.length > 0 && (
            <button onClick={() => setActiveTab('config')}
              className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-left hover:border-blue-200 transition-colors">
              <div className="text-xs text-gray-400 mb-1">利率变更</div>
              <div className="text-lg font-bold text-indigo-600">{rateChanges.length} 次</div>
              <div className="text-xs text-gray-400 mt-1">
                最新 {rateChanges[rateChanges.length - 1].newRate}%
              </div>
            </button>
          )}
        </div>
      )}

      <button onClick={() => setActiveTab('plan')}
        className="w-full py-3 bg-white rounded-xl border border-gray-100 shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
        查看完整还款计划 →
      </button>
    </div>
  );
}
