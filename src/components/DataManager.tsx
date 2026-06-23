import { useRef, useState } from 'react';
import { useLoanStore } from '@/stores/loanStore';
import { getServerConfig, generateSyncLink, DEFAULT_API_URL } from '@/utils/serverSync';

export default function DataManager() {
  const {
    exportData, importData, resetData,
    setupServer, clearSyncConfig,
    syncStatus, loadFromServer, saveToServerStore,
  } = useLoanStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showCloud, setShowCloud] = useState(false);
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [writeKey, setWriteKey] = useState('');
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
    if (window.confirm('确定要清空所有数据吗？此操作会同时清空服务端数据，不可恢复！')) resetData();
  };

  const handleSetup = async () => {
    if (!apiUrl.trim()) {
      setMessage({ type: 'error', text: '请填写服务端地址' });
      return;
    }
    setSyncing(true);
    setMessage(null);
    const result = await setupServer(apiUrl.trim(), writeKey.trim());
    setSyncing(false);
    if (result.success) {
      setMessage({ type: 'success', text: '✅ 连接成功！数据已存服务端' });
      // 连接成功后立即拉取数据
      await loadFromServer();
    } else {
      setMessage({ type: 'error', text: `❌ ${result.error}` });
    }
  };

  const handleRefresh = async () => {
    setSyncing(true);
    setMessage(null);
    const ok = await loadFromServer();
    setSyncing(false);
    setMessage(ok
      ? { type: 'success', text: '✅ 已从服务端刷新' }
      : { type: 'error', text: '❌ 刷新失败，请检查服务端地址' });
  };

  const handleSaveNow = async () => {
    setSyncing(true);
    setMessage(null);
    const ok = await saveToServerStore();
    setSyncing(false);
    setMessage(ok
      ? { type: 'success', text: '✅ 已保存到服务端' }
      : { type: 'error', text: '❌ 保存失败' });
  };

  const handleClearConfig = () => {
    clearSyncConfig();
    setApiUrl('');
    setWriteKey('');
    setMessage({ type: 'success', text: '已清除服务端配置' });
  };

  const handleGenLink = async () => {
    const link = generateSyncLink();
    if (!link) {
      setMessage({ type: 'error', text: '❌ 请先配置服务端地址' });
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setMessage({ type: 'success', text: '✅ 同步链接已复制！换浏览器打开此链接即可自动配置' });
    } catch {
      window.prompt('复制此链接，换浏览器时打开即可自动配置：', link);
    }
  };

  const existingConfig = getServerConfig();

  return (
    <div className="space-y-4">
      {/* 本地数据管理 */}
      <div>
        <div className="text-xs text-gray-500 mb-2 font-medium">数据备份</div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={exportData}
            className="px-3.5 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm hover:bg-gray-200 transition-colors">
            📥 导出 JSON
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

      {/* 服务端存储 - Cloudflare Worker + D1 */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-500 font-medium">☁️ 服务端存储（Cloudflare Worker + D1）</div>
          <button onClick={() => setShowCloud(!showCloud)}
            className="text-xs text-blue-500 hover:text-blue-600">
            {showCloud ? '收起' : '展开'}
          </button>
        </div>

        {/* 已配置时的快捷操作 */}
        {syncStatus.configured && (
          <div className="flex flex-wrap gap-2 mb-3">
            <button onClick={handleRefresh} disabled={syncing}
              className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 transition-colors disabled:opacity-50">
              {syncing ? '刷新中...' : '🔄 从服务端刷新'}
            </button>
            <button onClick={handleSaveNow} disabled={syncing}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
              {syncing ? '保存中...' : '⬆️ 立即保存'}
            </button>
            <button onClick={handleGenLink}
              className="px-4 py-2 rounded-lg bg-indigo-50 text-indigo-600 text-sm hover:bg-indigo-100 transition-colors">
              🔗 生成同步链接
            </button>
            <button onClick={handleClearConfig}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm hover:bg-gray-200 transition-colors">
              清除配置
            </button>
          </div>
        )}

        {showCloud && (
          <div className="bg-blue-50/30 rounded-lg p-4 border border-blue-100 space-y-3">
            <div className="text-xs text-gray-500 leading-relaxed">
              数据存在 Cloudflare D1 数据库（服务端），所有用户共享同一份数据，后台每天自动重算还款状态。
              <br />默认已使用公共 API：<code className="bg-gray-100 px-1 rounded">{DEFAULT_API_URL}</code>，可直接保存/读取。
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">服务端地址</label>
                <input type="text" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)}
                  className="input" placeholder="https://loan-tracker-api.pages.dev" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">写入密钥（可选，若服务端配置了 WRITE_KEY）</label>
                <input type="password" value={writeKey} onChange={(e) => setWriteKey(e.target.value)}
                  className="input" placeholder="留空表示公开写入" />
              </div>
            </div>

            <button onClick={handleSetup} disabled={syncing}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
              {syncing ? '连接中...' : '测试连接并保存'}
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
            <div>服务地址：<code className="bg-gray-100 px-1 rounded">{existingConfig.apiUrl}</code></div>
            <div>写入密钥：<code className="bg-gray-100 px-1 rounded">{existingConfig.writeKey ? '已设置' : '未设置（公开写入）'}</code></div>
            <div>连接状态：{syncStatus.online ? '🟢 在线' : '🔴 离线'}</div>
            {syncStatus.lastSync && <div>最后同步：{new Date(syncStatus.lastSync).toLocaleString('zh-CN')}</div>}
            {message && (
              <div className={`text-sm mt-2 ${message.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                {message.text}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
        ☁️ 数据存服务端（Cloudflare D1），不存本地浏览器，换设备/浏览器都能看到。
        <br />⏰ 后台每天自动重算还款状态（Worker cron），无需打开页面。
        <br />🔗 换浏览器时：点「生成同步链接」复制，在新浏览器打开一次即可自动配置。
      </div>
    </div>
  );
}
