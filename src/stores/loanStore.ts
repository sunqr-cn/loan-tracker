import { create } from 'zustand';
import type { LoanInfo, ScheduleItem, PrepaymentRecord, RateChangeRecord, LoanData } from '@/types/loan';
import { generateSchedule, generateId } from '@/utils/calculator';
import { loadFromSQLite, saveToSQLite, clearSQLite } from '@/utils/sqlite';
import {
  uploadToRepo, downloadFromRepo, saveConfig, getConfig, clearConfig,
  isAutoSyncEnabled, setAutoSync, autoUpload, autoDownload, getLastSyncTime,
  isConfigured, validateConfig,
} from '@/utils/repoSync';

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
    configured: boolean;
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
  setupSync: (token: string, owner: string, repo: string) => Promise<{ success: boolean; error?: string }>;
  cloudUpload: () => Promise<{ success: boolean; error?: string }>;
  cloudDownload: () => Promise<{ success: boolean; error?: string }>;
  clearSyncConfig: () => void;
  toggleAutoSync: (enabled: boolean) => void;
  isSyncConfigured: () => boolean;
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
    configured: isConfigured(),
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

      // 2. 如果开启了自动同步，从云端拉取最新数据（无需 Token）
      if (isAutoSyncEnabled() && isConfigured()) {
        set({ syncStatus: { ...get().syncStatus, syncing: true } });
        const cloudData = await autoDownload();
        if (cloudData && cloudData.loanInfo) {
          // 比较更新时间，云端更新则覆盖本地
          const localUpdated = data?.meta?.updatedAt || '';
          const cloudUpdated = cloudData.meta?.updatedAt || '';
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

    // 如果开启自动同步，静默上传到云端仓库
    if (isAutoSyncEnabled() && isConfigured()) {
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

  setupSync: async (token, owner, repo) => {
    // 验证 Token 和仓库权限
    const validation = await validateConfig(token, owner, repo);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    // 保存配置
    saveConfig(token, owner, repo);
    set({
      syncStatus: {
        ...get().syncStatus,
        configured: true,
      },
    });
    return { success: true };
  },

  cloudUpload: async () => {
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
    const result = await uploadToRepo(data);
    if (result.success) {
      set({
        syncStatus: {
          ...get().syncStatus,
          lastSync: new Date().toISOString(),
        },
      });
      return { success: true };
    }
    return { success: false, error: result.error };
  },

  cloudDownload: async () => {
    const result = await downloadFromRepo();
    if (result.data) {
      set({
        loanInfo: result.data.loanInfo,
        schedule: result.data.schedule,
        prepayments: result.data.prepayments || [],
        rateChanges: result.data.rateChanges || [],
        hasData: true,
      });
      await get().saveToStorage();
      return { success: true };
    }
    return { success: false, error: result.error };
  },

  clearSyncConfig: () => {
    clearConfig();
    set({
      syncStatus: {
        autoSync: false,
        configured: false,
        lastSync: null,
        syncing: false,
      },
    });
  },

  toggleAutoSync: (enabled) => {
    setAutoSync(enabled);
    set({
      syncStatus: { ...get().syncStatus, autoSync: enabled },
    });
  },

  isSyncConfigured: () => isConfigured(),
}));
