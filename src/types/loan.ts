export interface LoanInfo {
  totalAmount: number;
  annualRate: number;
  totalMonths: number;
  repaymentType: 'equalInstallment' | 'equalPrincipal';
  startDate: string;
}

export interface ScheduleItem {
  period: number;
  date: string;
  monthlyPayment: number;
  principal: number;
  interest: number;
  remainingPrincipal: number;
  paid: boolean;
  isPrepaymentPoint: boolean;
  isRateChangePoint: boolean;
}

export interface PrepaymentRecord {
  id: string;
  date: string;
  amount: number;
  mode: 'shortenTerm' | 'reduceMonthly';
  beforeRemainingPrincipal: number;
  afterRemainingPrincipal: number;
  originalRemainingMonths: number;
  newRemainingMonths: number;
  originalMonthlyPayment: number;
  newMonthlyPayment: number;
}

// 利率变更记录（参考银行LPR浮动利率调整）
export interface RateChangeRecord {
  id: string;
  date: string;           // 利率调整生效日期
  oldRate: number;         // 调整前年利率（%）
  newRate: number;         // 调整后年利率（%）
  beforeRemainingPrincipal: number; // 调整时剩余本金
  remainingMonths: number;  // 调整时剩余期数
}

export interface Transaction {
  id: string;
  date: string;           // YYYY-MM-DD
  type: 'deposit' | 'withdraw' | 'repayment';
  amount: number;
  balanceAfter: number;
  note?: string;
}

export interface RepaymentAccount {
  balance: number;
  transactions: Transaction[];
}

export interface LoanData {
  loanInfo: LoanInfo;
  schedule: ScheduleItem[];
  prepayments: PrepaymentRecord[];
  rateChanges: RateChangeRecord[];
  repaymentAccount?: RepaymentAccount;
  meta: {
    createdAt: string;
    updatedAt: string;
  };
}