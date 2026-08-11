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
   * 儲存每日體態紀錄 (支援 Insert & Update)
   * @param {string} dateString - 格式 'YYYY-MM-DD'
   * @param {Object} data - { weight, bodyFat, waist, isPeriodStart }
   */
  static async saveRecord(dateString, data) {
    try {
      // 1. 取得使用者基本資料以獲取身高 (用於計算 BMI)
      const profile = await UserModel.getProfile();
      if (!profile || !profile.height) {
        throw new Error('User profile missing. Please setup profile first.');
      }

      // 2. 防呆攔截 (紅旗機制：防止垃圾資料寫入)
      const weight = parseFloat(data.weight);
      if (isNaN(weight) || weight < 20 || weight > 300) {
        throw new Error(`Invalid weight value: ${weight}`);
      }

      const bodyFat = data.bodyFat ? parseFloat(data.bodyFat) : null;
      const waist = data.waist ? parseFloat(data.waist) : null;
      const isPeriodStart = data.isPeriodStart === true; // 強制轉布林

      // 3. 封裝並寫入本地端 DB
      const record = {
        id: dateString,
        weight: weight,
        bodyFat: bodyFat,
        bmi: this._calculateBMI(weight, profile.height),
        waist: waist,
        isPeriodStart: isPeriodStart,
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
    return await db.dailyRecords.get(dateString);
  }

  /**
   * 取得區間紀錄 (用於 Chart.js 繪製圖表)
   * @param {string} startDate - 'YYYY-MM-DD'
   * @param {string} endDate - 'YYYY-MM-DD'
   * @returns {Promise<Array>} 排序後的紀錄陣列
   */
  static async getRecordsRange(startDate, endDate) {
    return await db.dailyRecords
      .where('id')
      .between(startDate, endDate, true, true) // inclusive
      .sortBy('id'); // 確保依照時間遞增排序
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