// fanClubStore.ts
// ファンクラブ会員情報データの単一の保持元（single source of truth）。
// 永続化先は localStorage（端末のブラウザ内のみ。サーバー送信なし）。
import { registerBackupTarget } from "../backupRegistry.js";
import { registerOshiCleanupHandler } from "../oshiCleanupRegistry.js";
const STORAGE_KEY = "encoreTrail.fanClubs";
let memberships = [];
/** 起動時に一度呼び、localStorageから復元する */
export async function loadFanClubs() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        memberships = raw ? JSON.parse(raw) : [];
    }
    catch (err) {
        console.error("読み込みに失敗したため空リストで開始します", err);
        memberships = [];
    }
    return memberships;
}
/** 現在保持しているファンクラブ会員情報一覧 */
export function getFanClubs() {
    return [...memberships];
}
async function persist() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(memberships));
    }
    catch (err) {
        console.error("保存に失敗しました", err);
        throw err;
    }
}
/** 新規ファンクラブ会員情報を追加して保存する */
export async function addFanClub(data) {
    const membership = {
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
        ...data,
    };
    memberships.push(membership);
    await persist();
    return membership;
}
/** 既存ファンクラブ会員情報を更新して保存する */
export async function updateFanClub(id, data) {
    memberships = memberships.map((m) => (m.id === id ? { ...m, ...data } : m));
    await persist();
}
/** 指定IDのファンクラブ会員情報を削除して保存する */
export async function deleteFanClub(id) {
    memberships = memberships.filter((m) => m.id !== id);
    await persist();
}
/** ファンクラブ会員情報をまるごと置き換えて保存する（バックアップからの復元用） */
export async function replaceAllFanClubs(newMemberships) {
    memberships = newMemberships;
    await persist();
}
/** 指定した推しIDに紐づくファンクラブ件数を返す（oshiCleanupRegistry 用） */
export function countFanClubsByOshiId(oshiId) {
    return memberships.filter((m) => m.oshiId === oshiId).length;
}
/** 指定した推しIDに紐づくファンクラブを削除する（oshiCleanupRegistry 用） */
export async function deleteFanClubsByOshiId(oshiId) {
    memberships = memberships.filter((m) => m.oshiId !== oshiId);
    await persist();
}
registerBackupTarget({
    jsonKey: "fanClubs",
    getData: getFanClubs,
    replaceAll: (data) => replaceAllFanClubs(data),
});
registerOshiCleanupHandler({
    domainName: "fanClub",
    countByOshiId: countFanClubsByOshiId,
    deleteByOshiId: deleteFanClubsByOshiId,
});
