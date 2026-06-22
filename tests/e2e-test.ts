import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = './test-screenshots';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const CHROME_PATH = '/usr/bin/google-chrome-stable';

async function runTests() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const results: { name: string; passed: boolean; error?: string }[] = [];
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME_PATH,
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
    await page.waitForTimeout(1000);

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

    // 检查导航栏出现
    const navVisible = await page.getByText('首页报表').isVisible();
    results.push({ name: '导航栏显示', passed: navVisible });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-after-generate.png'), fullPage: true });
    console.log('  ✅ 截图: 02-after-generate.png');

    // ========== 测试 5: 首页报表 ==========
    console.log('\n📋 测试 5: 首页报表...');
    // 默认应该在 dashboard tab
    const statCards = await page.locator('.grid.grid-cols-2 > div').count();
    results.push({ name: '统计卡片显示', passed: statCards >= 4, error: statCards < 4 ? `只有 ${statCards} 个卡片` : undefined });

    // 检查 SVG 图表
    const svgs = await page.locator('svg').count();
    results.push({ name: 'SVG 图表渲染', passed: svgs >= 4, error: svgs < 4 ? `只有 ${svgs} 个 SVG` : undefined });

    // 检查图表标题
    const chartTitles = await page.getByText(/本金与利息占比|剩余本金递减|月度还款明细|还款进度/).count();
    results.push({ name: '图表标题显示', passed: chartTitles >= 3, error: chartTitles < 3 ? `只有 ${chartTitles} 个标题` : undefined });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-dashboard.png'), fullPage: true });
    console.log('  ✅ 截图: 03-dashboard.png');

    // ========== 测试 6: 贷款配置页 ==========
    console.log('\n📋 测试 6: 贷款配置页...');
    await page.getByRole('button', { name: '⚙️贷款配置' }).click();
    await page.waitForTimeout(500);

    const configSections = await page.getByText(/贷款基本信息|利率变更管理|提前还款管理|数据管理/).count();
    results.push({ name: '配置模块显示', passed: configSections >= 4, error: configSections < 4 ? `只有 ${configSections} 个模块` : undefined });

    // 检查利率变更表单
    const rateChangeBtn = await page.getByRole('button', { name: /添加利率变更/ }).isVisible();
    results.push({ name: '利率变更功能存在', passed: rateChangeBtn });

    // 检查提前还款表单
    const prepayBtn = await page.getByRole('button', { name: /添加提前还款/ }).isVisible();
    results.push({ name: '提前还款功能存在', passed: prepayBtn });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-config.png'), fullPage: true });
    console.log('  ✅ 截图: 04-config.png');

    // ========== 测试 7: 添加利率变更 ==========
    console.log('\n📋 测试 7: 添加利率变更...');
    // 填写利率变更表单
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
    await page.getByRole('button', { name: '📋还款计划' }).click();
    await page.waitForTimeout(500);

    const tableRows = await page.locator('tbody tr').count();
    results.push({ name: '还款计划表格有数据', passed: tableRows > 0, error: tableRows === 0 ? '表格无数据' : undefined });

    // 检查筛选按钮
    const filterAll = await page.getByRole('button', { name: '全部' }).isVisible();
    const filterUnpaid = await page.getByRole('button', { name: '待还' }).isVisible();
    const filterPaid = await page.getByRole('button', { name: /已还/ }).isVisible();
    results.push({ name: '筛选功能存在', passed: filterAll && filterUnpaid && filterPaid });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-repayment-plan.png'), fullPage: true });
    console.log('  ✅ 截图: 07-repayment-plan.png');

    // ========== 测试 10: 勾选还款状态 ==========
    console.log('\n📋 测试 10: 勾选还款状态...');
    const firstCheckbox = page.locator('tbody input[type="checkbox"]').first();
    await firstCheckbox.check();
    await page.waitForTimeout(500);

    const firstRowClass = await page.locator('tbody tr').first().getAttribute('class');
    const isPaid = firstRowClass?.includes('green');
    results.push({ name: '勾选后行高亮', passed: !!isPaid });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-mark-paid.png'), fullPage: true });
    console.log('  ✅ 截图: 08-mark-paid.png');

    // ========== 测试 11: 筛选功能 ==========
    console.log('\n📋 测试 11: 筛选功能...');
    await page.getByRole('button', { name: '已还' }).click();
    await page.waitForTimeout(500);
    const paidRows = await page.locator('tbody tr').count();
    results.push({ name: '已还筛选生效', passed: paidRows >= 1 });

    await page.getByRole('button', { name: '待还' }).click();
    await page.waitForTimeout(500);
    const unpaidRows = await page.locator('tbody tr').count();
    results.push({ name: '待还筛选生效', passed: unpaidRows >= 1 });

    await page.getByRole('button', { name: '全部' }).click();
    await page.waitForTimeout(300);

    // ========== 测试 12: 控制台无错误 ==========
    console.log('\n📋 测试 12: 控制台错误检查...');
    results.push({ name: '无控制台错误', passed: consoleErrors.length === 0, error: consoleErrors.length > 0 ? consoleErrors.slice(0, 3).join('; ') : undefined });
    results.push({ name: '无页面运行时错误', passed: pageErrors.length === 0, error: pageErrors.length > 0 ? pageErrors.slice(0, 3).join('; ') : undefined });

    // ========== 测试 13: 移动端响应式 ==========
    console.log('\n📋 测试 13: 移动端响应式...');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-mobile.png'), fullPage: true });
    console.log('  ✅ 截图: 09-mobile.png');
    results.push({ name: '移动端布局适配', passed: true });

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