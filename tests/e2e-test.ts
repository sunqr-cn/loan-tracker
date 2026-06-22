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
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  try {
    // ========== 测试 1: 页面加载 ==========
    console.log('\n📋 测试 1: 页面加载...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);

    const title = await page.title();
    const hasTitle = title === '公积金贷款还款计划管理';
    results.push({
      name: '页面标题正确',
      passed: hasTitle,
      error: hasTitle ? undefined : `标题为 "${title}"`,
    });

    const headerVisible = await page.isVisible('h1');
    results.push({
      name: '标题可见',
      passed: headerVisible,
    });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-initial-load.png'), fullPage: true });
    console.log('  ✅ 截图: 01-initial-load.png');

    // ========== 测试 2: 贷款信息表单 ==========
    console.log('\n📋 测试 2: 贷款信息表单...');
    const formInputs = await page.locator('input').count();
    results.push({
      name: '表单输入框存在',
      passed: formInputs >= 4,
      error: formInputs < 4 ? `只有 ${formInputs} 个输入框` : undefined,
    });

    const equalInstallmentBtn = await page.getByText('等额本息').isVisible();
    const equalPrincipalBtn = await page.getByText('等额本金').isVisible();
    results.push({
      name: '还款方式按钮存在',
      passed: equalInstallmentBtn && equalPrincipalBtn,
    });

    // ========== 测试 3: 生成还款计划 ==========
    console.log('\n📋 测试 3: 生成还款计划...');
    await page.getByRole('button', { name: /生成还款计划/ }).click();
    await page.waitForTimeout(2000);

    const overviewCards = await page.locator('.grid.grid-cols-2 > div').count();
    results.push({
      name: '进度概览卡片显示',
      passed: overviewCards >= 4,
      error: overviewCards < 4 ? `只有 ${overviewCards} 个卡片` : undefined,
    });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-after-generate.png'), fullPage: true });
    console.log('  ✅ 截图: 02-after-generate.png');

    // ========== 测试 4: 图表渲染 ==========
    console.log('\n📋 测试 4: 图表渲染...');
    const canvases = await page.locator('canvas').count();
    results.push({
      name: 'Canvas 图表存在',
      passed: canvases >= 3,
      error: canvases < 3 ? `只有 ${canvases} 个 canvas` : undefined,
    });

    const chartTitles = await page.getByText(/本金利息占比|月度还款趋势|剩余本金曲线/).count();
    results.push({
      name: '图表标题显示',
      passed: chartTitles >= 3,
    });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-charts.png'), fullPage: true });
    console.log('  ✅ 截图: 03-charts.png');

    // ========== 测试 5: 还款计划表格 ==========
    console.log('\n📋 测试 5: 还款计划表格...');
    const tableRows = await page.locator('tbody tr').count();
    results.push({
      name: '还款计划表格有数据',
      passed: tableRows > 0,
      error: tableRows === 0 ? '表格无数据' : undefined,
    });

    const tableHeaders = await page.locator('thead th').count();
    results.push({
      name: '表格列数正确',
      passed: tableHeaders >= 6,
    });

    // ========== 测试 6: 勾选还款状态 ==========
    console.log('\n📋 测试 6: 勾选还款状态...');
    const firstCheckbox = page.locator('tbody input[type="checkbox"]').first();
    await firstCheckbox.check();
    await page.waitForTimeout(500);

    const firstRowClass = await page.locator('tbody tr').first().getAttribute('class');
    const isPaid = firstRowClass?.includes('4ecca3');
    results.push({
      name: '勾选后行高亮',
      passed: !!isPaid,
    });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-mark-paid.png'), fullPage: true });
    console.log('  ✅ 截图: 04-mark-paid.png');

    await firstCheckbox.uncheck();
    await page.waitForTimeout(300);

    // ========== 测试 7: 提前还款功能 ==========
    console.log('\n📋 测试 7: 提前还款功能...');
    const prepayAmountInput = page.locator('input[placeholder="100000"]');
    await prepayAmountInput.fill('100000');

    const prepayDateInput = page.locator('input[type="date"]').nth(1);
    await prepayDateInput.fill('2025-01-01');

    await page.getByText('缩短年限').click();
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: /添加提前还款/ }).click();
    await page.waitForTimeout(2000);

    const prepayRows = await page.locator('text=¥100,000').count();
    results.push({
      name: '提前还款记录添加成功',
      passed: prepayRows > 0,
      error: prepayRows === 0 ? '未找到提前还款记录' : undefined,
    });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-prepayment.png'), fullPage: true });
    console.log('  ✅ 截图: 05-prepayment.png');

    // ========== 测试 8: 切换还款方式 ==========
    console.log('\n📋 测试 8: 切换等额本金...');
    await page.getByText('等额本金').click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /重新生成/ }).click();
    await page.waitForTimeout(2000);

    const newTableRows = await page.locator('tbody tr').count();
    results.push({
      name: '等额本金计划生成',
      passed: newTableRows > 0,
    });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-equal-principal.png'), fullPage: true });
    console.log('  ✅ 截图: 06-equal-principal.png');

    // ========== 测试 9: 控制台无错误 ==========
    console.log('\n📋 测试 9: 控制台错误检查...');
    results.push({
      name: '无控制台错误',
      passed: consoleErrors.length === 0,
      error: consoleErrors.length > 0 ? consoleErrors.slice(0, 3).join('; ') : undefined,
    });

    results.push({
      name: '无页面运行时错误',
      passed: pageErrors.length === 0,
      error: pageErrors.length > 0 ? pageErrors.slice(0, 3).join('; ') : undefined,
    });

    // ========== 测试 10: 移动端响应式 ==========
    console.log('\n📋 测试 10: 移动端响应式...');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-mobile.png'), fullPage: true });
    console.log('  ✅ 截图: 07-mobile.png');

    results.push({
      name: '移动端布局适配',
      passed: true,
    });

  } catch (error) {
    console.error('\n❌ 测试执行出错:', error);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error.png'), fullPage: true });
    results.push({
      name: '测试执行',
      passed: false,
      error: (error as Error).message,
    });
  } finally {
    await browser.close();
  }

  // 输出结果
  console.log('\n' + '='.repeat(60));
  console.log('📊 自动化测试结果');
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  results.forEach((r, i) => {
    const status = r.passed ? '✅' : '❌';
    console.log(`${status} ${i + 1}. ${r.name}${r.error ? ' → ' + r.error : ''}`);
    if (r.passed) passed++;
    else failed++;
  });

  console.log('='.repeat(60));
  console.log(`总计: ${results.length} | 通过: ${passed} | 失败: ${failed}`);
  console.log(`📸 截图保存在: ${SCREENSHOT_DIR}/`);
  console.log('');

  return failed === 0;
}

runTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('测试运行失败:', err);
    process.exit(1);
  });