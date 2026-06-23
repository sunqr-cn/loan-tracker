import type { LoanData } from '@/types/loan';

/**
 * GitHub 仓库文件存储
 *
 * 工作原理：
 * - 数据以 JSON 文件存储在仓库的 data 分支（如 data/loan-data.json）
 * - 读取：从 raw.githubusercontent.com 拉取，无需 Token（公开仓库），秒级更新
 * - 写入：用 GitHub Contents API + Token 提交到 data 分支
 * - 用独立 data 分支，不会触发 GitHub Pages 重建
 *
 * 相比 Gist 的优势：
 * - 数据就在你的仓库里，可见、有版本历史
 * - 读取不需要 Token
 * - 更直观
 */

const STORAGE_TOKEN_KEY = 'github_repo_token';
const STORAGE_OWNER_KEY = 'github_repo_owner';
const STORAGE_REPO_KEY = 'github_repo_name';
const STORAGE_BRANCH_KEY = 'github_repo_branch';
const STORAGE_FILE_PATH = 'loan-data.json';
const STORAGE_AUTO_SYNC_KEY = 'repo_auto_sync';
const STORAGE_LAST_SYNC_KEY = 'repo_last_sync';

const API_BASE = 'https://api.github.com';
const DEFAULT_BRANCH = 'data';

/**
 * 保存配置
 */
export function saveConfig(token: string, owner: string, repo: string, branch: string = DEFAULT_BRANCH): void {
  localStorage.setItem(STORAGE_TOKEN_KEY, token);
  localStorage.setItem(STORAGE_OWNER_KEY, owner);
  localStorage.setItem(STORAGE_REPO_KEY, repo);
  localStorage.setItem(STORAGE_BRANCH_KEY, branch);
}

/**
 * 获取配置
 */
export function getConfig(): { token: string; owner: string; repo: string; branch: string } | null {
  const token = localStorage.getItem(STORAGE_TOKEN_KEY);
  const owner = localStorage.getItem(STORAGE_OWNER_KEY);
  const repo = localStorage.getItem(STORAGE_REPO_KEY);
  const branch = localStorage.getItem(STORAGE_BRANCH_KEY) || DEFAULT_BRANCH;
  if (!token || !owner || !repo) return null;
  return { token, owner, repo, branch };
}

/**
 * 清除配置
 */
export function clearConfig(): void {
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_OWNER_KEY);
  localStorage.removeItem(STORAGE_REPO_KEY);
  localStorage.removeItem(STORAGE_BRANCH_KEY);
  localStorage.removeItem(STORAGE_AUTO_SYNC_KEY);
  localStorage.removeItem(STORAGE_LAST_SYNC_KEY);
}

/**
 * 验证 Token 和仓库权限
 */
