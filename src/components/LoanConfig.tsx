import { useState } from 'react';
import type { LoanInfo, PrepaymentRecord, RateChangeRecord } from '@/types/loan';
import { useLoanStore } from '@/stores/loanStore';
import { formatMoney, getCurrentRemainingPrincipal } from '@/utils/calculator';
import DataManager from './DataManager';

export default function LoanConfig() {
  const {
    loanInfo, schedule, prepayments, rateChanges,
    generatePlan, addPrepayment, deletePrepayment,
    addRateChange, deleteRateChange,
  } = useLoanStore();

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

  const currentRemaining = schedule.length > 0 ? getCurrentRemainingPrincipal(schedule) : 0;

  return (
    <div className="space-y-4">
      <Section title="贷款信息">
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
      </Section>

      <Section title="利率变更">
        <RateChangeForm schedule={schedule} currentRate={loanInfo?.annualRate || 0} onAdd={addRateChange} />
        {rateChanges.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs border-b border-gray-100">
                  <th className="text-left py-2 pr-2">生效日期</th>
                  <th className="text-right py-2 px-2">原利率</th>
                  <th className="text-right py-2 px-2">新利率</th>
                  <th className="text-right py-2 px-2">剩余本金</th>
                  <th className="text-right py-2 px-2">剩余期数</th>
                  <th className="text-center py-2 pl-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {rateChanges.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 text-gray-600">
                    <td className="py-2 pr-2">{r.date}</td>
                    <td className="text-right py-2 px-2 text-gray-400">{r.oldRate}%</td>
                    <td className="text-right py-2 px-2 font-medium text-blue-600">{r.newRate}%</td>
                    <td className="text-right py-2 px-2">¥{formatMoney(r.beforeRemainingPrincipal)}</td>
                    <td className="text-right py-2 px-2">{r.remainingMonths} 期</td>
                    <td className="text-center py-2 pl-2">
                      <button onClick={() => deleteRateChange(r.id)}
                        className="text-xs px-2 py-1 rounded text-red-500 hover:bg-red-50 transition-colors">
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="提前还款">
        {schedule.length > 0 && (
          <div className="mb-3 text-xs text-gray-500 bg-blue-50/50 rounded-lg px-3 py-2">
            当前剩余本金：<span className="font-medium text-blue-600">¥{formatMoney(currentRemaining)}</span>
          </div>
        )}
        <PrepaymentForm schedule={schedule} onAdd={addPrepayment} />
        {prepayments.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs border-b border-gray-100">
                  <th className="text-left py-2 pr-2">日期</th>
                  <th className="text-right py-2 px-2">金额</th>
                  <th className="text-center py-2 px-2">方式</th>
                  <th className="text-right py-2 px-2">还款前</th>
                  <th className="text-right py-2 px-2">还款后</th>
                  <th className="text-center py-2 pl-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {prepayments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 text-gray-600">
                    <td className="py-2 pr-2">{p.date}</td>
                    <td className="text-right py-2 px-2 font-medium text-blue-600">¥{formatMoney(p.amount)}</td>
                    <td className="text-center py-2 px-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                        {p.mode === 'shortenTerm' ? '缩短年限' : '缩短月供'}
                      </span>
                    </td>
                    <td className="text-right py-2 px-2 text-gray-400">¥{formatMoney(p.beforeRemainingPrincipal)}</td>
                    <td className="text-right py-2 px-2 text-green-600">¥{formatMoney(p.afterRemainingPrincipal)}</td>
                    <td className="text-center py-2 pl-2">
                      <button onClick={() => deletePrepayment(p.id)}
                        className="text-xs px-2 py-1 rounded text-red-500 hover:bg-red-50 transition-colors">
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="数据管理">
        <DataManager />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
      <h2 className="text-sm font-bold text-gray-800 mb-4">{title}</h2>
      {children}
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

function RateChangeForm({
  schedule, currentRate, onAdd,
}: {
  schedule: ReturnType<typeof useLoanStore.getState>['schedule'];
  currentRate: number;
  onAdd: (record: Omit<RateChangeRecord, 'id'>) => void;
}) {
  const [date, setDate] = useState('');
  const [newRate, setNewRate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(newRate);
    if (!date || !rate) return;

    const changeDate = new Date(date + 'T00:00:00');
    const lastBefore = schedule
      .filter((s) => new Date(s.date + 'T00:00:00') <= changeDate)
      .sort((a, b) => b.period - a.period)[0];
    const remainingPrincipal = lastBefore
      ? lastBefore.remainingPrincipal
      : (schedule[0]?.remainingPrincipal || 0) + (schedule[0]?.principal || 0);
    const remainingMonths = schedule.filter((s) => new Date(s.date + 'T00:00:00') > changeDate).length;

    onAdd({
      date,
      oldRate: currentRate,
      newRate: rate,
      beforeRemainingPrincipal: remainingPrincipal,
      remainingMonths,
    });

    setDate('');
    setNewRate('');
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
      <Field label="生效日期">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="input" required />
      </Field>
      <Field label="新利率（%）">
        <input type="number" value={newRate} onChange={(e) => setNewRate(e.target.value)}
          className="input" placeholder="3.05" required step="0.01" />
      </Field>
      <button type="submit"
        className="py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
        添加
      </button>
    </form>
  );
}

function PrepaymentForm({
  schedule, onAdd,
}: {
  schedule: ReturnType<typeof useLoanStore.getState>['schedule'];
  onAdd: (record: Omit<PrepaymentRecord, 'id'>) => void;
}) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [mode, setMode] = useState<'shortenTerm' | 'reduceMonthly'>('shortenTerm');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || !date) return;

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

    onAdd({
      date,
      amount: amt,
      mode,
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
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="还款金额（元）">
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="input" placeholder="100000" required step="10000" />
        </Field>
        <Field label="还款日期">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="input" required />
        </Field>
        <Field label="重算方式">
          <div className="flex gap-1.5">
            {(['shortenTerm', 'reduceMonthly'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                  mode === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                {m === 'shortenTerm' ? '缩短年限' : '缩短月供'}
              </button>
            ))}
          </div>
        </Field>
      </div>
      <button type="submit"
        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
        添加
      </button>
    </form>
  );
}
