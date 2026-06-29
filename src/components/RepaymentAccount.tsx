import { useState } from 'react';
import { useLoanStore } from '@/stores/loanStore';
import { formatMoney } from '@/utils/calculator';
import { Wallet, ArrowDownCircle, ArrowUpCircle, AlertCircle } from 'lucide-react';

export default function RepaymentAccount() {
  const { repaymentAccount, deposit, withdraw } = useLoanStore();
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const account = repaymentAccount || { balance: 0, transactions: [] };
  const balance = account.balance;

  const handleDeposit = () => {
    setModalType('deposit');
    setShowModal(true);
    setError('');
    setAmount('');
    setNote('');
  };

  const handleWithdraw = () => {
    setModalType('withdraw');
    setShowModal(true);
    setError('');
    setAmount('');
    setNote('');
  };

  const handleSubmit = () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('请输入有效金额');
      return;
    }

    if (modalType === 'withdraw' && numAmount > balance) {
      setError('余额不足');
      return;
    }

    try {
      if (modalType === 'deposit') {
        deposit(numAmount, note || undefined);
      } else {
        withdraw(numAmount, note || undefined);
      }
      setShowModal(false);
    } catch (err: any) {
      setError(err.message || '操作失败');
    }
  };

  // 按月份分组交易记录
  const groupedTransactions = account.transactions.reduce((groups, t) => {
    const month = t.date.slice(0, 7); // YYYY-MM
    if (!groups[month]) groups[month] = [];
    groups[month].push(t);
    return groups;
  }, {} as Record<string, typeof account.transactions>);

  const sortedMonths = Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a));

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'deposit': return '转入';
      case 'withdraw': return '转出';
      case 'repayment': return '自动扣款';
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'deposit': return 'text-green-600';
      case 'withdraw': return 'text-red-600';
      case 'repayment': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getTypeBg = (type: string) => {
    switch (type) {
      case 'deposit': return 'bg-green-50';
      case 'withdraw': return 'bg-red-50';
      case 'repayment': return 'bg-blue-50';
      default: return 'bg-gray-50';
    }
  };

  return (
    <div className="space-y-4">
      {/* 余额卡片 */}
      <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl p-6 text-white shadow-xl shadow-emerald-500/20">
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="w-5 h-5" />
          <span className="text-sm text-emerald-100">还款账户余额</span>
        </div>
        <div className="text-4xl font-bold mb-4">¥{formatMoney(balance)}</div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleDeposit}
            className="flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl py-3 transition-all"
          >
            <ArrowDownCircle className="w-5 h-5" />
            <span className="text-sm font-medium">转入</span>
          </button>
          <button
            onClick={handleWithdraw}
            className="flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl py-3 transition-all"
          >
            <ArrowUpCircle className="w-5 h-5" />
            <span className="text-sm font-medium">转出</span>
          </button>
        </div>
      </div>

      {/* 交易记录 */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-bold text-gray-800">交易记录</span>
          <span className="text-xs text-gray-400">({account.transactions.length} 笔)</span>
        </div>

        {account.transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Wallet className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">暂无交易记录</p>
            <p className="text-xs mt-1">点击"转入"开始使用</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedMonths.map(month => (
              <div key={month}>
                <div className="text-xs text-gray-400 mb-2 font-medium">{month}</div>
                <div className="space-y-2">
                  {groupedTransactions[month].map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full ${getTypeBg(t.type)} flex items-center justify-center`}>
                          {t.type === 'deposit' && <ArrowDownCircle className={`w-5 h-5 ${getTypeColor(t.type)}`} />}
                          {t.type === 'withdraw' && <ArrowUpCircle className={`w-5 h-5 ${getTypeColor(t.type)}`} />}
                          {t.type === 'repayment' && <Wallet className={`w-5 h-5 ${getTypeColor(t.type)}`} />}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-800">{getTypeLabel(t.type)}</div>
                          {t.note && <div className="text-xs text-gray-400 mt-0.5">{t.note}</div>}
                          <div className="text-xs text-gray-400 mt-0.5">{t.date}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-bold ${getTypeColor(t.type)}`}>
                          {t.type === 'deposit' ? '+' : '-'}¥{formatMoney(t.amount)}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">余额 ¥{formatMoney(t.balanceAfter)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 转入/转出弹窗 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              {modalType === 'deposit' ? (
                <ArrowDownCircle className="w-6 h-6 text-green-500" />
              ) : (
                <ArrowUpCircle className="w-6 h-6 text-red-500" />
              )}
              <h3 className="text-lg font-bold text-gray-800">
                {modalType === 'deposit' ? '转入' : '转出'}
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1.5">金额</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">¥</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1.5">备注（可选）</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="如：工资存入"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-xl">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  className={`py-3 rounded-xl text-white font-medium transition-colors ${
                    modalType === 'deposit'
                      ? 'bg-green-500 hover:bg-green-600'
                      : 'bg-red-500 hover:bg-red-600'
                  }`}
                >
                  确认
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
