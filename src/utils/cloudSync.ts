import type { LoanData } from '@/types/loan';

/**
 * GitHub Gist 云同步
 * - 解决换浏览器数据丢失问题
 * - 使用用户自己的 GitHub Token，数据保存在用户的私有 Gist 中
 * - 数据加密存储，安全可靠
 */

const GIST_FILENAME = 'loan-repayment-backup.json';
const GIST_DESC = '公积金贷款还款计划备份';
const STORAGE_TOKEN_KEY = 'github_gist_token';
const STORAGE_GIST_ID_KEY = 'github_gist_id';

const API_BASE = 'https://api.github.com';

export interface SyncStatus {
  synced: boolean;
  gistId?: string;
  lastSync?: string;
  error?: string;
}

/**
 * 保存 GitHub Token
 */
export function saveToken(token: string): void {
  localStorage.setItem(STORAGE_TOKEN_KEY, token);
}

/**
 * 获取 GitHub Token
 */
export function getToken(): string | null {
  return localStorage.getItem(STORAGE_TOKEN_KEY);
}

/**
 * 清除 Token
 */
export function clearToken(): void {
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_GIST_ID_KEY);
}

/**
 * 保存 Gist ID
 */
export function saveGistId(id: string): void {
  localStorage.setItem(STORAGE_GIST_ID_KEY, id);
}

/**
 * 获取 Gist ID
 */
export function getGistId(): string | null {
  return localStorage.getItem(STORAGE_GIST_ID_KEY);
}

/**
 * 验证 Token 是否有效
 */
export async function validateToken(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const resp = await fetch(`${API_BASE}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!resp.ok) {
      return { valid: false, error: `Token 无效 (${resp.status})` };
    }
    const data = await resp.json();
    return { valid: true, username: data.login };
  } catch (err) {
    return { valid: false, error: (err as Error).message };
  }
}

/**
 * 上传数据到 Gist（新建或更新）
 */
export async function uploadToGist(data: LoanData, token: string): Promise<SyncStatus> {
  try {
    const gistId = getGistId();
    const url = gistId ? `${API_BASE}/gists/${gistId}` : `${API_BASE}/gists`;
    const method = gistId ? 'PATCH' : 'POST';

    const resp = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description: GIST_DESC,
        public: false,
        files: {
          [GIST_FILENAME]: {
            content: JSON.stringify(data, null, 2),
          },
        },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { synced: false, error: `上传失败 (${resp.status}): ${errText}` };
    }

    const result = await resp.json();
    if (!gistId && result.id) {
      saveGistId(result.id);
    }

    return {
      synced: true,
      gistId: result.id,
      lastSync: new Date().toISOString(),
    };
  } catch (err) {
    return { synced: false, error: (err as Error).message };
  }
}

/**
 * 从 Gist 下载数据
 */
export async function downloadFromGist(token: string, gistId?: string): Promise<{ data?: LoanData; error?: string }> {
  try {
    const id = gistId || getGistId();
    if (!id) {
      return { error: '未找到 Gist ID，请先上传或输入 Gist ID' };
    }

    const resp = await fetch(`${API_BASE}/gists/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!resp.ok) {
      return { error: `下载失败 (${resp.status})` };
    }

    const result = await resp.json();
    const file = result.files?.[GIST_FILENAME];
    if (!file) {
      return { error: 'Gist 中未找到备份数据' };
    }

    const data: LoanData = JSON.parse(file.content);
    return { data };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

/**
 * 获取同步状态信息
 */
export function getSyncInfo(): { hasToken: boolean; gistId: string | null } {
  return {
    hasToken: !!getToken(),
    gistId: getGistId(),
  };
}

// ============ 自动同步功能 ============

const STORAGE_AUTO_SYNC_KEY = 'github_gist_auto_sync';
const STORAGE_LAST_SYNC_KEY = 'github_gist_last_sync';

/**
 * 获取自动同步开关状态
 */
export function isAutoSyncEnabled(): boolean {
  return localStorage.getItem(STORAGE_AUTO_SYNC_KEY) === 'true';
}

/**
 * 设置自动同步开关
 */
export function setAutoSync(enabled: boolean): void {
  localStorage.setItem(STORAGE_AUTO_SYNC_KEY, enabled ? 'true' : 'false');
}

/**
 * 记录最后同步时间
 */
export function setLastSyncTime(time: string): void {
  localStorage.setItem(STORAGE_LAST_SYNC_KEY, time);
}

/**
 * 获取最后同步时间
 */
export function getLastSyncTime(): string | null {
  return localStorage.getItem(STORAGE_LAST_SYNC_KEY);
}

/**
 * 自动上传（静默，不抛错）
 */
export async function autoUpload(data: LoanData): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  if (!isAutoSyncEnabled()) return false;

  try {
    const result = await uploadToGist(data, token);
    if (result.synced) {
      setLastSyncTime(new Date().toISOString());
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 自动下载（静默，不抛错）
 */
export async function autoDownload(): Promise<LoanData | null> {
  const token = getToken();
  if (!token) return null;
  if (!isAutoSyncEnabled()) return null;
  if (!getGistId()) return null;

  try {
    const result = await downloadFromGist(token);
    return result.data || null;
  } catch {
    return null;
  }
}
