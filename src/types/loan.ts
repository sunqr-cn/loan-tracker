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

export interface LoanData {
  loanInfo: LoanInfo;
  schedule: ScheduleItem[];
  prepayments: PrepaymentRecord[];
  meta: {
    createdAt: string;
    updatedAt: string;
  };
}