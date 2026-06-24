import { create } from 'zustand';
import type { LoanInfo, ScheduleItem, PrepaymentRecord, RateChangeRecord, LoanData } from '@/types/loan';
import { generateSchedule, generateId } from '@/utils/calculator';
import {
  fetchFromServer, saveToServer, saveServerConfig, clearServerConfig,
  clearServerData, isServerConfigured, testConnection, applySyncFromUrl,
} from '@/utils/serverSync';

interface LoanStore {
  loanInfo: LoanInfo | null;
  schedule: ScheduleItem[];
  prepayments: PrepaymentRecord[];
  rateChanges: RateChangeRecord[];
  hasData: boolean;
  isLoading: boolean;
  activeTab: 'dashboard' | 'config' | 'plan';
  syncStatus: {
    configured: boolean;
    lastSync: string | null;
    syncing: boolean;
    online: boolean;
  };

  setActiveTab: (tab: 'dashboard' | 'config' | 'plan') => void;
  setLoanInfo: (info: LoanInfo) => void;
  generatePlan: (info: LoanInfo) => void;
  togglePaid: (period: number) => void;
  addPrepayment: (record: Omit<PrepaymentRecord, 'id'>) => void;
  updatePrepayment: (id: string, record: Omit<PrepaymentRecord, 'id'>) => void;
  deletePrepayment: (id: string) => void;
  addRateChange: (record: Omit<RateChangeRecord, 'id'>) => void;
  updateRateChange: (id: string, record: Omit<RateChangeRecord, 'id'>) => void;
  deleteRateChange: (id: string) => void;
  exportData: () => void;
  importData: (jsonStr: string) => boolean;
  resetData: () => void;
  loadFromServer: () => Promise<boolean>;
  saveToServerStore: () => Promise<boolean>;
  setupServer: (apiUrl: string, writeKey: string) => Promise<{ success: boolean; error?: string }>;
  clearSyncConfig: () => void;
  applySyncFromUrl: () => boolean;
}

function recalcAll(
  loanInfo: LoanInfo,
  prepayments: PrepaymentRecord[],
  rateChanges: RateChangeRecord[]
): ScheduleItem[] {
  return generateSchedule(loanInfo, prepayments, rateChanges);
}

/**
 * 保留已还款状态 - 按日期映射（重算时保留手动勾选）
 */
function preservePaidStatus(oldSchedule: ScheduleItem[], newSchedule: ScheduleItem[]): ScheduleItem[] {
  const paidMap = new Map<string, boolean>();
  oldSchedule.forEach((s) => paidMap.set(s.date, s.paid));
  return newSchedule.map((s) => {
    const oldPaid = paidMap.get(s.date);
    if (oldPaid !== undefined) return { ...s, paid: oldPaid };
    return s;
  });
}

