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
        // 防呆：離線攔截。若瀏覽器判斷離線，直接拋出特定錯誤，不浪費資源發 Request
        if (!navigator.onLine) {
            throw new Error('OFFLINE_MODE');
        }

        try {
            const response = await fetch(CONFIG.GAS_API_URL, {
                method: 'POST', // GAS Web App 限制 CORS 最佳實踐通常使用 POST 傳遞 JSON
                headers: {
                    // 注意：GAS 有時會擋 'application/json' 導致 CORS 預檢失敗，
                    // 若發生 CORS 錯誤，可改為 'text/plain;charset=utf-8'，GAS 端的 JSON.parse 依然能解析。
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify(payload)
            });

            // 檢查 HTTP 狀態碼
            if (!response.ok) {
                throw new Error(`HTTP_ERROR_${response.status}`);
            }

            const result = await response.json();

            // 檢查 GAS 後端自定義的狀態碼 (符合我們稍早寫的 ResponseFormatter)
            if (result.status === 'error') {
                throw new Error(`API_ERROR: ${result.message} (Code: ${result.code})`);
            }

            return result.data;
        } catch (error) {
            // 收斂錯誤訊息格式，方便 Controller 進行 Error Handling
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
    static async linkGoogleAccount(currentUserId, email, fingerprint) {
        try {
            const response = await fetch(this.GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'linkGoogleAccount',
                    currentUserId: currentUserId,
                    email: email,
                    fingerprint: fingerprint
                })
            });

            if (!response.ok) throw new Error('API 網路請求失敗');
            return await response.json();
        } catch (error) {
            console.error('[ApiService] 帳號綁定失敗:', error);
            throw error;
        }
    }
}
