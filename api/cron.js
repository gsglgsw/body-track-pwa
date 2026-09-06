// api/cron.js
const webpush = require('web-push');

webpush.setVapidDetails(
    'mailto:gsglgsw@gmail.com', // ⚠️ 務必換成你的 Email
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
    // 🛡️ 資安防呆：驗證是否為 Vercel Cron 發出的合法請求
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ status: 'error', message: 'Unauthorized (金鑰無效)' });
    }

    try {
        // 1. 精準計算台灣時間 (UTC+8) 的當前小時
        const now = new Date();
        const twHour = (now.getUTCHours() + 8) % 24;
        const targetTime = `${String(twHour).padStart(2, '0')}:00`; 

        console.log(`[Cron] 啟動！目標推播時段: ${targetTime}`);

        // 2. 呼叫 GAS 取得名單
        const gasRes = await fetch(process.env.GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_push_targets', targetTime })
        });

        const gasData = await gasRes.json();
        if (gasData.status !== 'success') throw new Error('GAS 取資料失敗');

        const targets = gasData.data || [];
        console.log(`[Cron] 撈取成功，共 ${targets.length} 位使用者需要推播。`);

        if (targets.length === 0) {
            return res.status(200).json({ status: 'success', message: '該時段無人需要推播' });
        }

        // 3. 打包所有推播請求 (高併發架構)
        const pushPromises = targets.map(user => {
            let bodyText = '開啟輕盈日記，記錄今天的變化吧！';
            if (user.notifyMeasurement && user.notifySummary) bodyText = '早安！該填寫今日體態了，並查看今日的手札清單！';
            else if (user.notifySummary) bodyText = '早安！您今天有手札待辦事項需要確認喔！';
            else if (user.notifyMeasurement) bodyText = '早安！請記得站上體重計，記錄今天的體態數值。';

            const payload = {
                title: '🔔 輕盈日記晨報',
                body: bodyText,
                url: '/'
            };

            return webpush.sendNotification(user.subscription, JSON.stringify(payload));
        });

        // 4. 併發執行並等待所有推播完成 (解決 Vercel 10 秒 Timeout 限制)
        const results = await Promise.allSettled(pushPromises);
        
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failCount = results.filter(r => r.status === 'rejected').length;

        return res.status(200).json({ 
            status: 'success', 
            targetTime,
            stats: { total: targets.length, success: successCount, failed: failCount }
        });

    } catch (error) {
        console.error('[Cron Error]', error);
        return res.status(500).json({ status: 'error', message: error.message });
    }
}