export const useLoanStore = create<LoanStore>((set, get) => ({
  loanInfo: null,
  schedule: [],
  prepayments: [],
  rateChanges: [],
  hasData: false,
  isLoading: true,
  activeTab: 'config',
  syncStatus: {
    configured: isServerConfigured(),
    lastSync: null,
    syncing: false,
    online: true,
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  setLoanInfo: (info) => set({ loanInfo: info }),

  generatePlan: (info) => {
    const prepayments = get().prepayments;
    const rateChanges = get().rateChanges;
    const schedule = generateSchedule(info, prepayments, rateChanges);
    set({ loanInfo: info, schedule, hasData: true });
    get().saveToServerStore();
  },

  togglePaid: (period) => {
    const schedule = get().schedule.map((item) =>
      item.period === period ? { ...item, paid: !item.paid } : item
    );
    set({ schedule });
    get().saveToServerStore();
  },

  addPrepayment: (record) => {
    const id = generateId();
    const newRecord: PrepaymentRecord = { ...record, id };
    const prepayments = [...get().prepayments, newRecord];
    const loanInfo = get().loanInfo;
    if (!loanInfo) return;
    const newSchedule = recalcAll(loanInfo, prepayments, get().rateChanges);
    const schedule = preservePaidStatus(get().schedule, newSchedule);
    set({ prepayments, schedule });
    get().saveToServerStore();
  },

  updatePrepayment: (id, record) => {
    const prepayments = get().prepayments.map((p) => (p.id === id ? { ...record, id } : p));
    const loanInfo = get().loanInfo;
    if (!loanInfo) return;
    const newSchedule = recalcAll(loanInfo, prepayments, get().rateChanges);
    const schedule = preservePaidStatus(get().schedule, newSchedule);
    set({ prepayments, schedule });
    get().saveToServerStore();
  },

  deletePrepayment: (id) => {
    const prepayments = get().prepayments.filter((p) => p.id !== id);
    const loanInfo = get().loanInfo;
    if (!loanInfo) return;
    const newSchedule = recalcAll(loanInfo, prepayments, get().rateChanges);
    const schedule = preservePaidStatus(get().schedule, newSchedule);
    set({ prepayments, schedule });
    get().saveToServerStore();
  },

  addRateChange: (record) => {
    const id = generateId();
    const newRecord: RateChangeRecord = { ...record, id };
    const rateChanges = [...get().rateChanges, newRecord];
    const loanInfo = get().loanInfo;
    if (!loanInfo) return;
    const newSchedule = recalcAll(loanInfo, get().prepayments, rateChanges);
    const schedule = preservePaidStatus(get().schedule, newSchedule);
    set({ rateChanges, schedule });
    get().saveToServerStore();
  },

  updateRateChange: (id, record) => {
    const rateChanges = get().rateChanges.map((r) => (r.id === id ? { ...record, id } : r));
    const loanInfo = get().loanInfo;
    if (!loanInfo) return;
    const newSchedule = recalcAll(loanInfo, get().prepayments, rateChanges);
    const schedule = preservePaidStatus(get().schedule, newSchedule);
    set({ rateChanges, schedule });
    get().saveToServerStore();
  },

  deleteRateChange: (id) => {
    const rateChanges = get().rateChanges.filter((r) => r.id !== id);
    const loanInfo = get().loanInfo;
    if (!loanInfo) return;
    const newSchedule = recalcAll(loanInfo, get().prepayments, rateChanges);
    const schedule = preservePaidStatus(get().schedule, newSchedule);
    set({ rateChanges, schedule });
    get().saveToServerStore();
  },

  exportData: () => {
    const state = get();
    const data: LoanData = {
      loanInfo: state.loanInfo!,
      schedule: state.schedule,
      prepayments: state.prepayments,
      rateChanges: state.rateChanges,
      meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loan-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importData: (jsonStr) => {
    try {
      const data: LoanData = JSON.parse(jsonStr);
      if (!data.loanInfo || !data.schedule) return false;
      set({
        loanInfo: data.loanInfo,
        schedule: data.schedule,
        prepayments: data.prepayments || [],
        rateChanges: data.rateChanges || [],
        hasData: true,
      });
      get().saveToServerStore();
      return true;
    } catch {
      return false;
    }
  },

  resetData: () => {
    set({
      loanInfo: null,
      schedule: [],
      prepayments: [],
      rateChanges: [],
      hasData: false,
    });
    // 清空服务端数据
    if (isServerConfigured()) {
      clearServerData();
    }
  },

  loadFromServer: async () => {
    try {
      if (!isServerConfigured()) {
        set({ isLoading: false });
        return false;
      }
      set({ syncStatus: { ...get().syncStatus, syncing: true } });
      const { data, updatedAt, error } = await fetchFromServer();
      if (error) {
        set({ isLoading: false, syncStatus: { ...get().syncStatus, syncing: false, online: false } });
        return false;
      }
      if (data && data.loanInfo && data.schedule) {
        // 按今天日期重新计算还款状态（双保险：即使后台 cron 没跑，打开也立即正确）
        const freshSchedule = generateSchedule(data.loanInfo, data.prepayments || [], data.rateChanges || []);
        const schedule = preservePaidStatus(data.schedule, freshSchedule);
        set({
          loanInfo: data.loanInfo,
          schedule,
          prepayments: data.prepayments || [],
          rateChanges: data.rateChanges || [],
          hasData: true,
          isLoading: false,
          syncStatus: { ...get().syncStatus, syncing: false, lastSync: updatedAt, online: true },
        });
      } else {
        set({ isLoading: false, syncStatus: { ...get().syncStatus, syncing: false, online: true } });
      }
      return true;
    } catch {
      set({ isLoading: false, syncStatus: { ...get().syncStatus, syncing: false, online: false } });
      return false;
    }
  },

  saveToServerStore: async () => {
    const state = get();
    if (!state.loanInfo) return false;
    if (!isServerConfigured()) return false;
    const data: LoanData = {
      loanInfo: state.loanInfo,
      schedule: state.schedule,
      prepayments: state.prepayments,
      rateChanges: state.rateChanges,
      meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    };
    const result = await saveToServer(data);
    if (result.success) {
      set({ syncStatus: { ...get().syncStatus, lastSync: result.updatedAt || new Date().toISOString(), online: true } });
      return true;
    }
    set({ syncStatus: { ...get().syncStatus, online: false } });
    return false;
  },

  setupServer: async (apiUrl, writeKey) => {
    const test = await testConnection(apiUrl);
    if (!test.ok) return { success: false, error: test.error };
    saveServerConfig(apiUrl, writeKey);
    set({ syncStatus: { ...get().syncStatus, configured: true, online: true } });
    return { success: true };
  },

  clearSyncConfig: () => {
    clearServerConfig();
    set({
      syncStatus: { configured: false, lastSync: null, syncing: false, online: true },
    });
  },

  applySyncFromUrl: () => {
    const applied = applySyncFromUrl();
    if (applied) {
      set({ syncStatus: { ...get().syncStatus, configured: true } });
    }
    return applied;
  },
}));
