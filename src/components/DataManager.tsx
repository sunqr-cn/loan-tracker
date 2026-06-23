import { useRef, useState } from 'react';
import { useLoanStore } from '@/stores/loanStore';
import { exportSQLiteFile } from '@/utils/sqlite';
import { getConfig } from '@/utils/repoSync';

export default function DataManager() {
  const {
    exportData, importData, resetData,
    setupSync, cloudUpload, cloudDownload, clearSyncConfig,
    syncStatus, toggleAutoSync,
  } = useLoanStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showCloud, setShowCloud] = useState(false);
  const [token, setToken] = useState('');
  const [owner, setOwner] = useState('sunqr-cn');
  const [repo, setRepo] = useState('loan-tracker');
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const success = importData(reader.result as string);
      if (!success) alert('导入失败：文件格式不正确');
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleReset = () => {
    if (window.confirm('确定要清空所有数据吗？此操作不可恢复！')) resetData();
  };

  const handleExportSQLite = async () => {
    try {
      const blob = await exportSQLiteFile();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `loan-data-${new Date().toISOString().slice(0, 10)}.db`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('导出 SQLite 失败: ' + (err as Error).message);
    }
  };

  const handleSetup = async () => {
    if (!token.trim() || !owner.trim() || !repo.trim()) {
      setMessage({ type: 'error', text: '请填写完整信息' });
      return;
    }
    setSyncing(true);
    setMessage(null);
    const result = await setupSync(token.trim(), owner.trim(), repo.trim());
    setSyncing(false);
    if (result.success) {
      setMessage({ type: 'success', text: '✅ 配置成功！现在可以上传数据或开启自动同步' });
    } else {
      setMessage({ type: 'error', text: `❌ ${result.error}` });
    }
  };

  const handleUpload = async () => {
    setSyncing(true);
    setMessage(null);
    const result = await cloudUpload();
    setSyncing(false);
    if (result.success) {
      setMessage({ type: 'success', text: '✅ 数据已上传到仓库 data 分支' });
    } else {
      setMessage({ type: 'error', text: `❌ ${result.error}` });
    }
  };

  const handleDownload = async () => {
    if (!window.confirm('从云端恢复将覆盖当前数据，确定继续吗？')) return;
    setSyncing(true);
    setMessage(null);
    const result = await cloudDownload();
    setSyncing(false);
    if (result.success) {
      setMessage({ type: 'success', text: '✅ 已从云端恢复数据' });
    } else {
      setMessage({ type: 'error', text: `❌ ${result.error}` });
    }
  };

  const handleClearConfig = () => {
    clearSyncConfig();
    setToken('');
    setMessage({ type: 'success', text: '已清除云端配置' });
  };

  const existingConfig = getConfig();

  return (
    <div className="space-y-4">
      {/* 本地数据管理 */}
      <div>
        <div className="text-xs text-gray-500 mb-2 font-medium">本地数据</div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={exportData}
            className="px-3.5 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm hover:bg-gray-200 transition-colors">
            📥 导出 JSON
          </button>
          <button onClick={handleExportSQLite}
            className="px-3.5 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm hover:bg-gray-200 transition-colors">
            🗄 导出 SQLite
          </button>
          <label className="px-3.5 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm hover:bg-gray-200 transition-colors cursor-pointer">
            📤 导入
            <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          <button onClick={handleReset}
            className="px-3.5 py-2 rounded-lg bg-red-50 text-red-500 text-sm hover:bg-red-100 transition-colors">
            🗑 重置
          </button>
        </div>
      </div>

      {/* 云同步 - 仓库文件存储 */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-500 font-medium">☁️ 仓库云同步（换浏览器不丢数据）</div>
          <button onClick={() => setShowCloud(!showCloud)}
            className="text-xs text-blue-500 hover:text-blue-600">
            {showCloud ? '收起' : '展开'}
          </button>
        </div>

        {/* 自动同步开关 */}
        {syncStatus.configured && (
          <div className="flex items-center justify-between bg-blue-50/50 rounded-lg px-3 py-2 mb-3">
            <div>
              <div className="text-sm text-gray-700">自动同步</div>
              <div className="text-xs text-gray-400">每次修改自动上传，打开应用自动拉取（读取无需 Token）</div>
            </div>
            <button
              onClick={() => toggleAutoSync(!syncStatus.autoSync)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                syncStatus.autoSync ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                syncStatus.autoSync ? 'translate-x-5' : ''
              }`} />
            </button>
          </div>
        )}

        {/* 已配置时的快捷操作 */}
        {syncStatus.configured && (
          <div className="flex flex-wrap gap-2 mb-3">
            <button onClick={handleUpload} disabled={syncing}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
              {syncing ? '上传中...' : '⬆️ 立即上传'}
            </button>
            <button onClick={handleDownload} disabled={syncing}
              className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 transition-colors disabled:opacity-50">
              {syncing ? '下载中...' : '⬇️ 云端恢复'}
            </button>
            <button onClick={handleClearConfig}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm hover:bg-gray-200 transition-colors">
              清除配置
            </button>
          </div>
        )}

        {showCloud && !syncStatus.configured && (
          <div className="bg-blue-50/30 rounded-lg p-4 border border-blue-100 space-y-3">
            <div className="text-xs text-gray-500">
              数据将以 JSON 文件存储在你仓库的 <code className="bg-gray-100 px-1 rounded">data</code> 分支。
              <a href="https://github.com/settings/tokens/new?scopes=repo&description=贷款数据同步"
                 target="_blank" rel="noopener noreferrer"
                 className="text-blue-500 underline ml-1">
                点此创建 Token
              </a>
              （需 repo 权限）
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">GitHub 用户名</label>
                <input type="text" value={owner} onChange={(e) => setOwner(e.target.value)}
                  className="input" placeholder="sunqr-cn" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">仓库名</label>
                <input type="text" value={repo} onChange={(e) => setRepo(e.target.value)}
                  className="input" placeholder="loan-tracker" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">GitHub Token</label>
                <input type="password" value={token} onChange={(e) => setToken(e.target.value)}
                  className="input" placeholder="ghp_xxxxxxxxxxxx" />
              </div>
            </div>

            <button onClick={handleSetup} disabled={syncing}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
              {syncing ? '验证中...' : '验证并保存配置'}
            </button>

            {message && (
              <div className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                {message.text}
              </div>
            )}
          </div>
        )}

        {showCloud && syncStatus.configured && existingConfig && (
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
            <div>已绑定仓库：<code className="bg-gray-100 px-1 rounded">{existingConfig.owner}/{existingConfig.repo}</code></div>
            <div>存储分支：<code className="bg-gray-100 px-1 rounded">{existingConfig.branch}</code></div>
            <div>文件路径：<code className="bg-gray-100 px-1 rounded">loan-data.json</code></div>
            {message && (
              <div className={`text-sm mt-2 ${message.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                {message.text}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
        💾 本地用 SQLite 存储（清缓存不丢失）。配置仓库云同步后，数据存到仓库 data 分支的 JSON 文件，换浏览器打开自动拉取。
      </div>
    </div>
  );
}
