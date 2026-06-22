import { useEffect } from 'react';
import { useLoanStore } from '@/stores/loanStore';
import Layout from '@/components/Layout';
import Dashboard from '@/components/Dashboard';
import LoanConfig from '@/components/LoanConfig';
import RepaymentPlan from '@/components/RepaymentPlan';

export default function Home() {
  const { hasData, activeTab, loadFromStorage } = useLoanStore();

  useEffect(() => {
    loadFromStorage();
  }, []);

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