// src/models/noteModel.js
import db from './db.js';

export default class NoteModel {
    static async saveNote(noteData) {
        try {
            const note = {
                id: noteData.id || `NOTE-${Date.now()}`,
                title: noteData.title,
                type: noteData.type, // 'single' (單次) 或 'duration' (區間)
                startDate: noteData.startDate,
                durationDays: parseInt(noteData.durationDays) || 1,
                color: noteData.color || 'emerald', // 儲存使用者選擇的顏色 (rose, emerald, sky...)
                status: noteData.status || 'active',
                updatedAt: new Date().toISOString()
            };

            await db.routineNotes.put(note);
            return note;
        } catch (error) {
            console.error('[NoteModel Error] saveNote 失敗:', error);
            throw error;
        }
    }

    // 取得所有生效的記事
    static async getNotesRange() {
        return await db.routineNotes.where('status').equals('active').toArray();
    }

    // 刪除記事
    static async deleteNote(noteId) {
        try {
            await db.routineNotes.delete(noteId);
            return true;
        } catch (error) {
            console.error('[NoteModel Error] deleteNote 失敗:', error);
            throw error;
        }
    }
    /**
     * 🚩 自動清理機制 (Auto-Pruning)
     * 刪除過期超過 30 天的單次紀錄與時效區間，保持本地與雲端資料庫輕量
     */
    static async cleanUpExpiredNotes() {
        try {
            const allNotes = await db.routineNotes.toArray();
            const today = new Date();
            const toDeleteIds = [];

            allNotes.forEach(note => {
                const [y, m, d] = note.startDate.split('-').map(Number);
                const start = new Date(y, m - 1, d);
                let endDate = start;

                if (note.type === 'duration') {
                    endDate = new Date(y, m - 1, d);
                    endDate.setDate(endDate.getDate() + note.durationDays - 1);
                }

                // 如果今天已經超過結束日
                if (today > endDate) {
                    const overDays = Math.floor((today - endDate) / 86400000);
                    // 過期大於 30 天，列入刪除名單
                    if (overDays > 30) {
                        toDeleteIds.push(note.id);
                    }
                }
            });

            if (toDeleteIds.length > 0) {
                await db.routineNotes.bulkDelete(toDeleteIds);
                console.log(`[System] 🧹 已在背景自動清理 ${toDeleteIds.length} 筆過期超過 30 天的手札。`);
            }
        } catch (error) {
            console.error('[NoteModel Error] cleanUpExpiredNotes 執行失敗:', error);
        }
    }
}