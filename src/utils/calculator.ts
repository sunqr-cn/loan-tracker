import type { LoanInfo, ScheduleItem, PrepaymentRecord, RateChangeRecord } from '@/types/loan';

/**
 * 计算等额本息月供
 */
export function calcEqualInstallmentMonthly(
  principal: number,
  monthlyRate: number,
  months: number
): number {
  if (monthlyRate === 0) return principal / months;
  const pow = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * pow) / (pow - 1);
}

/**
 * 计算等额本息反算剩余期数
 */
export function calcRemainingMonths(
  principal: number,
  monthlyPayment: number,
  monthlyRate: number
): number {
  if (monthlyRate === 0) return Math.ceil(principal / monthlyPayment);
  const n = Math.log(monthlyPayment / (monthlyPayment - principal * monthlyRate)) / Math.log(1 + monthlyRate);
  return Math.ceil(n);
}

interface TimelineEvent {
  date: Date;
  type: 'prepayment' | 'rateChange';
  record: PrepaymentRecord | RateChangeRecord;
}

/**
 * 生成完整还款计划（支持提前还款 + 利率变更）
 * 参考银行贷款逻辑：利率变更时，用新利率重算剩余期数的月供
 */
export function generateSchedule(
  loanInfo: LoanInfo,
  prepayments: PrepaymentRecord[] = [],
  rateChanges: RateChangeRecord[] = []
): ScheduleItem[] {
  const schedule: ScheduleItem[] = [];
  const startDate = new Date(loanInfo.startDate);
  let remainingPrincipal = loanInfo.totalAmount;
  let currentPeriod = 1;
  let remainingMonths = loanInfo.totalMonths;
  let currentMonthlyRate = loanInfo.annualRate / 100 / 12;

  // 合并所有时间线事件并排序
  const events: TimelineEvent[] = [
    ...prepayments.map(p => ({ date: new Date(p.date), type: 'prepayment' as const, record: p })),
    ...rateChanges.map(r => ({ date: new Date(r.date), type: 'rateChange' as const, record: r })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  let eventIndex = 0;

  if (loanInfo.repaymentType === 'equalInstallment') {
    let monthlyPayment = calcEqualInstallmentMonthly(
      remainingPrincipal,
      currentMonthlyRate,
      remainingMonths
    );

    while (remainingMonths > 0 && remainingPrincipal > 0.01) {
      const interest = remainingPrincipal * currentMonthlyRate;
      let principal = monthlyPayment - interest;

      if (principal >= remainingPrincipal) {
        principal = remainingPrincipal;
      }

      const paymentDate = new Date(startDate);
      paymentDate.setMonth(paymentDate.getMonth() + currentPeriod);

      // 处理当前期之前的事件
      let isPrepayPoint = false;
      let isRateChangePoint = false;

      while (
        eventIndex < events.length &&
        events[eventIndex].date <= paymentDate
      ) {
        const event = events[eventIndex];

        if (event.type === 'prepayment') {
          const prepay = event.record as PrepaymentRecord;
          remainingPrincipal -= prepay.amount;
          isPrepayPoint = true;

          if (prepay.mode === 'shortenTerm') {
            remainingMonths = calcRemainingMonths(remainingPrincipal, monthlyPayment, currentMonthlyRate);
          } else {
            remainingMonths = remainingMonths - 1;
            monthlyPayment = calcEqualInstallmentMonthly(
              remainingPrincipal,
              currentMonthlyRate,
              remainingMonths
            );
          }
        } else {
          // 利率变更：用新利率重算月供，期数不变
          const rateChange = event.record as RateChangeRecord;
          currentMonthlyRate = rateChange.newRate / 100 / 12;
          isRateChangePoint = true;
          monthlyPayment = calcEqualInstallmentMonthly(
            remainingPrincipal,
            currentMonthlyRate,
            remainingMonths
          );
        }
        eventIndex++;
      }

      remainingPrincipal -= principal;
      if (remainingPrincipal < 0) {
        principal += remainingPrincipal;
        remainingPrincipal = 0;
      }

      schedule.push({
        period: currentPeriod,
        date: paymentDate.toISOString().slice(0, 10),
        monthlyPayment: Math.round((principal + interest) * 100) / 100,
        principal: Math.round(principal * 100) / 100,
        interest: Math.round(interest * 100) / 100,
        remainingPrincipal: Math.round(remainingPrincipal * 100) / 100,
        paid: false,
        isPrepaymentPoint: isPrepayPoint,
        isRateChangePoint: isRateChangePoint,
      });

      currentPeriod++;
      remainingMonths--;
    }
  } else {
    // 等额本金
    const fixedPrincipal = loanInfo.totalAmount / loanInfo.totalMonths;

    while (remainingMonths > 0 && remainingPrincipal > 0.01) {
      const interest = remainingPrincipal * currentMonthlyRate;
      let principal = fixedPrincipal;

      if (principal >= remainingPrincipal) {
        principal = remainingPrincipal;
      }

      const paymentDate = new Date(startDate);
      paymentDate.setMonth(paymentDate.getMonth() + currentPeriod);

      let isPrepayPoint = false;
      let isRateChangePoint = false;

      while (
        eventIndex < events.length &&
        events[eventIndex].date <= paymentDate
      ) {
        const event = events[eventIndex];

        if (event.type === 'prepayment') {
          const prepay = event.record as PrepaymentRecord;
          remainingPrincipal -= prepay.amount;
          isPrepayPoint = true;

          if (prepay.mode === 'shortenTerm') {
            remainingMonths = Math.ceil(remainingPrincipal / fixedPrincipal);
          } else {
            remainingMonths = remainingMonths - 1;
          }
        } else {
          // 利率变更：等额本金只需更新利率，每期本金不变
          const rateChange = event.record as RateChangeRecord;
          currentMonthlyRate = rateChange.newRate / 100 / 12;
          isRateChangePoint = true;
        }
        eventIndex++;
      }

      remainingPrincipal -= principal;
      if (remainingPrincipal < 0) {
        principal += remainingPrincipal;
        remainingPrincipal = 0;
      }

      schedule.push({
        period: currentPeriod,
        date: paymentDate.toISOString().slice(0, 10),
        monthlyPayment: Math.round((principal + interest) * 100) / 100,
        principal: Math.round(principal * 100) / 100,
        interest: Math.round(interest * 100) / 100,
        remainingPrincipal: Math.round(remainingPrincipal * 100) / 100,
        paid: false,
        isPrepaymentPoint: isPrepayPoint,
        isRateChangePoint: isRateChangePoint,
      });

      currentPeriod++;
      remainingMonths--;
    }
  }

  return schedule;
}

/**
 * 格式化金额
 */
export function formatMoney(amount: number): string {
  return amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * 格式化日期
 */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}