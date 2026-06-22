import { useLoanStore } from '@/stores/loanStore';
import { formatMoney } from '@/utils/calculator';

export default function ScheduleTable() {
  const { schedule, togglePaid } = useLoanStore();

  if (schedule.length === 0) return null;

  return (
    <div className="rounded-2xl p-6 shadow-lg overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #16213e 0%, #1a1a2e 100%)', border: '1px solid rgba(226,176,74,0.15)' }}>
      <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Georgia, serif', color: '#e2b04a' }}>
        <span className="text-2xl mr-2">📋</span>还款计划明细
      </h2>

      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10"
            style={{ background: 'linear-gradient(135deg, #16213e 0%, #1a1a2e 100%)' }}>
            <tr className="text-gray-400 text-xs border-b border-gray-700/50">
              <th className="text-left py-2.5 pr-2 w-12">状态</th>
              <th className="text-center py-2.5 px-1">期数</th>
              <th className="text-left py-2.5 px-1">还款日期</th>
              <th className="text-right py-2.5 px-1">月供</th>
              <th className="text-right py-2.5 px-1">本金</th>
              <th className="text-right py-2.5 px-1">利息</th>
              <th className="text-right py-2.5 pl-1">剩余本金</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((item) => (
              <tr
                key={item.period}
                className={`border-b border-gray-700/20 transition-colors duration-150 hover:bg-white/3 ${
                  item.paid ? 'bg-[#4ecca3]/5' : ''
                } ${item.isPrepaymentPoint ? 'border-l-2 border-l-[#e2b04a]' : ''}`}
              >
                <td className="py-2 pr-2">
                  <label className="flex items-center justify-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.paid}
                      onChange={() => togglePaid(item.period)}
                      className="w-4 h-4 rounded accent-[#4ecca3] cursor-pointer"
                    />
                  </label>
                </td>
                <td className="text-center py-2 px-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    item.isPrepaymentPoint
                      ? 'text-[#e2b04a] bg-[#e2b04a]/10'
                      : 'text-gray-400'
                  }`}>
                    {item.period}
                  </span>
                </td>
                <td className="py-2 px-1 text-gray-300 text-xs">{item.date}</td>
                <td className="text-right py-2 px-1 font-mono text-xs"
                  style={{ color: item.paid ? '#4ecca3' : '#e2b04a' }}>
                  ¥{formatMoney(item.monthlyPayment)}
                </td>
                <td className="text-right py-2 px-1 font-mono text-xs text-gray-300">
                  {formatMoney(item.principal)}
                </td>
                <td className="text-right py-2 px-1 font-mono text-xs text-gray-500">
                  {formatMoney(item.interest)}
                </td>
                <td className="text-right py-2 pl-1 font-mono text-xs text-gray-400">
                  {formatMoney(item.remainingPrincipal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}