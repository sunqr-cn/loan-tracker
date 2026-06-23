import type { LoanData } from '@/types/loan';

/**
 * 服务端同步（Cloudflare Worker + D1）
 *
 * 架构：
 * - 所有数据存 Cloudflare D1（SQLite），不存本地浏览器
 * - 前端通过 Worker API 读写，读取公开（所有用户可见），写入可选 API key
 * - 后台 cron 每天自动重算还款状态（Worker scheduled handler）
 * - Worker URL 存 localStorage（非敏感，读取本就公开）
 * - 可选 Write Key 存 localStorage（写入鉴权用）
 * - 跨浏览器：用同步链接（URL fragment 编码 Worker URL + key）一键配置
 */

const STORAGE_URL_KEY = 'server_api_url';
const STORAGE_WRITE_KEY = 'server_write_key';

/** 默认 Cloudflare Pages API 地址 */
export const DEFAULT_API_URL = 'https://loan-tracker-api.pages.dev';

/**
 * 保存服务端配置
 */
export function saveServerConfig(apiUrl: string, writeKey: string = ''): void {
  // 规范化 URL：去掉末尾斜杠
  const normalized = apiUrl.trim().replace(/\/+$/, '');
  localStorage.setItem(STORAGE_URL_KEY, normalized);
  localStorage.setItem(STORAGE_WRITE_KEY, writeKey.trim());
}

/**
 * 获取服务端配置；未保存时返回默认 API 地址
 */
export function getServerConfig(): { apiUrl: string; writeKey: string } {
  const apiUrl = localStorage.getItem(STORAGE_URL_KEY) || DEFAULT_API_URL;
  const writeKey = localStorage.getItem(STORAGE_WRITE_KEY) || '';
  return { apiUrl, writeKey };
}

/**
 * 清除服务端配置
 */
export function clearServerConfig(): void {
  localStorage.removeItem(STORAGE_URL_KEY);
  localStorage.removeItem(STORAGE_WRITE_KEY);
}

/**
 * 是否已配置（默认 API 视为已配置）
 */
export function isServerConfigured(): boolean {
  const cfg = getServerConfig();
  return !!cfg.apiUrl;
}

/**
 * 测试连接（验证 Worker URL 可达）
 */
export async function testConnection(apiUrl: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = apiUrl.trim().replace(/\/+$/, '') + '/api/health';
    const resp = await fetch(url, { cache: 'no-cache' });
    if (!resp.ok) return { ok: false, error: `连接失败 (${resp.status})` };
    const data = await resp.json();
    if (!data.ok) return { ok: false, error: '响应格式不正确' };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * 从服务端读取数据（公开，无需 key）
 */
export async function fetchFromServer(): Promise<{ data: LoanData | null; updatedAt: string | null; error?: string }> {
  try {
    const config = getServerConfig();
    if (!config) return { data: null, updatedAt: null, error: '未配置服务端地址' };
    const resp = await fetch(`${config.apiUrl}/api/data?t=${Date.now()}`, { cache: 'no-cache' });
    if (!resp.ok) return { data: null, updatedAt: null, error: `读取失败 (${resp.status})` };
    const result = await resp.json();
    return { data: result.data || null, updatedAt: result.updatedAt || null };
  } catch (err) {
    return { data: null, updatedAt: null, error: (err as Error).message };
  }
}

/**
 * 保存数据到服务端（需要 key，若服务端配置了 WRITE_KEY）
 */
export async function saveToServer(data: LoanData): Promise<{ success: boolean; updatedAt?: string; error?: string }> {
  try {
    const config = getServerConfig();
    if (!config) return { success: false, error: '未配置服务端地址' };
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.writeKey) headers['X-Write-Key'] = config.writeKey;
    const resp = await fetch(`${config.apiUrl}/api/data`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    const result = await resp.json();
    if (!resp.ok) return { success: false, error: result.error || `保存失败 (${resp.status})` };
    return { success: true, updatedAt: result.updatedAt };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * 清空服务端数据
 */
export async function clearServerData(): Promise<{ success: boolean; error?: string }> {
  try {
    const config = getServerConfig();
    if (!config) return { success: false, error: '未配置服务端地址' };
    const resp = await fetch(`${config.apiUrl}/api/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loanInfo: null, schedule: null }),
    });
    if (!resp.ok) return { success: false, error: `清空失败 (${resp.status})` };
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * 触发服务端重算还款状态（也可由后台 cron 自动执行）
 */
export async function recalcOnServer(): Promise<{ success: boolean; updated?: number; error?: string }> {
  try {
    const config = getServerConfig();
    if (!config) return { success: false, error: '未配置服务端地址' };
    const headers: Record<string, string> = {};
    if (config.writeKey) headers['X-Write-Key'] = config.writeKey;
    const resp = await fetch(`${config.apiUrl}/api/recalc`, { method: 'POST', headers });
    const result = await resp.json();
    if (!resp.ok) return { success: false, error: result.error || `重算失败 (${resp.status})` };
    return { success: true, updated: result.updated };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ============ 跨浏览器配置（同步链接） ============

const SYNC_HASH_KEY = 'sync';

/**
 * 生成同步书签链接（编码 Worker URL + Write Key 到 URL fragment）
 */
export function generateSyncLink(): string | null {
  const config = getServerConfig();
  if (!config) return null;
  const payload = JSON.stringify({ apiUrl: config.apiUrl, writeKey: config.writeKey });
  const encoded = btoa(unescape(encodeURIComponent(payload)));
  const base = window.location.origin + window.location.pathname;
  return `${base}#${SYNC_HASH_KEY}=${encoded}`;
}

/**
 * 从当前 URL 读取并应用服务端配置（跨浏览器一键配置）
 */
export function applySyncFromUrl(): boolean {
  try {
    const hash = window.location.hash;
    if (!hash) return false;
    const match = hash.match(new RegExp(`#${SYNC_HASH_KEY}=([^&]+)`));
    if (!match) return false;
    const json = decodeURIComponent(escape(atob(match[1])));
    const cfg = JSON.parse(json);
    if (!cfg.apiUrl) return false;
    saveServerConfig(cfg.apiUrl, cfg.writeKey || '');
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    return true;
  } catch {
    return false;
  }
}
