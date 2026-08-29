// api/send-push.js
const webpush = require('web-push');

// 1. 初始化 VAPID 設定 (讀取 Vercel 環境變數)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

// 2. 定義 Serverless API 處理邏輯
module.exports = async (req, res) => {
    // 處理 CORS 預檢請求
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 嚴格限制只能使用 POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed. 只允許 POST 請求。' });
    }

    try {
        const { subscription, payload } = req.body;

        if (!subscription) {
            return res.status(400).json({ error: 'Bad Request: 缺少 subscription 物件。' });
        }

        if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
            console.error('[Web Push Error] 伺服器未設定 VAPID 環境變數');
            return res.status(500).json({ error: '伺服器設定錯誤' });
        }

        // 3. 發射推播訊號！
        await webpush.sendNotification(subscription, JSON.stringify(payload || {}));
        
        res.status(200).json({ status: 'success', message: '推播發射成功！' });

    } catch (error) {
        console.error('[Web Push Error] 推播發射失敗:', error);
        res.status(500).json({ 
            status: 'error', 
            message: '推播發射失敗', 
            details: error.message 
        });
    }
};