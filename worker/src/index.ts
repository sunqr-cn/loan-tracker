/**
 * 公积金贷款还款计划管理 - Cloudflare Worker 后端
 *
 * 职责：
 * 1. 提供 REST API 读写 D1 中存储的贷款数据（id=1 单行表，所有用户共享）
 * 2. 通过 scheduled（cron）每天自动重算还款状态
 *
 * 绑定：
 * - env.DB        : D1 数据库
 * - env.WRITE_KEY : 可选写入密钥（设置后写入需校验 X-Write-Key）
 */

// ============ 类型定义 ============

interface LoanInfo {
  totalAmount: number;
  annualRate: number;
  totalMonths: number;
  repaymentType: 'equalInstallment' | 'equalPrincipal';
  startDate: string;
}

interface ScheduleItem {
  period: number;
  date: string; // YYYY-MM-DD
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

// D1 中的行结构
interface LoanDataRow {
  id: number;
  data: string;
  updated_at: string;
}

// Worker 环境变量
interface Env {
  DB: D1Database;
  WRITE_KEY?: string;
}

// ============ 工具函数 ============

/** 返回当前 UTC 时间的 ISO 字符串 */
function nowISO(): string {
  return new Date().toISOString();
}

/**
 * 用 UTC 日期构造 YYYY-MM-DD 字符串，避免时区问题
 * 例如：2024-06-01
 */
function todayUTCStr(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 构造 JSON 响应，统一附加 CORS 头 */
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

/** 构造错误响应 */
function errorResponse(message: string, status: number): Response {
  return jsonResponse({ success: false, error: message }, status);
}

/** 校验写入密钥；若环境变量 WRITE_KEY 未设置则放行 */
function checkWriteKey(request: Request, env: Env): Response | null {
  if (env.WRITE_KEY) {
    const provided = request.headers.get('X-Write-Key');
    if (provided !== env.WRITE_KEY) {
      return errorResponse('未授权：X-Write-Key 缺失或不正确', 401);
    }
  }
  return null;
}

// ============ 数据访问层 ============

/** 从 D1 读取 id=1 的记录 */
async function readLoanData(env: Env): Promise<{ data: LoanData | null; updatedAt: string | null }> {
  const row = await env.DB.prepare('SELECT data, updated_at FROM loan_data WHERE id = 1').first<LoanDataRow>();
  if (!row) {
    return { data: null, updatedAt: null };
  }
  try {
    const parsed = JSON.parse(row.data) as LoanData;
    return { data: parsed, updatedAt: row.updated_at };
  } catch {
    // 数据损坏时返回 null，避免整体崩溃
    return { data: null, updatedAt: row.updated_at };
  }
}

/** 写入（覆盖）id=1 的记录 */
async function writeLoanData(env: Env, data: LoanData): Promise<string> {
  const updatedAt = nowISO();
  // 同步更新 meta.updatedAt
  data.meta = { ...data.meta, updatedAt };
  const json = JSON.stringify(data);
  await env.DB.prepare(
    'INSERT OR REPLACE INTO loan_data (id, data, updated_at) VALUES (1, ?, ?)',
  )
    .bind(json, updatedAt)
    .run();
  return updatedAt;
}

// ============ 核心业务：重算还款状态 ============

/**
 * 重算 schedule 中每项的 paid 字段：
 * - 日期 <= 今天：paid = true（按期已到，自动标记已还）
 * - 日期 > 今天：保留用户提前手动标记的 paid=true，否则 false
 *
 * @returns 重算后发生变化的条数
 */
function recalcSchedule(data: LoanData, todayStr: string): number {
  let updated = 0;
  if (!Array.isArray(data.schedule)) {
    return 0;
  }
  for (const item of data.schedule) {
    const due = item.date <= todayStr; // 日期已到
    const oldPaid = item.paid === true;
    let newPaid: boolean;
    if (due) {
      // 日期已到：自动标记为已还
      newPaid = true;
    } else {
      // 日期未到：保留用户手动标记的 paid=true，否则为 false
      newPaid = oldPaid;
    }
    if (newPaid !== oldPaid) {
      updated++;
    }
    item.paid = newPaid;
  }
  return updated;
}

/**
 * 执行重算流程：读取现有数据 -> 重算 -> 写回
 * @returns { updated, updatedAt } 若无数据 updated=0
 */
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

// ============ 路由处理 ============

/** GET /api/health 健康检查 */
function handleHealth(): Response {
  return jsonResponse({ ok: true, time: nowISO() });
}

/** GET /api/data 读取数据 */
async function handleGetData(env: Env): Promise<Response> {
  const { data, updatedAt } = await readLoanData(env);
  return jsonResponse({ data, updatedAt });
}

/** POST /api/data 写入数据 */
async function handlePostData(request: Request, env: Env): Promise<Response> {
  // 校验写入密钥
  const authError = checkWriteKey(request, env);
  if (authError) return authError;

  let body: LoanData;
  try {
    body = (await request.json()) as LoanData;
  } catch {
    return errorResponse('请求体不是合法的 JSON', 400);
  }

  // 基础结构校验
  if (!body || typeof body !== 'object' || !body.loanInfo || !Array.isArray(body.schedule)) {
    return errorResponse('数据结构不合法：缺少 loanInfo 或 schedule', 400);
  }

  const updatedAt = await writeLoanData(env, body);
  return jsonResponse({ success: true, updatedAt });
}

/** POST /api/recalc 手动触发重算 */
async function handleRecalc(env: Env): Promise<Response> {
  const { updated, updatedAt } = await doRecalc(env);
  return jsonResponse({ success: true, updated, updatedAt });
}

// ============ 主入口 ============

export default {
  /** HTTP 请求处理 */
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method.toUpperCase();

    // 处理 CORS 预检请求
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
      // 路由匹配
      if (pathname === '/api/health' && method === 'GET') {
        return handleHealth();
      }
      if (pathname === '/api/data' && method === 'GET') {
        return await handleGetData(env);
      }
      if (pathname === '/api/data' && method === 'POST') {
        return await handlePostData(request, env);
      }
      if (pathname === '/api/recalc' && method === 'POST') {
        return await handleRecalc(env);
      }

      // 未匹配的路由
      return errorResponse(`未找到路由: ${method} ${pathname}`, 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : '内部服务器错误';
      return errorResponse(message, 500);
    }
  },

  /** 定时任务处理：每天 UTC 00:05 自动重算还款状态 */
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // 使用 waitUntil 确保异步任务在响应返回前完成
    ctx.waitUntil(
      (async () => {
        try {
          const result = await doRecalc(env);
          console.log(`[scheduled] 重算完成，更新条数: ${result.updated}, 时间: ${result.updatedAt}`);
        } catch (err) {
          console.error('[scheduled] 重算失败:', err);
        }
      })(),
    );
  },
};
