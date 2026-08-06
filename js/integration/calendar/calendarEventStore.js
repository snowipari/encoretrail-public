// calendarEventStore.ts
// カレンダーイベントデータの単一の保持元（single source of truth）。
// 永続化先は localStorage（端末のブラウザ内のみ。サーバー送信なし）。
import { registerBackupTarget } from "../backupRegistry.js";
const STORAGE_KEY = "encoreTrail.calendarEvents";
let events = [];
/** 起動時に一度呼び、localStorageから復元する */
export async function loadCalendarEvents() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        // 旧 userMemo (string) を userMemos 配列へ移行
        events = parsed.map((ev) => {
            const legacy = ev.userMemo;
            if (legacy && !ev.userMemos) {
                const entry = {
                    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
                    text: legacy,
                    scope: "all-days",
                };
                const { userMemo: _removed, ...rest } = ev;
                return { ...rest, userMemos: [entry] };
            }
            return ev;
        });
    }
    catch (err) {
        console.error("読み込みに失敗したため空リストで開始します", err);
        events = [];
    }
    return events;
}
/** 現在保持しているカレンダーイベント一覧 */
export function getCalendarEvents() {
    return [...events];
}
async function persist() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    }
    catch (err) {
        console.error("保存に失敗しました", err);
        throw err;
    }
}
/** 新規カレンダーイベントを追加して保存する */
export async function addCalendarEvent(data) {
    const event = {
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
        ...data,
    };
    events.push(event);
    await persist();
    return event;
}
/** 既存カレンダーイベントを更新して保存する */
export async function updateCalendarEvent(id, data) {
    events = events.map((ev) => (ev.id === id ? { ...ev, ...data } : ev));
    await persist();
}
/** 指定IDのカレンダーイベントを削除して保存する */
export async function deleteCalendarEvent(id) {
    events = events.filter((ev) => ev.id !== id);
    await persist();
}
/** カレンダーイベントをまるごと置き換えて保存する（バックアップからの復元用） */
export async function replaceAllCalendarEvents(newEvents) {
    events = newEvents;
    await persist();
}
/**
 * 自動取得（autoFetched: true）のイベントを一括で更新する（同期処理用）。
 * 既存の手動入力イベントは変更しない。
 * ユーザーが書き込んだ userMemos は id 一致で引き継ぐ。
 */
export async function replaceAutoFetchedEvents(newAutoEvents) {
    const manualEvents = events.filter((ev) => !ev.autoFetched);
    const memoMap = new Map(events.filter((ev) => ev.autoFetched && ev.userMemos?.length).map((ev) => [ev.id, ev.userMemos]));
    const merged = newAutoEvents.map((ev) => memoMap.has(ev.id) ? { ...ev, userMemos: memoMap.get(ev.id) } : ev);
    events = [...manualEvents, ...merged];
    await persist();
}
registerBackupTarget({
    jsonKey: "calendarEvents",
    getData: getCalendarEvents,
    replaceAll: (data) => replaceAllCalendarEvents(data),
});
