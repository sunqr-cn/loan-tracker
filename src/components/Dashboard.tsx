import type { ScheduleItem } from '@/types/loan';
import { useLoanStore } from '@/stores/loanStore';
import { formatMoney, getCurrentRemainingPrincipal } from '@/utils/calculator';
import { Clock, Calendar, TrendingUp, PiggyBank, Wallet } from 'lucide-react';

export default function Dashboard() {
  const { loanInfo, schedule, repaymentAccount } = useLoanStore();

  if (!loanInfo) return null;

  // 从已还期数直接求和（不依赖 schedule 总本金，因为提前还款后 schedule 会重算）
  const paidItems = schedule.filter(s => s.paid);
  const paidPrincipal = paidItems.reduce((sum, s) => sum + s.principal, 0);
  const paidInterest = paidItems.reduce((sum, s) => sum + s.interest, 0);
  const paidTotal = paidPrincipal + paidInterest;

  // 全 schedule 的本金利息总和（用于构成图）
  const totalPrincipal = schedule.reduce((sum, s) => sum + s.principal, 0);
  const totalInterest = schedule.reduce((sum, s) => sum + s.interest, 0);
  const totalPayment = schedule.reduce((sum, s) => sum + s.monthlyPayment, 0);
  const paidCount = paidItems.length;
  const remainingPrincipal = getCurrentRemainingPrincipal(schedule);
  const remainingPeriods = schedule.length - paidCount;
  const progress = schedule.length > 0 ? (paidCount / schedule.length) * 100 : 0;

  const currentPeriod = schedule.find(s => !s.paid);
  const nextPeriod = schedule.filter(s => !s.paid)[1];

  // 还款账户信息
  const accountBalance = repaymentAccount?.balance || 0;
  const accountTransactions = repaymentAccount?.transactions || [];
  const nextPayment = currentPeriod?.monthlyPayment || 0;
  const accountSufficient = accountBalance >= nextPayment;
  const accountCoverage = nextPayment > 0 ? (accountBalance / nextPayment) : 0;

  // 构成比例（基于贷款总额，不是 schedule 本金和，因为提前还款会减少 schedule 本金）
  const totalPaymentActual = loanInfo.totalAmount + totalInterest;
  const principalRatio = totalPaymentActual > 0 ? (loanInfo.totalAmount / totalPaymentActual) * 100 : 0;
  const interestRatio = totalPaymentActual > 0 ? (totalInterest / totalPaymentActual) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* 剩余本金 - 大卡片 */}
      <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-5 text-white shadow-xl shadow-blue-600/20">
        <div className="text-xs text-blue-200 mb-1">剩余本金</div>
        <div className="text-3xl font-bold mb-3">¥{formatMoney(remainingPrincipal)}</div>
        <div className="relative h-2.5 bg-white/20 rounded-full overflow-hidden mb-2">
          <div
            className="absolute inset-y-0 left-0 bg-white rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-blue-100">
          <span>已还 {paidCount} 期</span>
          <span>剩余 {remainingPeriods} 期</span>
        </div>
      </div>

      {/* 本期 / 下期还款 */}
      <div className="grid grid-cols-2 gap-3">
        {currentPeriod && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-4 h-4 text-green-500" />
              <span className="text-xs text-gray-500 font-medium">本期还款</span>
            </div>
            <div className="text-lg font-bold text-green-600 mb-2">¥{formatMoney(currentPeriod.monthlyPayment)}</div>
            <div className="text-[11px] text-gray-400 mb-2">{currentPeriod.date}</div>
            <div className="grid grid-cols-2 gap-1 pt-2 border-t border-gray-100">
              <div>
                <div className="text-[10px] text-gray-400">本金</div>
                <div className="text-xs font-semibold text-gray-700">¥{formatMoney(currentPeriod.principal)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">利息</div>
                <div className="text-xs font-semibold text-gray-700">¥{formatMoney(currentPeriod.interest)}</div>
              </div>
            </div>
          </div>
        )}

        {nextPeriod && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-1.5 mb-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-gray-500 font-medium">下期还款</span>
            </div>
            <div className="text-lg font-bold text-blue-600 mb-2">¥{formatMoney(nextPeriod.monthlyPayment)}</div>
            <div className="text-[11px] text-gray-400 mb-2">{nextPeriod.date}</div>
            <div className="grid grid-cols-2 gap-1 pt-2 border-t border-gray-100">
              <div>
                <div className="text-[10px] text-gray-400">本金</div>
                <div className="text-xs font-semibold text-gray-700">¥{formatMoney(nextPeriod.principal)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">利息</div>
                <div className="text-xs font-semibold text-gray-700">¥{formatMoney(nextPeriod.interest)}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 还款账户 */}
      <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl p-4 text-white shadow-lg shadow-emerald-500/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            <span className="text-sm font-medium">还款账户</span>
          </div>
          <div className={`text-xs px-2 py-1 rounded-full ${
            accountSufficient ? 'bg-white/20' : 'bg-red-400/30'
          }`}>
            {accountSufficient ? '余额充足' : '余额不足'}
          </div>
        </div>
        <div className="text-2xl font-bold mb-2">¥{formatMoney(accountBalance)}</div>
        <div className="flex items-center justify-between text-xs text-emerald-100">
          <span>下期还款 ¥{formatMoney(nextPayment)}</span>
          <span>可还 {Math.floor(accountCoverage)} 期</span>
        </div>
      </div>

      {/* 核心数据 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm text-center">
          <div className="text-[10px] text-gray-400 mb-1">已还本金</div>
          <div className="text-sm font-bold text-blue-600">¥{formatMoney(paidPrincipal)}</div>
        </div>
        <div className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm text-center">
          <div className="text-[10px] text-gray-400 mb-1">已还利息</div>
          <div className="text-sm font-bold text-orange-500">¥{formatMoney(paidInterest)}</div>
        </div>
        <div className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm text-center">
          <div className="text-[10px] text-gray-400 mb-1">还款进度</div>
          <div className="text-sm font-bold text-indigo-600">{progress.toFixed(1)}%</div>
        </div>
      </div>

      {/* 本金利息构成 */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <PiggyBank className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-bold text-gray-800">本金利息构成</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <svg width="100" height="100" className="transform -rotate-90">
              <circle cx="50" cy="50" r="38" fill="none" stroke="#f3f4f6" strokeWidth="16" />
              <circle
                cx="50" cy="50" r="38" fill="none"
                stroke="#3b82f6" strokeWidth="16"
                strokeDasharray={`${2 * Math.PI * 38 * principalRatio / 100} ${2 * Math.PI * 38}`}
                strokeDashoffset="0"
              />
              <circle
                cx="50" cy="50" r="38" fill="none"
                stroke="#f97316" strokeWidth="16"
                strokeDasharray={`${2 * Math.PI * 38 * interestRatio / 100} ${2 * Math.PI * 38}`}
                strokeDashoffset={`${-2 * Math.PI * 38 * principalRatio / 100}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-lg font-bold text-gray-800">{principalRatio.toFixed(0)}%</div>
              <div className="text-[10px] text-gray-400">本金</div>
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-xs text-gray-600">本金</span>
              </div>
              <span className="text-xs font-semibold text-gray-800">¥{formatMoney(totalPrincipal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-xs text-gray-600">利息</span>
              </div>
              <span className="text-xs font-semibold text-gray-800">¥{formatMoney(totalInterest)}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-500 font-medium">还款总额</span>
              <span className="text-xs font-bold text-gray-800">¥{formatMoney(totalPayment)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 贷款信息摘要 */}
      <div className="bg-gray-50 rounded-2xl p-4">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-[10px] text-gray-400 mb-0.5">贷款总额</div>
            <div className="text-base font-bold text-gray-800">¥{formatMoney(loanInfo.totalAmount)}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400 mb-0.5">贷款期限</div>
            <div className="text-base font-bold text-gray-800">{loanInfo.totalMonths} 期</div>
          </div>
        </div>
      </div>
    </div>
  );
}
