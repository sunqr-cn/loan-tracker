/**
 * 接口级数据变动验证脚本
 * 直接调用 generateSchedule 计算逻辑 + mock-server API
 * 验证提前还款和利率调整是否真的生效
 */
import { generateSchedule, formatMoney, getCurrentRemainingPrincipal } from '../src/utils/calculator';
import type { LoanInfo, PrepaymentRecord, RateChangeRecord } from '../src/types/loan';

const API_URL = process.env.API_URL || 'http://localhost:8787';

interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
}

const results: TestResult[] = [];

function assert(name: string, condition: boolean, detail: string) {
  results.push({ name, passed: condition, detail });
  const icon = condition ? '✅' : '❌';
  console.log(`${icon} ${name}: ${detail}`);
}

async function apiGet(path: string) {
  const resp = await fetch(`${API_URL}${path}`, { cache: 'no-cache' });
  return resp.json();
}

async function apiPost(path: string, body: unknown) {
  const resp = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return resp.json();
}

async function main() {
  console.log('='.repeat(60));
  console.log('🔧 接口级数据变动验证');
  console.log('='.repeat(60));

  // ========== 基础贷款信息 ==========
  const loanInfo: LoanInfo = {
    totalAmount: 500000,
    annualRate: 3.25,
    totalMonths: 240,
    repaymentType: 'equalInstallment',
    startDate: '2024-01-01',
  };

  // ========== 1. 基准计划（无提前还款、无利率变更） ==========
  console.log('\n📋 1. 生成基准还款计划...');
  const baseSchedule = generateSchedule(loanInfo, [], []);
  const baseTotalInterest = baseSchedule.reduce((s, x) => s + x.interest, 0);
  const baseTotalPayment = baseSchedule.reduce((s, x) => s + x.monthlyPayment, 0);
  const baseMonthly = baseSchedule[0].monthlyPayment;
  const basePeriods = baseSchedule.length;
  const baseRemaining = getCurrentRemainingPrincipal(baseSchedule);

  console.log(`  基准: ${basePeriods}期, 月供¥${formatMoney(baseMonthly)}, 总利息¥${formatMoney(baseTotalInterest)}, 当前剩余本金¥${formatMoney(baseRemaining)}`);

  assert('基准计划生成', basePeriods === 240, `期数=${basePeriods}, 月供=¥${formatMoney(baseMonthly)}`);
  assert('基准月供 > 0', baseMonthly > 0, `月供=¥${formatMoney(baseMonthly)}`);
  assert('基准总利息 > 0', baseTotalInterest > 0, `总利息=¥${formatMoney(baseTotalInterest)}`);

  // ========== 2. 利率变更验证 ==========
  console.log('\n📋 2. 利率变更验证（3.25% → 2.85%）...');
  const rateChange: RateChangeRecord = {
    id: 'rc1',
    date: '2025-01-01',
    oldRate: 3.25,
    newRate: 2.85,
    beforeRemainingPrincipal: 0,
    remainingMonths: 0,
  };
  const rateChangedSchedule = generateSchedule(loanInfo, [], [rateChange]);
  const rateChangedMonthly = rateChangedSchedule[0].monthlyPayment;
  // 找到利率变更后的月供（变更点之后的第一期）
  const rateChangePoint = rateChangedSchedule.find(s => s.isRateChangePoint);
  const monthlyAfterRateChange = rateChangePoint ? rateChangePoint.monthlyPayment : 0;
  const rateChangedTotalInterest = rateChangedSchedule.reduce((s, x) => s + x.interest, 0);
  const rateChangedPeriods = rateChangedSchedule.length;

  console.log(`  变更前月供: ¥${formatMoney(baseMonthly)}`);
  console.log(`  变更后月供(变更点): ¥${formatMoney(monthlyAfterRateChange)}`);
  console.log(`  变更后总利息: ¥${formatMoney(rateChangedTotalInterest)} (基准: ¥${formatMoney(baseTotalInterest)})`);

  assert('利率变更标记存在', !!rateChangePoint, `变更点日期=${rateChangePoint?.date}`);
  assert('利率变更后月供变化', monthlyAfterRateChange !== baseMonthly && monthlyAfterRateChange > 0,
    `变更前¥${formatMoney(baseMonthly)} → 变更后¥${formatMoney(monthlyAfterRateChange)}`);
  assert('利率下降后总利息减少', rateChangedTotalInterest < baseTotalInterest,
    `基准¥${formatMoney(baseTotalInterest)} → 降息后¥${formatMoney(rateChangedTotalInterest)}, 减少¥${formatMoney(baseTotalInterest - rateChangedTotalInterest)}`);

  // ========== 3. 提前还款验证（缩短年限） ==========
  console.log('\n📋 3. 提前还款验证（10万，缩短年限）...');
  const prepayment: PrepaymentRecord = {
    id: 'pp1',
    date: '2025-06-01',
    amount: 100000,
    mode: 'shortenTerm',
    beforeRemainingPrincipal: 0,
    afterRemainingPrincipal: 0,
    originalRemainingMonths: 0,
    newRemainingMonths: 0,
    originalMonthlyPayment: 0,
    newMonthlyPayment: 0,
  };
  const prepaySchedule = generateSchedule(loanInfo, [prepayment], []);
  const prepayPeriods = prepaySchedule.length;
  const prepayTotalInterest = prepaySchedule.reduce((s, x) => s + x.interest, 0);
  const prepayMonthly = prepaySchedule[0].monthlyPayment;
  const prepayPoint = prepaySchedule.find(s => s.isPrepaymentPoint);
  const prepayRemaining = getCurrentRemainingPrincipal(prepaySchedule);

  console.log(`  基准期数: ${basePeriods}, 提前还款后期数: ${prepayPeriods}`);
  console.log(`  基准总利息: ¥${formatMoney(baseTotalInterest)}, 提前还款后总利息: ¥${formatMoney(prepayTotalInterest)}`);
  console.log(`  提前还款点剩余本金: ¥${formatMoney(prepayPoint?.remainingPrincipal || 0)}`);

  assert('提前还款标记存在', !!prepayPoint, `还款点日期=${prepayPoint?.date}`);
  assert('缩短年限后期数减少', prepayPeriods < basePeriods,
    `基准${basePeriods}期 → 提前还款后${prepayPeriods}期, 减少${basePeriods - prepayPeriods}期`);
  assert('提前还款后总利息减少', prepayTotalInterest < baseTotalInterest,
    `基准¥${formatMoney(baseTotalInterest)} → 提前还款后¥${formatMoney(prepayTotalInterest)}, 节省¥${formatMoney(baseTotalInterest - prepayTotalInterest)}`);
  // 缩短年限模式：月供应基本不变
  assert('缩短年限模式月供基本不变', Math.abs(prepayMonthly - baseMonthly) < 1,
    `基准月供¥${formatMoney(baseMonthly)}, 提前还款后月供¥${formatMoney(prepayMonthly)}`);

  // ========== 4. 提前还款验证（缩短月供） ==========
  console.log('\n📋 4. 提前还款验证（10万，缩短月供）...');
  const prepaymentReduce: PrepaymentRecord = {
    ...prepayment,
    id: 'pp2',
    mode: 'reduceMonthly',
  };
  const reduceSchedule = generateSchedule(loanInfo, [prepaymentReduce], []);
  const reducePeriods = reduceSchedule.length;
  const reduceMonthly = reduceSchedule[0].monthlyPayment;
  const reducePoint = reduceSchedule.find(s => s.isPrepaymentPoint);
  const monthlyAfterReduce = reducePoint ? reducePoint.monthlyPayment : 0;

  console.log(`  基准月供: ¥${formatMoney(baseMonthly)}, 缩短月供后(变更点): ¥${formatMoney(monthlyAfterReduce)}`);
  console.log(`  基准期数: ${basePeriods}, 缩短月供后期数: ${reducePeriods}`);

  assert('缩短月供模式期数不变', reducePeriods === basePeriods,
    `基准${basePeriods}期 → 缩短月供后${reducePeriods}期`);
  assert('缩短月供后月供减少', monthlyAfterReduce < baseMonthly && monthlyAfterReduce > 0,
    `基准¥${formatMoney(baseMonthly)} → 缩短月供后¥${formatMoney(monthlyAfterReduce)}`);

  // ========== 5. 组合：利率变更 + 提前还款 ==========
  console.log('\n📋 5. 组合验证（利率变更 + 提前还款）...');
  const comboSchedule = generateSchedule(loanInfo, [prepayment], [rateChange]);
  const comboPeriods = comboSchedule.length;
  const comboTotalInterest = comboSchedule.reduce((s, x) => s + x.interest, 0);
  const comboPrepayPoint = comboSchedule.find(s => s.isPrepaymentPoint);
  const comboRatePoint = comboSchedule.find(s => s.isRateChangePoint);

  console.log(`  组合后期数: ${comboPeriods}, 总利息: ¥${formatMoney(comboTotalInterest)}`);

  assert('组合场景两种标记都存在', !!comboPrepayPoint && !!comboRatePoint,
    `提前还款点=${comboPrepayPoint?.date}, 利率变更点=${comboRatePoint?.date}`);
  assert('组合场景总利息 < 基准', comboTotalInterest < baseTotalInterest,
    `基准¥${formatMoney(baseTotalInterest)} → 组合¥${formatMoney(comboTotalInterest)}`);
  assert('组合场景总利息 < 仅提前还款', comboTotalInterest < prepayTotalInterest,
    `仅提前还款¥${formatMoney(prepayTotalInterest)} → 组合¥${formatMoney(comboTotalInterest)}`);

  // ========== 6. API 接口验证 ==========
  console.log('\n📋 6. API 接口验证（mock-server）...');

  // 6.1 健康检查
  const health = await apiGet('/api/health');
  assert('API 健康检查', health.ok === true, `响应=${JSON.stringify(health)}`);

  // 6.2 清空数据
  await apiPost('/api/data', { loanInfo: null, schedule: null });
  const empty = await apiGet('/api/data');
  assert('API 清空数据', empty.data === null, `data=${empty.data}`);

  // 6.3 保存数据
  const saveResp = await apiPost('/api/data', {
    loanInfo,
    schedule: baseSchedule,
    prepayments: [],
    rateChanges: [],
    meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  });
  assert('API 保存数据', saveResp.success === true, `success=${saveResp.success}`);

  // 6.4 读取验证
  const readResp = await apiGet('/api/data');
  const savedData = readResp.data;
  assert('API 读取数据', savedData && savedData.loanInfo && savedData.schedule,
    `loanInfo.totalAmount=${savedData?.loanInfo?.totalAmount}, schedule.length=${savedData?.schedule?.length}`);
  assert('API 数据一致性', savedData.schedule.length === basePeriods,
    `保存${basePeriods}期, 读取${savedData.schedule.length}期`);

  // 6.5 保存带提前还款的数据
  const savePrepayResp = await apiPost('/api/data', {
    loanInfo,
    schedule: prepaySchedule,
    prepayments: [prepayment],
    rateChanges: [],
    meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  });
  assert('API 保存提前还款数据', savePrepayResp.success === true, `success=${savePrepayResp.success}`);

  const readPrepay = await apiGet('/api/data');
  const savedPrepay = readPrepay.data;
  assert('API 提前还款数据持久化', savedPrepay.prepayments.length === 1,
    `prepayments.length=${savedPrepay.prepayments?.length}`);
  assert('API 提前还款后期数已变', savedPrepay.schedule.length < basePeriods,
    `保存${savedPrepay.schedule.length}期 < 基准${basePeriods}期`);

  // 6.6 保存带利率变更的数据
  const saveRateResp = await apiPost('/api/data', {
    loanInfo,
    schedule: rateChangedSchedule,
    prepayments: [],
    rateChanges: [rateChange],
    meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  });
  assert('API 保存利率变更数据', saveRateResp.success === true, `success=${saveRateResp.success}`);

  const readRate = await apiGet('/api/data');
  const savedRate = readRate.data;
  assert('API 利率变更数据持久化', savedRate.rateChanges.length === 1,
    `rateChanges.length=${savedRate.rateChanges?.length}`);
  assert('API 利率变更后月供已变',
    savedRate.schedule.find((s: { isRateChangePoint: boolean }) => s.isRateChangePoint)?.monthlyPayment !== baseMonthly,
    `变更点月供≠基准月供¥${formatMoney(baseMonthly)}`);

  // 6.7 清空数据（测试后清理）
  await apiPost('/api/data', { loanInfo: null, schedule: null });
  const finalCheck = await apiGet('/api/data');
  assert('API 测试后清空', finalCheck.data === null, `data=${finalCheck.data}`);

  // ========== 汇总 ==========
  console.log('\n' + '='.repeat(60));
  console.log('📊 接口验证结果汇总');
  console.log('='.repeat(60));

  let passed = 0, failed = 0;
  results.forEach((r, i) => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${i + 1}. ${r.name}`);
    if (!r.passed) console.log(`     详情: ${r.detail}`);
    if (r.passed) passed++; else failed++;
  });

  console.log('='.repeat(60));
  console.log(`总计: ${results.length} | 通过: ${passed} | 失败: ${failed}`);

  if (failed > 0) {
    console.log('\n❌ 存在失败项，请检查上方详情');
    process.exit(1);
  } else {
    console.log('\n✅ 全部验证通过：提前还款和利率调整均生效，API 数据变动正确');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('❌ 脚本执行出错:', err);
  process.exit(1);
});
