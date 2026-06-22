import { useEffect } from 'react';
import { useLoanStore } from '@/stores/loanStore';
import LoanForm from '@/components/LoanForm';
import ProgressOverview from '@/components/ProgressOverview';
import Charts from '@/components/Charts';
import PrepaymentManager from '@/components/PrepaymentManager';
import ScheduleTable from '@/components/ScheduleTable';
import DataManager from '@/components/DataManager';

export default function Home() {
  const { hasData, loadFromStorage } = useLoanStore();

  useEffect(() => {
    loadFromStorage();
  }, []);

  return (
    <div className="min-h-screen py-6 px-4 md:py-10 md:px-6"
      style={{ background: 'linear-gradient(180deg, #0f0f23 0%, #1a1a2e 50%, #0f0f23 100%)' }}>
      <div className="max-w-[1100px] mx-auto space-y-5">
        {/* 标题 */}
        <header className="text-center pb-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-wider"
            style={{ fontFamily: 'Georgia, serif', color: '#e2b04a' }}>
            公积金贷款还款计划
          </h1>
          <p className="text-gray-500 text-sm mt-1 tracking-wide">异地公积金贷款 · 还款管理工具</p>
        </header>

        {/* 贷款信息表单 */}
        <LoanForm />

        {hasData && (
          <>
            {/* 进度概览 */}
            <ProgressOverview />

            {/* 图表报表 */}
            <Charts />

            {/* 提前还款 */}
            <PrepaymentManager />

            {/* 还款计划表格 */}
            <ScheduleTable />

            {/* 数据管理 */}
            <div className="pt-2 pb-4">
              <DataManager />
            </div>
          </>
        )}

        {/* 底部 */}
        <footer className="text-center text-xs text-gray-600 pt-4 pb-2">
          数据仅保存在浏览器本地存储中，建议定期导出备份
        </footer>
      </div>
    </div>
  );
}