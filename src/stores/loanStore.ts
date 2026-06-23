import { create } from 'zustand';
import type { LoanInfo, ScheduleItem, PrepaymentRecord, RateChangeRecord, LoanData } from '@/types/loan';
import { generateSchedule, generateId } from '@/utils/calculator';
import { loadFromSQLite, saveToSQLite, clearSQLite } from '@/utils/sqlite';
import {
  uploadToGist, downloadFromGist, getToken, saveToken, getGistId, clearToken,
  isAutoSyncEnabled, setAutoSync, autoUpload, autoDownload, getLastSyncTime,
} from '@/utils/cloudSync';

interface LoanStore {
  loanInfo: LoanInfo | null;
  schedule: ScheduleItem[];
  prepayments: PrepaymentRecord[];
  rateChanges: RateChangeRecord[];
  hasData: boolean;
  isLoading: boolean;
  activeTab: 'dashboard' | 'config' | 'plan';
  syncStatus: {
    autoSync: boolean;
    hasToken: boolean;
    lastSync: string | null;
    syncing: boolean;
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
  loadFromStorage: () => Promise<boolean>;
  saveToStorage: () => Promise<void>;
  cloudSync: (token: string) => Promise<{ success: boolean; error?: string }>;
  cloudRestore: (token: string, gistId?: string) => Promise<{ success: boolean; error?: string }>;
  saveCloudToken: (token: string) => void;
  hasCloudToken: () => boolean;
  clearCloudToken: () => void;
  getCloudGistId: () => string | null;
  toggleAutoSync: (enabled: boolean) => void;
}

function recalcAll(
  loanInfo: LoanInfo,
  prepayments: PrepaymentRecord[],
  rateChanges: RateChangeRecord[]
): ScheduleItem[] {
  return generateSchedule(loanInfo, prepayments, rateChanges);
}

/**
 * 保留已还款状态 - 按日期映射
 */
function preservePaidStatus(oldSchedule: ScheduleItem[], newSchedule: ScheduleItem[]): ScheduleItem[] {
  const paidMap = new Map<string, boolean>();
  oldSchedule.forEach((s) => {
    paidMap.set(s.date, s.paid);
  });

  return newSchedule.map((s) => {
    const oldPaid = paidMap.get(s.date);
    if (oldPaid !== undefined) {
      return { ...s, paid: oldPaid };
    }
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
  activeTab: 'dashboard',
  syncStatus: {
    autoSync: isAutoSyncEnabled(),
    hasToken: !!getToken(),
    lastSync: getLastSyncTime(),
    syncing: false,
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  setLoanInfo: (info) => set({ loanInfo: info }),

  generatePlan: (info) => {
    const prepayments = get().prepayments;
    const rateChanges = get().rateChanges;
    const schedule = generateSchedule(info, prepayments, rateChanges);
    set({
      loanInfo: info,
      schedule,
      hasData: true,
    });
    get().saveToStorage();
  },

  togglePaid: (period) => {
    const schedule = get().schedule.map((item) =>
      item.period === period ? { ...item, paid: !item.paid } : item
    );
    set({ schedule });
    get().saveToStorage();
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
    get().saveToStorage();
  },

  updatePrepayment: (id, record) => {
    const prepayments = get().prepayments.map((p) =>
      p.id === id ? { ...record, id } : p
    );
    const loanInfo = get().loanInfo;
    if (!loanInfo) return;

    const newSchedule = recalcAll(loanInfo, prepayments, get().rateChanges);
    const schedule = preservePaidStatus(get().schedule, newSchedule);
    set({ prepayments, schedule });
    get().saveToStorage();
  },

  deletePrepayment: (id) => {
    const prepayments = get().prepayments.filter((p) => p.id !== id);
    const loanInfo = get().loanInfo;
    if (!loanInfo) return;

    const newSchedule = recalcAll(loanInfo, prepayments, get().rateChanges);
    const schedule = preservePaidStatus(get().schedule, newSchedule);
    set({ prepayments, schedule });
    get().saveToStorage();
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
    get().saveToStorage();
  },

  updateRateChange: (id, record) => {
    const rateChanges = get().rateChanges.map((r) =>
      r.id === id ? { ...record, id } : r
    );
    const loanInfo = get().loanInfo;
    if (!loanInfo) return;

    const newSchedule = recalcAll(loanInfo, get().prepayments, rateChanges);
    const schedule = preservePaidStatus(get().schedule, newSchedule);
    set({ rateChanges, schedule });
    get().saveToStorage();
  },

  deleteRateChange: (id) => {
    const rateChanges = get().rateChanges.filter((r) => r.id !== id);
    const loanInfo = get().loanInfo;
    if (!loanInfo) return;

    const newSchedule = recalcAll(loanInfo, get().prepayments, rateChanges);
    const schedule = preservePaidStatus(get().schedule, newSchedule);
    set({ rateChanges, schedule });
    get().saveToStorage();
  },

  exportData: () => {
    const state = get();
    const data: LoanData = {
      loanInfo: state.loanInfo!,
      schedule: state.schedule,
      prepayments: state.prepayments,
      rateChanges: state.rateChanges,
      meta: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
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
      get().saveToStorage();
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
    clearSQLite();
  },

  loadFromStorage: async () => {
    try {
      // 1. 先从本地 SQLite 加载
      const data = await loadFromSQLite();
      if (data && data.loanInfo && data.schedule) {
        set({
          loanInfo: data.loanInfo,
          schedule: data.schedule,
          prepayments: data.prepayments || [],
          rateChanges: data.rateChanges || [],
          hasData: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }

      // 2. 如果开启了自动同步，尝试从云端拉取最新数据
      if (isAutoSyncEnabled() && getToken() && getGistId()) {
        set({ syncStatus: { ...get().syncStatus, syncing: true } });
        const cloudData = await autoDownload();
        if (cloudData && cloudData.loanInfo) {
          // 比较更新时间，云端更新则覆盖本地
          const localData = data;
          const cloudUpdated = cloudData.meta?.updatedAt || '';
          const localUpdated = localData?.meta?.updatedAt || '';
          if (cloudUpdated > localUpdated) {
            set({
              loanInfo: cloudData.loanInfo,
              schedule: cloudData.schedule,
              prepayments: cloudData.prepayments || [],
              rateChanges: cloudData.rateChanges || [],
              hasData: true,
              isLoading: false,
            });
            await saveToSQLite(cloudData);
          }
        }
        set({
          syncStatus: {
            ...get().syncStatus,
            syncing: false,
            lastSync: getLastSyncTime(),
          },
        });
      }

      return true;
    } catch {
      set({ isLoading: false });
      return false;
    }
  },

  saveToStorage: async () => {
    const state = get();
    if (!state.loanInfo) return;
    const data: LoanData = {
      loanInfo: state.loanInfo,
      schedule: state.schedule,
      prepayments: state.prepayments,
      rateChanges: state.rateChanges,
      meta: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
    // 保存到本地 SQLite
    await saveToSQLite(data);

    // 如果开启自动同步，静默上传到云端
    if (isAutoSyncEnabled() && getToken()) {
      autoUpload(data).then((success) => {
        if (success) {
          set({
            syncStatus: {
              ...get().syncStatus,
              lastSync: getLastSyncTime(),
            },
          });
        }
      });
    }
  },

  cloudSync: async (token) => {
    const state = get();
    if (!state.loanInfo) {
      return { success: false, error: '无贷款数据可同步' };
    }
    const data: LoanData = {
      loanInfo: state.loanInfo,
      schedule: state.schedule,
      prepayments: state.prepayments,
      rateChanges: state.rateChanges,
      meta: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
    const result = await uploadToGist(data, token);
    if (result.synced) {
      saveToken(token);
      set({
        syncStatus: {
          ...get().syncStatus,
          hasToken: true,
          lastSync: new Date().toISOString(),
        },
      });
      return { success: true };
    }
    return { success: false, error: result.error };
  },

  cloudRestore: async (token, gistId) => {
    const result = await downloadFromGist(token, gistId);
    if (result.data) {
      set({
        loanInfo: result.data.loanInfo,
        schedule: result.data.schedule,
        prepayments: result.data.prepayments || [],
        rateChanges: result.data.rateChanges || [],
        hasData: true,
      });
      saveToken(token);
      await get().saveToStorage();
      return { success: true };
    }
    return { success: false, error: result.error };
  },

  saveCloudToken: (token) => saveToken(token),
  hasCloudToken: () => !!getToken(),
  clearCloudToken: () => {
    clearToken();
    setAutoSync(false);
    set({
      syncStatus: {
        autoSync: false,
        hasToken: false,
        lastSync: null,
        syncing: false,
      },
    });
  },
  getCloudGistId: () => getGistId(),

  toggleAutoSync: (enabled) => {
    setAutoSync(enabled);
    set({
      syncStatus: { ...get().syncStatus, autoSync: enabled },
    });
  },
}));
