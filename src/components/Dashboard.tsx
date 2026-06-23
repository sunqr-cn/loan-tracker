import { useLoanStore } from '@/stores/loanStore';
import { formatMoney, getCurrentRemainingPrincipal } from '@/utils/calculator';

export default function Dashboard() {
  const { schedule, loanInfo, prepayments, rateChanges, setActiveTab } = useLoanStore();

  if (schedule.length === 0) {
    return (
      <div className="text-center py-24">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
          <span className="text-4xl">📊</span>
        </div>
        <p className="text-gray-500 mb-4">暂无贷款数据</p>
        <button
          onClick={() => setActiveTab('config')}
          className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-blue-600/30 transition-all"
        >
          去配置贷款信息
        </button>
      </div>
    );
  }

  const totalPaid = schedule.filter((s) => s.paid).length;
  const totalPeriods = schedule.length;
  const paidPrincipal = schedule.filter((s) => s.paid).reduce((sum, s) => sum + s.principal, 0);
  const paidInterest = schedule.filter((s) => s.paid).reduce((sum, s) => sum + s.interest, 0);
  const totalInterest = schedule.reduce((sum, s) => sum + s.interest, 0);
  const prepaymentTotal = prepayments.reduce((sum, p) => sum + p.amount, 0);
  const totalPrincipal = loanInfo?.totalAmount || 0;
  const remainingPrincipal = getCurrentRemainingPrincipal(schedule);
  const nextPayment = schedule.find((s) => !s.paid);
  const paidAmount = paidPrincipal + paidInterest + prepaymentTotal;
  const totalAmount = totalPrincipal + totalInterest;

  // 计算下期还款剩余天数
  const daysToNext = nextPayment
    ? Math.ceil((new Date(nextPayment.date).getTime() - Date.now()) / 86400000)
    : 0;

  const stats = [
    {
      label: '贷款总额',
      value: `¥${formatMoney(loanInfo?.totalAmount || 0)}`,
      color: 'text-blue-600',
      bg: 'from-blue-50 to-blue-100/50',
      icon: '💰',
    },
    {
      label: '已还期数',
      value: `${totalPaid} / ${totalPeriods}`,
      sub: `${totalPeriods > 0 ? Math.round((totalPaid / totalPeriods) * 100) : 0}%`,
      color: 'text-green-600',
      bg: 'from-green-50 to-green-100/50',
      icon: '✅',
    },
    {
      label: '剩余本金',
      value: `¥${formatMoney(remainingPrincipal)}`,
      color: 'text-orange-500',
      bg: 'from-orange-50 to-orange-100/50',
      icon: '📉',
    },
    {
      label: '累计利息',
      value: `¥${formatMoney(totalInterest)}`,
      sub: `已还 ¥${formatMoney(paidInterest)}`,
      color: 'text-purple-500',
      bg: 'from-purple-50 to-purple-100/50',
      icon: '📈',
    },
  ];

  return (
    <div className="space-y-5">
      {/* 统计卡片 - 渐变背景 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`bg-gradient-to-br ${s.bg} rounded-2xl p-4 border border-white shadow-sm`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{s.label}</span>
              <span className="text-base opacity-70">{s.icon}</span>
            </div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            {s.sub && <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* 下期还款提醒 - 突出显示 */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500 rounded-2xl p-6 text-white shadow-xl shadow-blue-600/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mb-16" />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-blue-100">📅 下期还款</span>
              {nextPayment && daysToNext >= 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  daysToNext <= 7 ? 'bg-red-400/30 text-red-50' : 'bg-white/20 text-white'
                }`}>
                  {daysToNext === 0 ? '今天到期' : daysToNext <= 7 ? `${daysToNext}天后` : `${daysToNext}天`}
                </span>
              )}
            </div>
            {nextPayment ? (
              <>
                <div className="text-3xl font-bold tracking-tight">¥{formatMoney(nextPayment.monthlyPayment)}</div>
                <div className="text-sm text-blue-100 mt-1.5">
                  {nextPayment.date} · 第 {nextPayment.period} 期
                </div>
              </>
            ) : (
              <div className="text-3xl font-bold">✅ 贷款已全部还清</div>
            )}
          </div>
          {nextPayment && (
            <div className="text-right bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <div className="text-xs text-blue-100 mb-1.5">本息构成</div>
              <div className="text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-300" />
                <span className="text-blue-50">本金</span>
                <span className="font-medium">¥{formatMoney(nextPayment.principal)}</span>
              </div>
              <div className="text-sm flex items-center gap-2 mt-1">
                <span className="w-2 h-2 rounded-full bg-amber-300" />
                <span className="text-blue-50">利息</span>
                <span className="font-medium">¥{formatMoney(nextPayment.interest)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 图表区 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="本金与利息占比" subtitle="贷款总额构成">
          <PieChart
            data={[
              { label: '本金', value: totalPrincipal, color: '#3b82f6' },
              { label: '利息', value: totalInterest, color: '#f59e0b' },
            ]}
          />
        </ChartCard>

        <ChartCard title="剩余本金递减趋势" subtitle="逐期递减">
          <AreaChart data={schedule.map((s) => ({ x: s.period, y: s.remainingPrincipal }))} />
        </ChartCard>

        <ChartCard title="还款进度" subtitle="期数与金额双维度">
          <ProgressRing
            total={totalPeriods}
            paid={totalPaid}
            paidAmount={paidAmount}
            totalAmount={totalAmount}
          />
        </ChartCard>

        <ChartCard title="贷款概览" subtitle="关键信息">
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between items-center py-1 border-b border-gray-50">
              <span className="text-gray-400">还款方式</span>
              <span className="text-gray-600 font-medium">{loanInfo?.repaymentType === 'equalInstallment' ? '等额本息' : '等额本金'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-gray-50">
              <span className="text-gray-400">当前利率</span>
              <span className="text-gray-600 font-medium">{loanInfo?.annualRate}%</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-gray-50">
              <span className="text-gray-400">贷款期限</span>
              <span className="text-gray-600 font-medium">{loanInfo?.totalMonths} 期 ({Math.round((loanInfo?.totalMonths || 0) / 12 * 10) / 10} 年)</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-gray-50">
              <span className="text-gray-400">提前还款</span>
              <span className="text-gray-600 font-medium">{prepayments.length} 次 · ¥{formatMoney(prepaymentTotal)}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-gray-50">
              <span className="text-gray-400">利率调整</span>
              <span className="text-gray-600 font-medium">{rateChanges.length} 次</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-gray-400">已还总额</span>
              <span className="text-blue-600 font-bold">¥{formatMoney(paidAmount)}</span>
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function PieChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="text-center text-gray-400 py-8">暂无数据</div>;
  let cumulativeAngle = -Math.PI / 2;
  const radius = 70;
  const cx = 90;
  const cy = 90;

  return (
    <div className="flex items-center gap-4">
      <svg width="180" height="180" viewBox="0 0 180 180">
        {data.map((d, i) => {
          const angle = (d.value / total) * Math.PI * 2;
          const startAngle = cumulativeAngle;
          const endAngle = cumulativeAngle + angle;
          cumulativeAngle = endAngle;

          const x1 = cx + radius * Math.cos(startAngle);
          const y1 = cy + radius * Math.sin(startAngle);
          const x2 = cx + radius * Math.cos(endAngle);
          const y2 = cy + radius * Math.sin(endAngle);
          const largeArc = angle > Math.PI ? 1 : 0;

          return (
            <path
              key={i}
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
              fill={d.color}
            />
          );
        })}
        <circle cx={cx} cy={cy} r={40} fill="white" />
        <text x={cx} y={cy - 5} textAnchor="middle" className="text-xs fill-gray-400">总额</text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="text-sm font-bold fill-gray-700">
          ¥{(total / 10000).toFixed(1)}万
        </text>
      </svg>
      <div className="space-y-3 flex-1">
        {data.map((d, i) => (
          <div key={i}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded" style={{ background: d.color }} />
              <span className="text-xs text-gray-500">{d.label}</span>
              <span className="text-xs text-gray-400 ml-auto">{Math.round((d.value / total) * 100)}%</span>
            </div>
            <div className="text-sm font-medium text-gray-700 pl-5">¥{formatMoney(d.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AreaChart({ data }: { data: { x: number; y: number }[] }) {
  if (data.length === 0) return null;
  const maxVal = data[0]?.y || 1;
  const w = 400;
  const h = 160;
  const pad = { top: 10, right: 10, bottom: 25, left: 50 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  const points = data.map((d, i) => ({
    x: pad.left + (chartW / (data.length - 1 || 1)) * i,
    y: pad.top + chartH - (d.y / maxVal) * chartH,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${pad.top + chartH} L ${pad.left} ${pad.top + chartH} Z`;

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
        <g key={i}>
          <line x1={pad.left} y1={pad.top + chartH * r} x2={w - pad.right} y2={pad.top + chartH * r} stroke="#f0f0f0" />
          <text x={pad.left - 5} y={pad.top + chartH * r + 4} textAnchor="end" className="text-[10px] fill-gray-400">
            ¥{Math.round(maxVal * (1 - r) / 10000)}万
          </text>
        </g>
      ))}
      <path d={areaD} fill="url(#areaGrad)" />
      <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2" />
    </svg>
  );
}

