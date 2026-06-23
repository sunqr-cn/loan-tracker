-- 公积金贷款还款计划数据表
-- 使用单行表设计（id 固定为 1），所有用户共享同一份数据
CREATE TABLE IF NOT EXISTS loan_data (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
