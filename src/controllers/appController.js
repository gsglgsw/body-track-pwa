// src/controllers/appController.js
import RecordModel from '../models/recordModel.js';
import UserModel from '../models/userModel.js';
import NoteModel from '../models/noteModel.js';
import ChartView from '../views/chartView.js';
import CalendarView from '../views/calendarView.js';
import NoteView from '../views/noteView.js';
import SyncController from './syncController.js';
import ApiService from '../services/api.js';
import db from '../models/db.js';

// 🚩 請替換成你終端機產生的那串 Public Key
const PUBLIC_VAPID_KEY = 'BNekh0JVpnQZDk2r6P3Ss5MhXG0wjJEb3XPRmXMW5DL_Qg7hIZZ5mxaFgm7fi0ae69JbQKYCtXKT0HE-WX1h4uw';

export default class AppController {
    constructor() {
        this.chartView = new ChartView('bodyChart');
        this.calendarView = new CalendarView('calendarGrid');
        this.noteView = new NoteView('view-notes');

        this.currentView = 'chart';
        this.viewingDate = new Date();
        this.userProfile = null;
        this.currentMetric = 'weight';
        this.pickerTempYear = new Date().getFullYear();
        this.chartRange = 'week';
        this.deferredPrompt = null;

        this.dom = {
            viewChart: document.getElementById('view-chart'),
            viewCalendar: document.getElementById('view-calendar'),
            viewSettings: document.getElementById('view-settings'),
            viewNotes: document.getElementById('view-notes'),
            navChart: document.getElementById('nav-chart'),
            navCalendar: document.getElementById('nav-calendar'),
            navInput: document.getElementById('nav-input'),
            navSettings: document.getElementById('nav-settings'),
            navNotes: document.getElementById('nav-notes'),
            
            modal: document.getElementById('inputModal'),
            form: document.getElementById('recordForm'),
            clearRecordBtn: document.getElementById('clearRecordBtn'),
            syncStatusUI: document.getElementById('syncStatusUI'),
            syncIconContainer: document.getElementById('syncIconContainer'),
            syncText: document.getElementById('syncText'),
            periodWrapper: document.getElementById('periodWrapper'),

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
            setGoalWaist: document.getElementById('setGoalWaist'),
            
            requestNotifyBtn: document.getElementById('requestNotifyBtn'),
            notifyStatusText: document.getElementById('notifyStatusText'),
            setNotifyMeasurement: document.getElementById('setNotifyMeasurement'),
            setMeasurementTime: document.getElementById('setMeasurementTime'),
            setNotifySummary: document.getElementById('setNotifySummary'),
            setNotifyEventEnd: document.getElementById('setNotifyEventEnd'),
            
            googleSignInWrapper: document.getElementById('googleSignInWrapper'),
            accountBoundStatus: document.getElementById('accountBoundStatus'),
            boundEmailText: document.getElementById('boundEmailText'),
            logoutBtn: document.getElementById('logoutBtn'),
            guestModeText: document.getElementById('guestModeText'),
            logoutModal: document.getElementById('logoutModal'),
            cancelLogoutBtn: document.getElementById('cancelLogoutBtn'),
            confirmLogoutBtn: document.getElementById('confirmLogoutBtn'),
            offlineBadge: document.getElementById('offlineBadge'),
            installAppBtn: document.getElementById('installAppBtn'),
        
            noteModal: document.getElementById('noteModal'),
            closeNoteModalBtn: document.getElementById('closeNoteModalBtn'),
            noteForm: document.getElementById('noteForm'),
            noteId: document.getElementById('noteId'),
            noteTitle: document.getElementById('noteTitle'),
            noteStartDate: document.getElementById('noteStartDate'),
            noteDurationDays: document.getElementById('noteDurationDays'),
            durationDaysContainer: document.getElementById('durationDaysContainer'),
            startDateLabel: document.getElementById('startDateLabel')
        };

        this.init();
        this.bindEvents();
    }

