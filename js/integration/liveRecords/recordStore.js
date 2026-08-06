// recordStore.ts
// ライブ記録データの単一の保持元（single source of truth）。
// 永続化先は localStorage（端末のブラウザ内のみ。サーバー送信なし）。
import { registerBackupTarget } from "../backupRegistry.js";
const STORAGE_KEY = "encoreTrail.records";
let records = [];
/** 起動時に一度呼び、localStorageから復元する */
export async function loadRecords() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        records = raw ? JSON.parse(raw) : [];
    }
    catch (err) {
        console.error("読み込みに失敗したため空リストで開始します", err);
        records = [];
    }
    return records;
}
/** 現在保持している記録一覧（参照を直接返さずコピーを返す） */
export function getRecords() {
    return [...records];
}
async function persist() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    }
    catch (err) {
        console.error("保存に失敗しました", err);
        throw err;
    }
}
/** 新規記録を追加して保存する */
export async function addRecord(data) {
    const record = {
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
        ...data,
    };
    records.push(record);
    await persist();
    return record;
}
/** 既存記録を更新して保存する */
export async function updateRecord(id, data) {
    records = records.map((r) => (r.id === id ? { ...r, ...data } : r));
    await persist();
}
/** 指定IDの記録を削除して保存する */
export async function deleteRecord(id) {
    records = records.filter((r) => r.id !== id);
    await persist();
}
/** 記録一覧をまるごと置き換えて保存する（バックアップからの復元用） */
export async function replaceAllRecords(newRecords) {
    records = newRecords;
    await persist();
}
registerBackupTarget({
    jsonKey: "records",
    getData: getRecords,
    replaceAll: (data) => replaceAllRecords(data),
});