export async function validateConfig(token: string, owner: string, repo: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const resp = await fetch(`${API_BASE}/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!resp.ok) {
      return { valid: false, error: `仓库访问失败 (${resp.status})：请检查用户名/仓库名/Token` };
    }
    const data = await resp.json();
    if (!data.permissions?.push) {
      return { valid: false, error: 'Token 没有写入权限，请确保 Token 有 repo 权限' };
    }
    return { valid: true };
  } catch (err) {
    return { valid: false, error: (err as Error).message };
  }
}

/**
 * 获取 raw 文件 URL（读取用，无需 Token）
 */
function getRawUrl(owner: string, repo: string, branch: string): string {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${STORAGE_FILE_PATH}`;
}

/**
 * 从仓库读取数据（无需 Token，公开仓库）
 */
export async function downloadFromRepo(): Promise<{ data?: LoanData; error?: string }> {
  try {
    const config = getConfig();
    if (!config) {
      return { error: '未配置仓库信息' };
    }
    const url = getRawUrl(config.owner, config.repo, config.branch);
    // 加时间戳避免缓存
    const resp = await fetch(`${url}?t=${Date.now()}`, {
      cache: 'no-cache',
    });
    if (resp.status === 404) {
      return { error: '云端暂无数据（首次使用请先上传）' };
    }
    if (!resp.ok) {
      return { error: `读取失败 (${resp.status})` };
    }
    const data: LoanData = await resp.json();
    return { data };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

/**
 * 上传数据到仓库（需要 Token）
 */
export async function uploadToRepo(data: LoanData): Promise<{ success: boolean; error?: string }> {
  try {
    const config = getConfig();
    if (!config) {
      return { success: false, error: '未配置仓库信息' };
    }

    const { token, owner, repo, branch } = config;
    const apiUrl = `${API_BASE}/repos/${owner}/${repo}/contents/${STORAGE_FILE_PATH}`;

    // 1. 尝试获取现有文件的 sha（更新需要 sha，新建不需要）
    let sha: string | undefined;
    try {
      const getResp = await fetch(`${apiUrl}?ref=${branch}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      });
      if (getResp.ok) {
        const fileData = await getResp.json();
        sha = fileData.sha;
      }
    } catch {
      // 文件不存在，新建
    }

    // 2. 确保 data 分支存在（如果不存在，从默认分支创建）
    await ensureBranchExists(token, owner, repo, branch);

    // 3. 提交文件
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
    const body: Record<string, unknown> = {
      message: `chore: 更新贷款数据 ${new Date().toISOString().slice(0, 19)}`,
      content,
      branch,
    };
    if (sha) body.sha = sha;

    const putResp = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!putResp.ok) {
      const errText = await putResp.text();
      return { success: false, error: `上传失败 (${putResp.status}): ${errText}` };
    }

    setLastSyncTime(new Date().toISOString());
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * 确保 data 分支存在
 */
async function ensureBranchExists(token: string, owner: string, repo: string, branch: string): Promise<void> {
  // 检查分支是否存在
  const checkResp = await fetch(`${API_BASE}/repos/${owner}/${repo}/branches/${branch}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (checkResp.ok) return; // 分支已存在

  // 获取默认分支的 sha 作为基准
  const repoResp = await fetch(`${API_BASE}/repos/${owner}/${repo}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  const repoData = await repoResp.json();
  const defaultBranch = repoData.default_branch;

  const refResp = await fetch(`${API_BASE}/repos/${owner}/${repo}/git/refs/heads/${defaultBranch}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  const refData = await refResp.json();
  const baseSha = refData.object.sha;

  // 创建新分支
  await fetch(`${API_BASE}/repos/${owner}/${repo}/git/refs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: `refs/heads/${branch}`,
      sha: baseSha,
    }),
  });
}

// ============ 自动同步 ============

export function isAutoSyncEnabled(): boolean {
  return localStorage.getItem(STORAGE_AUTO_SYNC_KEY) === 'true';
}

export function setAutoSync(enabled: boolean): void {
  localStorage.setItem(STORAGE_AUTO_SYNC_KEY, enabled ? 'true' : 'false');
}

export function getLastSyncTime(): string | null {
  return localStorage.getItem(STORAGE_LAST_SYNC_KEY);
}

function setLastSyncTime(time: string): void {
  localStorage.setItem(STORAGE_LAST_SYNC_KEY, time);
}

/**
 * 自动上传（静默）
 */
export async function autoUpload(data: LoanData): Promise<boolean> {
  if (!getConfig()) return false;
  if (!isAutoSyncEnabled()) return false;
  try {
    const result = await uploadToRepo(data);
    return result.success;
  } catch {
    return false;
  }
}

/**
 * 自动下载（静默，无需 Token）
 */
export async function autoDownload(): Promise<LoanData | null> {
  if (!isAutoSyncEnabled()) return null;
  if (!getConfig()) return null;
  try {
    const result = await downloadFromRepo();
    return result.data || null;
  } catch {
    return null;
  }
}

/**
 * 是否已配置
 */
export function isConfigured(): boolean {
  return getConfig() !== null;
}
