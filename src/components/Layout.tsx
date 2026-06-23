import { useLoanStore } from '@/stores/loanStore';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { activeTab, setActiveTab, hasData, syncStatus } = useLoanStore();

  const tabs = [
    { key: 'dashboard' as const, label: '首页', icon: '📊' },
    { key: 'config' as const, label: '配置', icon: '⚙️' },
    { key: 'plan' as const, label: '计划', icon: '📋' },
  ];

  const formatSyncTime = (time: string | null) => {
    if (!time) return null;
    const d = new Date(time);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return '刚刚同步';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前同步`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前同步`;
    return `${d.getMonth() + 1}/${d.getDate()} 同步`;
  };

  const syncText = formatSyncTime(syncStatus.lastSync);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      {/* 顶部导航 - 现代渐变风格 */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-200/60">
        <div className="max-w-[1100px] mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
                <span className="text-white text-lg">🏦</span>
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-800 leading-tight">公积金贷款管理</h1>
                <p className="text-[10px] text-gray-400 leading-tight">SQLite · 云同步</p>
              </div>
            </div>

            {/* 导航 - 胶囊式 */}
            {hasData && (
              <nav className="flex gap-1 bg-gray-100/80 p-1 rounded-xl">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                      activeTab === tab.key
                        ? 'bg-white text-blue-600 shadow-sm shadow-gray-300/50'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <span className="mr-1">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </nav>
            )}

            {/* 同步状态 */}
            {hasData && syncStatus.configured && (
              <div className="hidden md:flex items-center gap-1.5 text-xs">
                {syncStatus.syncing ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-gray-400">同步中...</span>
                  </>
                ) : syncStatus.autoSync ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-gray-400">{syncText || '已开启自动同步'}</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-gray-300" />
                    <span className="text-gray-400">手动同步</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 内容区 */}
      <main className="max-w-[1100px] mx-auto px-4 py-6">
        {children}
      </main>

      {/* 底部 */}
      <footer className="text-center text-xs text-gray-400 py-6">
        <div className="flex items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            SQLite 本地数据库
          </span>
          <span className="text-gray-300">·</span>
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            GitHub Gist 云同步
          </span>
        </div>
        <p className="mt-1.5 text-[11px]">配置云同步后，换浏览器数据不丢失</p>
      </footer>
    </div>
  );
}
