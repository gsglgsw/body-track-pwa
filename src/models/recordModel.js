// src/models/recordModel.js
import db from './db.js';
import UserModel from './userModel.js';

export default class RecordModel {
  /**
   * 計算 BMI (內部私有方法)
   * 公式：體重(kg) / (身高(m) 的平方)
   */
  static _calculateBMI(weight, heightCm) {
    const heightM = heightCm / 100;
    const bmi = weight / (heightM * heightM);
    return parseFloat(bmi.toFixed(2)); // 取小數點後兩位
  }

  /**
     * 儲存或更新單日紀錄
     * 🚩 支援 Soft Clear：若傳入空字串，將轉換為 null 儲存
     */
    static async saveRecord(dateStr, data) {
        try {
            // 🚩 核心修正：三元運算子防呆。若為空字串或 null，直接存為 null；否則才進行 parseFloat
            const parsedWeight = (data.weight === '' || data.weight === null) ? null : parseFloat(data.weight);
            const parsedBodyFat = (data.bodyFat === '' || data.bodyFat === null) ? null : parseFloat(data.bodyFat);
            const parsedWaist = (data.waist === '' || data.waist === null) ? null : parseFloat(data.waist);

            // 嚴格型別檢查：如果不是 null (代表有輸入值)，且轉換後是 NaN，才拋出錯誤攔截
            if (parsedWeight !== null && isNaN(parsedWeight)) throw new Error('Invalid weight value: NaN');
            if (parsedBodyFat !== null && isNaN(parsedBodyFat)) throw new Error('Invalid bodyFat value: NaN');
            if (parsedWaist !== null && isNaN(parsedWaist)) throw new Error('Invalid waist value: NaN');

            const record = {
                id: `REC-${dateStr}`,
                date: dateStr,
                weight: parsedWeight,
                bodyFat: parsedBodyFat,
                waist: parsedWaist,
                isPeriodStart: data.isPeriodStart || false,
                syncStatus: 'pending', // 標記為待同步
                updatedAt: new Date().toISOString()
            };

            await db.dailyRecords.put(record);
            return record;
        } catch (error) {
            console.error('[RecordModel Error] saveRecord 失敗:', error);
            throw error; 
        }
    }
  /**
   * 取得指定日期的紀錄
   * @param {string} dateString - 'YYYY-MM-DD'
   */
  static async getRecordByDate(dateString) {
    // 🚩 核心修正：確保查詢單筆資料時，主鍵加上 'REC-' 前綴
    const queryId = dateString.startsWith('REC-') ? dateString : `REC-${dateString}`;
    return await db.dailyRecords.get(queryId);
  }

  static async getRecordsRange(startDate, endDate) {
    // 🚩 確保查詢的起始與結束 ID 包含 'REC-' 字首，與 saveRecord 的 id 格式對齊
    const startId = startDate.startsWith('REC-') ? startDate : `REC-${startDate}`;
    const endId = endDate.startsWith('REC-') ? endDate : `REC-${endDate}`;

    return await db.dailyRecords
      .where('id')
      .between(startId, endId, true, true) // inclusive
      .sortBy('id');
  }

  /**
   * 取得所有等待同步至 GAS 的資料
   */
  static async getPendingSyncRecords() {
    return await db.dailyRecords.where('syncStatus').equals('pending').toArray();
  }
  
  /**
   * 同步完成後更新狀態
   * @param {string} dateString - 'YYYY-MM-DD'
   */
  static async markAsSynced(dateString) {
    return await db.dailyRecords.update(dateString, { syncStatus: 'synced' });
  }
}