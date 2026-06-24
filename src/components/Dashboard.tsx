import type { ScheduleItem } from '@/types/loan';
import { useLoanStore } from '@/stores/loanStore';
import { formatMoney, getCurrentRemainingPrincipal } from '@/utils/calculator';
import {
  Calendar, TrendingUp, PiggyBank, Clock,
  ArrowRight, Percent, CreditCard, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';

export default function Dashboard() {
  const { loanInfo, schedule, prepayments, rateChanges, setActiveTab, togglePaid } = useLoanStore();
  const [showAllSchedule, setShowAllSchedule] = useState(false);

  if (!loanInfo) return null;

  const totalInterest = schedule.reduce((sum, s) => sum + s.interest, 0);
  const totalPayment = schedule.reduce((sum, s) => sum + s.monthlyPayment, 0);
  const paidCount = schedule.filter(s => s.paid).length;
  const remainingPrincipal = getCurrentRemainingPrincipal(schedule);
  const progress = schedule.length > 0 ? (paidCount / schedule.length) * 100 : 0;

  // 找到当前期待还和下一期
  const currentPeriod = schedule.find(s => !s.paid);
  const nextPeriod = schedule.filter(s => !s.paid)[1];

  // 显示的还款计划
  const displaySchedule = showAllSchedule ? schedule : schedule.slice(0, 6);

  return (
    <div className="space-y-4">
      {/* 核心数据卡片 */}
      <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-5 text-white shadow-xl shadow-blue-600/20">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs text-blue-100 mb-1">剩余本金</div>
            <div className="text-3xl font-bold">¥{formatMoney(remainingPrincipal)}</div>
            <div className="text-xs text-blue-200 mt-1">
              已还 {((paidCount / schedule.length) * 100).toFixed(1)}%
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-blue-100 mb-1">累计利息</div>
            <div className="text-2xl font-bold">¥{formatMoney(totalInterest)}</div>
          </div>
        </div>

        {/* 进度条 */}
        <div className="relative h-2 bg-white/20 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-white rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-blue-100">
          <span>{paidCount} 期已还</span>
          <span>{schedule.length - paidCount} 期待还</span>
        </div>
      </div>

      {/* 本期/下期还款信息 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 本期还款 */}
        {currentPeriod && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500">本期还款</div>
                <div className="text-xs font-medium text-gray-800">{currentPeriod.date}</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">还款金额</span>
                <span className="text-lg font-bold text-green-600">¥{formatMoney(currentPeriod.monthlyPayment)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                <div>
                  <div className="text-xs text-gray-400">本金</div>
                  <div className="text-sm font-semibold text-gray-700">¥{formatMoney(currentPeriod.principal)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">利息</div>
                  <div className="text-sm font-semibold text-gray-700">¥{formatMoney(currentPeriod.interest)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 下期还款 */}
        {nextPeriod && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500">下期还款</div>
                <div className="text-xs font-medium text-gray-800">{nextPeriod.date}</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">还款金额</span>
                <span className="text-lg font-bold text-blue-600">¥{formatMoney(nextPeriod.monthlyPayment)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                <div>
                  <div className="text-xs text-gray-400">本金</div>
                  <div className="text-sm font-semibold text-gray-700">¥{formatMoney(nextPeriod.principal)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">利息</div>
                  <div className="text-sm font-semibold text-gray-700">¥{formatMoney(nextPeriod.interest)}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 还款计划列表 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">还款计划</h3>
              <p className="text-xs text-gray-400">共 {schedule.length} 期</p>
            </div>
          </div>
          {schedule.length > 6 && (
            <button
              onClick={() => setShowAllSchedule(!showAllSchedule)}
              className="text-xs text-blue-600 font-medium flex items-center gap-1"
            >
              {showAllSchedule ? '收起' : '查看全部'}
              <ChevronRight className={`w-3 h-3 transition-transform ${showAllSchedule ? 'rotate-90' : ''}`} />
            </button>
          )}
        </div>

        <div className="divide-y divide-gray-50">
          {displaySchedule.map((item) => (
            <div
              key={item.period}
              className={`flex items-center justify-between p-3 hover:bg-gray-50 transition-colors ${
                item.paid ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => togglePaid(item.period)}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    item.paid
                      ? 'bg-green-500 border-green-500'
                      : 'border-gray-300 hover:border-green-400'
                  }`}
                >
                  {item.paid && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <div>
                  <div className="text-sm font-medium text-gray-800">
                    第 {item.period} 期
                    {item.isRateChangePoint && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-orange-100 text-orange-600 rounded">利率变更</span>
                    )}
                    {item.isPrepaymentPoint && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-600 rounded">提前还款</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">{item.date}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-gray-800">¥{formatMoney(item.monthlyPayment)}</div>
                <div className="text-xs text-gray-400">
                  本金 ¥{formatMoney(item.principal)} + 利息 ¥{formatMoney(item.interest)}
                </div>
              </div>
            </div>
          ))}
        </div>
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

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 剩余本金趋势图 */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-purple-600" />
            </div>
            <h3 className="text-sm font-bold text-gray-800">剩余本金趋势</h3>
          </div>
          <div className="h-40">
            <svg viewBox="0 0 400 160" className="w-full h-full">
              {/* 网格线 */}
              <line x1="0" y1="40" x2="400" y2="40" stroke="#f3f4f6" strokeWidth="1" />
              <line x1="0" y1="80" x2="400" y2="80" stroke="#f3f4f6" strokeWidth="1" />
              <line x1="0" y1="120" x2="400" y2="120" stroke="#f3f4f6" strokeWidth="1" />
              
              {/* 曲线 */}
              <path
                d={`M 0 0 ${schedule.slice(0, 20).map((s, i) => {
                  const x = (i / 19) * 400;
                  const y = 160 - (s.remainingPrincipal / loanInfo.totalAmount) * 160;
                  return `L ${x} ${y}`;
                }).join(' ')}`}
                fill="none"
                stroke="url(#gradient-purple)"
                strokeWidth="2"
              />
              
              {/* 渐变填充 */}
              <path
                d={`M 0 0 ${schedule.slice(0, 20).map((s, i) => {
                  const x = (i / 19) * 400;
                  const y = 160 - (s.remainingPrincipal / loanInfo.totalAmount) * 160;
                  return `L ${x} ${y}`;
                }).join(' ')} L 400 160 L 0 160 Z`}
                fill="url(#gradient-purple-fill)"
                opacity="0.2"
              />
              
              <defs>
                <linearGradient id="gradient-purple" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
                <linearGradient id="gradient-purple-fill" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>第1期</span>
            <span>第20期</span>
          </div>
        </div>

        {/* 本金利息构成图 */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
              <PiggyBank className="w-4 h-4 text-orange-600" />
            </div>
            <h3 className="text-sm font-bold text-gray-800">本金利息构成</h3>
          </div>
          <div className="h-40 flex items-center justify-center">
            <svg viewBox="0 0 200 200" className="w-32 h-32">
              {/* 饼图 */}
              <circle
                cx="100" cy="100" r="80"
                fill="none"
                stroke="#f3f4f6"
                strokeWidth="40"
              />
              <circle
                cx="100" cy="100" r="80"
                fill="none"
                stroke="url(#gradient-blue)"
                strokeWidth="40"
                strokeDasharray={`${(totalPrincipal / totalPayment) * 502.65} 502.65`}
                transform="rotate(-90 100 100)"
              />
              <text x="100" y="95" textAnchor="middle" className="text-2xl font-bold fill-gray-800">
                {((totalPrincipal / totalPayment) * 100).toFixed(0)}%
              </text>
              <text x="100" y="115" textAnchor="middle" className="text-xs fill-gray-400">
                本金占比
              </text>
              <defs>
                <linearGradient id="gradient-blue" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#2563eb" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="flex justify-around mt-3 text-xs">
            <div className="text-center">
              <div className="font-bold text-blue-600">¥{formatMoney(totalPrincipal)}</div>
              <div className="text-gray-400">本金</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-orange-600">¥{formatMoney(totalInterest)}</div>
              <div className="text-gray-400">利息</div>
            </div>
          </div>
        </div>
      </div>

      {/* 汇总信息 */}
      <div className="bg-gray-50 rounded-2xl p-4">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-xs text-gray-500 mb-1">还款总额</div>
            <div className="text-lg font-bold text-gray-800">¥{formatMoney(totalPayment)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">贷款总额</div>
            <div className="text-lg font-bold text-gray-800">¥{formatMoney(loanInfo.totalAmount)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
