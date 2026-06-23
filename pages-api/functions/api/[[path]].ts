/**
 * 公积金贷款还款计划管理 - Cloudflare Pages Functions 后端
 *
 * 职责：
 * 1. 提供 REST API 读写 D1 中存储的贷款数据（id=1 单行表，所有用户共享）
 * 2. /api/recalc 可被外部 cron 服务（如 cron-job.org）每天调用，自动重算还款状态
 *
 * 绑定：
 * - env.DB        : D1 数据库
 * - env.WRITE_KEY : 可选写入密钥（设置后写入/重算需校验 X-Write-Key）
 */

interface LoanInfo {
  totalAmount: number;
  annualRate: number;
  totalMonths: number;
  repaymentType: 'equalInstallment' | 'equalPrincipal';
  startDate: string;
}

interface ScheduleItem {
  period: number;
  date: string;
  monthlyPayment: number;
  principal: number;
  interest: number;
  remainingPrincipal: number;
  paid: boolean;
  isPrepaymentPoint: boolean;
  isRateChangePoint: boolean;
}

interface LoanData {
  loanInfo: LoanInfo;
  schedule: ScheduleItem[];
  prepayments: unknown[];
  rateChanges: unknown[];
  meta: {
    createdAt: string;
    updatedAt: string;
  };
}

interface LoanDataRow {
  id: number;
  data: string;
  updated_at: string;
}

interface Env {
  DB: D1Database;
  WRITE_KEY?: string;
}

function nowISO(): string {
  return new Date().toISOString();
}

function todayUTCStr(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Write-Key',
    },
  });
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ success: false, error: message }, status);
}

function checkWriteKey(request: Request, env: Env): Response | null {
  if (env.WRITE_KEY) {
    const provided = request.headers.get('X-Write-Key');
    if (provided !== env.WRITE_KEY) {
      return errorResponse('未授权：X-Write-Key 缺失或不正确', 401);
    }
  }
  return null;
}

async function readLoanData(env: Env): Promise<{ data: LoanData | null; updatedAt: string | null }> {
  const row = await env.DB.prepare('SELECT data, updated_at FROM loan_data WHERE id = 1').first<LoanDataRow>();
  if (!row) {
    return { data: null, updatedAt: null };
  }
  try {
    const parsed = JSON.parse(row.data) as LoanData;
    return { data: parsed, updatedAt: row.updated_at };
  } catch {
    return { data: null, updatedAt: row.updated_at };
  }
}

async function writeLoanData(env: Env, data: LoanData): Promise<string> {
  const updatedAt = nowISO();
  data.meta = { ...data.meta, updatedAt };
  const json = JSON.stringify(data);
  await env.DB.prepare(
    'INSERT OR REPLACE INTO loan_data (id, data, updated_at) VALUES (1, ?, ?)',
  )
    .bind(json, updatedAt)
    .run();
  return updatedAt;
}

function recalcSchedule(data: LoanData, todayStr: string): number {
  let updated = 0;
  if (!Array.isArray(data.schedule)) {
    return 0;
  }
  for (const item of data.schedule) {
    const due = item.date <= todayStr;
    const oldPaid = item.paid === true;
    let newPaid: boolean;
    if (due) {
      newPaid = true;
    } else {
      newPaid = oldPaid;
    }
    if (newPaid !== oldPaid) {
      updated++;
    }
    item.paid = newPaid;
  }
  return updated;
}

async function doRecalc(env: Env): Promise<{ updated: number; updatedAt: string }> {
  const { data } = await readLoanData(env);
  if (!data) {
    return { updated: 0, updatedAt: nowISO() };
  }
  const todayStr = todayUTCStr();
  const updated = recalcSchedule(data, todayStr);
  const updatedAt = await writeLoanData(env, data);
  return { updated, updatedAt };
}

async function handleHealth(): Promise<Response> {
  return jsonResponse({ ok: true, time: nowISO() });
}

async function handleGetData(env: Env): Promise<Response> {
  const { data, updatedAt } = await readLoanData(env);
  return jsonResponse({ data, updatedAt });
}

async function handlePostData(request: Request, env: Env): Promise<Response> {
  const authError = checkWriteKey(request, env);
  if (authError) return authError;

  let body: LoanData;
  try {
    body = (await request.json()) as LoanData;
  } catch {
    return errorResponse('请求体不是合法的 JSON', 400);
  }

  if (!body || typeof body !== 'object' || !body.loanInfo || !Array.isArray(body.schedule)) {
    return errorResponse('数据结构不合法：缺少 loanInfo 或 schedule', 400);
  }

  const updatedAt = await writeLoanData(env, body);
  return jsonResponse({ success: true, updatedAt });
}

async function handleRecalc(request: Request, env: Env): Promise<Response> {
  const authError = checkWriteKey(request, env);
  if (authError) return authError;

  const { updated, updatedAt } = await doRecalc(env);
  return jsonResponse({ success: true, updated, updatedAt });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Write-Key',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  try {
    if (pathname === '/api/health' && method === 'GET') {
      return await handleHealth();
    }
    if (pathname === '/api/data' && method === 'GET') {
      return await handleGetData(env);
    }
    if (pathname === '/api/data' && method === 'POST') {
      return await handlePostData(request, env);
    }
    if (pathname === '/api/recalc' && method === 'POST') {
      return await handleRecalc(request, env);
    }

    return errorResponse(`未找到路由: ${method} ${pathname}`, 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部服务器错误';
    return errorResponse(message, 500);
  }
};
