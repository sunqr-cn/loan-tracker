import { create } from 'zustand';
import type { LoanInfo, ScheduleItem, PrepaymentRecord, LoanData } from '@/types/loan';
import { generateSchedule, generateId } from '@/utils/calculator';

const STORAGE_KEY = 'loan_repayment_data';

interface LoanStore {
  loanInfo: LoanInfo | null;
  schedule: ScheduleItem[];
  prepayments: PrepaymentRecord[];
  hasData: boolean;

  setLoanInfo: (info: LoanInfo) => void;
  generatePlan: (info: LoanInfo, prepayments?: PrepaymentRecord[]) => void;
  togglePaid: (period: number) => void;
  addPrepayment: (record: Omit<PrepaymentRecord, 'id'>) => void;
  updatePrepayment: (id: string, record: Omit<PrepaymentRecord, 'id'>) => void;
  deletePrepayment: (id: string) => void;
  exportData: () => void;
  importData: (jsonStr: string) => boolean;
  resetData: () => void;
  loadFromStorage: () => boolean;
  saveToStorage: () => void;
}

function recalcAll(loanInfo: LoanInfo, prepayments: PrepaymentRecord[]): ScheduleItem[] {
  return generateSchedule(loanInfo, prepayments);
}

export const useLoanStore = create<LoanStore>((set, get) => ({
  loanInfo: null,
  schedule: [],
  prepayments: [],
  hasData: false,

  setLoanInfo: (info) => set({ loanInfo: info }),

  generatePlan: (info, prepayments = []) => {
    const schedule = generateSchedule(info, prepayments);
    set({
      loanInfo: info,
      schedule,
      prepayments,
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

    const schedule = recalcAll(loanInfo, prepayments);
    // 保留已标记的还款状态
    const oldSchedule = get().schedule;
    const paidMap = new Map(oldSchedule.map((s) => [s.period, s.paid]));

    const updatedSchedule = schedule.map((s) => ({
      ...s,
      paid: paidMap.get(s.period) || false,
    }));

    set({ prepayments, schedule: updatedSchedule });
    get().saveToStorage();
  },

  updatePrepayment: (id, record) => {
    const prepayments = get().prepayments.map((p) =>
      p.id === id ? { ...record, id } : p
    );
    const loanInfo = get().loanInfo;
    if (!loanInfo) return;

    const schedule = recalcAll(loanInfo, prepayments);
    const oldSchedule = get().schedule;
    const paidMap = new Map(oldSchedule.map((s) => [s.period, s.paid]));

    const updatedSchedule = schedule.map((s) => ({
      ...s,
      paid: paidMap.get(s.period) || false,
    }));

    set({ prepayments, schedule: updatedSchedule });
    get().saveToStorage();
  },

  deletePrepayment: (id) => {
    const prepayments = get().prepayments.filter((p) => p.id !== id);
    const loanInfo = get().loanInfo;
    if (!loanInfo) return;

    const schedule = recalcAll(loanInfo, prepayments);
    const oldSchedule = get().schedule;
    const paidMap = new Map(oldSchedule.map((s) => [s.period, s.paid]));

    const updatedSchedule = schedule.map((s) => {
      const wasPaid = paidMap.get(s.period);
      return {
        ...s,
        paid: wasPaid !== undefined ? wasPaid : false,
      };
    });

    set({ prepayments, schedule: updatedSchedule });
    get().saveToStorage();
  },

  exportData: () => {
    const state = get();
    const data: LoanData = {
      loanInfo: state.loanInfo!,
      schedule: state.schedule,
      prepayments: state.prepayments,
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
      meta: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
}));