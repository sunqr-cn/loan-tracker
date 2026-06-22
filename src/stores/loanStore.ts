import { create } from 'zustand';
import type { LoanInfo, ScheduleItem, PrepaymentRecord, RateChangeRecord, LoanData } from '@/types/loan';
import { generateSchedule, generateId } from '@/utils/calculator';

const STORAGE_KEY = 'loan_repayment_data_v2';

interface LoanStore {
  loanInfo: LoanInfo | null;
  schedule: ScheduleItem[];
  prepayments: PrepaymentRecord[];
  rateChanges: RateChangeRecord[];
  hasData: boolean;
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
  loadFromStorage: () => boolean;
  saveToStorage: () => void;
}

function recalcAll(
  loanInfo: LoanInfo,
  prepayments: PrepaymentRecord[],
  rateChanges: RateChangeRecord[]
): ScheduleItem[] {
  return generateSchedule(loanInfo, prepayments, rateChanges);
}

function preservePaidStatus(oldSchedule: ScheduleItem[], newSchedule: ScheduleItem[]): ScheduleItem[] {
  const paidMap = new Map(oldSchedule.map((s) => [s.period, s.paid]));
  return newSchedule.map((s) => ({
    ...s,
    paid: paidMap.get(s.period) || false,
  }));
}

export const useLoanStore = create<LoanStore>((set, get) => ({
  loanInfo: null,
  schedule: [],
  prepayments: [],
  rateChanges: [],
  hasData: false,
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
    localStorage.removeItem(STORAGE_KEY);
  },

  loadFromStorage: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data: LoanData = JSON.parse(raw);
      if (!data.loanInfo || !data.schedule) return false;
      set({
        loanInfo: data.loanInfo,
        schedule: data.schedule,
        prepayments: data.prepayments || [],
        rateChanges: data.rateChanges || [],
        hasData: true,
      });
      return true;
    } catch {
      return false;
    }
  },

  saveToStorage: () => {
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
}));