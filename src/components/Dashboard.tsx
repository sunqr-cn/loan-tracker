import { useLoanStore } from '@/stores/loanStore';
import { formatMoney } from '@/utils/calculator';

export default function Dashboard() {
  const { schedule, loanInfo, prepayments, rateChanges, setActiveTab } = useLoanStore();

  if (schedule.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">📊</div>
        <p className="text-gray-500 mb-4">暂无贷款数据</p>
        <button
          onClick={() => setActiveTab('config')}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
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
  const totalPrincipal = schedule.reduce((sum, s) => sum + s.principal, 0);
  const remainingPrincipal = schedule[schedule.length - 1]?.remainingPrincipal || 0;
  const nextPayment = schedule.find((s) => !s.paid);

  const stats = [
    { label: '贷款总额', value: `¥${formatMoney(loanInfo?.totalAmount || 0)}`, color: 'text-blue-600' },
    { label: '已还期数', value: `${totalPaid} / ${totalPeriods}`, sub: `${totalPeriods > 0 ? Math.round((totalPaid / totalPeriods) * 100) : 0}%`, color: 'text-green-600' },
    { label: '剩余本金', value: `¥${formatMoney(remainingPrincipal)}`, color: 'text-orange-500' },
    { label: '累计利息', value: `¥${formatMoney(totalInterest)}`, sub: `已还 ¥${formatMoney(paidInterest)}`, color: 'text-purple-500' },
  ];

  return (
    <div className="space-y-5">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="text-xs text-gray-400 mb-1">{s.label}</div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            {s.sub && <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* 图表区 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="本金与利息占比">
          <PieChart
            data={[
              { label: '本金', value: totalPrincipal, color: '#2563eb' },
              { label: '利息', value: totalInterest, color: '#f59e0b' },
            ]}
          />
        </ChartCard>

        <ChartCard title="剩余本金递减趋势">
          <AreaChart data={schedule.map((s) => ({ x: s.period, y: s.remainingPrincipal }))} />
        </ChartCard>

        <ChartCard title="月度还款明细（近12期）">
          <BarChart data={schedule.slice(0, 12).map((s) => ({
            label: `${s.period}`,
            principal: s.principal,
            interest: s.interest,
            paid: s.paid,
          }))} />
        </ChartCard>

        <ChartCard title="还款进度">
          <ProgressRing
            total={totalPeriods}
            paid={totalPaid}
            paidAmount={paidPrincipal + paidInterest}
            totalAmount={totalPrincipal + totalInterest}
          />
        </ChartCard>
      </div>

      {/* 下期提醒 + 事件记录 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">📅 下期还款</h3>
          {nextPayment ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">还款日期</span>
                <span className="font-medium text-gray-700">{nextPayment.date}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">应还金额</span>
                <span className="font-bold text-blue-600">¥{formatMoney(nextPayment.monthlyPayment)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">其中本金</span>
                <span className="text-gray-600">¥{formatMoney(nextPayment.principal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">其中利息</span>
                <span className="text-gray-600">¥{formatMoney(nextPayment.interest)}</span>
              </div>
            </div>
          ) : (
            <p className="text-green-600 font-medium">✅ 贷款已全部还清</p>
          )}
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">📝 贷款事件</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">还款方式</span>
              <span className="text-gray-600">{loanInfo?.repaymentType === 'equalInstallment' ? '等额本息' : '等额本金'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">当前利率</span>
              <span className="text-gray-600">{loanInfo?.annualRate}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">提前还款次数</span>
              <span className="text-gray-600">{prepayments.length} 次</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">利率调整次数</span>
              <span className="text-gray-600">{rateChanges.length} 次</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function PieChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
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
      <div className="space-y-2 flex-1">
        {data.map((d, i) => (
          <div key={i}>
            <div className="flex items-center gap-2 mb-0.5">
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
          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
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
      <path d={pathD} fill="none" stroke="#2563eb" strokeWidth="2" />
    </svg>
  );
}

function BarChart({ data }: { data: { label: string; principal: number; interest: number; paid: boolean }[] }) {
  if (data.length === 0) return null;
  const maxVal = Math.max(...data.map((d) => d.principal + d.interest));
  const w = 400;
  const h = 160;
  const pad = { top: 10, right: 10, bottom: 25, left: 50 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const barW = Math.min(chartW / data.length * 0.6, 24);

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
        <g key={i}>
          <line x1={pad.left} y1={pad.top + chartH * r} x2={w - pad.right} y2={pad.top + chartH * r} stroke="#f0f0f0" />
          <text x={pad.left - 5} y={pad.top + chartH * r + 4} textAnchor="end" className="text-[10px] fill-gray-400">
            ¥{Math.round(maxVal * (1 - r) / 1000)}k
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        const x = pad.left + (chartW / (data.length - 1 || 1)) * i - barW / 2;
        const principalH = (d.principal / maxVal) * chartH;
        const interestH = (d.interest / maxVal) * chartH;
        return (
          <g key={i}>
            <rect x={x} y={pad.top + chartH - principalH - interestH} width={barW} height={interestH}
              fill={d.paid ? '#fbbf24' : '#fde68a'} rx={2} />
            <rect x={x} y={pad.top + chartH - principalH} width={barW} height={principalH}
              fill={d.paid ? '#2563eb' : '#93c5fd'} rx={2} />
            <text x={x + barW / 2} y={pad.top + chartH + 15} textAnchor="middle" className="text-[10px] fill-gray-400">
              {d.label}
            </text>
          </g>
        );
      })}
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
        <circle cx="90" cy="90" r={radius} fill="none" stroke="#2563eb" strokeWidth="12"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 90 90)" />
        <text x="90" y="85" textAnchor="middle" className="text-2xl font-bold fill-blue-600">
          {Math.round(percentage)}%
        </text>
        <text x="90" y="105" textAnchor="middle" className="text-xs fill-gray-400">
          {paid} / {total} 期
        </text>
      </svg>
      <div className="space-y-2 flex-1">
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