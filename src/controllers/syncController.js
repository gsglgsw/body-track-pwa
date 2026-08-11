// src/controllers/syncController.js
import RecordModel from '../models/recordModel.js';
import UserModel from '../models/userModel.js';
import ApiService from '../services/api.js';

export default class SyncController {
  
  /**
   * 執行全域資料同步
   * 建議在以下時機點觸發：
   * 1. App 啟動時 (且有網路連線)
   * 2. 使用者新增/修改完一筆資料後 (背景觸發)
   * 3. 網路從 offline 恢復成 online 時 (window.addEventListener('online', ...))
   */
  static async syncAllPendingData() {
    try {
      console.log('[SyncController] 開始檢查待同步資料...');

      // 1. 取得需要同步的資料
      const pendingRecords = await RecordModel.getPendingSyncRecords();
      
      // 若沒有資料需要同步，提早 return 結束流程
      if (!pendingRecords || pendingRecords.length === 0) {
        console.log('[SyncController] 沒有待同步的資料。');
        return true; 
      }

      console.log(`[SyncController] 發現 ${pendingRecords.length} 筆待同步資料，準備上傳。`);

      // 2. 獲取用戶驗證資料
      const profile = await UserModel.getProfile();
      if (!profile || !profile.userId || !profile.fingerprint) {
        throw new Error('遺失用戶驗證資訊 (userId 或 fingerprint)。');
      }

      // 3. 發送至 GAS 進行批次同步
      await ApiService.batchSyncRecords(
        profile.userId,
        profile.fingerprint,
        pendingRecords
      );

      // 4. 同步成功，將本地 IndexedDB 內的狀態改為 'synced'
      // 避免使用 Promise.all() 平行處理，改用 for...of 確保每筆 IndexedDB 更新都成功
      for (const record of pendingRecords) {
        await RecordModel.markAsSynced(record.id);
      }

      console.log('[SyncController] 批次同步完成。');
      return true;

    } catch (error) {
      if (error.message === 'OFFLINE_MODE') {
        console.warn('[SyncController] 目前處於離線狀態，同步已暫停，將於下次連線時自動處理。');
        return false; // 離線不是系統錯誤，安靜失敗即可
      }
      
      // 記錄真實錯誤，供開發者追蹤
      console.error('[SyncController] 同步過程發生異常:', error);
      
      // 在 UI 層（若有綁定）可以考慮跳出 Toast 提示使用者
      return false;
    }
  }
}