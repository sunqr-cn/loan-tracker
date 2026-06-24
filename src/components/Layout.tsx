import { useLoanStore } from '@/stores/loanStore';
import { Settings, Cloud } from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { hasData, syncStatus, setActiveTab } = useLoanStore();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-200/60 shadow-sm shadow-gray-200/30">
        <div className="max-w-[1100px] mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-600/25">
                <span className="text-white text-sm">🏦</span>
              </div>
              <h1 className="text-sm font-bold text-gray-800">公积金贷款</h1>
            </div>

            {/* 右侧：同步状态 + 设置 */}
            <div className="flex items-center gap-2">
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
              {hasData && (
                <button
                  onClick={() => setActiveTab('config')}
                  className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <Settings className="w-4 h-4 text-gray-600" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-4 py-4">
        {children}
      </main>
    </div>
  );
}
