import type { LoanInfo, ScheduleItem, PrepaymentRecord } from '@/types/loan';

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
 * 已知剩余本金、月供、月利率，求剩余期数
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

/**
 * 生成完整还款计划
 */
export function generateSchedule(
  loanInfo: LoanInfo,
  prepayments: PrepaymentRecord[] = []
): ScheduleItem[] {
  const monthlyRate = loanInfo.annualRate / 100 / 12;
  const schedule: ScheduleItem[] = [];
  const startDate = new Date(loanInfo.startDate);
  let remainingPrincipal = loanInfo.totalAmount;
  let currentPeriod = 1;
  let remainingMonths = loanInfo.totalMonths;

  // 排序提前还款记录
  const sortedPrepayments = [...prepayments].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let prepayIndex = 0;

  if (loanInfo.repaymentType === 'equalInstallment') {
    let monthlyPayment = calcEqualInstallmentMonthly(
      remainingPrincipal,
      monthlyRate,
      remainingMonths
    );

    while (remainingMonths > 0 && remainingPrincipal > 0.01) {
      const interest = remainingPrincipal * monthlyRate;
      let principal = monthlyPayment - interest;

      if (principal >= remainingPrincipal) {
        principal = remainingPrincipal;
      }

      const paymentDate = new Date(startDate);
      paymentDate.setMonth(paymentDate.getMonth() + currentPeriod);

      // 检查是否有提前还款在此期之前
      let isPrepayPoint = false;
      while (
        prepayIndex < sortedPrepayments.length &&
        new Date(sortedPrepayments[prepayIndex].date) <= paymentDate
      ) {
        const prepay = sortedPrepayments[prepayIndex];
        remainingPrincipal -= prepay.amount;
        isPrepayPoint = true;

        if (prepay.mode === 'shortenTerm') {
          // 缩短年限：保持月供不变，重算剩余期数
          remainingMonths = calcRemainingMonths(remainingPrincipal, monthlyPayment, monthlyRate);
        } else {
          // 缩短月供：保持期数不变，重算月供
          remainingMonths = remainingMonths - 1; // 扣除当前期
          monthlyPayment = calcEqualInstallmentMonthly(
            remainingPrincipal,
            monthlyRate,
            remainingMonths
          );
        }
        prepayIndex++;
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
      });

      currentPeriod++;
      remainingMonths--;
    }
  } else {
    // 等额本金
    const fixedPrincipal = loanInfo.totalAmount / loanInfo.totalMonths;

    while (remainingMonths > 0 && remainingPrincipal > 0.01) {
      const interest = remainingPrincipal * monthlyRate;
      let principal = fixedPrincipal;

      if (principal >= remainingPrincipal) {
        principal = remainingPrincipal;
      }

      const paymentDate = new Date(startDate);
      paymentDate.setMonth(paymentDate.getMonth() + currentPeriod);

      // 检查提前还款
      let isPrepayPoint = false;
      while (
        prepayIndex < sortedPrepayments.length &&
        new Date(sortedPrepayments[prepayIndex].date) <= paymentDate
      ) {
        const prepay = sortedPrepayments[prepayIndex];
        remainingPrincipal -= prepay.amount;
        isPrepayPoint = true;

        if (prepay.mode === 'shortenTerm') {
          // 缩短年限：剩余本金 / 原每期本金 ≈ 新剩余期数
          remainingMonths = Math.ceil(remainingPrincipal / fixedPrincipal);
        } else {
          // 缩短月供：保持期数不变
          remainingMonths = remainingMonths - 1;
        }
        prepayIndex++;
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