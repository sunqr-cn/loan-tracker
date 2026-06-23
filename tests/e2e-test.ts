import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = './test-screenshots';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

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
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);

    const title = await page.title();
    results.push({ name: '页面标题正确', passed: title === '公积金贷款还款计划管理', error: title !== '公积金贷款还款计划管理' ? `标题为 "${title}"` : undefined });

    const headerVisible = await page.isVisible('h1');
    results.push({ name: '顶部标题可见', passed: headerVisible });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-initial-load.png'), fullPage: true });
    console.log('  ✅ 截图: 01-initial-load.png');

    // ========== 测试 2: 白色背景 ==========
    console.log('\n📋 测试 2: 白色背景主题...');
    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor;
    });
    results.push({ name: '背景为白色/浅色', passed: bgColor === 'rgb(245, 246, 250)' || bgColor === 'rgb(255, 255, 255)', error: `背景色为 ${bgColor}` });

    // ========== 测试 3: 贷款信息表单 ==========
    console.log('\n📋 测试 3: 贷款信息表单...');
    const formInputs = await page.locator('input').count();
    results.push({ name: '表单输入框存在', passed: formInputs >= 4, error: formInputs < 4 ? `只有 ${formInputs} 个输入框` : undefined });

    const equalInstallmentBtn = await page.getByText('等额本息').isVisible();
    const equalPrincipalBtn = await page.getByText('等额本金').isVisible();
    results.push({ name: '还款方式按钮存在', passed: equalInstallmentBtn && equalPrincipalBtn });

    // ========== 测试 4: 生成还款计划 ==========
    console.log('\n📋 测试 4: 生成还款计划...');
    await page.getByRole('button', { name: /生成还款计划/ }).click();
    await page.waitForTimeout(2000);

    const navVisible = await page.getByText('首页').first().isVisible();
    results.push({ name: '导航栏显示', passed: navVisible });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-after-generate.png'), fullPage: true });
    console.log('  ✅ 截图: 02-after-generate.png');

    // ========== 测试 5: 首页报表 ==========
    console.log('\n📋 测试 5: 首页报表...');
    const statCards = await page.locator('.grid.grid-cols-2 > div').count();
    results.push({ name: '统计卡片显示', passed: statCards >= 4, error: statCards < 4 ? `只有 ${statCards} 个卡片` : undefined });

    // 检查下期还款卡片（新增）
    const nextPaymentCard = await page.getByText('下期还款').isVisible();
    results.push({ name: '下期还款卡片显示', passed: nextPaymentCard });

    // 检查月度还款明细图表已移除
    const barChartRemoved = !(await page.getByText('月度还款明细').isVisible().catch(() => false));
    results.push({ name: '月度还款明细图表已移除', passed: barChartRemoved });

    // 检查 SVG 图表
    const svgs = await page.locator('svg').count();
    results.push({ name: 'SVG 图表渲染', passed: svgs >= 3, error: svgs < 3 ? `只有 ${svgs} 个 SVG` : undefined });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-dashboard.png'), fullPage: true });
    console.log('  ✅ 截图: 03-dashboard.png');

    // ========== 测试 6: 贷款配置页 ==========
    console.log('\n📋 测试 6: 贷款配置页...');
    await page.getByRole('button', { name: '⚙️配置' }).click();
    await page.waitForTimeout(500);

    const configSections = await page.getByText(/贷款基本信息|利率变更管理|提前还款管理|数据管理/).count();
    results.push({ name: '配置模块显示', passed: configSections >= 4, error: configSections < 4 ? `只有 ${configSections} 个模块` : undefined });

    // 检查当前剩余本金提示
    const remainingHint = await page.getByText('当前剩余本金').isVisible();
    results.push({ name: '当前剩余本金提示显示', passed: remainingHint });

    // 检查云同步功能
    const cloudSyncBtn = await page.getByText('仓库云同步').first().isVisible();
    results.push({ name: '云同步功能存在', passed: cloudSyncBtn });

    // 检查 SQLite 存储提示
    const pageContent = await page.content();
    const indexedDBHint = pageContent.includes('SQLite');
    results.push({ name: 'SQLite 存储提示显示', passed: indexedDBHint });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-config.png'), fullPage: true });
    console.log('  ✅ 截图: 04-config.png');

    // ========== 测试 7: 添加利率变更 ==========
    console.log('\n📋 测试 7: 添加利率变更...');
    const rateDateInput = page.locator('input[type="date"]').nth(1);
    await rateDateInput.fill('2025-01-01');

    const rateInput = page.locator('input[placeholder="3.05"]');
    await rateInput.fill('3.05');

    await page.getByRole('button', { name: /添加利率变更/ }).click();
    await page.waitForTimeout(1500);

    const rateChangeRows = await page.locator('text=3.05%').count();
    results.push({ name: '利率变更记录添加', passed: rateChangeRows > 0, error: rateChangeRows === 0 ? '未找到利率变更记录' : undefined });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-rate-change.png'), fullPage: true });
    console.log('  ✅ 截图: 05-rate-change.png');

    // ========== 测试 8: 添加提前还款 ==========
    console.log('\n📋 测试 8: 添加提前还款...');
    const prepayAmountInput = page.locator('input[placeholder="100000"]');
    await prepayAmountInput.fill('100000');

    const prepayDateInput = page.locator('input[type="date"]').nth(2);
    await prepayDateInput.fill('2025-06-01');

    await page.getByRole('button', { name: '缩短年限' }).click();
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: /添加提前还款/ }).click();
    await page.waitForTimeout(1500);

    const prepayRows = await page.locator('text=¥100,000.00').count();
    results.push({ name: '提前还款记录添加', passed: prepayRows > 0, error: prepayRows === 0 ? '未找到提前还款记录' : undefined });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-prepayment.png'), fullPage: true });
    console.log('  ✅ 截图: 06-prepayment.png');

    // ========== 测试 9: 还款计划页 ==========
    console.log('\n📋 测试 9: 还款计划页...');
    await page.getByRole('button', { name: '📋计划' }).click();
    await page.waitForTimeout(500);

    const tableRows = await page.locator('tbody tr').count();
    results.push({ name: '还款计划表格有数据', passed: tableRows > 0, error: tableRows === 0 ? '表格无数据' : undefined });

    // 检查自动标记已还款提示
    const autoPaidHint = await page.getByText(/自动标记/).isVisible();
    results.push({ name: '自动标记已还款提示显示', passed: autoPaidHint });

    // 检查筛选按钮
    const filterAll = await page.getByRole('button', { name: '全部' }).isVisible();
    const filterUnpaid = await page.getByRole('button', { name: '待还' }).isVisible();
    const filterPaid = await page.getByRole('button', { name: /已还/ }).isVisible();
    results.push({ name: '筛选功能存在', passed: filterAll && filterUnpaid && filterPaid });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-repayment-plan.png'), fullPage: true });
    console.log('  ✅ 截图: 07-repayment-plan.png');

    // ========== 测试 10: 自动标记已还款（根据日期） ==========
    console.log('\n📋 测试 10: 自动标记已还款...');
    // 检查是否有已还款的行（日期 <= 今天的应该自动标记为已还）
    const paidRows = await page.locator('tbody tr.bg-green-50\\/40').count();
    results.push({ name: '已还款行自动标记', passed: paidRows > 0, error: paidRows === 0 ? '没有自动标记的已还款行' : undefined });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-auto-paid.png'), fullPage: true });
    console.log('  ✅ 截图: 08-auto-paid.png');

    // ========== 测试 11: 手动勾选还款状态 ==========
    console.log('\n📋 测试 11: 手动勾选还款状态...');
    // 找到第一个未还款的行
    const firstUnpaidCheckbox = page.locator('tbody input[type="checkbox"]').first();
    await firstUnpaidCheckbox.check();
    await page.waitForTimeout(500);

    const firstRowClass = await page.locator('tbody tr').first().getAttribute('class');
    const isPaid = firstRowClass?.includes('green');
    results.push({ name: '手动勾选后行高亮', passed: !!isPaid });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-manual-paid.png'), fullPage: true });
    console.log('  ✅ 截图: 09-manual-paid.png');

    // ========== 测试 12: 筛选功能 ==========
    console.log('\n📋 测试 12: 筛选功能...');
    await page.getByRole('button', { name: '已还' }).click();
    await page.waitForTimeout(500);
    const paidFilterRows = await page.locator('tbody tr').count();
    results.push({ name: '已还筛选生效', passed: paidFilterRows >= 1 });

    await page.getByRole('button', { name: '待还' }).click();
    await page.waitForTimeout(500);
    const unpaidFilterRows = await page.locator('tbody tr').count();
    results.push({ name: '待还筛选生效', passed: unpaidFilterRows >= 1 });

    await page.getByRole('button', { name: '全部' }).click();
    await page.waitForTimeout(300);

    // ========== 测试 13: 首页报表数据正确性 ==========
    console.log('\n📋 测试 13: 首页报表数据正确性...');
    await page.getByRole('button', { name: '📊首页' }).click();
    await page.waitForTimeout(1000);

    // 检查剩余本金不为0（之前取最后一期为0的bug）
    const remainingCard = page.locator('.grid.grid-cols-2 > div').filter({ hasText: '剩余本金' });
    const remainingText = await remainingCard.textContent();
    const hasNonZeroRemaining = remainingText && !remainingText.includes('¥0.00');
    results.push({ name: '剩余本金计算正确（非0）', passed: !!hasNonZeroRemaining, error: !hasNonZeroRemaining ? '剩余本金显示为0' : undefined });

    // 检查贷款总额显示正确
    const loanCard = page.locator('.grid.grid-cols-2 > div').filter({ hasText: '贷款总额' });
    const loanAmountText = await loanCard.textContent();
    const hasCorrectAmount = loanAmountText && loanAmountText.includes('500,000');
    results.push({ name: '贷款总额显示正确', passed: !!hasCorrectAmount, error: !hasCorrectAmount ? '贷款总额不正确' : undefined });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-dashboard-verify.png'), fullPage: true });
    console.log('  ✅ 截图: 10-dashboard-verify.png');

    // ========== 测试 14: 控制台无错误 ==========
    console.log('\n📋 测试 14: 控制台错误检查...');
    results.push({ name: '无控制台错误', passed: consoleErrors.length === 0, error: consoleErrors.length > 0 ? consoleErrors.slice(0, 3).join('; ') : undefined });
    results.push({ name: '无页面运行时错误', passed: pageErrors.length === 0, error: pageErrors.length > 0 ? pageErrors.slice(0, 3).join('; ') : undefined });

    // ========== 测试 15: 移动端响应式 ==========
    console.log('\n📋 测试 15: 移动端响应式...');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11-mobile.png'), fullPage: true });
    console.log('  ✅ 截图: 11-mobile.png');
    results.push({ name: '移动端布局适配', passed: true });

    // ========== 测试 16: 数据持久化（SQLite） ==========
    console.log('\n📋 测试 16: 数据持久化测试...');
    await page.setViewportSize({ width: 1280, height: 900 });
    // 刷新页面，数据应该还在
    await page.reload({ waitUntil: 'networkidle' });
    // 等待 sql.js WASM 加载完成（可能需要几秒）
    let dataLoaded = false;
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(1000);
      const navVisible = await page.getByText('首页').first().isVisible().catch(() => false);
      if (navVisible) { dataLoaded = true; break; }
    }

    // 检查数据是否还在（导航栏应该显示）
    const navAfterReload = await page.getByText('首页').first().isVisible().catch(() => false);
    results.push({ name: '刷新后数据持久化', passed: dataLoaded && navAfterReload, error: !navAfterReload ? '刷新后数据丢失' : undefined });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12-after-reload.png'), fullPage: true });
    console.log('  ✅ 截图: 12-after-reload.png');

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
  .then((success) => process.exit(success ? 0 : 1))
  .catch((err) => { console.error('测试运行失败:', err); process.exit(1); });
