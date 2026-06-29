/**
 * 还款计划自动更新 + 邮件提醒
 *
 * 功能：
 * 1. 从 API 读取贷款数据
 * 2. 重新生成完整还款计划（含提前还款、利率变更）
 * 3. 自动标记已还款状态
 * 4. 写回 API
 * 5. 如果今天/明天是还款日，发送邮件提醒
 *
 * 环境变量：
 * - API_URL        : API 地址（默认 https://loan-tracker-api.pages.dev）
 * - WRITE_KEY      : API 写入密钥（可选）
 * - SMTP_HOST      : SMTP 服务器（默认 smtp.163.com）
 * - SMTP_PORT      : SMTP 端口（默认 465）
 * - SMTP_USER      : 发件邮箱
 * - SMTP_PASS      : 邮箱授权码
 * - SMTP_TO        : 收件邮箱
 */

const https = require('https');
const http = require('http');
const net = require('net');
const tls = require('tls');
const crypto = require('crypto');

// ============ 配置 ============

const API_URL = (process.env.API_URL || 'https://loan-tracker-api.pages.dev').replace(/\/+$/, '');
const WRITE_KEY = process.env.WRITE_KEY || '';
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.163.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_TO = process.env.SMTP_TO || '';

// ============ 工具函数 ============

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nowISO() {
  return new Date().toISOString();
}

function formatDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDateLocal(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ============ HTTP 请求 ============

function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const mod = parsedUrl.protocol === 'https:' ? https : http;
    const req = mod.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 15000,
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ============ API 读写 ============

async function fetchData() {
  const resp = await httpRequest(`${API_URL}/api/data?t=${Date.now()}`);
  if (resp.status !== 200) throw new Error(`读取数据失败: HTTP ${resp.status}`);
  const result = JSON.parse(resp.body);
  return result.data;
}

async function writeData(data) {
  const headers = { 'Content-Type': 'application/json' };
  if (WRITE_KEY) headers['X-Write-Key'] = WRITE_KEY;
  const resp = await httpRequest(`${API_URL}/api/data`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  if (resp.status !== 200) throw new Error(`写入数据失败: HTTP ${resp.status}: ${resp.body}`);
  return JSON.parse(resp.body);
}

// ============ 计算引擎（与前端 calculator.ts 一致） ============

function calcEqualInstallmentMonthly(principal, monthlyRate, months) {
  if (monthlyRate === 0) return principal / months;
  const pow = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * pow) / (pow - 1);
}

function calcRemainingMonths(principal, monthlyPayment, monthlyRate) {
  if (principal <= 0) return 0;
  if (monthlyRate === 0) return Math.ceil(principal / monthlyPayment);
  const n = Math.log(monthlyPayment / (monthlyPayment - principal * monthlyRate)) / Math.log(1 + monthlyRate);
  return Math.ceil(n);
}

function generateSchedule(loanInfo, prepayments = [], rateChanges = []) {
  const schedule = [];
  const startDate = parseDateLocal(loanInfo.startDate);
  const today = todayStr();

  let remainingPrincipal = loanInfo.totalAmount;
  let currentPeriod = 1;
  let remainingMonths = loanInfo.totalMonths;
  let currentMonthlyRate = loanInfo.annualRate / 100 / 12;

  const events = [
    ...prepayments.map(p => ({ date: parseDateLocal(p.date), type: 'prepayment', record: p })),
    ...rateChanges.map(r => ({ date: parseDateLocal(r.date), type: 'rateChange', record: r })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  let eventIndex = 0;

  if (loanInfo.repaymentType === 'equalInstallment') {
    let monthlyPayment = calcEqualInstallmentMonthly(remainingPrincipal, currentMonthlyRate, remainingMonths);

    while (remainingMonths > 0 && remainingPrincipal > 0.01) {
      const paymentDate = new Date(startDate.getFullYear(), startDate.getMonth() + currentPeriod, startDate.getDate());
      const paymentDateStr = formatDateStr(paymentDate);

      let isPrepayPoint = false;
      let isRateChangePoint = false;

      while (eventIndex < events.length && events[eventIndex].date <= paymentDate) {
        const event = events[eventIndex];
        if (event.type === 'prepayment') {
          const prepay = event.record;
          remainingPrincipal -= prepay.amount;
          isPrepayPoint = true;
          if (prepay.mode === 'shortenTerm') {
            remainingMonths = calcRemainingMonths(remainingPrincipal, monthlyPayment, currentMonthlyRate);
          } else {
            monthlyPayment = calcEqualInstallmentMonthly(remainingPrincipal, currentMonthlyRate, remainingMonths);
          }
        } else {
          const rateChange = event.record;
          currentMonthlyRate = rateChange.newRate / 100 / 12;
          isRateChangePoint = true;
          monthlyPayment = calcEqualInstallmentMonthly(remainingPrincipal, currentMonthlyRate, remainingMonths);
        }
        eventIndex++;
      }

      const interest = remainingPrincipal * currentMonthlyRate;
      let principal = monthlyPayment - interest;

      if (principal >= remainingPrincipal) {
        principal = remainingPrincipal;
      }

      remainingPrincipal -= principal;
      if (remainingPrincipal < 0) {
        principal += remainingPrincipal;
        remainingPrincipal = 0;
      }

      const paid = paymentDateStr <= today;

      schedule.push({
        period: currentPeriod,
        date: paymentDateStr,
        monthlyPayment: round2(principal + interest),
        principal: round2(principal),
        interest: round2(interest),
        remainingPrincipal: round2(remainingPrincipal),
        paid,
        isPrepaymentPoint: isPrepayPoint,
        isRateChangePoint: isRateChangePoint,
      });

      currentPeriod++;
      remainingMonths--;
    }
  } else {
    let fixedPrincipal = loanInfo.totalAmount / loanInfo.totalMonths;

    while (remainingMonths > 0 && remainingPrincipal > 0.01) {
      const paymentDate = new Date(startDate.getFullYear(), startDate.getMonth() + currentPeriod, startDate.getDate());
      const paymentDateStr = formatDateStr(paymentDate);

      let isPrepayPoint = false;
      let isRateChangePoint = false;

      while (eventIndex < events.length && events[eventIndex].date <= paymentDate) {
        const event = events[eventIndex];
        if (event.type === 'prepayment') {
          const prepay = event.record;
          remainingPrincipal -= prepay.amount;
          isPrepayPoint = true;
          if (prepay.mode === 'shortenTerm') {
            remainingMonths = Math.ceil(remainingPrincipal / fixedPrincipal);
          } else {
            fixedPrincipal = remainingPrincipal / remainingMonths;
          }
        } else {
          const rateChange = event.record;
          currentMonthlyRate = rateChange.newRate / 100 / 12;
          isRateChangePoint = true;
        }
        eventIndex++;
      }

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

      const paid = paymentDateStr <= today;

      schedule.push({
        period: currentPeriod,
        date: paymentDateStr,
        monthlyPayment: round2(principal + interest),
        principal: round2(principal),
        interest: round2(interest),
        remainingPrincipal: round2(remainingPrincipal),
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

// ============ 保留已还款状态 ============

function preservePaidStatus(oldSchedule, newSchedule) {
  const paidMap = new Map();
  if (Array.isArray(oldSchedule)) {
    oldSchedule.forEach(s => paidMap.set(s.date, s.paid));
  }
  return newSchedule.map(s => {
    const oldPaid = paidMap.get(s.date);
    if (oldPaid !== undefined) return { ...s, paid: oldPaid };
    return s;
  });
}

// ============ SMTP 邮件发送（163 邮箱） ============

function smtpSendMailOnce({ host, port, user, pass, to, subject, html }) {
  return new Promise((resolve, reject) => {
    const messageId = `<${crypto.randomUUID()}@smtp.163.com>`;
    const from = user;

    // 构建邮件内容
    const headers = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: ${messageId}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
    ].join('\r\n');

    const bodyBase64 = Buffer.from(html, 'utf-8').toString('base64');
    // 每 76 字符换行
    const bodyWrapped = bodyBase64.match(/.{1,76}/g).join('\r\n');

    const mailData = `${headers}\r\n\r\n${bodyWrapped}\r\n.`;

    console.log(`[SMTP] 连接 ${host}:${port}...`);

    // 使用 TLS 连接（端口 465）
    const socket = tls.connect({ host, port, servername: host }, () => {
      let step = 0;
      let buffer = '';

      function send(cmd) {
        socket.write(cmd + '\r\n');
      }

      function handleData(data) {
        buffer += data.toString();
        // 等待完整的响应行
        const lines = buffer.split('\r\n').filter(l => l.length > 0);
        if (lines.length === 0) return;
        const lastLine = lines[lines.length - 1];
        const code = parseInt(lastLine.substring(0, 3));

        // 多行响应（如 250-xxx）等待最后一行
        if (lastLine.length > 3 && lastLine[3] === '-') return;

        buffer = '';

        switch (step) {
          case 0: // 服务器欢迎
            if (code === 220) { step = 1; send(`EHLO ${host}`); }
            else { cleanup(); reject(new Error(`SMTP 欢迎失败: ${lastLine}`)); }
            break;
          case 1: // EHLO 响应
            if (code === 250) { step = 2; send('AUTH LOGIN'); }
            else { cleanup(); reject(new Error(`EHLO 失败: ${lastLine}`)); }
            break;
          case 2: // AUTH LOGIN
            if (code === 334) { step = 3; send(Buffer.from(user).toString('base64')); }
            else { cleanup(); reject(new Error(`AUTH LOGIN 失败: ${lastLine}`)); }
            break;
          case 3: // 用户名
            if (code === 334) { step = 4; send(Buffer.from(pass).toString('base64')); }
            else { cleanup(); reject(new Error(`用户名失败: ${lastLine}`)); }
            break;
          case 4: // 密码
            if (code === 235) { step = 5; send(`MAIL FROM:<${from}>`); }
            else { cleanup(); reject(new Error(`密码认证失败: ${lastLine}`)); }
            break;
          case 5: // MAIL FROM
            if (code === 250) { step = 6; send(`RCPT TO:<${to}>`); }
            else { cleanup(); reject(new Error(`MAIL FROM 失败: ${lastLine}`)); }
            break;
          case 6: // RCPT TO
            if (code === 250) { step = 7; send('DATA'); }
            else { cleanup(); reject(new Error(`RCPT TO 失败: ${lastLine}`)); }
            break;
          case 7: // DATA
            if (code === 354) { step = 8; send(mailData); }
            else { cleanup(); reject(new Error(`DATA 失败: ${lastLine}`)); }
            break;
          case 8: // 邮件内容发送完毕
            if (code === 250) { cleanup(); resolve({ success: true }); }
            else { cleanup(); reject(new Error(`发送失败: ${lastLine}`)); }
            break;
        }
      }

      function cleanup() {
        socket.removeAllListeners('data');
        socket.removeAllListeners('error');
        try { send('QUIT'); } catch {}
        setTimeout(() => { try { socket.destroy(); } catch {} }, 1000);
      }

      socket.on('data', handleData);
      socket.on('error', (err) => { cleanup(); reject(new Error(`SMTP 连接错误: ${err.message}`)); });
    });

    socket.on('error', (err) => reject(new Error(`SMTP 连接失败: ${err.message || err}`)));
    socket.setTimeout(30000, () => { socket.destroy(); reject(new Error('SMTP 连接超时（30秒）')); });
  });
}

// 带重试的邮件发送
async function smtpSendMail({ host, port, user, pass, to, subject, html }, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[SMTP] 第 ${attempt}/${maxRetries} 次尝试发送...`);
      await smtpSendMailOnce({ host, port, user, pass, to, subject, html });
      console.log(`[SMTP] 发送成功`);
      return { success: true };
    } catch (err) {
      const errMsg = err.message || String(err);
      console.error(`[SMTP] 第 ${attempt} 次失败: ${errMsg}`);
      if (attempt < maxRetries) {
        const delay = attempt * 5000; // 递增延迟：5s, 10s, 15s
        console.log(`[SMTP] ${delay/1000}秒后重试...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw new Error(`邮件发送失败（重试${maxRetries}次后）: ${errMsg}`);
      }
    }
  }
}

// ============ 自动扣款 ============

function processAutoDeduction(data, schedule) {
  const todayDateStr = todayStr();
  const account = data.repaymentAccount;
  if (!account) return;

  // 找到今天到期的未还款期数
  const todayPayment = schedule.find(s => s.date === todayDateStr && !s.paid);
  if (!todayPayment) {
    console.log(`今天 ${todayDateStr} 没有到期还款，跳过自动扣款`);
    return;
  }

  const paymentAmount = todayPayment.monthlyPayment;
  if (account.balance < paymentAmount) {
    console.log(`还款账户余额 ¥${account.balance.toFixed(2)} 不足，无法自动扣款 ¥${paymentAmount.toFixed(2)}`);
    return;
  }

  // 执行扣款
  const newBalance = round2(account.balance - paymentAmount);
  const transaction = {
    id: crypto.randomUUID(),
    date: todayDateStr,
    type: 'repayment',
    amount: paymentAmount,
    balanceAfter: newBalance,
    note: `第${todayPayment.period}期自动扣款`,
  };

  account.balance = newBalance;
  account.transactions = [transaction, ...(account.transactions || [])];

  console.log(`自动扣款成功：第${todayPayment.period}期 ¥${paymentAmount.toFixed(2)}，扣款后余额 ¥${newBalance.toFixed(2)}`);
}

// ============ 邮件内容生成 ============

function buildReminderEmail(schedule, loanInfo, account) {
  const today = new Date();
  const todayDateStr = todayStr();

  // 找到下一个未还款的期数
  const nextUnpaid = schedule.find(s => s.date >= todayDateStr && !s.paid);
  if (!nextUnpaid) return null;

  // 计算距离还款日还有几天
  const paymentDate = parseDateLocal(nextUnpaid.date);
  const diffDays = Math.ceil((paymentDate - today) / (1000 * 60 * 60 * 24));

  // 只在还款日前3天内（含当天）才发送邮件
  if (diffDays > 3) {
    console.log(`下次还款日 ${nextUnpaid.date} 距今 ${diffDays} 天，未到提醒时间（≤3天）`);
    return null;
  }

  const upcoming = schedule.filter(s => s.date >= todayDateStr && !s.paid).slice(0, 3);
  if (upcoming.length === 0) return null;

  const next = upcoming[0];
  const remainingPrincipal = next.remainingPrincipal;
  const paidCount = schedule.filter(s => s.paid).length;
  const progress = ((paidCount / schedule.length) * 100).toFixed(1);

  // 还款账户信息
  const accountBalance = account?.balance || 0;
  const accountSufficient = accountBalance >= next.monthlyPayment;

  let rows = upcoming.map(s => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">第${s.period}期</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${s.date}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:bold;color:#16a34a;">¥${s.monthlyPayment.toLocaleString('zh-CN', {minimumFractionDigits:2})}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">¥${s.principal.toLocaleString('zh-CN', {minimumFractionDigits:2})}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">¥${s.interest.toLocaleString('zh-CN', {minimumFractionDigits:2})}</td>
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:20px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:24px;color:white;text-align:center;">
      <div style="font-size:14px;opacity:0.8;margin-bottom:4px;">还款提醒</div>
      <div style="font-size:28px;font-weight:bold;">¥${next.monthlyPayment.toLocaleString('zh-CN', {minimumFractionDigits:2})}</div>
      <div style="font-size:13px;opacity:0.8;margin-top:4px;">还款日期：${next.date}</div>
    </div>
    <div style="padding:20px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:16px;">
        <div style="text-align:center;flex:1;">
          <div style="font-size:11px;color:#9ca3af;">剩余本金</div>
          <div style="font-size:16px;font-weight:bold;color:#1f2937;margin-top:2px;">¥${remainingPrincipal.toLocaleString('zh-CN', {minimumFractionDigits:2})}</div>
        </div>
        <div style="text-align:center;flex:1;">
          <div style="font-size:11px;color:#9ca3af;">还款进度</div>
          <div style="font-size:16px;font-weight:bold;color:#4f46e5;margin-top:2px;">${progress}%</div>
        </div>
        <div style="text-align:center;flex:1;">
          <div style="font-size:11px;color:#9ca3af;">已还/总期数</div>
          <div style="font-size:16px;font-weight:bold;color:#1f2937;margin-top:2px;">${paidCount}/${schedule.length}</div>
        </div>
      </div>
      <div style="background:linear-gradient(135deg,#10b981,#06b6d4);border-radius:12px;padding:16px;margin-bottom:16px;color:white;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:12px;opacity:0.9;">还款账户余额</div>
            <div style="font-size:22px;font-weight:bold;margin-top:2px;">¥${accountBalance.toLocaleString('zh-CN', {minimumFractionDigits:2})}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;opacity:0.9;">下期还款</div>
            <div style="font-size:14px;font-weight:bold;margin-top:2px;">¥${next.monthlyPayment.toLocaleString('zh-CN', {minimumFractionDigits:2})}</div>
            <div style="font-size:11px;margin-top:4px;padding:2px 8px;border-radius:10px;background:${accountSufficient ? 'rgba(255,255,255,0.3)' : 'rgba(239,68,68,0.5)'};">
              ${accountSufficient ? '✓ 余额充足' : '⚠ 余额不足'}
            </div>
          </div>
        </div>
      </div>
      <div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:8px;">近期还款计划</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:center;color:#6b7280;font-weight:500;">期数</th>
            <th style="padding:8px 12px;text-align:center;color:#6b7280;font-weight:500;">日期</th>
            <th style="padding:8px 12px;text-align:right;color:#6b7280;font-weight:500;">月供</th>
            <th style="padding:8px 12px;text-align:right;color:#6b7280;font-weight:500;">本金</th>
            <th style="padding:8px 12px;text-align:right;color:#6b7280;font-weight:500;">利息</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:16px;padding:12px;background:#f0f9ff;border-radius:8px;font-size:12px;color:#1e40af;">
        贷款总额：¥${loanInfo.totalAmount.toLocaleString('zh-CN', {minimumFractionDigits:2})} · ${loanInfo.totalMonths}期 · 年利率${loanInfo.annualRate}%
      </div>
    </div>
  </div>
</body>
</html>`;

  return {
    subject: `还款提醒 - ${next.date} 应还 ¥${next.monthlyPayment.toLocaleString('zh-CN', {minimumFractionDigits:2})} | 账户余额 ¥${accountBalance.toLocaleString('zh-CN', {minimumFractionDigits:2})}`,
    html,
  };
}

// ============ 主流程 ============

async function main() {
  console.log(`[${nowISO()}] 还款提醒服务启动`);
  console.log(`API: ${API_URL}`);
  console.log(`今天: ${todayStr()}`);

  // 1. 读取数据
  let data;
  try {
    data = await fetchData();
  } catch (err) {
    console.error('读取数据失败:', err.message);
    process.exit(1);
  }

  if (!data || !data.loanInfo || !Array.isArray(data.schedule)) {
    console.log('没有贷款数据，跳过');
    process.exit(0);
  }

  console.log(`贷款总额: ¥${data.loanInfo.totalAmount}, ${data.loanInfo.totalMonths}期, 利率${data.loanInfo.annualRate}%`);
  console.log(`当前 schedule 期数: ${data.schedule.length}`);

  // 2. 重新生成完整还款计划
  const newSchedule = generateSchedule(
    data.loanInfo,
    data.prepayments || [],
    data.rateChanges || []
  );

  // 3. 保留已还款状态
  const schedule = preservePaidStatus(data.schedule, newSchedule);

  console.log(`重算后 schedule 期数: ${schedule.length}`);
  const paidCount = schedule.filter(s => s.paid).length;
  console.log(`已还期数: ${paidCount}, 待还期数: ${schedule.length - paidCount}`);

  // 4. 自动扣款（如果今天有到期还款且账户余额充足）
  processAutoDeduction(data, schedule);

  // 5. 写回 API
  data.schedule = schedule;
  data.meta = data.meta || { createdAt: nowISO(), updatedAt: nowISO() };

  try {
    const result = await writeData(data);
    console.log('数据写回成功:', result);
  } catch (err) {
    console.error('写回数据失败:', err.message);
    process.exit(1);
  }

  // 6. 检查是否需要发送邮件提醒
  if (SMTP_USER && SMTP_PASS && SMTP_TO) {
    const email = buildReminderEmail(schedule, data.loanInfo, data.repaymentAccount);
    if (email) {
      console.log(`发送邮件提醒到 ${SMTP_TO}: ${email.subject}`);
      try {
        await smtpSendMail({
          host: SMTP_HOST,
          port: SMTP_PORT,
          user: SMTP_USER,
          pass: SMTP_PASS,
          to: SMTP_TO,
          subject: email.subject,
          html: email.html,
        });
        console.log('邮件发送成功');
      } catch (err) {
        console.error('邮件发送失败:', err.message);
      }
    } else {
      console.log('没有待还款项或未到提醒时间，跳过邮件提醒');
    }
  } else {
    console.log('未配置 SMTP，跳过邮件提醒');
  }

  console.log(`[${nowISO()}] 完成`);
}

main().catch(err => {
  console.error('未捕获的错误:', err);
  process.exit(1);
});
