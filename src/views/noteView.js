// src/views/noteView.js

export default class NoteView {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.colorMap = {
            rose: { bg: 'bg-rose-500', text: 'text-rose-600', expiredBg: 'bg-stone-300' },
            emerald: { bg: 'bg-emerald-500', text: 'text-emerald-600', expiredBg: 'bg-stone-300' },
            sky: { bg: 'bg-sky-500', text: 'text-sky-600', expiredBg: 'bg-stone-300' },
            amber: { bg: 'bg-amber-500', text: 'text-amber-600', expiredBg: 'bg-stone-300' },
            purple: { bg: 'bg-purple-500', text: 'text-purple-600', expiredBg: 'bg-stone-300' },
            stone: { bg: 'bg-stone-500', text: 'text-stone-600', expiredBg: 'bg-stone-300' }
        };
    }

    render(notesList, onEditClick, onDeleteClick) {
        if (!this.container) return;

        let html = `
            <div class="p-5 pb-24">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-xl font-bold text-stone-700">手札與提醒管理</h2>
                    <button id="openNoteModalFromListBtn" class="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full text-sm font-bold hover:bg-emerald-100 transition-colors shadow-sm">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
                        新增記事
                    </button>
                </div>
        `;

        if (notesList.length === 0) {
            html += `<div class="text-center text-sm text-stone-400 py-10 bg-white rounded-2xl shadow-sm border border-stone-100">目前沒有設定任何手札或提醒喔！</div>`;
        } else {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            // 🚩 核心邏輯：計算狀態並排序
            const enrichedNotes = notesList.map(note => {
                const c = this.colorMap[note.color] || this.colorMap.stone;
                const [y, m, d] = note.startDate.split('-').map(Number);
                const start = new Date(y, m - 1, d);

                let progressHtml = '';
                let sortWeight = 1; // 1: 進行中, 2: 等待中, 3: 已過期 (沉底)
                let isExpired = false;

                if (note.type === 'duration') {
                    const end = new Date(y, m - 1, d);
                    end.setDate(end.getDate() + note.durationDays - 1);
                    const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

                    if (today < start) {
                        sortWeight = 2; // 未來事件
                        progressHtml = `<span class="text-stone-400">🕒 等待啟用 (${note.startDate} 開始)</span>`;
                    } else if (today > end) {
                        sortWeight = 3; // 已過期
                        isExpired = true;
                        const overDays = Math.floor((today - end) / 86400000);
                        progressHtml = `<span class="text-rose-500 font-bold">⚠️ 已過期 ${overDays} 天</span>`;
                    } else {
                        sortWeight = 1; // 進行中 (最優先)
                        const currentDay = Math.floor((today - start) / 86400000) + 1;
                        progressHtml = `<span class="${c.text} font-bold">▶ 進行中 (第 ${currentDay} 天 / 共 ${note.durationDays} 天)</span> 
                                        <span class="text-stone-400 ml-1">➔ ${endStr} 到期</span>`;
                    }
                } else {
                    // 單日紀錄，若時間小於今天算過期
                    if (today > start) {
                        sortWeight = 3;
                        isExpired = true;
                        progressHtml = `<span class="text-stone-400">◆ 單日紀錄 (${note.startDate} 已結束)</span>`;
                    } else {
                        sortWeight = 1;
                        progressHtml = `<span class="text-stone-600">◆ 單日紀錄 (${note.startDate})</span>`;
                    }
                }
                return { ...note, progressHtml, sortWeight, isExpired, c };
            });

            // 執行排序 (數字小的排上面)
            enrichedNotes.sort((a, b) => a.sortWeight - b.sortWeight);

            enrichedNotes.forEach(note => {
                // 🚩 UX 視覺降級：過期的卡片變透明、標籤變灰
                const opacityClass = note.isExpired ? 'opacity-50 grayscale' : 'shadow-sm';
                const barColor = note.isExpired ? note.c.expiredBg : note.c.bg;

                html += `
                    <div class="flex items-center gap-3 p-4 bg-white rounded-2xl border border-stone-100 mb-3 relative group transition-all ${opacityClass}">
                        <div class="h-12 w-1.5 ${barColor} rounded-full transition-colors"></div>
                        <div class="flex-1 min-w-0 cursor-pointer edit-note-btn" data-id="${note.id}">
                            <h4 class="text-base font-bold ${note.isExpired ? 'text-stone-500 line-through' : 'text-stone-700'} truncate group-hover:text-emerald-600 transition-colors">${note.title}</h4>
                            <p class="text-xs mt-1 truncate">${note.progressHtml}</p>
                        </div>
                        <button class="delete-note-btn text-stone-300 hover:text-rose-500 p-2 transition-colors outline-none" data-id="${note.id}">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                `;
            });
        }
        html += `</div>`;
        this.container.innerHTML = html;

        this.container.querySelectorAll('.edit-note-btn').forEach(btn => {
            btn.addEventListener('click', (e) => onEditClick(e.currentTarget.getAttribute('data-id'), notesList));
        });
        this.container.querySelectorAll('.delete-note-btn').forEach(btn => {
            btn.addEventListener('click', (e) => onDeleteClick(e.currentTarget.getAttribute('data-id')));
        });

        const addBtn = this.container.querySelector('#openNoteModalFromListBtn');
        if (addBtn) addBtn.addEventListener('click', () => onEditClick(null, notesList));
    }
}