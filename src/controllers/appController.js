// src/controllers/appController.js
import RecordModel from '../models/recordModel.js';
import UserModel from '../models/userModel.js';
import ChartView from '../views/chartView.js';
import CalendarView from '../views/calendarView.js';
import SyncController from './syncController.js';
import ApiService from '../services/api.js';


export default class AppController {
    constructor() {
        this.chartView = new ChartView('bodyChart');
        this.calendarView = new CalendarView('calendarGrid');

        this.currentView = 'chart';
        this.viewingDate = new Date();
        this.userProfile = null;

        // 🚩 核心狀態統一：無論月曆或圖表，都共用這個 Metric
        this.currentMetric = 'weight';

        this.pickerTempYear = new Date().getFullYear();
        this.chartRange = 'week';
        this.deferredPrompt = null;

        this.dom = {
            viewChart: document.getElementById('view-chart'),
            viewCalendar: document.getElementById('view-calendar'),
            viewSettings: document.getElementById('view-settings'),
            navChart: document.getElementById('nav-chart'),
            navCalendar: document.getElementById('nav-calendar'),
            navInput: document.getElementById('nav-input'),
            navSettings: document.getElementById('nav-settings'),
            modal: document.getElementById('inputModal'),
            form: document.getElementById('recordForm'),
            clearRecordBtn: document.getElementById('clearRecordBtn'), // 🚩 新增註冊清除按鈕
            syncStatusUI: document.getElementById('syncStatusUI'),
            syncIconContainer: document.getElementById('syncIconContainer'),
            syncText: document.getElementById('syncText'),
            periodWrapper: document.getElementById('periodWrapper'),

            // 🚩 新增：抓取全域所有的切換按鈕 (包含圖表與月曆)
            metricToggleBtns: document.querySelectorAll('.metric-toggle-btn'),
            chartRangeBtns: document.querySelectorAll('.chart-range-btn'),

            customMonthBtn: document.getElementById('customMonthBtn'),
            monthPickerText: document.getElementById('monthPickerText'),
            customMonthMenu: document.getElementById('customMonthMenu'),
            pickerYearText: document.getElementById('pickerYearText'),
            pickerMonthGrid: document.getElementById('pickerMonthGrid'),
            pickerPrevYear: document.getElementById('pickerPrevYear'),
            pickerNextYear: document.getElementById('pickerNextYear'),

            settingsForm: document.getElementById('settingsForm'),
            setGender: document.getElementById('setGender'),
            setBirthYear: document.getElementById('setBirthYear'),
            setHeight: document.getElementById('setHeight'),
            setGoalWeight: document.getElementById('setGoalWeight'),
            setGoalBodyFat: document.getElementById('setGoalBodyFat'),
            setGoalWaist: document.getElementById('setGoalWaist'), // 🚩 新增
            googleSignInWrapper: document.getElementById('googleSignInWrapper'),
            accountBoundStatus: document.getElementById('accountBoundStatus'),
            boundEmailText: document.getElementById('boundEmailText'),
            logoutBtn: document.getElementById('logoutBtn'),
            guestModeText: document.getElementById('guestModeText'),
            logoutModal: document.getElementById('logoutModal'),
            cancelLogoutBtn: document.getElementById('cancelLogoutBtn'),
            confirmLogoutBtn: document.getElementById('confirmLogoutBtn'),
            offlineBadge: document.getElementById('offlineBadge'),
            installAppBtn: document.getElementById('installAppBtn')
        };

        this.init();
        this.bindEvents();
    }

    async init() {
        try {
            this.updateOnlineStatus();
            this.userProfile = await UserModel.getProfile();


            if (!this.userProfile) {
                this.userProfile = await UserModel.saveProfile({
                    gender: 'female', birthYear: 1995, height: 165, goalWeight: 50.8, goalBodyFat: 24.0
                });
            }

            await this.refreshChartData(this.userProfile?.goalWeight, this.userProfile?.goalBodyFat);
            await this.refreshCalendarData();
            this.initGoogleSignIn();

        } catch (error) {
            console.error('❌ [AppController] 初始化異常:', error);
        }
    }

