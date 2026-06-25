import { useState } from 'react';
import type { LoanInfo, PrepaymentRecord, RateChangeRecord } from '@/types/loan';
import { useLoanStore } from '@/stores/loanStore';
import { formatMoney, getCurrentRemainingPrincipal } from '@/utils/calculator';
import { recalcOnServer } from '@/utils/serverSync';
import DataManager from './DataManager';
import { ArrowLeft, ChevronRight, Calculator, TrendingDown, PiggyBank, Database, Home, RefreshCw } from 'lucide-react';

type ConfigSection = 'menu' | 'loanInfo' | 'rateChange' | 'prepayment' | 'data';

export default function LoanConfig() {
  const [section, setSection] = useState<ConfigSection>('menu');

  if (section === 'menu') {
    return <ConfigMenu onNavigate={setSection} />;
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => setSection('menu')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>返回设置</span>
      </button>
      {section === 'loanInfo' && <LoanInfoSection />}
      {section === 'rateChange' && <RateChangeSection />}
      {section === 'prepayment' && <PrepaymentSection />}
      {section === 'data' && <DataSection />}
    </div>
  );
}

function ConfigMenu({ onNavigate }: { onNavigate: (s: ConfigSection) => void }) {
  const { setActiveTab, loanInfo, schedule, loadFromServer } = useLoanStore();
  const [updating, setUpdating] = useState(false);
  const currentRemaining = schedule.length > 0 ? getCurrentRemainingPrincipal(schedule) : 0;

  const handleManualUpdate = async () => {
    setUpdating(true);
    try {
      await recalcOnServer();
      await loadFromServer();
    } catch (err) {
      console.error('更新失败:', err);
    } finally {
      setUpdating(false);
    }
  };

  const menuItems = [
    {
      key: 'loanInfo' as const,
      icon: <Calculator className="w-5 h-5 text-blue-500" />,
      title: '贷款信息',
      desc: loanInfo ? `¥${formatMoney(loanInfo.totalAmount)} · ${loanInfo.totalMonths}期 · ${loanInfo.annualRate}%` : '配置贷款基本信息',
      color: 'bg-blue-50',
    },
    {
      key: 'rateChange' as const,
      icon: <TrendingDown className="w-5 h-5 text-green-500" />,
      title: '利率变更',
      desc: '调整贷款利率',
      color: 'bg-green-50',
    },
    {
      key: 'prepayment' as const,
      icon: <PiggyBank className="w-5 h-5 text-orange-500" />,
      title: '提前还款',
      desc: currentRemaining > 0 ? `剩余本金 ¥${formatMoney(currentRemaining)}` : '管理提前还款',
      color: 'bg-orange-50',
    },
    {
      key: 'data' as const,
      icon: <Database className="w-5 h-5 text-purple-500" />,
      title: '数据管理',
      desc: '导入导出数据',
      color: 'bg-purple-50',
    },
  ];

  return (
    <div className="space-y-4">
      <button
        onClick={() => setActiveTab('dashboard')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <Home className="w-4 h-4" />
        <span>返回首页</span>
      </button>

      <div className="space-y-3">
        {menuItems.map((item) => (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className="w-full bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center gap-4 text-left"
          >
            <div className={`w-11 h-11 rounded-xl ${item.color} flex items-center justify-center flex-shrink-0`}>
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-800">{item.title}</div>
              <div className="text-xs text-gray-400 mt-0.5 truncate">{item.desc}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
          </button>
        ))}

        {/* 手动更新按钮 */}
        <button
          onClick={handleManualUpdate}
          disabled={updating}
          className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl p-4 border border-blue-400/20 shadow-md hover:shadow-lg transition-all flex items-center gap-4 text-left disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <RefreshCw className={`w-5 h-5 text-blue-600 ${updating ? 'animate-spin' : ''}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white">手动更新还款计划</div>
            <div className="text-xs text-blue-100 mt-0.5">重新计算还款状态并同步</div>
          </div>
        </button>
      </div>
    </div>
  );
}

function LoanInfoSection() {
  const { loanInfo, generatePlan } = useLoanStore();

  const [totalAmount, setTotalAmount] = useState(loanInfo?.totalAmount?.toString() || '500000');
  const [annualRate, setAnnualRate] = useState(loanInfo?.annualRate?.toString() || '3.25');
  const [totalMonths, setTotalMonths] = useState(loanInfo?.totalMonths?.toString() || '240');
  const [repaymentType, setRepaymentType] = useState<'equalInstallment' | 'equalPrincipal'>(
    loanInfo?.repaymentType || 'equalInstallment'
  );
  const [startDate, setStartDate] = useState(loanInfo?.startDate || '2024-01-01');

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    generatePlan({
      totalAmount: parseFloat(totalAmount),
      annualRate: parseFloat(annualRate),
      totalMonths: parseInt(totalMonths),
      repaymentType,
      startDate,
    });
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <h2 className="text-sm font-bold text-gray-800 mb-4">贷款信息</h2>
      <form onSubmit={handleGenerate} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="贷款总额（元）">
            <input type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)}
              className="input" placeholder="500000" required step="10000" />
          </Field>
          <Field label="年利率（%）">
            <input type="number" value={annualRate} onChange={(e) => setAnnualRate(e.target.value)}
              className="input" placeholder="3.25" required step="0.01" />
          </Field>
          <Field label="贷款期限（月）">
            <input type="number" value={totalMonths} onChange={(e) => setTotalMonths(e.target.value)}
              className="input" placeholder="240" required step="12" />
          </Field>
          <Field label="开始日期">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="input" required />
          </Field>
        </div>

        <Field label="还款方式">
          <div className="flex gap-2">
            {(['equalInstallment', 'equalPrincipal'] as const).map((type) => (
              <button key={type} type="button" onClick={() => setRepaymentType(type)}
                className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all ${
                  repaymentType === type
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>
                {type === 'equalInstallment' ? '等额本息' : '等额本金'}
              </button>
            ))}
          </div>
        </Field>

        <button type="submit"
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold text-base hover:bg-blue-700 transition-colors shadow-md shadow-blue-600/20">
          {loanInfo ? '重新生成还款计划' : '生成还款计划'}
        </button>
      </form>
    </div>
  );
}

function RateChangeSection() {
  const { schedule, loanInfo, rateChanges, addRateChange, deleteRateChange } = useLoanStore();

  const [date, setDate] = useState('');
  const [newRate, setNewRate] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!date) { setError('请选择生效日期'); return; }
    const rate = parseFloat(newRate);
    if (!rate || isNaN(rate)) { setError('请输入有效的新利率'); return; }
    if (rate <= 0 || rate > 20) { setError('利率应在 0~20% 之间'); return; }

    const changeDate = new Date(date + 'T00:00:00');
    const lastBefore = schedule
      .filter((s) => new Date(s.date + 'T00:00:00') <= changeDate)
      .sort((a, b) => b.period - a.period)[0];
    const remainingPrincipal = lastBefore
      ? lastBefore.remainingPrincipal
      : (schedule[0]?.remainingPrincipal || 0) + (schedule[0]?.principal || 0);
    const remainingMonths = schedule.filter((s) => new Date(s.date + 'T00:00:00') > changeDate).length;

    addRateChange({ date, oldRate: loanInfo?.annualRate || 0, newRate: rate, beforeRemainingPrincipal: remainingPrincipal, remainingMonths });
    setDate('');
    setNewRate('');
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <h2 className="text-sm font-bold text-gray-800 mb-4">利率变更</h2>
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <Field label="生效日期">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          </Field>
          <Field label="新利率（%）">
            <input type="number" value={newRate} onChange={(e) => setNewRate(e.target.value)}
              className="input" placeholder="3.05" step="0.01" />
          </Field>
          <button type="submit"
            className="py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
            添加
          </button>
        </div>
        {error && <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
      </form>

      {rateChanges.length > 0 && (
        <div className="mt-4 space-y-2">
          {rateChanges.map((r) => (
            <div key={r.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
              <div>
                <div className="text-xs text-gray-400">{r.date}</div>
                <div className="text-sm font-semibold text-gray-800">
                  {r.oldRate}% → <span className="text-green-600">{r.newRate}%</span>
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  剩余本金 ¥{formatMoney(r.beforeRemainingPrincipal)} · {r.remainingMonths}期
                </div>
              </div>
              <button onClick={() => deleteRateChange(r.id)}
                className="text-xs px-3 py-1.5 rounded-lg text-red-500 bg-red-50 hover:bg-red-100 transition-colors">
                删除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PrepaymentSection() {
  const { schedule, prepayments, addPrepayment, deletePrepayment } = useLoanStore();
  const currentRemaining = schedule.length > 0 ? getCurrentRemainingPrincipal(schedule) : 0;

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [mode, setMode] = useState<'shortenTerm' | 'reduceMonthly'>('shortenTerm');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!date) { setError('请选择还款日期'); return; }
    const amt = parseFloat(amount);
    if (!amt || isNaN(amt) || amt <= 0) { setError('请输入有效的还款金额'); return; }

    const prepayDate = new Date(date + 'T00:00:00');
    const lastBefore = schedule
      .filter((s) => new Date(s.date + 'T00:00:00') <= prepayDate)
      .sort((a, b) => b.period - a.period)[0];
    const beforeRemaining = lastBefore
      ? lastBefore.remainingPrincipal
      : (schedule[0]?.remainingPrincipal || 0) + (schedule[0]?.principal || 0);
    const afterRemaining = beforeRemaining - amt;
    const remainingAfter = schedule.filter((s) => new Date(s.date + 'T00:00:00') > prepayDate).length;
    const currentMonthly = schedule.find((s) => new Date(s.date + 'T00:00:00') >= prepayDate)?.monthlyPayment || 0;

    addPrepayment({
      date, amount: amt, mode,
      beforeRemainingPrincipal: beforeRemaining,
      afterRemainingPrincipal: afterRemaining,
      originalRemainingMonths: remainingAfter,
      newRemainingMonths: remainingAfter,
      originalMonthlyPayment: currentMonthly,
      newMonthlyPayment: currentMonthly,
    });
    setAmount('');
    setDate('');
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <h2 className="text-sm font-bold text-gray-800 mb-4">提前还款</h2>
      {currentRemaining > 0 && (
        <div className="mb-4 text-xs text-gray-500 bg-blue-50/50 rounded-lg px-3 py-2">
          当前剩余本金：<span className="font-medium text-blue-600">¥{formatMoney(currentRemaining)}</span>
        </div>
      )}
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="还款金额（元）">
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="input" placeholder="100000" step="10000" />
          </Field>
          <Field label="还款日期">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          </Field>
        </div>
        <Field label="重算方式">
          <div className="flex gap-2">
            {(['shortenTerm', 'reduceMonthly'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  mode === m ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>
                {m === 'shortenTerm' ? '缩短年限' : '缩短月供'}
              </button>
            ))}
          </div>
        </Field>
        {error && <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        <button type="submit"
          className="w-full py-3 bg-orange-500 text-white rounded-lg font-bold text-sm hover:bg-orange-600 transition-colors shadow-md shadow-orange-500/20">
          添加提前还款
        </button>
      </form>

      {prepayments.length > 0 && (
        <div className="mt-4 space-y-2">
          {prepayments.map((p) => (
            <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
              <div>
                <div className="text-xs text-gray-400">{p.date}</div>
                <div className="text-sm font-semibold text-gray-800">¥{formatMoney(p.amount)}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {p.mode === 'shortenTerm' ? '缩短年限' : '缩短月供'} · 剩余 ¥{formatMoney(p.afterRemainingPrincipal)}
                </div>
              </div>
              <button onClick={() => deletePrepayment(p.id)}
                className="text-xs px-3 py-1.5 rounded-lg text-red-500 bg-red-50 hover:bg-red-100 transition-colors">
                删除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DataSection() {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <h2 className="text-sm font-bold text-gray-800 mb-4">数据管理</h2>
      <DataManager />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