    async init() {
        try {
            this.updateOnlineStatus();
            this.userProfile = await UserModel.getProfile();
            if (!this.userProfile) {
                this.userProfile = await UserModel.saveProfile({ gender: 'female', birthYear: 1995, height: 165, goalWeight: 50.8, goalBodyFat: 24.0 });
            }
            await this.refreshChartData();
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
        const records = rawRecords.filter(r => r.weight !== null || r.bodyFat !== null || r.waist !== null || r.isPeriodStart === true);

        let labels = []; let plotData = []; let isPeriods = [];
        records.forEach(r => {
            labels.push(r.id.substring(5));
            plotData.push(r[this.currentMetric] || null);
            isPeriods.push(r.isPeriodStart ? true : false);
        });

        let goalValue = null;
        if (this.currentMetric === 'weight') goalValue = this.userProfile?.goalWeight;
        if (this.currentMetric === 'bodyFat') goalValue = this.userProfile?.goalBodyFat;
        if (this.currentMetric === 'waist') goalValue = this.userProfile?.goalWaist;

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
        const monthRecords = rawMonthRecords.filter(r => r.weight !== null || r.bodyFat !== null || r.waist !== null || r.isPeriodStart === true);

        const activeNotes = await NoteModel.getNotesRange();
        const routineNotesMap = new Map();

        activeNotes.forEach(note => {
            if (note.type === 'single') {
                if (!routineNotesMap.has(note.startDate)) routineNotesMap.set(note.startDate, []);
                routineNotesMap.get(note.startDate).push({ note, marker: 'single' });
            } else if (note.type === 'duration') {
                const start = note.startDate;
                const [y, m, d] = start.split('-').map(Number);
                
                const endObj = new Date(y, m - 1, d);
                endObj.setDate(endObj.getDate() + note.durationDays - 1);
                const end = `${endObj.getFullYear()}-${String(endObj.getMonth() + 1).padStart(2, '0')}-${String(endObj.getDate()).padStart(2, '0')}`;

                if (!routineNotesMap.has(start)) routineNotesMap.set(start, []);
                routineNotesMap.get(start).push({ note, marker: 'start' });

                if (!routineNotesMap.has(end)) routineNotesMap.set(end, []);
                routineNotesMap.get(end).push({ note, marker: 'end' });
            }
        });

        this.calendarView.renderMonth(year, month, monthRecords, this.currentMetric, routineNotesMap, activeNotes);
        
        this.noteView.render(activeNotes, 
            (noteId, notesList) => this.openEditNoteModal(noteId, notesList),
            async (noteId) => {
                if (confirm('確定要刪除這筆記事嗎？')) {
                    await NoteModel.deleteNote(noteId);
                    await this.refreshCalendarData();

                    // 🚩 核心修復：刪除後也必須強制觸發雲端同步
                    if (navigator.onLine && this.userProfile?.boundEmail) {
                        this.setSyncStatus('syncing');
                        const success = await SyncController.syncAllPendingData();
                        this.setSyncStatus(success ? 'synced' : 'offline');
                    }
                }
            }
        );
    }

    bindEvents() {
        

        window.addEventListener('online', () => this.updateOnlineStatus());
        window.addEventListener('offline', () => this.updateOnlineStatus());
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.updateOnlineStatus(); });

        this.dom.navChart.addEventListener('click', () => this.switchView('chart'));
        this.dom.navCalendar.addEventListener('click', () => this.switchView('calendar'));
        this.dom.navNotes.addEventListener('click', () => this.switchView('notes'));
        this.dom.navSettings.addEventListener('click', () => { this.loadSettingsForm(); this.switchView('settings'); });
        
        this.dom.logoutBtn.addEventListener('click', () => { this.dom.logoutModal.classList.remove('hidden'); });
        this.dom.cancelLogoutBtn.addEventListener('click', () => { this.dom.logoutModal.classList.add('hidden'); });
        this.dom.confirmLogoutBtn.addEventListener('click', async () => { await this.handleLogout(); });

