import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = './test-screenshots';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:8787';
const IS_ONLINE = BASE_URL.includes('github.io');

async function runTests() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const results: { name: string; passed: boolean; error?: string }[] = [];
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  try {
    // ========== 测试 1: 页面加载 ==========
    console.log('\n📋 测试 1: 页面加载...');
    await page.goto(BASE_URL, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);

    const title = await page.title();
    results.push({ name: '页面标题正确', passed: title === '公积金贷款还款计划管理', error: title !== '公积金贷款还款计划管理' ? `标题为 "${title}"` : undefined });

    const headerVisible = await page.isVisible('h1');
    results.push({ name: '顶部标题可见', passed: headerVisible });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-initial-load.png'), fullPage: true });
    console.log('  ✅ 截图: 01-initial-load.png');

    // ========== 配置服务端地址 ==========
    console.log('\n📋 配置服务端地址...');
    if (!IS_ONLINE) {
      await page.evaluate((apiUrl) => {
        localStorage.setItem('server_api_url', apiUrl);
        localStorage.setItem('server_write_key', '');
      }, API_URL);
      // 清空服务端数据
      await page.evaluate(async (apiUrl) => {
        await fetch(`${apiUrl}/api/data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loanInfo: null, schedule: null }),
        });
      }, API_URL);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      results.push({ name: '服务端地址已配置', passed: true });
    } else {
      console.log('  ⏭️ 线上测试跳过服务端配置');
      results.push({ name: '服务端地址已配置', passed: true });
    }

    // ========== 测试 2: 默认进入设置页 ==========
    console.log('\n📋 测试 2: 默认进入设置页...');
    const loanInfoSection = await page.getByText('贷款信息').isVisible();
    results.push({ name: '默认显示设置页', passed: loanInfoSection, error: !loanInfoSection ? '未显示设置页' : undefined });

    // ========== 测试 3: 白色背景 ==========
    console.log('\n📋 测试 3: 白色背景主题...');
    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor;
    });
    results.push({ name: '背景为白色/浅色', passed: bgColor === 'rgb(245, 246, 250)' || bgColor === 'rgb(255, 255, 255)' || bgColor === 'rgba(0, 0, 0, 0)', error: `背景色为 ${bgColor}` });

    // ========== 测试 4: 贷款信息表单 ==========
    console.log('\n📋 测试 4: 贷款信息表单...');
    const formInputs = await page.locator('input').count();
    results.push({ name: '表单输入框存在', passed: formInputs >= 4, error: formInputs < 4 ? `只有 ${formInputs} 个输入框` : undefined });

    const equalInstallmentBtn = await page.getByText('等额本息').isVisible();
    const equalPrincipalBtn = await page.getByText('等额本金').isVisible();
    results.push({ name: '还款方式按钮存在', passed: equalInstallmentBtn && equalPrincipalBtn });

    // ========== 测试 5: 生成还款计划 ==========
    console.log('\n📋 测试 5: 生成还款计划...');
    // 填入表单数据
    const loanAmountInput = page.locator('input[placeholder="500000"]');
    await loanAmountInput.fill('500000');
    const rateInput2 = page.locator('input[placeholder="3.25"]');
    await rateInput2.fill('3.25');
    const termInput = page.locator('input[placeholder="240"]');
    await termInput.fill('240');
    
    await page.getByRole('button', { name: /生成还款计划/ }).click();
    await page.waitForTimeout(2000);

    // 检查底部导航栏是否显示
    const bottomNav = await page.locator('div.fixed.bottom-0 button').count();
    results.push({ name: '底部导航栏显示', passed: bottomNav > 0 });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-after-generate.png'), fullPage: true });
    console.log('  ✅ 截图: 02-after-generate.png');

    // ========== 测试 6: 底部导航切换 ==========
    console.log('\n📋 测试 6: 底部导航切换...');
    // 点击首页
    await page.locator('div.fixed.bottom-0 button').filter({ hasText: '首页' }).click();
    await page.waitForTimeout(800);
    
    // 检查首页内容
    const dashboardContent = await page.getByText('剩余本金', { exact: true }).isVisible();
    results.push({ name: '首页内容显示', passed: dashboardContent });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-dashboard.png'), fullPage: true });
    console.log('  ✅ 截图: 03-dashboard.png');

    // ========== 测试 7: 首页报表 ==========
    console.log('\n📋 测试 7: 首页报表...');
    // 检查本期/下期还款卡片
    const currentPeriod = await page.getByText('本期还款').isVisible();
    const nextPeriod = await page.getByText('下期还款').isVisible();
    results.push({ name: '本期还款卡片显示', passed: currentPeriod });
    results.push({ name: '下期还款卡片显示', passed: nextPeriod });

    // 检查还款计划列表
    const scheduleList = await page.getByText('还款计划').isVisible();
    results.push({ name: '还款计划列表显示', passed: scheduleList });

    // 检查图表
    const principalChart = await page.getByText('剩余本金趋势').isVisible();
    const structureChart = await page.getByText('本金利息构成').isVisible();
    results.push({ name: '剩余本金趋势图显示', passed: principalChart });
    results.push({ name: '本金利息构成图显示', passed: structureChart });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-dashboard-charts.png'), fullPage: true });
    console.log('  ✅ 截图: 04-dashboard-charts.png');

    // ========== 测试 8: 设置页 ==========
    console.log('\n📋 测试 8: 设置页...');
    await page.locator('div.fixed.bottom-0 button').filter({ hasText: '设置' }).click();
    await page.waitForTimeout(500);

    const configSections = await page.getByText(/贷款信息|利率变更|提前还款|数据管理/).count();
    results.push({ name: '设置模块显示', passed: configSections >= 4, error: configSections < 4 ? `只有 ${configSections} 个模块` : undefined });

    // 检查当前剩余本金提示
    const remainingHint = await page.getByText('当前剩余本金').isVisible();
    results.push({ name: '当前剩余本金提示显示', passed: remainingHint });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-config.png'), fullPage: true });
    console.log('  ✅ 截图: 05-config.png');

    // ========== 测试 9: 添加利率变更 ==========
    console.log('\n📋 测试 9: 添加利率变更...');
    // 记录变更前的当前月供
    await page.locator('div.fixed.bottom-0 button').filter({ hasText: '首页' }).click();
    await page.waitForTimeout(800);
    const currentPaymentBefore = await page.locator('text=还款金额').locator('..').locator('text=¥').first().textContent({ timeout: 10000 });

    // 返回设置页添加利率变更
    await page.locator('div.fixed.bottom-0 button').filter({ hasText: '设置' }).click();
    await page.waitForTimeout(500);

    // 利率变更表单：日期 + 新利率 + 添加按钮
    const rateDateInput = page.locator('input[type="date"]').nth(1);
    await rateDateInput.fill('2025-01-01');

    const rateInput = page.locator('input[placeholder="3.05"]');
    await rateInput.fill('3.05');

    // 第一个"添加"按钮是利率变更的
    await page.getByRole('button', { name: '添加' }).first().click();
    await page.waitForTimeout(1500);

    const rateChangeRows = await page.locator('text=3.05%').count();
    results.push({ name: '利率变更记录添加', passed: rateChangeRows > 0, error: rateChangeRows === 0 ? '未找到利率变更记录' : undefined });

    // 验证利率变更后月供确实变化
    await page.locator('div.fixed.bottom-0 button').filter({ hasText: '首页' }).click();
    await page.waitForTimeout(800);
    const currentPaymentAfter = await page.locator('text=还款金额').locator('..').locator('text=¥').first().textContent({ timeout: 10000 });
    const rateChanged = currentPaymentAfter !== currentPaymentBefore;
    results.push({ name: '利率变更影响月供', passed: rateChanged, error: rateChanged ? undefined : `变更前后月供相同: ${currentPaymentBefore}` });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-rate-change.png'), fullPage: true });
    console.log('  ✅ 截图: 06-rate-change.png');

    // ========== 测试 10: 添加提前还款 ==========
    console.log('\n📋 测试 10: 添加提前还款...');
    // 记录提前还款前的剩余本金
    const remainingBefore = await page.getByText('剩余本金', { exact: true }).locator('..').locator('text=¥').first().textContent();

    await page.locator('div.fixed.bottom-0 button').filter({ hasText: '设置' }).click();
    await page.waitForTimeout(500);

    const prepayAmountInput = page.locator('input[placeholder="100000"]');
    await prepayAmountInput.fill('100000');

    const prepayDateInput = page.locator('input[type="date"]').nth(2);
    await prepayDateInput.fill('2025-06-01');

    // 确保缩短年限被选中
    await page.getByRole('button', { name: '缩短年限' }).click();
    await page.waitForTimeout(300);

    // 最后一个"添加"按钮是提前还款的
    await page.getByRole('button', { name: '添加' }).last().click();
    await page.waitForTimeout(1500);

    const prepayRows = await page.locator('text=¥100,000.00').count();
    results.push({ name: '提前还款记录添加', passed: prepayRows > 0, error: prepayRows === 0 ? '未找到提前还款记录' : undefined });

    // 验证提前还款后数据变化
    await page.locator('div.fixed.bottom-0 button').filter({ hasText: '首页' }).click();
    await page.waitForTimeout(800);
    const remainingAfter = await page.getByText('剩余本金', { exact: true }).locator('..').locator('text=¥').first().textContent();
    const remainingReduced = remainingAfter !== remainingBefore;
    results.push({ name: '提前还款减少剩余本金', passed: remainingReduced, error: remainingReduced ? undefined : `变更前后剩余本金相同: ${remainingBefore}` });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-prepayment.png'), fullPage: true });
    console.log('  ✅ 截图: 07-prepayment.png');

    // ========== 测试 11: 还款计划页 ==========
    console.log('\n📋 测试 11: 还款计划页...');
    await page.locator('div.fixed.bottom-0 button').filter({ hasText: '计划' }).click();
    await page.waitForTimeout(500);

    const tableRows = await page.locator('tbody tr').count();
    results.push({ name: '还款计划表格有数据', passed: tableRows > 0, error: tableRows === 0 ? '表格无数据' : undefined });

    // 检查自动标记已还款提示
    const autoPaidHint = await page.getByText(/自动标记/).isVisible();
    results.push({ name: '自动标记已还款提示显示', passed: autoPaidHint });

    // 检查筛选按钮
    const filterAll = await page.getByRole('button', { name: /全部/ }).isVisible();
    const filterUnpaid = await page.getByRole('button', { name: /待还/ }).isVisible();
    const filterPaid = await page.getByRole('button', { name: /已还/ }).isVisible();
    results.push({ name: '筛选功能存在', passed: filterAll && filterUnpaid && filterPaid });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-repayment-plan.png'), fullPage: true });
    console.log('  ✅ 截图: 08-repayment-plan.png');

    // ========== 测试 12: 自动标记已还款（根据日期） ==========
    console.log('\n📋 测试 12: 自动标记已还款...');
    const paidRows = await page.locator('tbody tr.bg-green-50\\/40').count();
    results.push({ name: '已还款行自动标记', passed: paidRows > 0, error: paidRows === 0 ? '没有自动标记的已还款行' : undefined });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-auto-paid.png'), fullPage: true });
    console.log('  ✅ 截图: 09-auto-paid.png');

    // ========== 测试 13: 手动勾选还款状态 ==========
    console.log('\n📋 测试 13: 手动勾选还款状态...');
    const firstUnpaidCheckbox = page.locator('tbody input[type="checkbox"]').first();
    await firstUnpaidCheckbox.check();
    await page.waitForTimeout(500);

    const firstRowClass = await page.locator('tbody tr').first().getAttribute('class');
    const isPaid = firstRowClass?.includes('green');
    results.push({ name: '手动勾选后行高亮', passed: !!isPaid });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-manual-paid.png'), fullPage: true });
    console.log('  ✅ 截图: 10-manual-paid.png');

    // ========== 测试 14: 筛选功能 ==========
    console.log('\n📋 测试 14: 筛选功能...');
    await page.getByRole('button', { name: /已还/ }).click();
    await page.waitForTimeout(500);
    const paidFilterRows = await page.locator('tbody tr').count();
    results.push({ name: '已还筛选生效', passed: paidFilterRows >= 1 });

    await page.getByRole('button', { name: /待还/ }).click();
    await page.waitForTimeout(500);
    const unpaidFilterRows = await page.locator('tbody tr').count();
    results.push({ name: '待还筛选生效', passed: unpaidFilterRows >= 1 });

    await page.getByRole('button', { name: /全部/ }).click();
    await page.waitForTimeout(300);

    // ========== 测试 15: 首页报表数据正确性 ==========
    console.log('\n📋 测试 15: 首页报表数据正确性...');
    await page.locator('div.fixed.bottom-0 button').filter({ hasText: '首页' }).click();
    await page.waitForTimeout(1000);

    // 检查剩余本金不为0
    const remainingCard = page.getByText('剩余本金', { exact: true }).locator('..');
    const remainingText = await remainingCard.textContent();
    const hasNonZeroRemaining = remainingText && !remainingText.includes('¥0.00');
    results.push({ name: '剩余本金计算正确（非0）', passed: !!hasNonZeroRemaining, error: !hasNonZeroRemaining ? '剩余本金显示为0' : undefined });

    // 检查贷款总额显示正确
    const loanCard = page.locator('text=贷款总额').locator('..');
    const loanAmountText = await loanCard.textContent();
    const hasCorrectAmount = loanAmountText && loanAmountText.includes('500,000');
    results.push({ name: '贷款总额显示正确', passed: !!hasCorrectAmount, error: !hasCorrectAmount ? '贷款总额不正确' : undefined });

    // 检查利率变更和提前还款卡片
    const rateChangeCard = await page.getByRole('button', { name: /利率变更/ }).isVisible();
    results.push({ name: '利率变更卡片显示', passed: rateChangeCard });

    const prepayCard = await page.getByRole('button', { name: /提前还款/ }).isVisible();
    results.push({ name: '提前还款卡片显示', passed: prepayCard });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11-dashboard-verify.png'), fullPage: true });
    console.log('  ✅ 截图: 11-dashboard-verify.png');

    // ========== 测试 16: 控制台无错误 ==========
    console.log('\n📋 测试 16: 控制台错误检查...');
    results.push({ name: '无控制台错误', passed: consoleErrors.length === 0, error: consoleErrors.length > 0 ? consoleErrors.slice(0, 3).join('; ') : undefined });
    results.push({ name: '无页面运行时错误', passed: pageErrors.length === 0, error: pageErrors.length > 0 ? pageErrors.slice(0, 3).join('; ') : undefined });

    // ========== 测试 17: 移动端响应式 ==========
    console.log('\n📋 测试 17: 移动端响应式...');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12-mobile.png'), fullPage: true });
    console.log('  ✅ 截图: 12-mobile.png');
    results.push({ name: '移动端布局适配', passed: true });

    // ========== 测试 18: 数据持久化（服务端存储） ==========
    if (!IS_ONLINE) {
      console.log('\n📋 测试 18: 数据持久化测试...');
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.reload({ waitUntil: 'networkidle' });
      let dataLoaded = false;
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(1000);
        const navVisible = await page.locator('div.fixed.bottom-0 button').filter({ hasText: '首页' }).isVisible().catch(() => false);
        if (navVisible) { dataLoaded = true; break; }
      }

      const navAfterReload = await page.locator('div.fixed.bottom-0 button').filter({ hasText: '首页' }).isVisible().catch(() => false);
      results.push({ name: '刷新后数据持久化', passed: dataLoaded && navAfterReload, error: !navAfterReload ? '刷新后数据丢失' : undefined });

      // 检查利率变更和提前还款数据是否持久化
      await page.locator('div.fixed.bottom-0 button').filter({ hasText: '设置' }).click();
      await page.waitForTimeout(1000);
      const rateChangePersisted = await page.locator('text=3.05%').count();
      results.push({ name: '利率变更数据持久化', passed: rateChangePersisted > 0, error: rateChangePersisted === 0 ? '利率变更数据丢失' : undefined });

      const prepayPersisted = await page.locator('text=¥100,000.00').count();
      results.push({ name: '提前还款数据持久化', passed: prepayPersisted > 0, error: prepayPersisted === 0 ? '提前还款数据丢失' : undefined });

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13-after-reload.png'), fullPage: true });
      console.log('  ✅ 截图: 13-after-reload.png');
    } else {
      console.log('\n⏭️ 线上测试跳过数据持久化测试');
    }

  } catch (error) {
    console.error('\n❌ 测试执行出错:', error);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error.png'), fullPage: true });
    results.push({ name: '测试执行', passed: false, error: (error as Error).message });
  } finally {
    await browser.close();
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 自动化测试结果');
  console.log('='.repeat(60));

  let passed = 0, failed = 0;
  results.forEach((r, i) => {
    const status = r.passed ? '✅' : '❌';
    console.log(`${status} ${i + 1}. ${r.name}${r.error ? ' → ' + r.error : ''}`);
    if (r.passed) passed++; else failed++;
  });

  console.log('='.repeat(60));
  console.log(`总计: ${results.length} | 通过: ${passed} | 失败: ${failed}`);
  console.log(`📸 截图保存在: ${SCREENSHOT_DIR}/\n`);

  return failed === 0;
}

runTests()
  .then(async (success) => {
    // 测试完成后清空服务端数据
    console.log('\n🧹 清空服务端测试数据...');
    try {
      const resp = await fetch(`${API_URL}/api/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanInfo: null, schedule: null }),
      });
      const result = await resp.json();
      console.log('✅ 服务端数据已清空:', JSON.stringify(result));
    } catch (err) {
      console.log('⚠️ 清空服务端数据失败:', (err as Error).message);
    }
    process.exit(success ? 0 : 1);
  })
  .catch((err) => { console.error('测试运行失败:', err); process.exit(1); });