    async refreshChartData() {
        const today = new Date();
        const endDateStr = today.toISOString().split('T')[0];
        let startDate = new Date();

        if (this.chartRange === 'week') startDate.setDate(today.getDate() - 6);
        else if (this.chartRange === 'month') startDate.setDate(today.getDate() - 29);
        else if (this.chartRange === 'year') startDate.setFullYear(today.getFullYear() - 1);

        const startDateStr = startDate.toISOString().split('T')[0];
        const rawRecords = await RecordModel.getRecordsRange(startDateStr, endDateStr);

        // 🚩 核心防呆：過濾掉被「軟刪除」的空紀錄，避免空日期殘留在圖表 X 軸
        const records = rawRecords.filter(r => 
            r.weight !== null || r.bodyFat !== null || r.waist !== null || r.isPeriodStart === true
        );

        let labels = [];
        let plotData = [];
        let isPeriods = [];

        // 判斷要撈哪個數值
        records.forEach(r => {
            labels.push(r.id.substring(5));
            plotData.push(r[this.currentMetric] || null);
            isPeriods.push(r.isPeriodStart ? true : false);
        });

        // 取出對應的目標值
        let goalValue = null;
        if (this.currentMetric === 'weight') goalValue = this.userProfile?.goalWeight;
        if (this.currentMetric === 'bodyFat') goalValue = this.userProfile?.goalBodyFat;
        if (this.currentMetric === 'waist') goalValue = this.userProfile?.goalWaist;

        // 渲染圖表
        this.chartView.renderChart(labels, plotData, isPeriods, goalValue, this.currentMetric);
    }

    renderMonthPickerGrid() {
        this.dom.pickerYearText.innerText = this.pickerTempYear;
        this.dom.pickerMonthGrid.innerHTML = '';

        for (let i = 0; i < 12; i++) {
            const btn = document.createElement('button');
            btn.innerText = `${i + 1}月`;
            if (this.pickerTempYear === this.viewingDate.getFullYear() && i === this.viewingDate.getMonth()) {
                btn.className = 'py-2 rounded-xl text-sm font-bold bg-rose-500 text-white shadow-sm';
            } else {
                btn.className = 'py-2 rounded-xl text-sm font-medium text-stone-600 hover:bg-rose-50 hover:text-rose-600 transition-colors';
            }

            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                this.viewingDate.setFullYear(this.pickerTempYear, i);
                this.dom.customMonthMenu.classList.add('hidden');
                await this.refreshCalendarData();
            });

