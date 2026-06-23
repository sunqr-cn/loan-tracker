import { useEffect } from 'react';
import { useLoanStore } from '@/stores/loanStore';
import Layout from '@/components/Layout';
import Dashboard from '@/components/Dashboard';
import LoanConfig from '@/components/LoanConfig';
import RepaymentPlan from '@/components/RepaymentPlan';

export default function Home() {
  const { hasData, isLoading, activeTab, loadFromServer, applySyncFromUrl } = useLoanStore();

  useEffect(() => {
    // 先尝试从 URL 应用服务端配置（跨浏览器一键配置），再加载数据
    applySyncFromUrl();
    loadFromServer();
  }, []);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3"></div>
            <p className="text-sm text-gray-400">从服务端加载数据...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {!hasData ? (
        <LoanConfig />
      ) : (
        <>
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'config' && <LoanConfig />}
          {activeTab === 'plan' && <RepaymentPlan />}
        </>
      )}
    </Layout>
  );
}
