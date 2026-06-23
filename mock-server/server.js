// mock server 主代码
// 使用 Node 内置模块（http, fs）模拟 Cloudflare Worker API，供前端 E2E 测试使用
// 不依赖任何第三方包

const http = require('http');
const fs = require('fs');

const PORT = 8787;
const DATA_FILE = __dirname + '/data.json';

// 全局内存数据：启动时从 data.json 加载，每次写入后同步保存到文件（持久化）
let store = { data: null, updatedAt: null };

// 计算今天的日期字符串，格式 YYYY-MM-DD（使用 UTC，与真实 Worker 保持一致）
function getTodayStr() {
  const d = new Date();
  const todayStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return todayStr;
}

// 从文件加载数据到内存；文件不存在则创建初始数据
function loadStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      // 兼容旧文件，确保 data / updatedAt 字段存在
      store = {
        data: parsed && parsed.data !== undefined ? parsed.data : null,
        updatedAt: parsed && parsed.updatedAt !== undefined ? parsed.updatedAt : null,
      };
    } else {
      // 文件不存在，创建初始数据并写入
      store = { data: null, updatedAt: null };
      saveStore();
    }
  } catch (e) {
    // 解析失败，回退到默认数据并保存
    store = { data: null, updatedAt: null };
    saveStore();
  }
}

// 同步保存内存数据到 data.json，确保持久化
function saveStore() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

// 统一发送 JSON 响应（附带 CORS 头，允许所有源）
function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Write-Key',
  });
  res.end(body);
}

// 通过 data / end 事件累积读取请求体
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

// 创建 HTTP 服务器
const server = http.createServer(async (req, res) => {
  try {
    const method = req.method;
    // 去掉查询字符串，只保留路径部分（前端读取时会带 ?t=时间戳 防缓存）
    const url = req.url.split('?')[0];

    // 处理 CORS 预检请求，返回 204
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Write-Key',
      });
      res.end();
      return;
    }

    // 1. GET /api/health —— 健康检查
    if (method === 'GET' && url === '/api/health') {
      sendJSON(res, 200, { ok: true, time: new Date().toISOString() });
      return;
    }

    // 2. GET /api/data —— 读取当前数据
    if (method === 'GET' && url === '/api/data') {
      sendJSON(res, 200, { data: store.data, updatedAt: store.updatedAt });
      return;
    }

    // 3. POST /api/data —— 保存数据
    if (method === 'POST' && url === '/api/data') {
      // 若设置了 WRITE_KEY 环境变量，则必须校验 X-Write-Key 请求头
      if (process.env.WRITE_KEY) {
        const key = req.headers['x-write-key'];
        if (key !== process.env.WRITE_KEY) {
          sendJSON(res, 401, { success: false, error: '无写入权限' });
          return;
        }
      }
      // 读取并解析请求体
      let raw;
      try {
        raw = await readBody(req);
      } catch (e) {
        sendJSON(res, 400, { success: false, error: '读取请求体失败' });
        return;
      }
      let data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        sendJSON(res, 400, { success: false, error: '无效的 JSON' });
        return;
      }
      // 保存数据并更新时间戳
      store.data = data;
      store.updatedAt = new Date().toISOString();
      saveStore();
      sendJSON(res, 200, { success: true, updatedAt: store.updatedAt });
      return;
    }

    // 4. POST /api/recalc —— 按今天日期重算 schedule 中每项的 paid 字段
    if (method === 'POST' && url === '/api/recalc') {
      const now = new Date().toISOString();
      // 无数据时直接返回
      if (!store.data) {
        sendJSON(res, 200, { success: true, updated: 0, updatedAt: now });
        return;
      }
      const todayStr = getTodayStr();
      let changed = 0; // 记录 paid 值发生变化的条数
      const schedule = store.data.schedule;
      if (Array.isArray(schedule)) {
        for (const item of schedule) {
          if (!item || typeof item.date !== 'string') continue;
          const oldPaid = item.paid === true;
          let newPaid;
          if (item.date <= todayStr) {
            // 日期已到（含今天），标记为已还
            newPaid = true;
          } else {
            // 日期未到，保留用户提前手动标记的 paid=true
            newPaid = oldPaid;
          }
          // 仅当值发生变化时更新并计数
          if (newPaid !== oldPaid) {
            item.paid = newPaid;
            changed++;
          }
        }
      }
      store.updatedAt = now;
      saveStore();
      sendJSON(res, 200, { success: true, updated: changed, updatedAt: now });
      return;
    }

    // 未匹配的路由
    sendJSON(res, 404, { error: 'Not Found' });
  } catch (e) {
    // 兜底错误处理
    sendJSON(res, 500, { error: 'Internal Server Error' });
  }
});

// 启动时加载数据
loadStore();

// 启动服务器
server.listen(PORT, () => {
  console.log(`Mock server running on http://localhost:${PORT}`);
});
