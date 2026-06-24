import { useLoanStore } from '@/stores/loanStore';
import { Cloud } from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { hasData, syncStatus } = useLoanStore();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 pb-20">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-200/60 shadow-sm shadow-gray-200/30">
        <div className="max-w-[1100px] mx-auto px-4">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-600/25">
                <span className="text-white text-xs">🏦</span>
              </div>
              <h1 className="text-sm font-bold text-gray-800">公积金贷款</h1>
            </div>
            {hasData && syncStatus.configured && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-50 border border-gray-100">
                <Cloud className="w-3 h-3 text-gray-400" />
                {syncStatus.syncing ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                ) : syncStatus.online ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-4 py-4">
        {children}
      </main>

      {/* 底部导航栏 */}
      {hasData && <BottomNav />}
    </div>
  );
}

function BottomNav() {
  const { activeTab, setActiveTab } = useLoanStore();

  const tabs = [
    { key: 'dashboard' as const, label: '首页', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )},
    { key: 'plan' as const, label: '计划', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    )},
    { key: 'config' as const, label: '设置', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )},
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-gray-200/60 shadow-lg shadow-gray-200/30">
      <div className="max-w-[1100px] mx-auto flex">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-all ${
                isActive ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              {tab.icon}
              <span className="text-[10px] font-medium">{tab.label}</span>
              {isActive && <div className="w-5 h-0.5 rounded-full bg-blue-500 mt-0.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