            this.dom.pickerMonthGrid.appendChild(btn);
        }
    }

    async refreshCalendarData() {
        const year = this.viewingDate.getFullYear();
        const month = this.viewingDate.getMonth();
        this.dom.monthPickerText.innerText = `${year}年${String(month + 1).padStart(2, '0')}月`;

        const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month + 1, 0).getDate();
        const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const rawMonthRecords = await RecordModel.getRecordsRange(startDate, endDate);
        
        // 🚩 核心防呆：過濾掉被「軟刪除」的空紀錄，讓月曆的資料對應更乾淨
        const monthRecords = rawMonthRecords.filter(r => 
            r.weight !== null || r.bodyFat !== null || r.waist !== null || r.isPeriodStart === true
        );

        this.calendarView.renderMonth(year, month, monthRecords, this.currentMetric);
    }

    bindEvents() {
        // 🚩 網路狀態監聽 (Online / Offline)
        window.addEventListener('online', () => this.updateOnlineStatus());
        window.addEventListener('offline', () => this.updateOnlineStatus());

        // 🚩 iOS 雙重保險：當 App 從背景切回前景時，強制檢查並同步
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.updateOnlineStatus();
            }
        });

        // 🚩 PWA 安裝提示攔截 (A2HS)
        window.addEventListener('beforeinstallprompt', (e) => {
            // 防止瀏覽器自動彈出醜陋的安裝提示
            e.preventDefault();
            // 把事件暫存起來，等使用者按按鈕時再觸發
            this.deferredPrompt = e;
            // 顯示我們自訂的美觀安裝按鈕
            this.dom.installAppBtn.classList.remove('hidden');
        });

        // 綁定我們自訂的安裝按鈕點擊事件
        this.dom.installAppBtn.addEventListener('click', async () => {
            if (this.deferredPrompt) {
                // 觸發原生安裝提示
                this.deferredPrompt.prompt();
                // 等待使用者選擇 (接受或拒絕)
                const { outcome } = await this.deferredPrompt.userChoice;
                console.log(`[PWA] 使用者安裝選擇: ${outcome}`);

                // 無論結果為何，清空暫存並隱藏按鈕
                this.deferredPrompt = null;
                this.dom.installAppBtn.classList.add('hidden');
            }
        });

        // 監聽安裝完成事件
        window.addEventListener('appinstalled', () => {
            console.log('[PWA] 應用程式已成功安裝到桌面');
            this.dom.installAppBtn.classList.add('hidden');
            this.deferredPrompt = null;
        });

        this.dom.navChart.addEventListener('click', () => this.switchView('chart'));
        this.dom.navCalendar.addEventListener('click', () => this.switchView('calendar'));
        this.dom.navSettings.addEventListener('click', () => {
            this.loadSettingsForm();
            this.switchView('settings');
        });
        // 🚩 改為點擊時「開啟」 Modal，而不是直接執行
        this.dom.logoutBtn.addEventListener('click', () => {
            this.dom.logoutModal.classList.remove('hidden');
        });

        // 綁定 Modal 的取消按鈕
        this.dom.cancelLogoutBtn.addEventListener('click', () => {
            this.dom.logoutModal.classList.add('hidden');
        });

        // 綁定 Modal 的確認按鈕
        this.dom.confirmLogoutBtn.addEventListener('click', async () => {
            await this.handleLogout();
        });

        this.dom.chartRangeBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                this.dom.chartRangeBtns.forEach(b => {
                    b.classList.remove('bg-rose-200', 'text-rose-800');
                    b.classList.add('text-stone-400', 'hover:bg-stone-50');
                });
                e.target.classList.remove('text-stone-400', 'hover:bg-stone-50');
                e.target.classList.add('bg-rose-200', 'text-rose-800');

                this.chartRange = e.target.getAttribute('data-range');
                await this.refreshChartData(this.userProfile?.goalWeight, this.userProfile?.goalBodyFat);
            });
        });

        document.getElementById('prevMonth').addEventListener('click', async () => {
            this.viewingDate.setMonth(this.viewingDate.getMonth() - 1);
            await this.refreshCalendarData();
        });
        document.getElementById('nextMonth').addEventListener('click', async () => {
            this.viewingDate.setMonth(this.viewingDate.getMonth() + 1);
            await this.refreshCalendarData();
        });

        this.dom.customMonthBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.pickerTempYear = this.viewingDate.getFullYear();
            this.renderMonthPickerGrid();
            this.dom.customMonthMenu.classList.toggle('hidden');
        });
        this.dom.pickerPrevYear.addEventListener('click', (e) => {
            e.stopPropagation();
            this.pickerTempYear--;
            this.renderMonthPickerGrid();
        });
        this.dom.pickerNextYear.addEventListener('click', (e) => {
            e.stopPropagation();
            this.pickerTempYear++;
            this.renderMonthPickerGrid();
        });


        this.dom.navInput.addEventListener('click', () => {
            const todayStr = new Date().toISOString().split('T')[0];
            this.openInputModal(todayStr);
        });
        this.calendarView.bindDateClick((dateStr, existingRecord) => {
            this.openInputModal(dateStr, existingRecord);
        });
        document.getElementById('closeModalBtn').addEventListener('click', () => {
            this.dom.modal.classList.add('hidden');
        });

        this.dom.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleRecordSubmit();
        });

        // 🚩 新增：綁定清除按鈕
        this.dom.clearRecordBtn.addEventListener('click', async () => {
            await this.handleRecordClear();
        });

        this.dom.settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSettingsSubmit();
        });


        // 🚩 全域數據切換按鈕事件 (圖表與月曆連動)
        this.dom.metricToggleBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                // 必須使用 currentTarget 確保點擊的是 button 本身
                const selectedMetric = e.currentTarget.getAttribute('data-metric');
                this.currentMetric = selectedMetric;

                // 動態決定選中時的主題色
                let activeColor = 'text-rose-500';
                if (selectedMetric === 'bodyFat') activeColor = 'text-emerald-500';
                if (selectedMetric === 'waist') activeColor = 'text-amber-500';

                // 迴圈更新畫面上「所有」切換按鈕的 UI (包含圖表區與月曆區)
                this.dom.metricToggleBtns.forEach(b => {
                    if (b.getAttribute('data-metric') === selectedMetric) {
                        b.className = `metric-toggle-btn px-3 py-1.5 rounded-md bg-white shadow-sm font-bold ${activeColor}`;
                    } else {
                        b.className = 'metric-toggle-btn px-3 py-1.5 rounded-md hover:text-stone-700 transition-colors text-stone-500';
                    }
                });

                // 同時刷新圖表與月曆的數據
                await this.refreshChartData();
                await this.refreshCalendarData();
            });
        });

    }

    switchView(viewName) {
        this.currentView = viewName;
        this.dom.viewChart.classList.add('hidden');
        this.dom.viewCalendar.classList.add('hidden');
        this.dom.viewSettings.classList.add('hidden');

        [this.dom.navChart, this.dom.navCalendar, this.dom.navSettings].forEach(nav => {
            nav.classList.remove('text-rose-500');
            nav.classList.add('text-stone-400');
        });

        if (viewName === 'chart') {
            this.dom.viewChart.classList.remove('hidden');
            this.dom.navChart.classList.replace('text-stone-400', 'text-rose-500');
        } else if (viewName === 'calendar') {
            this.dom.viewCalendar.classList.remove('hidden');
            this.dom.navCalendar.classList.replace('text-stone-400', 'text-rose-500');
        } else if (viewName === 'settings') {
            this.dom.viewSettings.classList.remove('hidden');
            this.dom.navSettings.classList.replace('text-stone-400', 'text-rose-500');
        }

    }

    /**
     * 🚩 更新離線/連線 UI 狀態與觸發自動同步
     */
    async updateOnlineStatus() {
        if (navigator.onLine) {
            this.dom.offlineBadge.classList.add('hidden');

            if (this.userProfile && this.userProfile.boundEmail) {
                this.setSyncStatus('syncing'); // 🚩 轉為同步中
                const success = await SyncController.syncAllPendingData();
                this.setSyncStatus(success ? 'synced' : 'offline'); // 🚩 根據結果轉狀態
            } else {
                this.setSyncStatus('synced');
            }

        } else {
            this.dom.offlineBadge.classList.remove('hidden');
            this.setSyncStatus('offline'); // 🚩 斷網時顯示橘色警告
        }
    }

    async openInputModal(dateStr, existingRecord = null) {
        document.getElementById('modalDateLabel').innerText = `記錄：${dateStr}`;
        document.getElementById('inputDate').value = dateStr;

        if (!existingRecord) {
            existingRecord = await RecordModel.getRecordByDate(dateStr);
        }

        document.getElementById('inputWeight').value = existingRecord?.weight || '';
        document.getElementById('inputBodyFat').value = existingRecord?.bodyFat || '';
        document.getElementById('inputWaist').value = existingRecord?.waist || '';
        document.getElementById('inputPeriod').checked = existingRecord?.isPeriodStart || false;

        if (this.userProfile?.gender === 'male') {
            this.dom.periodWrapper.classList.add('hidden');
            document.getElementById('inputPeriod').checked = false;
        } else {
            this.dom.periodWrapper.classList.remove('hidden');
        }

        this.dom.modal.classList.remove('hidden');
    }

   async handleRecordSubmit() {
        const submitBtn = this.dom.form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '儲存中...';
        submitBtn.disabled = true;
        submitBtn.classList.replace('bg-rose-500', 'bg-stone-300');
        submitBtn.classList.remove('hover:bg-rose-600');

        const dateStr = document.getElementById('inputDate').value;
        const weight = document.getElementById('inputWeight').value;
        const bodyFat = document.getElementById('inputBodyFat').value;
        const waist = document.getElementById('inputWaist').value;
        const isPeriodStart = document.getElementById('inputPeriod').checked;

        // 🚩 前端提早攔截 (Early Return) 與友善提示
        if (!weight || weight.trim() === '') {
            alert('提醒您：請輸入今日的體重數值後，再進行儲存喔！');
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            submitBtn.classList.replace('bg-stone-300', 'bg-rose-500');
            submitBtn.classList.add('hover:bg-rose-600');
            return; 
        }

        try {
            // 寫入資料庫
            await RecordModel.saveRecord(dateStr, {
                weight: weight,
                bodyFat: bodyFat,
                waist: waist,
                isPeriodStart: isPeriodStart
            });

            this.dom.modal.classList.add('hidden');
            
            // 重繪視圖
            this.userProfile = await UserModel.getProfile();
            await this.refreshChartData();
            await this.refreshCalendarData();

            // 觸發背景同步
            if (navigator.onLine && this.userProfile?.boundEmail) {
                this.setSyncStatus('syncing'); 
                const success = await SyncController.syncAllPendingData();
                this.setSyncStatus(success ? 'synced' : 'offline');
            }

        } catch (error) {
            console.error('[System] 儲存失敗:', error);
            alert(`儲存失敗: ${error.message}`);
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            submitBtn.classList.replace('bg-stone-300', 'bg-rose-500');
            submitBtn.classList.add('hover:bg-rose-600');
        }
    }

    /**
     * 🚩 處理「清除紀錄」 (Soft Clear)
     * 利用寫入空字串來覆蓋本地與雲端資料，確保雙向同步正確執行
     */
    async handleRecordClear() {
        const dateStr = document.getElementById('inputDate').value;

        // UX 防呆：要求二次確認
        if (!confirm(`確定要清除 ${dateStr} 的所有紀錄嗎？`)) {
            return;
        }

        const clearBtn = this.dom.clearRecordBtn;
        const originalText = clearBtn.innerHTML;
        clearBtn.innerHTML = '清除中...';
        clearBtn.disabled = true;
        clearBtn.classList.replace('bg-stone-100', 'bg-stone-300');

        try {
            // 🚩 MVC Data Nullification：將所有欄位設為空，模擬刪除
            await RecordModel.saveRecord(dateStr, {
                weight: '',
                bodyFat: '',
                waist: '',
                isPeriodStart: false
            });

            this.dom.modal.classList.add('hidden');

            // 刷新視圖
            this.userProfile = await UserModel.getProfile();
            await this.refreshChartData();
            await this.refreshCalendarData();

            // 觸發背景同步 (把刪除狀態覆寫到 GAS)
            if (navigator.onLine && this.userProfile?.boundEmail) {
                this.setSyncStatus('syncing');
                const success = await SyncController.syncAllPendingData();
                this.setSyncStatus(success ? 'synced' : 'offline');
            }

        } catch (error) {
            alert(`清除失敗: ${error.message}`);
            console.error('[System] 清除紀錄異常:', error);
        } finally {
            clearBtn.innerHTML = originalText;
            clearBtn.disabled = false;
            clearBtn.classList.replace('bg-stone-300', 'bg-stone-100');
        }
    }

    loadSettingsForm() {
        if (!this.userProfile) return;
        this.dom.setGender.value = this.userProfile.gender;
        this.dom.setBirthYear.value = this.userProfile.birthYear;
        this.dom.setHeight.value = this.userProfile.height;
        this.dom.setGoalWeight.value = this.userProfile.goalWeight || '';
        this.dom.setGoalBodyFat.value = this.userProfile.goalBodyFat || '';
        this.dom.setGoalWaist.value = this.userProfile.goalWaist || ''; // 🚩 新增載入
    }

    async handleSettingsSubmit() {
        const submitBtn = this.dom.settingsForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        submitBtn.innerHTML = '儲存中...';
        submitBtn.disabled = true;
        submitBtn.classList.replace('bg-stone-800', 'bg-stone-300');
        submitBtn.classList.remove('hover:bg-stone-900');

        try {
            this.userProfile = await UserModel.saveProfile({
                gender: this.dom.setGender.value,
                birthYear: this.dom.setBirthYear.value,
                height: this.dom.setHeight.value,
                goalWeight: this.dom.setGoalWeight.value,
                goalBodyFat: this.dom.setGoalBodyFat.value,
                goalWaist: this.dom.setGoalWaist.value // 🚩 新增儲存
            });

            await this.refreshChartData(this.userProfile?.goalWeight, this.userProfile?.goalBodyFat);

            ApiService.registerUser(this.userProfile.userId, this.userProfile.fingerprint, {
                gender: this.userProfile.gender,
                birthYear: this.userProfile.birthYear,
                height: this.userProfile.height,
                registrationDate: this.userProfile.registrationDate,
                goalWeight: this.userProfile.goalWeight,
                goalBodyFat: this.userProfile.goalBodyFat
            }).catch(err => console.warn('[背景同步設定失敗]', err));

            submitBtn.innerHTML = '儲存成功';
            submitBtn.classList.replace('bg-stone-300', 'bg-emerald-500');

            setTimeout(() => {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                submitBtn.classList.replace('bg-emerald-500', 'bg-stone-800');
                submitBtn.classList.add('hover:bg-stone-900');
                this.switchView('chart');
            }, 1000);

        } catch (error) {
            alert(`設定儲存失敗: ${error.message}`);
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            submitBtn.classList.replace('bg-stone-300', 'bg-stone-800');
            submitBtn.classList.add('hover:bg-stone-900');
        }
    }
    /**
     * 🚩 解析 Google 回傳的 JWT 憑證
     */
    parseJwt(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            console.error('[System] JWT 解析失敗', e);
            return null;
        }
    }
    /**
     * 🚩 初始化 Google 登入按鈕 (加入 Singleton 防呆，避免重複初始化)
     */
    initGoogleSignIn() {
        if (!window.google || !window.google.accounts) {
            console.warn('[System] Google SDK 尚未載入');
            return;
        }
        if (this.isGoogleInitialized) {
            return;
        }
        // 狀態分支 1：如果已經綁定過 Email
        if (this.userProfile && this.userProfile.boundEmail) {
            this.dom.googleSignInWrapper.classList.add('hidden');
            this.dom.accountBoundStatus.classList.remove('hidden');
            this.dom.boundEmailText.innerText = `已綁定：${this.userProfile.boundEmail}`;
            this.dom.logoutBtn.classList.remove('hidden');
            this.dom.guestModeText.classList.add('hidden'); // 🚩 隱藏訪客提示
            return;
        }

        // 狀態分支 2：尚未綁定 (訪客)
        this.dom.logoutBtn.classList.add('hidden');
        this.dom.guestModeText.classList.remove('hidden'); // 🚩 顯示訪客提示
        window.google.accounts.id.initialize({
            client_id: '854303040388-obe4eniqa5b21ecqko0i7kqoq61ilskc.apps.googleusercontent.com',
            callback: (response) => this.handleGoogleResponse(response)
        });

        window.google.accounts.id.renderButton(
            this.dom.googleSignInWrapper,
            { theme: 'outline', size: 'large', width: 280, text: 'continue_with' }
        );

        this.isGoogleInitialized = true; // 標記已初始化

    }

    /**
     * 🚩 處理 Google 登入成功的回呼 (Callback) 與帳號合併
     */
    async handleGoogleResponse(response) {
        const payload = this.parseJwt(response.credential);

        if (payload && payload.email) {
            console.log('🚀 [System] 取得 Google 授權 Email:', payload.email);

            // 讓按鈕顯示處理中狀態 (UX 優化)
            this.dom.googleSignInWrapper.innerHTML = `<div class="text-sm text-stone-500 flex items-center gap-2"><svg class="animate-spin h-4 w-4 text-rose-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 安全連線並同步歷史紀錄中...</div>`;

            try {
                // 呼叫 API 進行綁定或合併
                const result = await ApiService.linkGoogleAccount(
                    this.userProfile.userId,
                    payload.email,
                    this.userProfile.fingerprint
                );

                if (result.status === 'success') {
                    if (result.action === 'merged') {
                        // 🚩 情境 B (老鳥回歸)：覆寫本地 UUID，並匯入歷史紀錄
                        this.userProfile = await UserModel.saveProfile({
                            ...this.userProfile,
                            userId: result.primaryUserId, // 繼承舊帳號的 UUID
                            boundEmail: payload.email
                        });

                        // 透過 bulkPut 匯入資料 (IndexedDB 的 Upsert 邏輯)
                        // 本地那 15 天的訪客紀錄會被保留，並在下次同步時自動掛上舊帳號的 UUID
                        if (result.historicalRecords && result.historicalRecords.length > 0) {
                            await db.dailyRecords.bulkPut(result.historicalRecords);
                        }
                    } else {
                        // 🚩 情境 A (全新綁定)：僅更新 Email
                        this.userProfile = await UserModel.saveProfile({
                            ...this.userProfile,
                            boundEmail: payload.email
                        });
                    }

                    // 觸發 UI 視圖變更
                    this.dom.googleSignInWrapper.classList.add('hidden');
                    this.dom.accountBoundStatus.classList.remove('hidden');
                    this.dom.boundEmailText.innerText = `已綁定：${payload.email}`;

                    // 🚩 補上這兩行：剛綁定成功時，立刻顯示登出按鈕並隱藏訪客提示
                    this.dom.logoutBtn.classList.remove('hidden');
                    this.dom.guestModeText.classList.add('hidden');

                    // 刷新圖表與日曆
                    await this.refreshChartData(this.userProfile?.goalWeight, this.userProfile?.goalBodyFat);
                    await this.refreshCalendarData();

                    alert(result.message); // 提示使用者成功還原或綁定
                }
            } catch (error) {
                // 🚩 加入這行：強制印出 Call Stack 與真實錯誤原因
                console.error('🚨 [System] 帳號綁定發生前端致命錯誤:', error);

                // 把原本寫死的文字，加上真實的 error.message
                alert(`帳號綁定連線失敗，錯誤原因: ${error.message}`);

                this.dom.googleSignInWrapper.innerHTML = '';
                this.initGoogleSignIn();
            }
        }
    }
    /**
     * 🚩 處理安全登出與清除快取
     */
    /**
     * 🚩 處理安全登出與清除快取 (改為搭配自訂 Modal 使用)
     */
    async handleLogout() {
        const originalText = this.dom.confirmLogoutBtn.innerText;
        this.dom.confirmLogoutBtn.innerText = '處理中...';
        this.dom.confirmLogoutBtn.disabled = true;

        try {
            // 在清空前，強制呼叫一次同步
            await SyncController.syncAllPendingData();
            // 清空本機資料
            await UserModel.clearAllLocalData();
            // 重新載入網頁
            window.location.reload(true);

        } catch (error) {
            console.error('🚨 [System] 登出失敗:', error);
            alert(`登出過程發生錯誤: ${error.message}`);
            this.dom.confirmLogoutBtn.innerText = originalText;
            this.dom.confirmLogoutBtn.disabled = false;
        }
    }
    /**
     * 🚩 控制同步指示燈的 UI 狀態機
     * @param {'synced' | 'syncing' | 'offline'} state 
     */
    setSyncStatus(state) {
        if (state === 'synced') {
            this.dom.syncIconContainer.innerHTML = `<svg class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>`;
            this.dom.syncText.innerText = '已同步';
            this.dom.syncText.className = 'text-[11px] font-bold text-stone-500 tracking-wide';
        }
        else if (state === 'syncing') {
            this.dom.syncIconContainer.innerHTML = `<svg class="w-3.5 h-3.5 text-rose-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
            this.dom.syncText.innerText = '同步中...';
            this.dom.syncText.className = 'text-[11px] font-bold text-rose-600 tracking-wide';
        }
        else if (state === 'offline') {
            this.dom.syncIconContainer.innerHTML = `<svg class="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
            this.dom.syncText.innerText = '等待連線';
            this.dom.syncText.className = 'text-[11px] font-bold text-amber-600 tracking-wide';
        }
    }

}
new AppController();