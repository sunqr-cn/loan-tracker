import { useState } from 'react';
import { useLoanStore } from '@/stores/loanStore';
import { formatMoney, generateId } from '@/utils/calculator';
import type { PrepaymentRecord } from '@/types/loan';

export default function PrepaymentManager() {
  const { schedule, prepayments, addPrepayment, updatePrepayment, deletePrepayment } = useLoanStore();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [mode, setMode] = useState<'shortenTerm' | 'reduceMonthly'>('shortenTerm');
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    if (!date) return;

    // 找到提前还款时的剩余本金
    const prepayDate = new Date(date);
    const lastPaidBefore = schedule
      .filter((s) => new Date(s.date) <= prepayDate)
      .sort((a, b) => b.period - a.period)[0];
    const beforeRemaining = lastPaidBefore
      ? lastPaidBefore.remainingPrincipal
      : schedule[0]?.remainingPrincipal + schedule[0]?.principal || 0;

    const afterRemaining = beforeRemaining - amt;

    // 计算原剩余期数
    const remainingAfter = schedule.filter(
      (s) => new Date(s.date) > prepayDate
    ).length;

    // 找到当前月供
    const currentMonthly = schedule.find(
      (s) => new Date(s.date) >= prepayDate
    )?.monthlyPayment || 0;

    const record = {
      id: editingId || generateId(),
      date,
      amount: amt,
      mode,
      beforeRemainingPrincipal: beforeRemaining,
      afterRemainingPrincipal: afterRemaining,
      originalRemainingMonths: remainingAfter,
      newRemainingMonths: remainingAfter,
      originalMonthlyPayment: currentMonthly,
      newMonthlyPayment: currentMonthly,
    };

    if (editingId) {
      updatePrepayment(editingId, record);
      setEditingId(null);
    } else {
      addPrepayment(record);
    }

    setAmount('');
    setDate('');
  };

  const handleEdit = (p: PrepaymentRecord) => {
    setAmount(p.amount.toString());
    setDate(p.date);
    setMode(p.mode);
    setEditingId(p.id);
  };

  const handleCancelEdit = () => {
    setAmount('');
    setDate('');
    setEditingId(null);
  };

  return (
    <div className="rounded-2xl p-6 shadow-lg"
      style={{ background: 'linear-gradient(135deg, #16213e 0%, #1a1a2e 100%)', border: '1px solid rgba(226,176,74,0.15)' }}>
      <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Georgia, serif', color: '#e2b04a' }}>
        <span className="text-2xl mr-2">💰</span>提前还款管理
      </h2>

      <form onSubmit={handleSubmit} className="space-y-3 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">提前还款金额（元）</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#0f0f23] border border-gray-700 text-white text-sm
                focus:outline-none focus:border-[#e2b04a] transition-colors"
              placeholder="100000"
              required
              step="10000"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">还款日期</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#0f0f23] border border-gray-700 text-white text-sm
                focus:outline-none focus:border-[#e2b04a] transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">重算方式</label>
            <div className="flex gap-1.5">
              {(['shortenTerm', 'reduceMonthly'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                    mode === m
                      ? 'bg-[#e2b04a] text-[#1a1a2e]'
                      : 'bg-[#0f0f23] text-gray-400 border border-gray-700'
                  }`}
                >
                  {m === 'shortenTerm' ? '缩短年限' : '缩短月供'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="px-6 py-2 rounded-xl text-sm font-bold transition-all duration-200 hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg, #e2b04a, #c9902a)', color: '#1a1a2e' }}
          >
            {editingId ? '更新提前还款' : '添加提前还款'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-4 py-2 rounded-xl text-sm bg-[#0f0f23] border border-gray-600 text-gray-400 hover:text-white transition-colors"
            >
              取消编辑
            </button>
          )}
        </div>
      </form>

      {prepayments.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-gray-700/50">
                <th className="text-left py-2 pr-2">日期</th>
                <th className="text-right py-2 px-2">还款金额</th>
                <th className="text-center py-2 px-2">方式</th>
                <th className="text-right py-2 px-2">还款前剩余</th>
                <th className="text-right py-2 px-2">还款后剩余</th>
                <th className="text-center py-2 pl-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {prepayments.map((p) => (
                <tr key={p.id} className="border-b border-gray-700/30 text-gray-300">
                  <td className="py-2 pr-2">{p.date}</td>
                  <td className="text-right py-2 px-2" style={{ color: '#e2b04a' }}>
                    ¥{formatMoney(p.amount)}
                  </td>
                  <td className="text-center py-2 px-2">
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(226,176,74,0.15)', color: '#e2b04a' }}>
                      {p.mode === 'shortenTerm' ? '缩短年限' : '缩短月供'}
                    </span>
                  </td>
                  <td className="text-right py-2 px-2">¥{formatMoney(p.beforeRemainingPrincipal)}</td>
                  <td className="text-right py-2 px-2" style={{ color: '#4ecca3' }}>
                    ¥{formatMoney(p.afterRemainingPrincipal)}
                  </td>
                  <td className="text-center py-2 pl-2">
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={() => handleEdit(p)}
                        className="text-xs px-2 py-1 rounded-lg bg-[#0f0f23] border border-gray-600 text-gray-400 hover:text-[#e2b04a] hover:border-[#e2b04a] transition-colors"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => deletePrepayment(p.id)}
                        className="text-xs px-2 py-1 rounded-lg bg-[#0f0f23] border border-gray-600 text-gray-400 hover:text-red-400 hover:border-red-500 transition-colors"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}