        this.dom.chartRangeBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                this.dom.chartRangeBtns.forEach(b => { b.classList.remove('bg-rose-200', 'text-rose-800'); b.classList.add('text-stone-400', 'hover:bg-stone-50'); });
                e.target.classList.remove('text-stone-400', 'hover:bg-stone-50'); e.target.classList.add('bg-rose-200', 'text-rose-800');
                this.chartRange = e.target.getAttribute('data-range'); await this.refreshChartData();
            });
        });

        document.getElementById('prevMonth').addEventListener('click', async () => { this.viewingDate.setMonth(this.viewingDate.getMonth() - 1); await this.refreshCalendarData(); });
        document.getElementById('nextMonth').addEventListener('click', async () => { this.viewingDate.setMonth(this.viewingDate.getMonth() + 1); await this.refreshCalendarData(); });
        this.dom.customMonthBtn.addEventListener('click', (e) => { e.stopPropagation(); this.pickerTempYear = this.viewingDate.getFullYear(); this.renderMonthPickerGrid(); this.dom.customMonthMenu.classList.toggle('hidden'); });
        this.dom.pickerPrevYear.addEventListener('click', (e) => { e.stopPropagation(); this.pickerTempYear--; this.renderMonthPickerGrid(); });
        this.dom.pickerNextYear.addEventListener('click', (e) => { e.stopPropagation(); this.pickerTempYear++; this.renderMonthPickerGrid(); });

        this.dom.navInput.addEventListener('click', () => { this.openInputModal(new Date().toISOString().split('T')[0]); });
        this.calendarView.bindDateClick((dateStr, existingRecord) => { this.openInputModal(dateStr, existingRecord); });
        
        document.getElementById('closeModalBtn').addEventListener('click', () => { this.dom.modal.classList.add('hidden'); });
        this.dom.form.addEventListener('submit', async (e) => { e.preventDefault(); await this.handleRecordSubmit(); });
        this.dom.clearRecordBtn.addEventListener('click', async () => { await this.handleRecordClear(); });
        
       // 🚩 整合：將正式按鈕綁定真實的推播訂閱邏輯
        this.dom.requestNotifyBtn.addEventListener('click', async () => {
            const originalText = this.dom.requestNotifyBtn.innerHTML;
            this.dom.requestNotifyBtn.innerHTML = '連線授權中...';
            this.dom.requestNotifyBtn.disabled = true;
            
            try {
                await this.subscribeToWebPush(); // 呼叫真正的訂閱流程
                this.loadSettingsForm(); // 重新整理 UI，顯示「已成功開啟系統通知」
            } catch (error) {
                console.error("[Push] 授權失敗:", error);
                this.dom.requestNotifyBtn.innerHTML = originalText;
                this.dom.requestNotifyBtn.disabled = false;
            }
        });

        this.dom.settingsForm.addEventListener('submit', async (e) => { e.preventDefault(); await this.handleSettingsSubmit(); });
        
        this.dom.closeNoteModalBtn.addEventListener('click', () => { 
            this.dom.noteModal.classList.add('hidden'); 
            this.dom.noteForm.reset(); 
            this.dom.noteId.value = ''; 
        });

        const noteTypeRadios = document.querySelectorAll('input[name="noteType"]');
        noteTypeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'duration') {
                    this.dom.durationDaysContainer.classList.remove('hidden');
                    this.dom.startDateLabel.innerText = '基準日 (起始日)';
                } else {
                    this.dom.durationDaysContainer.classList.add('hidden');
                    this.dom.startDateLabel.innerText = '指定日期';
                }
            });
        });

        this.dom.noteForm.addEventListener('submit', async (e) => { e.preventDefault(); await this.handleNoteSubmit(); });

        this.dom.metricToggleBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const selectedMetric = e.currentTarget.getAttribute('data-metric');
                this.currentMetric = selectedMetric;
                let activeColor = 'text-rose-500';
                if (selectedMetric === 'bodyFat') activeColor = 'text-emerald-500';
                if (selectedMetric === 'waist') activeColor = 'text-amber-500';

                this.dom.metricToggleBtns.forEach(b => {
                    if (b.getAttribute('data-metric') === selectedMetric) {
                        b.className = `metric-toggle-btn px-3 py-1.5 rounded-md bg-white shadow-sm font-bold ${activeColor}`;
                    } else {
                        b.className = 'metric-toggle-btn px-3 py-1.5 rounded-md hover:text-stone-700 transition-colors text-stone-500';
                    }
                });
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
        this.dom.viewNotes.classList.add('hidden'); 

        [this.dom.navChart, this.dom.navCalendar, this.dom.navNotes, this.dom.navSettings].forEach(nav => {
            nav.classList.remove('text-rose-500'); 
            nav.classList.add('text-stone-400');
        });
        
        if (viewName === 'chart') { 
            this.dom.viewChart.classList.remove('hidden'); 
            this.dom.navChart.classList.replace('text-stone-400', 'text-rose-500'); 
        } 
        else if (viewName === 'calendar') { 
            this.dom.viewCalendar.classList.remove('hidden'); 
            this.dom.navCalendar.classList.replace('text-stone-400', 'text-rose-500'); 
        } 
        else if (viewName === 'notes') { 
            this.dom.viewNotes.classList.remove('hidden'); 
            this.dom.navNotes.classList.replace('text-stone-400', 'text-rose-500'); 
        } 
        else if (viewName === 'settings') { 
            this.dom.viewSettings.classList.remove('hidden'); 
            this.dom.navSettings.classList.replace('text-stone-400', 'text-rose-500'); 
        }
    }

    openEditNoteModal(noteId, notesList) {
        if (noteId && notesList) {
            const note = notesList.find(n => n.id === noteId);
            if (note) {
                this.dom.noteId.value = note.id;
                this.dom.noteTitle.value = note.title;
                this.dom.noteStartDate.value = note.startDate;
                
                document.querySelector(`input[name="noteType"][value="${note.type}"]`).checked = true;
                if (note.type === 'duration') {
                    this.dom.durationDaysContainer.classList.remove('hidden');
                    this.dom.noteDurationDays.value = note.durationDays;
                    this.dom.startDateLabel.innerText = '基準日 (起始日)';
                } else {
                    this.dom.durationDaysContainer.classList.add('hidden');
                    this.dom.startDateLabel.innerText = '指定日期';
                }

                const colorRadio = document.querySelector(`input[name="noteColor"][value="${note.color}"]`);
                if (colorRadio) colorRadio.checked = true;
            }
        } else {
            this.dom.noteForm.reset();
            this.dom.noteId.value = '';
            this.dom.noteStartDate.value = new Date().toISOString().split('T')[0];
            this.dom.durationDaysContainer.classList.add('hidden');
            document.querySelector('input[name="noteType"][value="single"]').checked = true;
            document.querySelector('input[name="noteColor"][value="emerald"]').checked = true;
        }
        this.dom.noteModal.classList.remove('hidden');
    }

    async handleNoteSubmit() {
        const submitBtn = this.dom.noteForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '儲存中...'; 
        submitBtn.disabled = true;

        try {
            const isDuration = document.querySelector('input[name="noteType"]:checked').value === 'duration';
            const selectedColor = document.querySelector('input[name="noteColor"]:checked').value;
            const noteId = this.dom.noteId.value; 
            
            const noteData = {
                id: noteId ? noteId : undefined, 
                title: this.dom.noteTitle.value,
                type: isDuration ? 'duration' : 'single',
                startDate: this.dom.noteStartDate.value,
                durationDays: isDuration ? parseInt(this.dom.noteDurationDays.value) : 1,
                color: selectedColor
            };

            await NoteModel.saveNote(noteData);
            
            this.dom.noteModal.classList.add('hidden');
            this.dom.noteForm.reset();
            this.dom.noteId.value = ''; 
            
            await this.refreshCalendarData(); 

            // 🚩 核心修復：強制觸發雲端同步
            if (navigator.onLine && this.userProfile?.boundEmail) {
                this.setSyncStatus('syncing');
                const success = await SyncController.syncAllPendingData();
                this.setSyncStatus(success ? 'synced' : 'offline');
            }

        } catch (error) { 
            alert(`儲存失敗: ${error.message}`); 
        } finally { 
            submitBtn.innerHTML = originalText; 
            submitBtn.disabled = false; 
        }
    }

    async updateOnlineStatus() {
        if (navigator.onLine) {
            this.dom.offlineBadge.classList.add('hidden');
            if (this.userProfile && this.userProfile.boundEmail) {
                this.setSyncStatus('syncing');
                const success = await SyncController.syncAllPendingData();
                this.setSyncStatus(success ? 'synced' : 'offline');
            } else { 
                this.setSyncStatus('synced'); 
            }
        } else {
            this.dom.offlineBadge.classList.remove('hidden');
            this.setSyncStatus('offline');
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

        if (!weight || weight.trim() === '') {
            alert('提醒您：請輸入今日的體重數值後，再進行儲存喔！');
            submitBtn.innerHTML = originalText; 
            submitBtn.disabled = false;
            submitBtn.classList.replace('bg-stone-300', 'bg-rose-500'); 
            submitBtn.classList.add('hover:bg-rose-600');
            return; 
        }

        try {
            await RecordModel.saveRecord(dateStr, { weight, bodyFat, waist, isPeriodStart });
            this.dom.modal.classList.add('hidden');
            this.userProfile = await UserModel.getProfile();
            await this.refreshChartData();
            await this.refreshCalendarData();
            
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

    async handleRecordClear() {
        const dateStr = document.getElementById('inputDate').value;
        if (!confirm(`確定要清除 ${dateStr} 的所有紀錄嗎？`)) return;
        
        const clearBtn = this.dom.clearRecordBtn;
        const originalText = clearBtn.innerHTML;
        clearBtn.innerHTML = '清除中...'; 
        clearBtn.disabled = true; 
        clearBtn.classList.replace('bg-stone-100', 'bg-stone-300');
        
        try {
            await RecordModel.saveRecord(dateStr, { weight: '', bodyFat: '', waist: '', isPeriodStart: false });
            this.dom.modal.classList.add('hidden');
            this.userProfile = await UserModel.getProfile();
            await this.refreshChartData(); 
            await this.refreshCalendarData();
            
            if (navigator.onLine && this.userProfile?.boundEmail) {
                this.setSyncStatus('syncing');
                const success = await SyncController.syncAllPendingData();
                this.setSyncStatus(success ? 'synced' : 'offline');
            }
        } catch (error) { 
            alert(`清除失敗: ${error.message}`); 
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
        this.dom.setGoalWaist.value = this.userProfile.goalWaist || '';

        this.dom.setNotifyMeasurement.checked = this.userProfile.notifyMeasurement || false;
        this.dom.setMeasurementTime.value = this.userProfile.measurementTime || '08:00';
        this.dom.setNotifySummary.checked = this.userProfile.notifySummary || false;
        this.dom.setNotifyEventEnd.checked = this.userProfile.notifyEventEnd || false;

        const notifyWarning = document.getElementById('notifyDeniedWarning');
        
        if (!("Notification" in window)) {
            this.dom.requestNotifyBtn.classList.add('hidden');
        } else if (Notification.permission === "granted") {
            this.dom.requestNotifyBtn.classList.add('hidden');
            this.dom.notifyStatusText.classList.remove('hidden');
            notifyWarning.classList.add('hidden');
        } else if (Notification.permission === "denied") {
            this.dom.requestNotifyBtn.classList.add('hidden');
            this.dom.notifyStatusText.classList.add('hidden');
            notifyWarning.classList.remove('hidden');
        } else {
            this.dom.requestNotifyBtn.classList.remove('hidden');
            this.dom.notifyStatusText.classList.add('hidden');
            notifyWarning.classList.add('hidden');
        }
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
                goalWaist: this.dom.setGoalWaist.value,
                notifyMeasurement: this.dom.setNotifyMeasurement.checked,
                measurementTime: this.dom.setMeasurementTime.value,
                notifySummary: this.dom.setNotifySummary.checked,
                notifyEventEnd: this.dom.setNotifyEventEnd.checked
            });
            await this.refreshChartData();
            
            if (navigator.onLine && this.userProfile?.boundEmail) {
                this.setSyncStatus('syncing');
                const success = await SyncController.syncAllPendingData();
                this.setSyncStatus(success ? 'synced' : 'offline');
            }

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

   initGoogleSignIn() {
        if (!window.google || !window.google.accounts) {
            console.warn('[System] Google SDK 尚未載入，等待 0.5 秒後重試...');
            setTimeout(() => this.initGoogleSignIn(), 500); 
            return;
        }
        
        if (this.isGoogleInitialized) return;

        if (this.userProfile && this.userProfile.boundEmail) {
            this.dom.googleSignInWrapper.classList.add('hidden');
            this.dom.accountBoundStatus.classList.remove('hidden');
            this.dom.boundEmailText.innerText = `已綁定：${this.userProfile.boundEmail}`;
            this.dom.logoutBtn.classList.remove('hidden');
            this.dom.guestModeText.classList.add('hidden');
            return;
        }

        this.dom.logoutBtn.classList.add('hidden');
        this.dom.guestModeText.classList.remove('hidden');
        
        // 🚩 核心修復：強制啟用 FedCM 與 ITP 支援，繞過現代瀏覽器的跨域與 Cookie 阻擋
        window.google.accounts.id.initialize({
            client_id: '854303040388-obe4eniqa5b21ecqko0i7kqoq61ilskc.apps.googleusercontent.com',
            callback: (response) => this.handleGoogleResponse(response),
            ux_mode: 'popup',
            itp_support: true,
            use_fedcm_for_prompt: true // 啟動最新聯邦憑證管理
        });
        
        window.google.accounts.id.renderButton(
            this.dom.googleSignInWrapper,
            { theme: 'outline', size: 'large', width: 280, text: 'continue_with' }
        );

        this.isGoogleInitialized = true;
    }

    async handleGoogleResponse(response) {
        const payload = this.parseJwt(response.credential);
        if (payload && payload.email) {
            this.dom.googleSignInWrapper.innerHTML = `<div class="text-sm text-stone-500 flex items-center gap-2"><svg class="animate-spin h-4 w-4 text-rose-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 連線中...</div>`;
            try {
                console.log('🔍 [Debug] 1. 開始向 GAS 發送綁定請求...');
                const result = await ApiService.linkGoogleAccount(this.userProfile.userId, payload.email, this.userProfile.fingerprint);
                console.log('🔍 [Debug] 2. GAS 綁定回應:', result);
                
                if (result.status === 'success') {
                    const responseData = result.data || result;
                    
                    if (responseData.action === 'merged') {
                        console.log('🔍 [Debug] 3. 觸發老玩家回鍋機制，準備拉取雲端資料...');
                        this.dom.googleSignInWrapper.innerHTML = `<div class="text-sm text-emerald-500 font-bold">歡迎回來！下載備份中...</div>`;
                        
                        const cloudResult = await ApiService.pullCloudData(responseData.primaryUserId);
                        console.log('🔍 [Debug] 4. 成功拉取雲端資料:', cloudResult);

                        const cloudData = cloudResult.data || cloudResult;

                        await db.records.clear();
                        await db.notes.clear();

                        const newProfileData = { 
                            ...this.userProfile, 
                            ...cloudData.profile,
                            userId: responseData.primaryUserId, 
                            boundEmail: payload.email 
                        };
                        console.log('🔍 [Debug] 5. 準備寫入本機的新 Profile:', newProfileData);

                        this.userProfile = await UserModel.saveProfile(newProfileData);

                        for (const r of cloudData.records) {
                            await RecordModel.saveRecord(r.id.replace('date-', ''), r);
                        }
                        for (const n of cloudData.notes) {
                            await NoteModel.saveNote(n);
                        }
                        alert('資料還原成功！您所有的歷史紀錄已找回。');

                    } else {
                        console.log('🔍 [Debug] 3. 觸發新訪客綁定機制...');
                        this.userProfile = await UserModel.saveProfile({ ...this.userProfile, boundEmail: payload.email });
                        
                        this.setSyncStatus('syncing');
                        console.log('🔍 [Debug] 4. 準備執行第一次全域同步 (SyncAll)...');
                        
                        const syncResult = await SyncController.syncAllPendingData();
                        console.log('🔍 [Debug] 5. SyncAll 執行結果:', syncResult);
                        
                        this.setSyncStatus(syncResult ? 'synced' : 'offline');
                        alert(responseData.message || '綁定成功！訪客資料已同步至雲端。');
                    }

                    // 更新 UI
                    this.dom.googleSignInWrapper.classList.add('hidden');
                    this.dom.accountBoundStatus.classList.remove('hidden');
                    this.dom.boundEmailText.innerText = `已綁定：${payload.email}`;
                    this.dom.logoutBtn.classList.remove('hidden');
                    this.dom.guestModeText.classList.add('hidden');
                    
                    this.loadSettingsForm(); 
                    await this.refreshChartData(); 
                    await this.refreshCalendarData();
                } else {
                    throw new Error(result.message || '後端回傳失敗');
                }
            } catch (error) { 
                console.error('❌ [Debug] 致命錯誤發生:', error);
                alert(`帳號綁定失敗: ${error.message}`); 
                this.dom.googleSignInWrapper.innerHTML = ''; 
                this.initGoogleSignIn();
            }
        }
    }

    async handleLogout() {
        const originalText = this.dom.confirmLogoutBtn.innerText;
        this.dom.confirmLogoutBtn.innerText = '處理中...'; 
        this.dom.confirmLogoutBtn.disabled = true;
        try {
            await SyncController.syncAllPendingData();
            await UserModel.clearAllLocalData();
            window.location.reload(true);
        } catch (error) { 
            alert(`登出錯誤: ${error.message}`); 
            this.dom.confirmLogoutBtn.innerText = originalText; 
            this.dom.confirmLogoutBtn.disabled = false; 
        }
    }

    setSyncStatus(state) {
        if (state === 'synced') {
            this.dom.syncIconContainer.innerHTML = `<svg class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>`;
            this.dom.syncText.innerText = '已同步'; 
            this.dom.syncText.className = 'text-[11px] font-bold text-stone-500 tracking-wide';
        } else if (state === 'syncing') {
            this.dom.syncIconContainer.innerHTML = `<svg class="w-3.5 h-3.5 text-rose-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
            this.dom.syncText.innerText = '同步中...'; 
            this.dom.syncText.className = 'text-[11px] font-bold text-rose-600 tracking-wide';
        } else if (state === 'offline') {
            this.dom.syncIconContainer.innerHTML = `<svg class="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
            this.dom.syncText.innerText = '等待連線'; 
            this.dom.syncText.className = 'text-[11px] font-bold text-amber-600 tracking-wide';
        }
    }

    /**
     * 🚩 正式版：處理 Web Push 訂閱與歡迎推播
     */
    async subscribeToWebPush() {
        if (!("Notification" in window)) {
            alert("抱歉，您目前的瀏覽器不支援系統通知推播。");
            return;
        }

        // 1. 詢問作業系統通知權限
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            alert('您已拒絕通知權限。若要開啟，請至瀏覽器設定中解除封鎖。');
            return;
        }

        // 2. 確保 Service Worker 已準備就緒並產生訂閱憑證
        const registration = await navigator.serviceWorker.ready;
        console.log('[Push] 正在產生訂閱憑證...');
        
        // 取得訂閱物件 (Subscription)
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: this.urlB64ToUint8Array(PUBLIC_VAPID_KEY)
        });

        console.log('[Push] 訂閱成功！準備發送歡迎通知...');

        // 3. 呼叫 Vercel API 發送歡迎推播
        const response = await fetch('/api/send-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subscription: subscription,
                payload: {
                    title: '訂閱成功！',
                    body: '輕盈日記已準備就緒，未來將為您發送每日晨報。',
                    url: '/'
                }
            })
        });

        const result = await response.json();
        if (result.status !== 'success') {
            throw new Error(result.message || '伺服器連線失敗');
        }
        
        // 💡 下一步預告：未來我們需要把這個 `subscription` 物件存進 UserProfile，
        // 並透過 SyncController 送回 GAS 資料庫，讓 GAS 每天早上 8 點能自動發送晨報！
    }

    /**
     * 工具函式：將 Base64 公鑰轉換為 Uint8Array (Web Push 規範要求)
     */
    urlB64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

}

new AppController();