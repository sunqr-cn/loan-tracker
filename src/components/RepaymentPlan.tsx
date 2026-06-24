import { useState } from 'react';
import { useLoanStore } from '@/stores/loanStore';
import { formatMoney } from '@/utils/calculator';
import { CheckCircle, Clock, Calendar, TrendingUp } from 'lucide-react';

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
  const totalPaid = schedule.filter(s => s.paid).reduce((sum, s) => sum + s.monthlyPayment, 0);
  const totalRemaining = schedule.filter(s => !s.paid).reduce((sum, s) => sum + s.monthlyPayment, 0);

  // Group by year
  const groupedByYear = filteredSchedule.reduce((acc, item) => {
    const year = item.date.substring(0, 4);
    if (!acc[year]) acc[year] = [];
    acc[year].push(item);
    return acc;
  }, {} as Record<string, typeof schedule>);

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-4 text-white shadow-lg shadow-green-600/20">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs opacity-90">已还</span>
          </div>
          <div className="text-xl font-bold mb-1">{paidCount} 期</div>
          <div className="text-xs opacity-80">¥{formatMoney(totalPaid)}</div>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-4 text-white shadow-lg shadow-blue-600/20">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-xs opacity-90">待还</span>
          </div>
          <div className="text-xl font-bold mb-1">{unpaidCount} 期</div>
          <div className="text-xs opacity-80">¥{formatMoney(totalRemaining)}</div>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex items-center gap-2">
        {([
          { key: 'all' as const, label: '全部', count: schedule.length },
          { key: 'unpaid' as const, label: '待还', count: unpaidCount },
          { key: 'paid' as const, label: '已还', count: paidCount },
        ]).map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === f.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}>
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* 按年份分组显示 */}
      <div className="space-y-4">
        {Object.entries(groupedByYear).map(([year, items]) => (
          <div key={year}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-700">{year}年</span>
              <span className="text-xs text-gray-400">({items.length}期)</span>
            </div>
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.period}
                  className={`bg-white rounded-xl p-4 border transition-all ${
                    item.paid
                      ? 'border-green-200 bg-green-50/30'
                      : 'border-gray-100 shadow-sm hover:shadow-md'
                  } ${item.isPrepaymentPoint ? 'border-l-4 border-l-blue-500' : ''} ${
                    item.isRateChangePoint ? 'border-l-4 border-l-orange-400' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => togglePaid(item.period)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          item.paid
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-gray-300 hover:border-blue-500'
                        }`}
                      >
                        {item.paid && <CheckCircle className="w-4 h-4" />}
                      </button>
                      <div>
                        <div className="text-sm font-semibold text-gray-800">
                          第 {item.period} 期
                        </div>
                        <div className="text-xs text-gray-400">{item.date}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-600">
                        ¥{formatMoney(item.monthlyPayment)}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100">
                    <div>
                      <div className="text-[10px] text-gray-400 mb-0.5">本金</div>
                      <div className="text-xs font-semibold text-gray-700">
                        ¥{formatMoney(item.principal)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 mb-0.5">利息</div>
                      <div className="text-xs font-semibold text-gray-700">
                        ¥{formatMoney(item.interest)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 mb-0.5">剩余</div>
                      <div className="text-xs font-semibold text-gray-500">
                        ¥{formatMoney(item.remainingPrincipal)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 提示 + 图例 */}
      <div className="space-y-2 pt-2">
        <div className="text-xs text-gray-400 px-2">
          💡 点击圆圈可手动标记还款状态，已还款状态根据当前日期自动标记
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-400 px-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border-l-3 border-blue-500" />
            <span>提前还款重算点</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border-l-3 border-orange-400" />
            <span>利率变更点</span>
          </div>
        </div>
      </div>
    </div>
  );
}
