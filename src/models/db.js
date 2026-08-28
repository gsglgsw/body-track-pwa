// src/models/db.js
// 需在 HTML 引入: <script src="https://unpkg.com/dexie@latest/dist/dexie.js"></script>

/**
 * 初始化 Dexie 本地資料庫
 * @type {Dexie}
 */
const db = new Dexie('BodyTrackPWA_DB');

// 初始版本
db.version(1).stores({
  userProfile: 'userId, fingerprint',
  dailyRecords: 'id, syncStatus, isPeriodStart'
});

// 🚩 正確升級寫法：僅宣告新增的 routineNotes 資料表
db.version(2).stores({
  routineNotes: 'id, category, status'
});

export default db;