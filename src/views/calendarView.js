// src/views/calendarView.js

export default class CalendarView {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.onDateClickCallback = null;
        this.colorMap = {
            rose: { bg: 'bg-rose-500', border: 'border-rose-500' },
            emerald: { bg: 'bg-emerald-500', border: 'border-emerald-500' },
            sky: { bg: 'bg-sky-500', border: 'border-sky-500' },
            amber: { bg: 'bg-amber-500', border: 'border-amber-500' },
            purple: { bg: 'bg-purple-500', border: 'border-purple-500' },
            stone: { bg: 'bg-stone-500', border: 'border-stone-500' }
        };
    }

    bindDateClick(callback) { this.onDateClickCallback = callback; }

    renderMonth(year, month, monthRecords, displayMetric = 'weight', routineNotesMap = new Map(), activeNotesList = []) {
        if (!this.container) return;

        const recordMap = new Map();
        monthRecords.forEach(record => recordMap.set(record.date, record));

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // --- 1. 月曆網格 ---
        let html = `
            <div class="grid grid-cols-7 gap-1 text-center text-xs text-stone-400 mb-2 font-medium">
                <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
            </div>
            <div class="grid grid-cols-7 gap-1 pb-4">
        `;

        for (let i = 0; i < firstDay; i++) { html += `<div class="aspect-square"></div>`; }

        const todayStr = new Date().toISOString().split('T')[0];

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const record = recordMap.get(dateStr);
            const notesForDay = routineNotesMap.get(dateStr);
            const isToday = dateStr === todayStr;
            const isPeriodDay = record && record.isPeriodStart;

            let cellClasses = "aspect-square flex flex-col items-center justify-center rounded-lg cursor-pointer transition-colors relative border ";
            if (isToday) {
                cellClasses += "border-stone-800 border-[2px] font-bold shadow-sm ";
                cellClasses += isPeriodDay ? "bg-rose-100 " : "bg-white ";
            } else {
                if (isPeriodDay) { cellClasses += "bg-rose-100 border-rose-200 shadow-[0_2px_8px_rgba(0,0,0,0.02)] "; }
                else { cellClasses += "bg-white border-transparent hover:bg-stone-50 shadow-[0_2px_8px_rgba(0,0,0,0.02)] "; }
            }

            let singleIcons = [];
            let durationIcons = [];

            if (notesForDay && notesForDay.length > 0) {
                notesForDay.forEach(item => {
                    const c = this.colorMap[item.note.color] || this.colorMap.stone;
                    if (item.marker === 'single') singleIcons.push(`<div class="w-1.5 h-1.5 ${c.bg} rotate-45 shadow-sm rounded-[1px]"></div>`);
                    else if (item.marker === 'end') durationIcons.unshift(`<div class="w-2 h-2 rounded-full ${c.bg} shadow-sm border border-white"></div>`);
                    else if (item.marker === 'start') durationIcons.push(`<div class="w-2 h-2 rounded-full border-[1.5px] ${c.border} bg-white shadow-sm"></div>`);
                });
            }

            let iconsHtml = '';
            if (singleIcons.length > 0) iconsHtml += `<div class="absolute top-1 left-1 flex flex-col gap-1 items-center">${singleIcons.join('')}</div>`;
            if (durationIcons.length > 0) iconsHtml += `<div class="absolute top-1 right-1 flex flex-col gap-1 items-center">${durationIcons.join('')}</div>`;

            let contentHtml = `<span class="text-sm ${isToday ? 'mt-1' : ''}">${day}</span>`;

            if (record) {
                let displayValue = '';
                if (displayMetric === 'weight' && record.weight) displayValue = record.weight;
                else if (displayMetric === 'bodyFat' && record.bodyFat) displayValue = record.bodyFat;
                else if (displayMetric === 'waist' && record.waist) displayValue = record.waist;

                if (displayValue) {
                    let valueColor = 'text-stone-400';
                    if (displayMetric === 'weight') valueColor = 'text-rose-500';
                    if (displayMetric === 'bodyFat') valueColor = 'text-emerald-500';
                    if (displayMetric === 'waist') valueColor = 'text-amber-500';
                    contentHtml += `<span class="text-[11px] ${valueColor} font-bold mt-auto mb-1.5">${displayValue}</span>`;
                }
            }
            html += `<div class="${cellClasses}" data-date="${dateStr}">${iconsHtml}${contentHtml}</div>`;
        }
        html += `</div>`; // 網格結束

        // --- 2. 🚩 新增：唯讀概覽清單 (Dashboard 模式) ---
        html += `
            <div class="border-t border-stone-100 pt-4 pb-20 px-1">
                <h3 class="text-[11px] font-bold text-stone-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    進行中與今日事件
                </h3>
        `;

        if (!activeNotesList || activeNotesList.length === 0) {
            html += `<div class="text-center text-xs text-stone-400 py-4 bg-stone-50 rounded-xl border border-stone-100">本月尚無任何紀錄喔！</div>`;
        } else {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            // 過濾並排序：在 Dashboard 我們主要看「還沒過期」或「剛過期需要注意」的
            const dashboardNotes = activeNotesList.filter(note => {
                const [y, m, d] = note.startDate.split('-').map(Number);
                const start = new Date(y, m - 1, d);
                if (note.type === 'duration') {
                    const end = new Date(y, m - 1, d);
                    end.setDate(end.getDate() + note.durationDays - 1);
                    // 如果過期超過 3 天，就不顯示在首頁的總覽了 (保持乾淨)
                    return Math.floor((today - end) / 86400000) <= 3;
                }
                return true;
            });

            if (dashboardNotes.length === 0) {
                html += `<div class="text-center text-xs text-stone-400 py-4 bg-stone-50 rounded-xl border border-stone-100">近期沒有待辦事項喔！</div>`;
            }

            dashboardNotes.forEach(note => {
                const c = this.colorMap[note.color] || this.colorMap.stone;
                html += `
                    <div class="flex items-center gap-2.5 p-2.5 bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] border border-stone-100 mb-2">
                        <div class="h-8 w-1 ${c.bg} rounded-full"></div>
                        <div class="flex-1 min-w-0">
                            <h4 class="text-xs font-bold text-stone-700 truncate">${note.title}</h4>
                            <p class="text-[10px] text-stone-400 mt-0.5 truncate">${note.type === 'duration' ? '○—● 時效區間' : '◆ 單日紀錄'} (${note.startDate})</p>
                        </div>
                    </div>
                `;
            });
        }
        html += `</div>`; // 清單結束

        this.container.innerHTML = html;

        this.container.querySelectorAll('[data-date]').forEach(cell => {
            cell.addEventListener('click', (e) => {
                if (this.onDateClickCallback) this.onDateClickCallback(e.currentTarget.getAttribute('data-date'), recordMap.get(e.currentTarget.getAttribute('data-date')));
            });
        });
    }
}