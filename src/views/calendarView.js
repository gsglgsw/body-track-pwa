// src/views/calendarView.js

export default class CalendarView {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.monthLabel = document.getElementById('currentMonthLabel');
        this.onDateClickCallback = null; // 讓 Controller 注入的回呼函式
    }

    /**
     * 設定點擊日期的監聽器
     */
    bindDateClick(callback) {
        this.onDateClickCallback = callback;
    }


    /**
     * 渲染指定年月與對應的資料標記
     * @param {number} year 
     * @param {number} month (0-11)
     * @param {Array} monthRecords 該月的所有紀錄陣列
     * @param {string} displayMetric 要顯示的資料欄位 ('weight'|'bodyFat'|'waist')
     */
    renderMonth(year, month, monthRecords, displayMetric = 'weight') {

        if (!this.container) return;

        const recordMap = new Map();
        monthRecords.forEach(record => recordMap.set(record.id, record));

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        let html = `
      <div class="grid grid-cols-7 gap-1 text-center text-xs text-stone-400 mb-2 font-medium">
        <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
      </div>
      <div class="grid grid-cols-7 gap-1">
    `;

        for (let i = 0; i < firstDay; i++) {
            html += `<div class="aspect-square"></div>`;
        }

        const todayStr = new Date().toISOString().split('T')[0];

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const record = recordMap.get(dateStr);
            const isToday = dateStr === todayStr;

            let cellClasses = "aspect-square flex flex-col items-center justify-start pt-1 rounded-lg cursor-pointer transition-colors relative border ";
            if (isToday) {
                cellClasses += "bg-rose-50 border-rose-200 text-rose-700 font-bold shadow-sm ";
            } else {
                cellClasses += "bg-white border-transparent hover:bg-stone-50 text-stone-600 shadow-[0_2px_8px_rgba(0,0,0,0.02)] ";
            }

            let contentHtml = `<span class="text-sm">${day}</span>`;

            if (record) {
                // 🚩 核心修改：根據 displayMetric 動態選擇要顯示的數值
                let displayValue = '';
                if (displayMetric === 'weight' && record.weight) displayValue = record.weight;
                else if (displayMetric === 'bodyFat' && record.bodyFat) displayValue = record.bodyFat;
                else if (displayMetric === 'waist' && record.waist) displayValue = record.waist;

                if (displayValue) {
                    contentHtml += `<span class="text-[10px] text-stone-500 font-medium mt-auto mb-1">${displayValue}</span>`;
                }

                if (record.isPeriodStart) {
                    contentHtml += `<span class="absolute top-1 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full shadow-sm"></span>`;
                } else {
                    contentHtml += `<span class="absolute top-1 right-1 w-1 h-1 bg-stone-300 rounded-full"></span>`;
                }
            }

            html += `<div class="${cellClasses}" data-date="${dateStr}">${contentHtml}</div>`;
        }

        html += `</div>`;
        this.container.innerHTML = html;

        const cells = this.container.querySelectorAll('[data-date]');
        cells.forEach(cell => {
            cell.addEventListener('click', (e) => {
                const dateStr = e.currentTarget.getAttribute('data-date');
                if (this.onDateClickCallback) {
                    this.onDateClickCallback(dateStr, recordMap.get(dateStr));
                }
            });
        });
    }
}