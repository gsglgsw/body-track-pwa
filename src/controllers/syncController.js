// src/controllers/syncController.js
import UserModel from '../models/userModel.js';
import NoteModel from '../models/noteModel.js';
import db from '../models/db.js';
import ApiService from '../services/api.js';

export default class SyncController {
  
    /**
     * 🚩 執行全域資料同步 (Profile + Records + Notes)
     */
    static async syncAllPendingData() {
        if (!navigator.onLine) {
            console.warn('[Sync] 目前離線，暫停同步');
            return false;
        }

        try {
            const profile = await UserModel.getProfile();
            if (!profile || !profile.boundEmail) {
                return false; // 訪客模式不執行雲端同步
            }

            // 1. 同步前先執行垃圾清理，保持 Payload 輕量
            await NoteModel.cleanUpExpiredNotes();

            // 2. 抓取所有準備同步的資料
            // 🚩 核心修復：直接使用 Dexie 原生的 toArray() 獲取全表資料，解決 TypeError 崩潰
            const records = await db.dailyRecords.toArray(); 
            const notes = await db.routineNotes.toArray();

            const payload = {
                action: 'sync_all',
                userId: profile.userId,
                fingerprint: profile.fingerprint,
                email: profile.boundEmail,
                profile: profile,
                records: records,
                notes: notes
            };

            console.log('[Sync] 開始上傳資料至雲端...', payload);

            // 3. 呼叫 API 執行同步
            const response = await ApiService.syncData(payload);

            if (response && response.status === 'success') {
                console.log('[Sync] 雲端同步完成');
                return true;
            } else {
                throw new Error(response?.message || '同步回傳格式錯誤');
            }

        } catch (error) {
            console.error('[Sync] 同步失敗:', error);
            return false;
        }
    }
}