import { useState } from 'react';
import type { LoanInfo } from '@/types/loan';
import { useLoanStore } from '@/stores/loanStore';

export default function LoanForm() {
  const { setLoanInfo, generatePlan, hasData } = useLoanStore();
  const [totalAmount, setTotalAmount] = useState('500000');
  const [annualRate, setAnnualRate] = useState('3.25');
  const [totalMonths, setTotalMonths] = useState('240');
  const [repaymentType, setRepaymentType] = useState<'equalInstallment' | 'equalPrincipal'>('equalInstallment');
  const [startDate, setStartDate] = useState('2024-01-01');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const info: LoanInfo = {
      totalAmount: parseFloat(totalAmount),
      annualRate: parseFloat(annualRate),
      totalMonths: parseInt(totalMonths),
      repaymentType,
      startDate,
    };
    generatePlan(info);
  };

  return (
    <div className="rounded-2xl p-6 shadow-lg"
      style={{ background: 'linear-gradient(135deg, #16213e 0%, #1a1a2e 100%)', border: '1px solid rgba(226,176,74,0.15)' }}>
      <h2 className="text-xl font-bold mb-5 flex items-center gap-2" style={{ fontFamily: 'Georgia, serif', color: '#e2b04a' }}>
        <span className="text-2xl">🏦</span> 贷款信息
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">贷款总额（元）</label>
            <input
              type="number"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#0f0f23] border border-gray-700 text-white
                focus:outline-none focus:border-[#e2b04a] transition-colors duration-200"
              placeholder="500000"
              required
              step="10000"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">年利率（%）</label>
            <input
              type="number"
              value={annualRate}
              onChange={(e) => setAnnualRate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#0f0f23] border border-gray-700 text-white
                focus:outline-none focus:border-[#e2b04a] transition-colors duration-200"
              placeholder="3.25"
              required
              step="0.01"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">贷款期限（月）</label>
            <input
              type="number"
              value={totalMonths}
              onChange={(e) => setTotalMonths(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#0f0f23] border border-gray-700 text-white
                focus:outline-none focus:border-[#e2b04a] transition-colors duration-200"
              placeholder="240"
              required
              step="12"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">贷款开始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#0f0f23] border border-gray-700 text-white
                focus:outline-none focus:border-[#e2b04a] transition-colors duration-200"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">还款方式</label>
          <div className="flex gap-2">
            {(['equalInstallment', 'equalPrincipal'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setRepaymentType(type)}
                className={`px-5 py-2.5 rounded-xl font-medium transition-all duration-200 ${
                  repaymentType === type
                    ? 'bg-[#e2b04a] text-[#1a1a2e] shadow-lg shadow-[#e2b04a]/20'
                    : 'bg-[#0f0f23] text-gray-400 border border-gray-700 hover:border-gray-500'
                }`}
              >
                {type === 'equalInstallment' ? '等额本息' : '等额本金'}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3 rounded-xl font-bold text-lg transition-all duration-300
            hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]"
          style={{
            background: 'linear-gradient(135deg, #e2b04a 0%, #c9902a 100%)',
            color: '#1a1a2e',
          }}
        >
          {hasData ? '重新生成还款计划' : '生成还款计划'}
        </button>
      </form>
    </div>
  );
}