import { useLoanStore } from '@/stores/loanStore';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { activeTab, setActiveTab, hasData, syncStatus } = useLoanStore();

  const tabs = [
    { key: 'dashboard' as const, label: '首页', icon: '📊' },
    { key: 'config' as const, label: '配置', icon: '⚙️' },
    { key: 'plan' as const, label: '计划', icon: '📋' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-200/60">
        <div className="max-w-[1100px] mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-600/30">
                <span className="text-white text-sm">🏦</span>
              </div>
              <h1 className="text-sm font-bold text-gray-800">公积金贷款管理</h1>
            </div>

            {hasData && (
              <nav className="flex gap-0.5 bg-gray-100/80 p-1 rounded-xl">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      activeTab === tab.key
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <span className="mr-1">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </nav>
            )}

            {hasData && syncStatus.configured && (
              <div className="hidden md:flex items-center gap-1.5">
                {syncStatus.syncing ? (
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                ) : syncStatus.online ? (
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-4 py-5">
        {children}
      </main>
    </div>
  );
}
