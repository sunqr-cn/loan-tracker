import { useRef } from 'react';
import { useLoanStore } from '@/stores/loanStore';

export default function DataManager() {
  const { exportData, importData, resetData } = useLoanStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const success = importData(reader.result as string);
      if (!success) alert('导入失败：文件格式不正确');
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleReset = () => {
    if (window.confirm('确定要清空所有数据吗？此操作不可恢复！')) resetData();
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={exportData}
        className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm hover:bg-gray-200 transition-colors">
        📥 导出备份
      </button>
      <label className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm hover:bg-gray-200 transition-colors cursor-pointer">
        📤 导入备份
        <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
      </label>
      <button onClick={handleReset}
        className="px-4 py-2 rounded-lg bg-red-50 text-red-500 text-sm hover:bg-red-100 transition-colors">
        🗑 重置数据
      </button>
    </div>
  );
}