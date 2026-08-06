// oshiProfileStore.ts
// 推しプロフィールデータの単一の保持元（single source of truth）。
// 永続化先は localStorage（端末のブラウザ内のみ。サーバー送信なし）。
import { registerBackupTarget } from "../backupRegistry.js";
const STORAGE_KEY = "encoreTrail.oshiProfiles";
let oshiProfiles = [];
/** 起動時に一度呼び、localStorageから復元する */
export async function loadOshiProfiles() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        oshiProfiles = raw ? JSON.parse(raw) : [];
    }
    catch (err) {
        console.error("読み込みに失敗したため空リストで開始します", err);
        oshiProfiles = [];
    }
    return oshiProfiles;
}
/** 現在保持している推しプロフィール一覧 */
export function getOshiProfiles() {
    return [...oshiProfiles];
}
async function persist() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(oshiProfiles));
    }
    catch (err) {
        console.error("保存に失敗しました", err);
        throw err;
    }
}
/** 新規推しプロフィールを追加して保存する */
export async function addOshiProfile(data) {
    const profile = {
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
        ...data,
    };
    oshiProfiles.push(profile);
    await persist();
    return profile;
}
/** 既存推しプロフィールを更新して保存する */
export async function updateOshiProfile(id, data) {
    oshiProfiles = oshiProfiles.map((p) => (p.id === id ? { ...p, ...data } : p));
    await persist();
}
/** 指定IDの推しプロフィールを削除して保存する */
export async function deleteOshiProfile(id) {
    oshiProfiles = oshiProfiles.filter((p) => p.id !== id);
    await persist();
}
/** 推しプロフィール一覧をまるごと置き換えて保存する（バックアップからの復元用） */
export async function replaceAllOshiProfiles(newProfiles) {
    oshiProfiles = newProfiles;
    await persist();
}
registerBackupTarget({
    jsonKey: "oshiProfiles",
    getData: getOshiProfiles,
    replaceAll: (data) => replaceAllOshiProfiles(data),
});
