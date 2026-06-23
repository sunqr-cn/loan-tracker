import { useRef, useState } from 'react';
import { useLoanStore } from '@/stores/loanStore';
import { exportSQLiteFile } from '@/utils/sqlite';

export default function DataManager() {
  const {
    exportData, importData, resetData,
    cloudSync, cloudRestore,
    hasCloudToken, clearCloudToken, getCloudGistId,
    syncStatus, toggleAutoSync,
  } = useLoanStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showCloud, setShowCloud] = useState(false);
  const [token, setToken] = useState('');
  const [gistId, setGistId] = useState('');
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

  const handleSync = async () => {
    if (!token.trim()) {
      setMessage({ type: 'error', text: '请输入 GitHub Token' });
      return;
    }
    setSyncing(true);
    setMessage(null);
    const result = await cloudSync(token.trim());
    setSyncing(false);
    if (result.success) {
      setMessage({ type: 'success', text: '✅ 数据已同步到云端，开启自动同步后换浏览器不丢失' });
    } else {
      setMessage({ type: 'error', text: `❌ ${result.error}` });
    }
  };

  const handleRestore = async () => {
    if (!token.trim()) {
      setMessage({ type: 'error', text: '请输入 GitHub Token' });
      return;
    }
    if (!window.confirm('从云端恢复将覆盖当前数据，确定继续吗？')) return;
    setSyncing(true);
    setMessage(null);
    const result = await cloudRestore(token.trim(), gistId.trim() || undefined);
    setSyncing(false);
    if (result.success) {
      setMessage({ type: 'success', text: '✅ 已从云端恢复数据' });
    } else {
      setMessage({ type: 'error', text: `❌ ${result.error}` });
    }
  };

  const handleClearToken = () => {
    clearCloudToken();
    setToken('');
    setMessage({ type: 'success', text: '已清除云端配置' });
  };

  const existingGistId = getCloudGistId();

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

      {/* 云同步 */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-500 font-medium">☁️ 云同步（换浏览器不丢数据）</div>
          <button onClick={() => setShowCloud(!showCloud)}
            className="text-xs text-blue-500 hover:text-blue-600">
            {showCloud ? '收起' : '展开'}
          </button>
        </div>

        {/* 自动同步开关 */}
        {syncStatus.hasToken && (
          <div className="flex items-center justify-between bg-blue-50/50 rounded-lg px-3 py-2 mb-3">
            <div>
              <div className="text-sm text-gray-700">自动同步</div>
              <div className="text-xs text-gray-400">每次修改数据自动上传，打开应用自动拉取</div>
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

        {showCloud && (
          <div className="bg-blue-50/30 rounded-lg p-4 border border-blue-100 space-y-3">
            <div className="text-xs text-gray-500">
              通过 GitHub Token 将数据同步到你的私有 Gist。
              <a href="https://github.com/settings/tokens/new?scopes=gist&description=贷款数据同步"
                 target="_blank" rel="noopener noreferrer"
                 className="text-blue-500 underline ml-1">
                点此创建 Token
              </a>
              （只需 gist 权限）
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">GitHub Token</label>
                <input type="password" value={token} onChange={(e) => setToken(e.target.value)}
                  className="input" placeholder="ghp_xxxxxxxxxxxx" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Gist ID（恢复时填，同步时留空）</label>
                <input type="text" value={gistId} onChange={(e) => setGistId(e.target.value)}
                  className="input" placeholder="留空使用已保存的" />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={handleSync} disabled={syncing}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
                {syncing ? '同步中...' : '⬆️ 上传同步'}
              </button>
              <button onClick={handleRestore} disabled={syncing}
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 transition-colors disabled:opacity-50">
                {syncing ? '恢复中...' : '⬇️ 云端恢复'}
              </button>
              {hasCloudToken() && (
                <button onClick={handleClearToken}
                  className="px-4 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm hover:bg-gray-200 transition-colors">
                  清除配置
                </button>
              )}
            </div>

            {existingGistId && (
              <div className="text-xs text-gray-400">
                已绑定 Gist: <code className="bg-gray-100 px-1 rounded">{existingGistId}</code>
              </div>
            )}

            {message && (
              <div className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                {message.text}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
        💾 数据以 SQLite 格式存储在浏览器 IndexedDB，清缓存不丢失。换浏览器需开启云同步。
      </div>
    </div>
  );
}
