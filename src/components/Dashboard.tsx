import type { ScheduleItem } from '@/types/loan';
import { useLoanStore } from '@/stores/loanStore';
import { formatMoney, getCurrentRemainingPrincipal } from '@/utils/calculator';
import {
  Wallet, TrendingUp, Calendar, PiggyBank, BarChart3,
  ArrowRight, Percent, CreditCard, Clock, Settings2,
} from 'lucide-react';

export default function Dashboard() {
  const { loanInfo, schedule, prepayments, rateChanges, setActiveTab } = useLoanStore();

  if (!loanInfo) return null;

  const totalInterest = schedule.reduce((sum, s) => sum + s.interest, 0);
  const totalPrincipal = schedule.reduce((sum, s) => sum + s.principal, 0);
  const totalPayment = totalPrincipal + totalInterest;
  const paidCount = schedule.filter(s => s.paid).length;
  const remainingPrincipal = getCurrentRemainingPrincipal(schedule);
  const currentMonthly = schedule.find(s => !s.paid)?.monthlyPayment || 0;
  const nextPaymentDate = schedule.find(s => !s.paid)?.date || '-';
  const progress = schedule.length > 0 ? (paidCount / schedule.length) * 100 : 0;
  const unpaidCount = schedule.length - paidCount;
  const paidPrincipal = totalPrincipal - remainingPrincipal;

  return (
    <div className="space-y-4">
      {/* 核心数据区 - 大卡片 */}
      <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-6 text-white shadow-xl shadow-blue-600/20">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-sm text-blue-100 mb-1">当前月供</div>
            <div className="text-4xl font-bold tracking-tight">¥{formatMoney(currentMonthly)}</div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-100">
              <Clock className="w-3.5 h-3.5" />
              <span>下一还款日 {nextPaymentDate}</span>
            </div>
          </div>
          <div className="text-right">
            <ProgressRingCompact progress={progress} paid={paidCount} total={schedule.length} />
          </div>
        </div>

        {/* 关键指标网格 */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
          <div>
            <div className="text-xs text-blue-100 mb-1">剩余本金</div>
            <div className="text-2xl font-bold">¥{formatMoney(remainingPrincipal)}</div>
            <div className="text-xs text-blue-200 mt-0.5">
              已还 ¥{formatMoney(paidPrincipal)} ({((paidPrincipal / totalPrincipal) * 100).toFixed(1)}%)
            </div>
          </div>
          <div>
            <div className="text-xs text-blue-100 mb-1">累计利息</div>
            <div className="text-2xl font-bold">¥{formatMoney(totalInterest)}</div>
            <div className="text-xs text-blue-200 mt-0.5">
              占还款总额 {((totalInterest / totalPayment) * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* 还款进度详情 */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-gray-800">还款进度</h3>
          </div>
          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
            {progress.toFixed(1)}%
          </span>
        </div>

        {/* 进度条 */}
        <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden mb-4">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700 mix-blend-difference">
            {paidCount} / {schedule.length} 期
          </div>
        </div>

        {/* 进度统计 */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-green-50 rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1">已还期数</div>
            <div className="text-xl font-bold text-green-600">{paidCount}</div>
            <div className="text-xs text-gray-400">期</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1">剩余期数</div>
            <div className="text-xl font-bold text-gray-700">{unpaidCount}</div>
            <div className="text-xs text-gray-400">期</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1">还款总额</div>
            <div className="text-lg font-bold text-blue-600">¥{formatMoney(totalPayment)}</div>
          </div>
        </div>
      </div>

      {/* 图表区 */}
      <div className="grid grid-cols-1 gap-4">
        <RemainingPrincipalChart schedule={schedule} loanAmount={loanInfo.totalAmount} />
        <PaymentStructureChart schedule={schedule} totalInterest={totalInterest} totalPrincipal={totalPrincipal} />
      </div>

      {/* 事件摘要 */}
      {(prepayments.length > 0 || rateChanges.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {prepayments.length > 0 && (
            <button onClick={() => setActiveTab('config')}
              className="group bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-left hover:border-blue-300 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-blue-500" />
                  </div>
                  <span className="text-sm font-bold text-gray-800">提前还款</span>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-bold text-blue-600">{prepayments.length}</div>
                <div className="text-xs text-gray-400">笔</div>
                <div className="flex-1 text-right text-sm font-medium text-gray-600">
                  ¥{formatMoney(prepayments.reduce((s, p) => s + p.amount, 0))}
                </div>
              </div>
            </button>
          )}
          {rateChanges.length > 0 && (
            <button onClick={() => setActiveTab('config')}
              className="group bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-left hover:border-indigo-300 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <Percent className="w-4 h-4 text-indigo-500" />
                  </div>
                  <span className="text-sm font-bold text-gray-800">利率变更</span>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-bold text-indigo-600">{rateChanges.length}</div>
                <div className="text-xs text-gray-400">次</div>
                <div className="flex-1 text-right text-sm font-medium text-gray-600">
                  {rateChanges[0].oldRate}% → {rateChanges[rateChanges.length - 1].newRate}%
                </div>
              </div>
            </button>
          )}
        </div>
      )}

      {/* 底部快捷入口 */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setActiveTab('plan')}
          className="flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl text-white text-sm font-bold shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30 transition-all">
          <Wallet className="w-4 h-4" />
          查看还款计划
        </button>
        <button onClick={() => setActiveTab('config')}
          className="flex items-center justify-center gap-2 py-3.5 bg-white rounded-2xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all">
          <Settings2 className="w-4 h-4" />
          调整贷款配置
        </button>
      </div>
    </div>
  );
}

function ProgressRingCompact({ progress, paid, total }: { progress: number; paid: number; total: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="8" />
        <circle
          cx="40" cy="40" r={radius} fill="none"
          stroke="white" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold">{progress.toFixed(0)}%</div>
        <div className="text-xs text-blue-100">{paid}/{total}期</div>
      </div>
    </div>
  );
}

function RemainingPrincipalChart({ schedule, loanAmount }: { schedule: ScheduleItem[]; loanAmount: number }) {
  if (schedule.length === 0) return null;

  const padding = { top: 20, right: 20, bottom: 30, left: 55 };
  const width = 600;
  const height = 260;
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxY = loanAmount;
  const xStep = chartW / (schedule.length - 1 || 1);

  const points = schedule.map((s, i) => {
    const x = padding.left + i * xStep;
    const y = padding.top + chartH - (s.remainingPrincipal / maxY) * chartH;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `${padding.left},${padding.top + chartH} ${points} ${padding.left + chartW},${padding.top + chartH}`;
  const ticks = [0, loanAmount * 0.25, loanAmount * 0.5, loanAmount * 0.75, loanAmount];

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-4 rounded-full bg-gradient-to-b from-blue-500 to-indigo-500" />
          <h3 className="text-sm font-bold text-gray-800">剩余本金趋势</h3>
        </div>
        <span className="text-xs text-gray-400">随还款期数变化</span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[320px]" preserveAspectRatio="xMidYMid meet">
          {ticks.map((t, i) => {
            const y = padding.top + chartH - (t / maxY) * chartH;
            return (
              <g key={i}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#f3f4f6" strokeWidth="1" />
                <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
                  ¥{(t / 10000).toFixed(0)}万
                </text>
              </g>
            );
          })}
          <text x={padding.left} y={height - 6} fontSize="10" fill="#9ca3af">第1期</text>
          <text x={width - padding.right} y={height - 6} textAnchor="end" fontSize="10" fill="#9ca3af">第{schedule.length}期</text>

          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={areaPoints} fill="url(#areaGradient)" />
          <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {schedule.filter(s => s.isPrepaymentPoint || s.isRateChangePoint).map((s, i) => {
            const idx = schedule.indexOf(s);
            const x = padding.left + idx * xStep;
            const y = padding.top + chartH - (s.remainingPrincipal / maxY) * chartH;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r="5" fill={s.isPrepaymentPoint ? '#3b82f6' : '#f97316'} stroke="white" strokeWidth="2" />
                <circle cx={x} cy={y} r="9" fill={s.isPrepaymentPoint ? '#3b82f6' : '#f97316'} opacity="0.15" />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span>提前还款点</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <span>利率变更点</span>
        </div>
      </div>
    </div>
  );
}

function PaymentStructureChart({ schedule, totalInterest, totalPrincipal }: { schedule: ScheduleItem[]; totalInterest: number; totalPrincipal: number }) {
  if (schedule.length === 0) return null;

  const sampleCount = Math.min(schedule.length, 24);
  const step = Math.ceil(schedule.length / sampleCount);
  const sample = schedule.filter((_, i) => i % step === 0).slice(0, sampleCount);
  const maxMonthly = Math.max(...sample.map(s => s.monthlyPayment));
  const width = 600;
  const height = 260;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const barW = Math.max(4, chartW / sample.length - 4);

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-4 rounded-full bg-gradient-to-b from-blue-500 to-orange-500" />
          <h3 className="text-sm font-bold text-gray-800">本金/利息构成</h3>
        </div>
        <span className="text-xs text-gray-400">本息占比随时间变化</span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[320px]" preserveAspectRatio="xMidYMid meet">
          {[0, maxMonthly / 2, maxMonthly].map((t, i) => {
            const y = padding.top + chartH - (t / maxMonthly) * chartH;
            return (
              <g key={i}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#f3f4f6" strokeWidth="1" />
                <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
                  ¥{(t / 10000).toFixed(1)}万
                </text>
              </g>
            );
          })}
          {sample.map((s, i) => {
            const x = padding.left + i * (chartW / sample.length) + 2;
            const principalH = (s.principal / maxMonthly) * chartH;
            const interestH = (s.interest / maxMonthly) * chartH;
            const baseY = padding.top + chartH;
            return (
              <g key={i}>
                <rect x={x} y={baseY - principalH - interestH} width={barW} height={principalH} fill="#3b82f6" rx="1.5" />
                <rect x={x} y={baseY - interestH} width={barW} height={interestH} fill="#f97316" rx="1.5" opacity="0.85" />
              </g>
            );
          })}
          <text x={padding.left} y={height - 6} fontSize="10" fill="#9ca3af">第1期</text>
          <text x={width - padding.right} y={height - 6} textAnchor="end" fontSize="10" fill="#9ca3af">第{schedule.length}期</text>
        </svg>
      </div>
      <div className="flex items-center justify-between mt-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
          <span className="text-gray-500">本金 ¥{formatMoney(totalPrincipal)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-orange-500" />
          <span className="text-gray-500">利息 ¥{formatMoney(totalInterest)}</span>
        </div>
      </div>
    </div>
  );
}
