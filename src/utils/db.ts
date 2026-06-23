import type { LoanData } from '@/types/loan';

/**
 * IndexedDB 本地数据库存储
 * - 比 localStorage 容量更大（50MB+）
 * - 清除浏览器缓存时不会丢失（IndexedDB 不属于缓存）
 * - 支持结构化数据
 */

const DB_NAME = 'loan_repayment_db';
const DB_VERSION = 1;
const STORE_NAME = 'loan_data';
const RECORD_KEY = 'main';

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前浏览器不支持 IndexedDB'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * 从 IndexedDB 读取数据
 */
export async function loadFromDB(): Promise<LoanData | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(RECORD_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(request.result || null);
      };
    });
  } catch (err) {
    console.error('IndexedDB 读取失败，尝试 localStorage 回退:', err);
    return loadFromLocalStorage();
  }
}

/**
 * 保存数据到 IndexedDB
 */
export async function saveToDB(data: LoanData): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(data, RECORD_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.error('IndexedDB 保存失败，回退到 localStorage:', err);
    saveToLocalStorage(data);
  }
}

/**
 * 清空 IndexedDB 数据
 */
export async function clearDB(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(RECORD_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.error('IndexedDB 清空失败:', err);
  }
  // 同时清理 localStorage
  localStorage.removeItem('loan_repayment_data_v2');
}

// ============ localStorage 回退方案 ============

const STORAGE_KEY = 'loan_repayment_data_v2';

function loadFromLocalStorage(): LoanData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveToLocalStorage(data: LoanData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('localStorage 保存失败:', err);
  }
}