function ProgressRing({ total, paid, paidAmount, totalAmount }: { total: number; paid: number; paidAmount: number; totalAmount: number }) {
  const percentage = total > 0 ? (paid / total) * 100 : 0;
  const amountPct = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex items-center gap-4">
      <svg width="180" height="180" viewBox="0 0 180 180">
        <circle cx="90" cy="90" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="12" />
        <circle cx="90" cy="90" r={radius} fill="none" stroke="#3b82f6" strokeWidth="12"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 90 90)" />
        <text x="90" y="85" textAnchor="middle" className="text-2xl font-bold fill-blue-600">
          {Math.round(percentage)}%
        </text>
        <text x="90" y="105" textAnchor="middle" className="text-xs fill-gray-400">
          {paid} / {total} 期
        </text>
      </svg>
      <div className="space-y-2.5 flex-1">
        <div>
          <div className="text-xs text-gray-400">已还金额</div>
          <div className="text-sm font-medium text-gray-700">¥{formatMoney(paidAmount)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">金额进度</div>
          <div className="text-sm font-medium text-gray-700">{Math.round(amountPct)}%</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">剩余金额</div>
          <div className="text-sm font-medium text-gray-700">¥{formatMoney(totalAmount - paidAmount)}</div>
        </div>
      </div>
    </div>
  );
}
