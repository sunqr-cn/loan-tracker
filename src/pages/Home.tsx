import { useLoanStore } from '@/stores/loanStore';
import LoanConfig from '@/components/LoanConfig';
import Dashboard from '@/components/Dashboard';
import RepaymentPlan from '@/components/RepaymentPlan';
import Layout from '@/components/Layout';

export default function Home() {
  const { hasData, activeTab } = useLoanStore();

  if (!hasData) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto pt-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/30 mx-auto mb-4">
              <span className="text-3xl">🏦</span>
            </div>
            <h1 className="text-xl font-bold text-gray-800">公积金贷款还款计划</h1>
            <p className="text-sm text-gray-400 mt-1">录入贷款信息，自动生成还款计划</p>
          </div>
          <LoanConfig />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {activeTab === 'dashboard' && <Dashboard />}
      {activeTab === 'config' && <LoanConfig />}
      {activeTab === 'plan' && <RepaymentPlan />}
    </Layout>
  );
}
