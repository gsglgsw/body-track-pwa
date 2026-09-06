const webpush = require('web-push');

webpush.setVapidDetails(
    'mailto:gsglgsw@gmail.com', // ⚠️ 請換成你的真實 Email
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

module.exports = async function handler(req, res) { // 🚩 修正了語法錯誤
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed. 只允許 POST 請求。' });
    }

    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ status: 'error', message: 'Unauthorized (金鑰無效)' });
    }

    try {
        const now = new Date();
        const twHour = (now.getUTCHours() + 8) % 24;
        const targetTime = `${String(twHour).padStart(2, '0')}:00`; 
        
        // 🚩 取得台灣今天的日期字串 (YYYY-MM-DD)，傳給 GAS 作為比對基準
        const twNow = new Date(now.getTime() + (8 * 60 * 60 * 1000));
        const todayStr = `${twNow.getUTCFullYear()}-${String(twNow.getUTCMonth() + 1).padStart(2, '0')}-${String(twNow.getUTCDate()).padStart(2, '0')}`;

        console.log(`[Cron] 啟動！目標時段: ${targetTime}, 基準日: ${todayStr}`);

        const gasRes = await fetch(process.env.GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_push_targets', targetTime, todayStr })
        });

        // 🚩 升級：捕捉非 JSON 的致命錯誤 (如權限擋網頁) 或 GAS 的詳細報錯
        let gasData;
        const rawText = await gasRes.text(); // 先以純文字讀取
        
        try {
            gasData = JSON.parse(rawText);
        } catch (e) {
            console.error('💥 [GAS 致命錯誤] 回傳非 JSON 格式:', rawText.substring(0, 500));
            throw new Error('GAS 回傳格式錯誤，請檢查 GAS 網址與權限設定。');
        }

        if (gasData.status !== 'success') {
            console.error('🚨 [GAS 邏輯錯誤] 詳細原因:', gasData); // 將真正死因印在 Log 上
            throw new Error(`GAS 取資料失敗: ${gasData.message || '未知錯誤'}`);
        }

       
        const targets = gasData.data || [];
        
        if (targets.length === 0) {
            return res.status(200).json({ status: 'success', message: '該時段無人需要推播' });
        }

        const pushPromises = targets.map(user => {
            let bodyText = '開啟輕盈日記，記錄今天的變化吧！';
            if (user.notifyMeasurement && user.notifySummary) bodyText = '早安！該填寫今日體態了，並查看今日的手札清單！';
            else if (user.notifySummary) bodyText = '早安！您今天有手札待辦事項需要確認喔！';
            else if (user.notifyMeasurement) bodyText = '早安！請記得站上體重計，記錄今天的體態數值。';

            // 🚩 新增：如果有今天到期的手札，在原本的推播文字後面加上嚴重警告！
            if (user.expiringNotes && user.expiringNotes.length > 0) {
                bodyText += ` ⚠️ 提醒您，今天有 ${user.expiringNotes.length} 項區間任務即將到期！`;
            }

            const payload = {
                title: '🔔 輕盈日記晨報',
                body: bodyText,
                url: '/'
            };

            return webpush.sendNotification(user.subscription, JSON.stringify(payload));
        });

        const results = await Promise.allSettled(pushPromises);
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failCount = results.filter(r => r.status === 'rejected').length;

        return res.status(200).json({ 
            status: 'success', 
            stats: { total: targets.length, success: successCount, failed: failCount }
        });

    } catch (error) {
        console.error('[Cron Error]', error);
        return res.status(500).json({ status: 'error', message: error.message });
    }
}