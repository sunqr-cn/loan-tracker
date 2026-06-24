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
  if (principal <= 0) return 0;
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
 * 解析 YYYY-MM-DD 字符串为本地时间 Date（避免 UTC 偏移导致事件处理错位）
 */
function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * 获取当前日期字符串 (YYYY-MM-DD)
 */
function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 格式化日期为 YYYY-MM-DD（避免时区问题）
 */
function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 生成完整还款计划（支持提前还款 + 利率变更）
 * 参考银行贷款逻辑：
 * - 提前还款：当期还款日前的事件先处理，减少剩余本金，再计算当期利息
 * - 利率变更：用新利率重算剩余期数的月供
 * - 已还款状态：根据当前日期自动标记（还款日期 <= 今天 = 已还款）
 */
export function generateSchedule(
  loanInfo: LoanInfo,
  prepayments: PrepaymentRecord[] = [],
  rateChanges: RateChangeRecord[] = []
): ScheduleItem[] {
  const schedule: ScheduleItem[] = [];
  const startDate = parseDateLocal(loanInfo.startDate);
  const todayStr = getTodayStr();

  let remainingPrincipal = loanInfo.totalAmount;
  let currentPeriod = 1;
  let remainingMonths = loanInfo.totalMonths;
  let currentMonthlyRate = loanInfo.annualRate / 100 / 12;

  // 合并所有时间线事件并按日期排序
  const events: TimelineEvent[] = [
    ...prepayments.map(p => ({ date: parseDateLocal(p.date), type: 'prepayment' as const, record: p })),
    ...rateChanges.map(r => ({ date: parseDateLocal(r.date), type: 'rateChange' as const, record: r })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  let eventIndex = 0;

  if (loanInfo.repaymentType === 'equalInstallment') {
    let monthlyPayment = calcEqualInstallmentMonthly(
      remainingPrincipal,
      currentMonthlyRate,
      remainingMonths
    );

    while (remainingMonths > 0 && remainingPrincipal > 0.01) {
      const paymentDate = new Date(startDate.getFullYear(), startDate.getMonth() + currentPeriod, startDate.getDate());
      const paymentDateStr = formatDateStr(paymentDate);

      // 先处理当期之前（含当期还款日）的事件
      // 事件在当期还款日及之前生效，影响当期利息计算
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
            // 缩短年限：月供不变，重算剩余期数
            remainingMonths = calcRemainingMonths(remainingPrincipal, monthlyPayment, currentMonthlyRate);
          } else {
            // 缩短月供：期数不变（remainingMonths 包含当期，不需要额外减1），重算月供
            monthlyPayment = calcEqualInstallmentMonthly(remainingPrincipal, currentMonthlyRate, remainingMonths);
          }
        } else {
          // 利率变更：用新利率重算月供，期数不变
          const rateChange = event.record as RateChangeRecord;
          currentMonthlyRate = rateChange.newRate / 100 / 12;
          isRateChangePoint = true;
          monthlyPayment = calcEqualInstallmentMonthly(remainingPrincipal, currentMonthlyRate, remainingMonths);
        }
        eventIndex++;
      }

      // 事件处理完毕后，计算当期利息和本金
      const interest = remainingPrincipal * currentMonthlyRate;
      let principal = monthlyPayment - interest;

      // 最后一期本金可能小于计算值
      if (principal >= remainingPrincipal) {
        principal = remainingPrincipal;
      }

      remainingPrincipal -= principal;
      if (remainingPrincipal < 0) {
        principal += remainingPrincipal;
        remainingPrincipal = 0;
      }

      // 根据当前日期自动标记已还款
      const paid = paymentDateStr <= todayStr;

      schedule.push({
        period: currentPeriod,
        date: paymentDateStr,
        monthlyPayment: Math.round((principal + interest) * 100) / 100,
        principal: Math.round(principal * 100) / 100,
        interest: Math.round(interest * 100) / 100,
        remainingPrincipal: Math.round(remainingPrincipal * 100) / 100,
        paid,
        isPrepaymentPoint: isPrepayPoint,
        isRateChangePoint: isRateChangePoint,
      });

      currentPeriod++;
      remainingMonths--;
    }
  } else {
    // 等额本金
    let fixedPrincipal = loanInfo.totalAmount / loanInfo.totalMonths;

    while (remainingMonths > 0 && remainingPrincipal > 0.01) {
      const paymentDate = new Date(startDate.getFullYear(), startDate.getMonth() + currentPeriod, startDate.getDate());
      const paymentDateStr = formatDateStr(paymentDate);

      // 先处理事件
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
            // 缩短年限：每月本金不变，重算剩余期数
            remainingMonths = Math.ceil(remainingPrincipal / fixedPrincipal);
          }
          // 缩短月供：期数不变，每月本金重算
          else {
            fixedPrincipal = remainingPrincipal / remainingMonths;
          }
        } else {
          // 利率变更：等额本金只需更新利率，每期本金不变
          const rateChange = event.record as RateChangeRecord;
          currentMonthlyRate = rateChange.newRate / 100 / 12;
          isRateChangePoint = true;
        }
        eventIndex++;
      }

      // 计算当期利息和本金
      const interest = remainingPrincipal * currentMonthlyRate;
      let principal = fixedPrincipal;

      if (principal >= remainingPrincipal) {
        principal = remainingPrincipal;
      }

      remainingPrincipal -= principal;
      if (remainingPrincipal < 0) {
        principal += remainingPrincipal;
        remainingPrincipal = 0;
      }

      const paid = paymentDateStr <= todayStr;

      schedule.push({
        period: currentPeriod,
        date: paymentDateStr,
        monthlyPayment: Math.round((principal + interest) * 100) / 100,
        principal: Math.round(principal * 100) / 100,
        interest: Math.round(interest * 100) / 100,
        remainingPrincipal: Math.round(remainingPrincipal * 100) / 100,
        paid,
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
 * 获取当前剩余本金（根据今天日期找到最近一期已过还款日的剩余本金）
 */
export function getCurrentRemainingPrincipal(schedule: ScheduleItem[]): number {
  if (schedule.length === 0) return 0;
  const todayStr = getTodayStr();
  // 找到最近一期已过还款日（date <= today）的剩余本金
  const passed = schedule.filter(s => s.date <= todayStr);
  if (passed.length === 0) {
    // 还没有到第一个还款日，剩余本金 = 贷款总额
    // 用第一期剩余本金 + 第一期本金反推
    return schedule[0].remainingPrincipal + schedule[0].principal;
  }
  // 取最后一期已过的剩余本金
  return passed[passed.length - 1].remainingPrincipal;
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
  return dateStr;
}

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
