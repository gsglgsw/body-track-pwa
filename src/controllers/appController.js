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
        this.currentMetric = 'weight';
        this.pickerTempYear = new Date().getFullYear();
        this.chartRange = 'week';
        // 🚩 新增：用來存放 PWA 安裝提示事件的變數
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
            syncBtn: document.getElementById('syncBtn'),
            periodWrapper: document.getElementById('periodWrapper'),
            chartRangeBtns: document.querySelectorAll('[data-range]'),
            customMonthBtn: document.getElementById('customMonthBtn'),
            monthPickerText: document.getElementById('monthPickerText'),
            customMonthMenu: document.getElementById('customMonthMenu'),
            pickerYearText: document.getElementById('pickerYearText'),
            pickerMonthGrid: document.getElementById('pickerMonthGrid'),
            pickerPrevYear: document.getElementById('pickerPrevYear'),
            pickerNextYear: document.getElementById('pickerNextYear'),
            metricDropdownBtn: document.getElementById('metricDropdownBtn'),
            metricDropdownMenu: document.getElementById('metricDropdownMenu'),
            metricDisplayText: document.getElementById('metricDisplayText'),
            metricOptions: document.querySelectorAll('.metric-option'),
            settingsForm: document.getElementById('settingsForm'),
            setGender: document.getElementById('setGender'),
            setBirthYear: document.getElementById('setBirthYear'),
            setHeight: document.getElementById('setHeight'),
            setGoalWeight: document.getElementById('setGoalWeight'),
            setGoalBodyFat: document.getElementById('setGoalBodyFat'),
            // 🚩 新增：Google 帳號綁定相關 DOM
            googleSignInWrapper: document.getElementById('googleSignInWrapper'),
            accountBoundStatus: document.getElementById('accountBoundStatus'),
            boundEmailText: document.getElementById('boundEmailText'),
            logoutBtn: document.getElementById('logoutBtn'),
            guestModeText: document.getElementById('guestModeText'),
            // 🚩 註冊登出 Modal 相關 DOM
            logoutModal: document.getElementById('logoutModal'),
            cancelLogoutBtn: document.getElementById('cancelLogoutBtn'),
            confirmLogoutBtn: document.getElementById('confirmLogoutBtn'),

            // 🚩 新增註冊這兩個新 DOM
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


        } catch (error) {
            console.error('❌ [AppController] 初始化異常:', error);
        }
    }

    async refreshChartData(goalWeight, goalBodyFat) {
        const today = new Date();
        const endDateStr = today.toISOString().split('T')[0];
        let startDate = new Date();

        if (this.chartRange === 'week') {
            startDate.setDate(today.getDate() - 6);
        } else if (this.chartRange === 'month') {
            startDate.setDate(today.getDate() - 29);
        } else if (this.chartRange === 'year') {
            startDate.setFullYear(today.getFullYear() - 1);
        }

        const startDateStr = startDate.toISOString().split('T')[0];
        const records = await RecordModel.getRecordsRange(startDateStr, endDateStr);

        let labels = [];
        let weights = [];
        let bodyFats = [];

        if (this.chartRange === 'year') {
            const monthlyData = {};
            records.forEach(r => {
                const monthKey = r.id.substring(0, 7);
                if (!monthlyData[monthKey]) monthlyData[monthKey] = { wSum: 0, wCount: 0, bfSum: 0, bfCount: 0 };
                if (r.weight) { monthlyData[monthKey].wSum += r.weight; monthlyData[monthKey].wCount++; }
                if (r.bodyFat) { monthlyData[monthKey].bfSum += r.bodyFat; monthlyData[monthKey].bfCount++; }
            });

            Object.keys(monthlyData).sort().forEach(key => {
                labels.push(key.substring(5) + '月');
                const d = monthlyData[key];
                weights.push(d.wCount > 0 ? parseFloat((d.wSum / d.wCount).toFixed(1)) : null);
                bodyFats.push(d.bfCount > 0 ? parseFloat((d.bfSum / d.bfCount).toFixed(1)) : null);
            });
        } else {
            records.forEach(r => {
                labels.push(r.id.substring(5));
                weights.push(r.weight);
                bodyFats.push(r.bodyFat);
            });
        }

        this.chartView.renderChart(labels, weights, bodyFats, goalWeight, goalBodyFat);
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

        const monthRecords = await RecordModel.getRecordsRange(startDate, endDate);
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

        this.dom.metricDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.dom.metricDropdownMenu.classList.toggle('hidden');
        });
        this.dom.metricOptions.forEach(optionBtn => {
            optionBtn.addEventListener('click', async (e) => {
                this.currentMetric = e.target.getAttribute('data-value');
                this.dom.metricDisplayText.innerText = e.target.getAttribute('data-text');
                this.dom.metricDropdownMenu.classList.add('hidden');
                await this.refreshCalendarData();
            });
        });

        document.addEventListener('click', (e) => {
            if (!this.dom.customMonthBtn.contains(e.target) && !this.dom.customMonthMenu.contains(e.target)) {
                this.dom.customMonthMenu.classList.add('hidden');
            }
            if (!this.dom.metricDropdownBtn.contains(e.target) && !this.dom.metricDropdownMenu.contains(e.target)) {
                this.dom.metricDropdownMenu.classList.add('hidden');
            }
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

        this.dom.settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSettingsSubmit();
        });

        this.dom.syncBtn.addEventListener('click', async () => {
            const originalText = this.dom.syncBtn.innerText;
            this.dom.syncBtn.innerText = '處理中...';
            const success = await SyncController.syncAllPendingData();

            if (success) {
                this.dom.syncBtn.innerText = '完成';
                setTimeout(() => this.dom.syncBtn.innerText = originalText, 2000);
            } else {
                this.dom.syncBtn.innerText = '離線或錯誤';
                setTimeout(() => this.dom.syncBtn.innerText = originalText, 2000);
            }
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
        this.initGoogleSignIn();
    }

    /**
     * 🚩 更新離線/連線 UI 狀態與觸發自動同步
     */
    async updateOnlineStatus() {
        if (navigator.onLine) {
            this.dom.offlineBadge.classList.add('hidden');
            this.dom.syncBtn.classList.remove('opacity-50', 'cursor-not-allowed');

            // 💡 終極自動化：偵測到網路恢復，且用戶已綁定帳號，立刻在背景無聲觸發同步！
            if (this.userProfile && this.userProfile.boundEmail) {
                console.log('📡 [System] 網路已連線，啟動背景自動同步...');
                // 將右上角按鈕改為處理中狀態，提供視覺回饋
                const originalText = this.dom.syncBtn.innerText;
                this.dom.syncBtn.innerText = '自動同步中...';

                await SyncController.syncAllPendingData();

                this.dom.syncBtn.innerText = originalText;
            }

        } else {
            this.dom.offlineBadge.classList.remove('hidden');
            this.dom.syncBtn.classList.add('opacity-50', 'cursor-not-allowed');
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

        try {
            await RecordModel.saveRecord(dateStr, {
                weight: weight,
                bodyFat: bodyFat,
                waist: waist,
                isPeriodStart: isPeriodStart
            });

            this.dom.modal.classList.add('hidden');
            this.userProfile = await UserModel.getProfile();
            await this.refreshChartData(this.userProfile?.goalWeight, this.userProfile?.goalBodyFat);
            await this.refreshCalendarData();

            SyncController.syncAllPendingData();
        } catch (error) {
            alert(`儲存失敗: ${error.message}`);
            console.error(error);
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            submitBtn.classList.replace('bg-stone-300', 'bg-rose-500');
            submitBtn.classList.add('hover:bg-rose-600');
        }
    }

    loadSettingsForm() {
        if (!this.userProfile) return;
        this.dom.setGender.value = this.userProfile.gender;
        this.dom.setBirthYear.value = this.userProfile.birthYear;
        this.dom.setHeight.value = this.userProfile.height;
        this.dom.setGoalWeight.value = this.userProfile.goalWeight || '';
        this.dom.setGoalBodyFat.value = this.userProfile.goalBodyFat || '';
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
                goalBodyFat: this.dom.setGoalBodyFat.value
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

}
new AppController();