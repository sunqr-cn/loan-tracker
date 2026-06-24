// 快速验证：打印利率变更和提前还款前后的实际数字
import { generateSchedule, formatMoney } from '../src/utils/calculator';
import type { LoanInfo, PrepaymentRecord, RateChangeRecord } from '../src/types/loan';

const loanInfo: LoanInfo = {
  totalAmount: 500000,
  annualRate: 3.25,
  totalMonths: 240,
  repaymentType: 'equalInstallment',
  startDate: '2024-01-01',
};

console.log('===== 基准计划 =====');
const base = generateSchedule(loanInfo, [], []);
console.log(`期数: ${base.length}`);
console.log(`第1期: 月供=${formatMoney(base[0].monthlyPayment)}, 利息=${formatMoney(base[0].interest)}, 本金=${formatMoney(base[0].principal)}`);
console.log(`第12期: 月供=${formatMoney(base[11].monthlyPayment)}, 利息=${formatMoney(base[11].interest)}, 本金=${formatMoney(base[11].principal)}`);
console.log(`第13期: 月供=${formatMoney(base[12].monthlyPayment)}, 利息=${formatMoney(base[12].interest)}, 本金=${formatMoney(base[12].principal)}`);
console.log(`总利息: ${formatMoney(base.reduce((s, x) => s + x.interest, 0))}`);

console.log('\n===== 利率变更 3.25% → 2.85% (2025-01-01) =====');
const rc: RateChangeRecord = {
  id: 'rc1', date: '2025-01-01', oldRate: 3.25, newRate: 2.85,
  beforeRemainingPrincipal: 0, remainingMonths: 0,
};
const withRate = generateSchedule(loanInfo, [], [rc]);
console.log(`期数: ${withRate.length}`);
console.log(`第1期: 月供=${formatMoney(withRate[0].monthlyPayment)}, 利息=${formatMoney(withRate[0].interest)}`);
console.log(`第12期(变更点): 月供=${formatMoney(withRate[11].monthlyPayment)}, 利息=${formatMoney(withRate[11].interest)}, isRateChange=${withRate[11].isRateChangePoint}`);
console.log(`第13期: 月供=${formatMoney(withRate[12].monthlyPayment)}, 利息=${formatMoney(withRate[12].interest)}`);
console.log(`总利息: ${formatMoney(withRate.reduce((s, x) => s + x.interest, 0))}`);
console.log(`利息差额: ${formatMoney(base.reduce((s, x) => s + x.interest, 0) - withRate.reduce((s, x) => s + x.interest, 0))}`);

console.log('\n===== 提前还款 10万 (2025-06-01, 缩短年限) =====');
const pp: PrepaymentRecord = {
  id: 'pp1', date: '2025-06-01', amount: 100000, mode: 'shortenTerm',
  beforeRemainingPrincipal: 0, afterRemainingPrincipal: 0,
  originalRemainingMonths: 0, newRemainingMonths: 0,
  originalMonthlyPayment: 0, newMonthlyPayment: 0,
};
const withPrepay = generateSchedule(loanInfo, [pp], []);
console.log(`期数: ${withPrepay.length} (基准: ${base.length})`);
console.log(`第1期: 月供=${formatMoney(withPrepay[0].monthlyPayment)}, 利息=${formatMoney(withPrepay[0].interest)}`);
console.log(`第17期(还款点): 月供=${formatMoney(withPrepay[16].monthlyPayment)}, 利息=${formatMoney(withPrepay[16].interest)}, isPrepay=${withPrepay[16].isPrepaymentPoint}`);
console.log(`第18期: 月供=${formatMoney(withPrepay[17].monthlyPayment)}, 利息=${formatMoney(withPrepay[17].interest)}`);
console.log(`总利息: ${formatMoney(withPrepay.reduce((s, x) => s + x.interest, 0))}`);
console.log(`利息节省: ${formatMoney(base.reduce((s, x) => s + x.interest, 0) - withPrepay.reduce((s, x) => s + x.interest, 0))}`);

console.log('\n===== 逐期对比 (前20期) =====');
console.log('期数 | 基准利息 | 变更后利息 | 提前还款后利息');
for (let i = 0; i < Math.min(20, Math.min(base.length, Math.min(withRate.length, withPrepay.length))); i++) {
  console.log(`${i + 1} | ${formatMoney(base[i].interest).padStart(12)} | ${formatMoney(withRate[i].interest).padStart(12)} | ${formatMoney(withPrepay[i].interest).padStart(12)}`);
}
