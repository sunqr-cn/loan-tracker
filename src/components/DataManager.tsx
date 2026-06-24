import { useState } from 'react';
import { useLoanStore } from '@/stores/loanStore';
import { getServerConfig, generateSyncLink, DEFAULT_API_URL, saveServerConfig, testConnection } from '@/utils/serverSync';

export default function DataManager() {
  const { exportData, importData, resetData, syncStatus } = useLoanStore();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCloud, setShowCloud] = useState(false);
  const config = getServerConfig();
  const [apiUrl, setApiUrl] = useState(config.apiUrl || DEFAULT_API_URL);
  const [writeKey, setWriteKey] = useState(config.writeKey || '');

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loan-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ type: 'success', text: '已导出备份文件' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        importData(data);
        setMessage({ type: 'success', text: '导入成功' });
      } catch {
        setMessage({ type: 'error', text: '文件格式错误' });
      }
      setTimeout(() => setMessage(null), 3000);
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (confirm('确定要清空所有数据？此操作不可撤销。')) {
      resetData();
      setMessage({ type: 'success', text: '已清空所有数据' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleSetup = async () => {
    const result = await testConnection(apiUrl);
    if (result.ok) {
      saveServerConfig(apiUrl, writeKey);
      setMessage({ type: 'success', text: '连接成功，已保存配置' });
    } else {
      setMessage({ type: 'error', text: result.error || '连接失败' });
    }
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSyncLink = () => {
    const link = generateSyncLink();
    navigator.clipboard.writeText(link);
    setMessage({ type: 'success', text: '同步链接已复制到剪贴板' });
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="space-y-3">
      {message && (
        <div className={`text-sm px-3 py-2 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button onClick={handleExport}
          className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors">
          导出备份
        </button>
        <label className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors cursor-pointer">
          导入
          <input type="file" accept=".json" onChange={handleImport} className="hidden" />
        </label>
        <button onClick={handleReset}
          className="px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors">
          清空数据
        </button>
      </div>

      <div className="border-t border-gray-100 pt-3">
        <button onClick={() => setShowCloud(!showCloud)}
          className="flex items-center justify-between w-full text-sm font-medium text-gray-700">
          <span>服务端同步</span>
          <span className="text-xs text-gray-400">{showCloud ? '收起' : '展开'}</span>
        </button>

        {showCloud && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${syncStatus.online ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-gray-500">
                {syncStatus.online ? '已连接' : '未连接'} · {syncStatus.configured ? '已配置' : '未配置'}
              </span>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">服务端地址</label>
              <input type="text" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)}
                className="input" placeholder={DEFAULT_API_URL} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">写入密钥（可选）</label>
              <input type="password" value={writeKey} onChange={(e) => setWriteKey(e.target.value)}
                className="input" placeholder="留空表示公开写入" />
            </div>

            <div className="flex gap-2">
              <button onClick={handleSetup}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors">
                测试并保存
              </button>
              <button onClick={handleSyncLink}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm hover:bg-gray-200 transition-colors">
                生成同步链接
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
