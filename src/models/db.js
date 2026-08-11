// src/models/db.js
// 需在 HTML 引入: <script src="https://unpkg.com/dexie@latest/dist/dexie.js"></script>

/**
 * 初始化 Dexie 本地資料庫
 * @type {Dexie}
 */
const db = new Dexie('BodyTrackPWA_DB');

// 定義資料庫版本與 Schema (僅需定義 Primary Key 與需要被 Search/Index 的欄位)
db.version(1).stores({
  // userId 作為主鍵，fingerprint 作為索引
  userProfile: 'userId, fingerprint',
  
  // id 格式為 YYYY-MM-DD，syncStatus 用於查詢離線未同步資料，isPeriodStart 用於日曆標記
  dailyRecords: 'id, syncStatus, isPeriodStart'
});

export default db;