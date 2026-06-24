import { useLoanStore } from '@/stores/loanStore';
import { LayoutDashboard, Settings, ListOrdered, Cloud } from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { activeTab, setActiveTab, hasData, syncStatus } = useLoanStore();

  const tabs = [
    { key: 'dashboard' as const, label: '首页', icon: LayoutDashboard },
    { key: 'config' as const, label: '配置', icon: Settings },
    { key: 'plan' as const, label: '计划', icon: ListOrdered },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-200/60 shadow-sm shadow-gray-200/30">
        <div className="max-w-[1100px] mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-600/25">
                <span className="text-white text-base">🏦</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-sm font-bold text-gray-800 leading-tight">公积金贷款管理</h1>
                <p className="text-[10px] text-gray-400 leading-tight">还款计划 · 利率调整 · 提前还款</p>
              </div>
            </div>

            {/* 导航 */}
            {hasData && (
              <nav className="flex items-center gap-1 bg-gray-100/70 p-1 rounded-2xl">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.key;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                        isActive
                          ? 'bg-white text-blue-600 shadow-sm shadow-blue-900/5 translate-y-[-1px]'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
                      {tab.label}
                      {isActive && (
                        <span className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-blue-500/40" />
                      )}
                    </button>
                  );
                })}
              </nav>
            )}

            {/* 同步状态 */}
            {hasData && syncStatus.configured && (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-100">
                <Cloud className="w-3 h-3 text-gray-400" />
                <span className="text-[10px] text-gray-400">同步</span>
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
