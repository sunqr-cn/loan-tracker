import { useState } from 'react';
import { useLoanStore } from '@/stores/loanStore';
import { formatMoney } from '@/utils/calculator';

export default function RepaymentPlan() {
  const { schedule, togglePaid, setActiveTab } = useLoanStore();
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('all');

  if (schedule.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">📋</div>
        <p className="text-gray-500 mb-4">暂无还款计划</p>
        <button onClick={() => setActiveTab('config')}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors">
          去配置贷款信息
        </button>
      </div>
    );
  }

  const filteredSchedule = schedule.filter((s) => {
    if (filter === 'unpaid') return !s.paid;
    if (filter === 'paid') return s.paid;
    return true;
  });

  const paidCount = schedule.filter((s) => s.paid).length;
  const unpaidCount = schedule.length - paidCount;

  return (
    <div className="space-y-4">
      {/* 筛选栏 */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {([
            { key: 'all' as const, label: '全部', count: schedule.length },
            { key: 'unpaid' as const, label: '待还', count: unpaidCount },
            { key: 'paid' as const, label: '已还', count: paidCount },
          ]).map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filter === f.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              {f.label} ({f.count})
            </button>
          ))}
        </div>
        <div className="text-sm text-gray-400">
          共 {schedule.length} 期 · 已还 {paidCount} 期
        </div>
      </div>

      {/* 表格 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="text-gray-400 text-xs border-b border-gray-100">
                <th className="text-center py-3 px-2 w-12">状态</th>
                <th className="text-center py-3 px-2 w-12">期数</th>
                <th className="text-left py-3 px-2">还款日期</th>
                <th className="text-right py-3 px-2">月供</th>
                <th className="text-right py-3 px-2">本金</th>
                <th className="text-right py-3 px-2">利息</th>
                <th className="text-right py-3 px-2">剩余本金</th>
              </tr>
            </thead>
            <tbody>
              {filteredSchedule.map((item) => (
                <tr key={item.period}
                  className={`border-b border-gray-50 transition-colors hover:bg-blue-50/30 ${
                    item.paid ? 'bg-green-50/40' : ''
                  } ${item.isPrepaymentPoint ? 'border-l-3 border-l-blue-500' : ''} ${
                    item.isRateChangePoint ? 'border-l-3 border-l-orange-400' : ''
                  }`}>
                  <td className="text-center py-2.5 px-2">
                    <input type="checkbox" checked={item.paid} onChange={() => togglePaid(item.period)}
                      className="w-4 h-4 cursor-pointer" />
                  </td>
                  <td className="text-center py-2.5 px-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      item.isPrepaymentPoint
                        ? 'bg-blue-50 text-blue-600'
                        : item.isRateChangePoint
                        ? 'bg-orange-50 text-orange-500'
                        : 'text-gray-400'
                    }`}>
                      {item.period}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-gray-600 text-xs">{item.date}</td>
                  <td className="text-right py-2.5 px-2 font-mono text-xs font-medium text-blue-600">
                    ¥{formatMoney(item.monthlyPayment)}
                  </td>
                  <td className="text-right py-2.5 px-2 font-mono text-xs text-gray-600">
                    {formatMoney(item.principal)}
                  </td>
                  <td className="text-right py-2.5 px-2 font-mono text-xs text-gray-400">
                    {formatMoney(item.interest)}
                  </td>
                  <td className="text-right py-2.5 px-2 font-mono text-xs text-gray-500">
                    {formatMoney(item.remainingPrincipal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 图例 */}
      <div className="flex items-center gap-4 text-xs text-gray-400 px-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-l-3 border-blue-500" />
          <span>提前还款重算点</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-l-3 border-orange-400" />
          <span>利率变更点</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-50/40" />
          <span>已还款</span>
        </div>
      </div>
    </div>
  );
}