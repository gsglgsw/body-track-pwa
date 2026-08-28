// src/models/userModel.js
import db from './db.js';

export default class UserModel {
    static async getProfile() {
        return await db.userProfile.toCollection().first();
    }

    static async saveProfile(data) {
        let profile = await this.getProfile();
        
        const newProfile = {
            userId: profile?.userId || crypto.randomUUID(),
            fingerprint: profile?.fingerprint || this.generateFingerprint(),
            boundEmail: profile?.boundEmail || null,
            gender: data.gender || 'female',
            birthYear: parseInt(data.birthYear) || 1995,
            height: parseFloat(data.height) || 165,
            goalWeight: parseFloat(data.goalWeight) || null,
            goalBodyFat: parseFloat(data.goalBodyFat) || null,
            goalWaist: parseFloat(data.goalWaist) || null, // 🚩 體態目標
            
            // 🚩 Phase 3 新增：系統推播偏好設定
            notifyMeasurement: data.notifyMeasurement !== undefined ? data.notifyMeasurement : (profile?.notifyMeasurement || false),
            measurementTime: data.measurementTime || profile?.measurementTime || '08:00',
            notifySummary: data.notifySummary !== undefined ? data.notifySummary : (profile?.notifySummary || false),
            notifyEventEnd: data.notifyEventEnd !== undefined ? data.notifyEventEnd : (profile?.notifyEventEnd || false),

            registrationDate: profile?.registrationDate || new Date().toISOString()
        };

        await db.userProfile.clear();
        await db.userProfile.put(newProfile);
        return newProfile;
    }

    static generateFingerprint() {
        const nav = window.navigator;
        const screen = window.screen;
        const str = `${nav.userAgent}-${nav.language}-${screen.width}x${screen.height}-${new Date().getTime()}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; 
        }
        return Math.abs(hash).toString(16);
    }

    static async clearAllLocalData() {
        await db.dailyRecords.clear();
        await db.userProfile.clear();
        await db.routineNotes.clear(); // 🚩 確保登出時連同手札一併清空
    }
}