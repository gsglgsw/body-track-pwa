// src/models/userModel.js
import db from './db.js';

export default class UserModel {
    /**
     * 產生並取得裝置指紋 (Device Fingerprint)
     * 結合瀏覽器特徵與時間戳，確保單一裝置唯一性
     * @returns {string} 裝置指紋 Hash
     */
    static _generateFingerprint() {
        const { userAgent, language } = navigator;
        const { width, height, colorDepth } = screen;
        const rawString = `${userAgent}-${language}-${width}x${height}-${colorDepth}`;

        let hash = 0;
        for (let i = 0; i < rawString.length; i++) {
            const char = rawString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        // 組合 Hash 與 UUID (使用時間戳輔助)
        return `DEV-${Math.abs(hash).toString(16)}-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;
    }

   /**
     * 初始化或更新用戶基本資料
     */
    static async saveProfile(profileData) {
        try {
            if (profileData.height && (profileData.height <= 0 || profileData.height > 300)) throw new Error('Invalid height provided.');
            if (profileData.gender && !['male', 'female'].includes(profileData.gender)) throw new Error('Invalid gender provided.');

            let profile = await db.userProfile.toCollection().first();
            
            if (!profile) {
                profile = {
                    userId: crypto.randomUUID ? crypto.randomUUID() : `USER-${Date.now()}`,
                    fingerprint: this._generateFingerprint(),
                    registrationDate: new Date().toISOString()
                };
            }

            // 🚩 擴充儲存 goalWaist
            profile = {
                ...profile,
                ...profileData, 
                birthYear: profileData.birthYear ? parseInt(profileData.birthYear, 10) : profile.birthYear,
                height: profileData.height ? parseFloat(profileData.height) : profile.height,
                goalWeight: profileData.goalWeight ? parseFloat(profileData.goalWeight) : profile.goalWeight,
                goalBodyFat: profileData.goalBodyFat ? parseFloat(profileData.goalBodyFat) : profile.goalBodyFat,
                goalWaist: profileData.goalWaist ? parseFloat(profileData.goalWaist) : profile.goalWaist
            };

            await db.userProfile.put(profile);
            return profile;
        } catch (error) {
            console.error('[UserModel Error] saveProfile 失敗:', error);
            throw error;
        }
    }

    /**
     * 取得用戶設定檔 (包含認證用的 Fingerprint)
     * @returns {Promise<Object|undefined>}
     */
    static async getProfile() {
        return await db.userProfile.toCollection().first();
    }
    /**
     * 🚩 徹底清除本機的所有 IndexedDB 資料 (登出用)
     */
    static async clearAllLocalData() {
        try {
            // 🚩 修正：我們的資料表名稱是 userProfile，不是 users
            await db.userProfile.clear();
            await db.dailyRecords.clear();
            console.log('[Model] 本機快取已徹底清除');
        } catch (error) {
            console.error('[Model] 清除快取失敗:', error);
            throw new Error('無法清除本地資料庫');
        }
    }
}