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
            
            // 🚩 判斷這天是否為月經期間
            const isPeriodDay = record && record.isPeriodStart; 

            // 🚩 1. 解決今日與經期的視覺衝突：今日改為強烈的深色粗邊框
            let cellClasses = "aspect-square flex flex-col items-center justify-start pt-1 rounded-lg cursor-pointer transition-colors relative border ";
            if (isToday) {
                cellClasses += "border-stone-800 border-[2px] font-bold shadow-sm "; 
                cellClasses += isPeriodDay ? "bg-rose-50 " : "bg-white "; 
            } else {
                if (isPeriodDay) {
                    cellClasses += "bg-rose-50 border-rose-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] "; 
                } else {
                    cellClasses += "bg-white border-transparent hover:bg-stone-50 shadow-[0_2px_8px_rgba(0,0,0,0.02)] ";
                }
            }

            let contentHtml = `<span class="text-sm">${day}</span>`;

            if (record) {
                let displayValue = '';
                if (displayMetric === 'weight' && record.weight) displayValue = record.weight;
                else if (displayMetric === 'bodyFat' && record.bodyFat) displayValue = record.bodyFat;
                else if (displayMetric === 'waist' && record.waist) displayValue = record.waist;

                if (displayValue) {
                    // 🚩 2. 文字顏色動態對應 Design System
                    let valueColor = 'text-stone-500';
                    if (displayMetric === 'weight') valueColor = 'text-rose-500';
                    if (displayMetric === 'bodyFat') valueColor = 'text-emerald-500';
                    if (displayMetric === 'waist') valueColor = 'text-amber-500';

                    contentHtml += `<span class="text-[11px] ${valueColor} font-bold mt-auto mb-1">${displayValue}</span>`;
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