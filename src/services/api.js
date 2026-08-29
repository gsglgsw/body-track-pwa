// src/services/api.js

// 🚩 請將下方引號內的網址，替換為你 GAS 部署出來的「網頁應用程式 URL」
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzHhch-OHOfhC5yOIc8RWhWNlnhmNuz38oYmQATyRTth2iQnZW1RdRLoN3dEk2SRYteRg/exec'; 

export default class ApiService {
    
    /**
     * 🚩 全域同步大腦 (Profile + Records + Notes)
     * @param {Object} payload 包含 action: 'sync_all' 與所有資料的 JSON 物件
     */
    static async syncData(payload) {
        try {
            const response = await fetch(GAS_URL, {
                method: 'POST',
                // GAS 接收 POST 請求時，建議將 body 轉為字串
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('[ApiService Error] syncData 失敗:', error);
            throw error;
        }
    }

    /**
     * 綁定 Google 帳號 (維持原有的登入連線功能)
     */
    static async linkGoogleAccount(userId, email, fingerprint) {
        try {
            const response = await fetch(GAS_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'link_google',
                    userId: userId,
                    email: email,
                    fingerprint: fingerprint
                })
            });
            return await response.json();
        } catch (error) {
            console.error('[ApiService Error] linkGoogleAccount 失敗:', error);
            throw error;
        }
    }

    /**
     * 註冊/更新使用者基本資料 (保留作為向下相容或特定更新使用)
     */
    static async registerUser(userId, fingerprint, data) {
        try {
            const response = await fetch(GAS_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'register',
                    userId: userId,
                    fingerprint: fingerprint,
                    data: data
                })
            });
            return await response.json();
        } catch (error) {
            console.error('[ApiService Error] registerUser 失敗:', error);
            throw error;
        }
    }
    /**
     * 🚩 新增：向 GAS 拉取老玩家的所有雲端資料
     */
    static async pullCloudData(userId) {
        try {
            const response = await fetch(GAS_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'pull_data',
                    userId: userId
                })
            });
            return await response.json();
        } catch (error) {
            console.error('[ApiService Error] pullCloudData 失敗:', error);
            throw error;
        }
    }
}