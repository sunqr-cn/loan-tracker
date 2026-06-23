import { create } from 'zustand';
import type { LoanInfo, ScheduleItem, PrepaymentRecord, RateChangeRecord, LoanData } from '@/types/loan';
import { generateSchedule, generateId } from '@/utils/calculator';
import { loadFromDB, saveToDB, clearDB } from '@/utils/db';
import { uploadToGist, downloadFromGist, getToken, saveToken, getGistId, clearToken } from '@/utils/cloudSync';

interface LoanStore {
  loanInfo: LoanInfo | null;
  schedule: ScheduleItem[];
  prepayments: PrepaymentRecord[];
  rateChanges: RateChangeRecord[];
  hasData: boolean;
  isLoading: boolean;
  activeTab: 'dashboard' | 'config' | 'plan';

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
}

function recalcAll(
  loanInfo: LoanInfo,
  prepayments: PrepaymentRecord[],
  rateChanges: RateChangeRecord[]
): ScheduleItem[] {
  return generateSchedule(loanInfo, prepayments, rateChanges);
}

/**
 * 保留已还款状态 - 按日期映射（而非按期数）
 * 当提前还款导致期数变化时，按日期映射能正确保留已还款状态
 * 同时保留用户手动取消的已还款状态（日期已过但用户手动标记为未还）
 */
function preservePaidStatus(oldSchedule: ScheduleItem[], newSchedule: ScheduleItem[]): ScheduleItem[] {
  // 按日期建立旧计划的已还款状态映射
  const paidMap = new Map<string, boolean>();
  oldSchedule.forEach((s) => {
    paidMap.set(s.date, s.paid);
  });

  return newSchedule.map((s) => {
    const oldPaid = paidMap.get(s.date);
    // 如果旧计划中有相同日期的记录，保留其已还款状态
    // 否则使用新生成的状态（已根据日期自动标记）
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
    clearDB();
  },

  loadFromStorage: async () => {
    try {
      const data = await loadFromDB();
      if (!data || !data.loanInfo || !data.schedule) {
        set({ isLoading: false });
        return false;
      }
      set({
        loanInfo: data.loanInfo,
        schedule: data.schedule,
        prepayments: data.prepayments || [],
        rateChanges: data.rateChanges || [],
        hasData: true,
        isLoading: false,
      });
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
    await saveToDB(data);
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
  clearCloudToken: () => clearToken(),
  getCloudGistId: () => getGistId(),
}));
