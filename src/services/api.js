// src/services/api.js

/**
 * 系統全域設定 (可視專案規模抽離為 config.js)
 */
export const CONFIG = {
    // 將你剛才部署取得的 Web App URL 填入此處
    GAS_API_URL: 'https://script.google.com/macros/s/AKfycbzHhch-OHOfhC5yOIc8RWhWNlnhmNuz38oYmQATyRTth2iQnZW1RdRLoN3dEk2SRYteRg/exec'
};

export default class ApiService {
    /**
     * 核心請求方法
     * @param {Object} payload - 要發送的 JSON 內容 (包含 action, userId, fingerprint, payload)
     * @returns {Promise<Object>} API 回傳的 data 區塊
     */
    static async _request(payload) {
        if (!navigator.onLine) {
            throw new Error('OFFLINE_MODE');
        }

        try {
            const response = await fetch(CONFIG.GAS_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP_ERROR_${response.status}`);
            }

            const result = await response.json();

            if (result.status === 'error') {
                throw new Error(`API_ERROR: ${result.message} (Code: ${result.code})`);
            }

            // 🚩 核心修復：改為回傳完整的 result 物件，而不是 result.data
            // 這樣 Controller 就能正確讀取到 result.status 與 result.message
            return result; 
            
        } catch (error) {
            console.error('[ApiService] Request failed:', error);
            throw error;
        }
    }

    /**
     * 註冊使用者裝置
     * @param {string} userId 
     * @param {string} fingerprint 
     * @param {Object} profileData 
     */
    static async registerUser(userId, fingerprint, profileData) {
        return this._request({
            action: 'register',
            userId: userId,
            fingerprint: fingerprint,
            payload: profileData
        });
    }

    /**
     * 批次同步日常紀錄
     * @param {string} userId 
     * @param {string} fingerprint 
     * @param {Array} records 
     */
    static async batchSyncRecords(userId, fingerprint, records) {
        return this._request({
            action: 'batchSync',
            userId: userId,
            fingerprint: fingerprint,
            payload: records
        });
    }
    /**
         * 🚩 發送綁定 Google 帳號的請求
         */
    /**
     * 🚩 發送綁定 Google 帳號的請求 (已修正變數指向與封裝)
     */
    static async linkGoogleAccount(currentUserId, email, fingerprint) {
        return this._request({
            action: 'linkGoogleAccount',
            currentUserId: currentUserId,
            email: email,
            fingerprint: fingerprint
        });
    }
}
