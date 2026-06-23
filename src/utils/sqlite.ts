import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import type { LoanData } from '@/types/loan';

/**
 * SQLite 本地存储（基于 sql.js + IndexedDB 持久化）
 *
 * 工作原理：
 * - sql.js 是 SQLite 编译成 WebAssembly 的版本，在浏览器中运行真正的 SQLite 引擎
 * - 数据库文件（.db 二进制）持久化到 IndexedDB，清浏览器缓存不丢失
 * - 支持标准 SQL 查询
 * - 可导出为 .db 文件，符合 SQLite 标准
 * - 如果 sql.js 加载失败，自动回退到 localStorage
 *
 * 注意：浏览器端的 SQLite 仍绑定单个浏览器，跨浏览器需配合云同步
 */

const DB_NAME = 'loan_sqlite_db';
const STORE_NAME = 'sqlite_store';
const DB_KEY = 'main_db';
const SQL_WASM_PATH = `${import.meta.env.BASE_URL}sql-wasm.wasm`;
const FALLBACK_KEY = 'loan_repayment_data_v2';

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
let initPromise: Promise<Database | null> | null = null;
let useFallback = false;

/**
 * 初始化 SQLite 数据库
 */
async function initDB(): Promise<Database | null> {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // 加载 sql.js
      SQL = await initSqlJs({
        locateFile: () => SQL_WASM_PATH,
      });

      // 尝试从 IndexedDB 加载已有的数据库二进制
      const savedBinary = await loadBinaryFromIndexedDB();
      if (savedBinary) {
        db = new SQL.Database(savedBinary);
      } else {
        db = new SQL.Database();
        createTables(db);
        await persistDB();
      }

      return db;
    } catch (err) {
      console.warn('sql.js 加载失败，回退到 localStorage:', err);
      useFallback = true;
      return null;
    }
  })();

  return initPromise;
}

/**
 * 创建数据库表
 */
function createTables(database: Database): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS loan_data (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

/**
 * 把 SQLite 数据库二进制持久化到 IndexedDB
 */
async function persistDB(): Promise<void> {
  if (!db) return;
  const binary = db.export();
  await saveBinaryToIndexedDB(binary);
}

/**
 * 从 IndexedDB 读取数据库二进制
 */
function loadBinaryFromIndexedDB(): Promise<Uint8Array | null> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        resolve(null);
        return;
      }
      const tx = database.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(DB_KEY);
      getReq.onsuccess = () => resolve(getReq.result || null);
      getReq.onerror = () => reject(getReq.error);
    };
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * 保存数据库二进制到 IndexedDB
 */
function saveBinaryToIndexedDB(binary: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB 不可用'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const tx = database.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const putReq = store.put(binary, DB_KEY);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * 从 SQLite 读取贷款数据
 */
export async function loadFromSQLite(): Promise<LoanData | null> {
  try {
    const database = await initDB();

    // 回退模式：从 localStorage 读取
    if (useFallback || !database) {
      const raw = localStorage.getItem(FALLBACK_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    }

    const result = database.exec('SELECT data FROM loan_data WHERE id = 1');
    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }
    const dataStr = result[0].values[0][0] as string;
    return JSON.parse(dataStr);
  } catch (err) {
    console.error('SQLite 读取失败:', err);
    // 最后尝试 localStorage
    const raw = localStorage.getItem(FALLBACK_KEY);
    if (raw) return JSON.parse(raw);
    return null;
  }
}

/**
 * 保存贷款数据到 SQLite
 */
export async function saveToSQLite(data: LoanData): Promise<void> {
  try {
    const database = await initDB();

    // 回退模式：保存到 localStorage
    if (useFallback || !database) {
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(data));
      return;
    }

    const dataStr = JSON.stringify(data);
    const now = new Date().toISOString();

    database.run(
      'INSERT OR REPLACE INTO loan_data (id, data, updated_at) VALUES (1, ?, ?)',
      [dataStr, now]
    );

    await persistDB();
  } catch (err) {
    console.error('SQLite 保存失败，回退到 localStorage:', err);
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(data));
  }
}

/**
 * 清空 SQLite 数据库
 */
export async function clearSQLite(): Promise<void> {
  try {
    const database = await initDB();
    if (database && !useFallback) {
      database.run('DELETE FROM loan_data WHERE id = 1');
      await persistDB();
    }
  } catch (err) {
    console.error('SQLite 清空失败:', err);
  }
  // 同时清理 localStorage
  localStorage.removeItem(FALLBACK_KEY);
}

/**
 * 导出 SQLite 数据库为二进制文件（.db）
 */
export async function exportSQLiteFile(): Promise<Blob> {
  const database = await initDB();
  const binary = database.export();
  return new Blob([binary], { type: 'application/x-sqlite3' });
}

/**
 * 执行自定义 SQL 查询（高级功能）
 */
export async function executeQuery(sql: string, params: any[] = []): Promise<any[]> {
  const database = await initDB();
  const result = database.exec(sql, params);
  if (result.length === 0) return [];
  return result[0].values.map((row) => {
    const obj: Record<string, any> = {};
    result[0].columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}
