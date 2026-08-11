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
     * @param {Object} profileData - { gender, birthYear, height }
     * @returns {Promise<Object>} 儲存後的完整用戶資料
     */
    static async saveProfile(profileData) {
    try {
      // 擴充接收 goalWeight 與 goalBodyFat
      const { gender, birthYear, height, goalWeight, goalBodyFat } = profileData;
      
      if (!height || height <= 0 || height > 300) throw new Error('Invalid height provided.');
      if (!['male', 'female'].includes(gender)) throw new Error('Invalid gender provided.');

      let profile = await db.userProfile.toCollection().first();
      
      if (!profile) {
        profile = {
          userId: crypto.randomUUID ? crypto.randomUUID() : `USER-${Date.now()}`,
          fingerprint: this._generateFingerprint(),
          registrationDate: new Date().toISOString()
        };
      }

      // 更新變動數值
      profile = {
        ...profile,
        gender,
        birthYear: parseInt(birthYear, 10),
        height: parseFloat(height),
        goalWeight: goalWeight ? parseFloat(goalWeight) : null,
        goalBodyFat: goalBodyFat ? parseFloat(goalBodyFat) : null
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
}