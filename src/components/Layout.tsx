import { useLoanStore } from '@/stores/loanStore';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { activeTab, setActiveTab, hasData } = useLoanStore();

  const tabs = [
    { key: 'dashboard' as const, label: '首页报表', icon: '📊' },
    { key: 'config' as const, label: '贷款配置', icon: '⚙️' },
    { key: 'plan' as const, label: '还款计划', icon: '📋' },
  ];

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1100px] mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <h1 className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Georgia, serif' }}>
              🏦 公积金贷款管理
            </h1>
            {hasData && (
              <nav className="flex gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      activeTab === tab.key
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`}
                  >
                    <span className="mr-1">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </nav>
            )}
          </div>
        </div>
      </header>

      {/* 内容区 */}
      <main className="max-w-[1100px] mx-auto px-4 py-6">
        {children}
      </main>

      {/* 底部 */}
      <footer className="text-center text-xs text-gray-400 py-4">
        数据保存在浏览器 IndexedDB 本地数据库 · 清缓存不丢失 · 支持云同步备份
      </footer>
    </div>
  );
}