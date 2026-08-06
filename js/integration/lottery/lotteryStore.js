// lotteryStore.ts
// 抽選エントリデータの単一の保持元（single source of truth）。
// 永続化先は localStorage（端末のブラウザ内のみ。サーバー送信なし）。
import { registerBackupTarget } from "../backupRegistry.js";
import { registerOshiCleanupHandler } from "../oshiCleanupRegistry.js";
const STORAGE_KEY = "encoreTrail.lotteryEntries";
let entries = [];
/** 起動時に一度呼び、localStorageから復元する */
export async function loadLotteryEntries() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        entries = raw ? JSON.parse(raw) : [];
    }
    catch (err) {
        console.error("抽選データの読み込みに失敗したため空リストで開始します", err);
        entries = [];
    }
    return entries;
}
/** 現在保持している抽選エントリ一覧（コピーを返す） */
export function getLotteryEntries() {
    return [...entries];
}
async function persist() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }
    catch (err) {
        console.error("抽選データの保存に失敗しました", err);
        throw err;
    }
}
/** 新規エントリを追加して保存する */
export async function addLotteryEntry(data) {
    const entry = {
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
        ...data,
    };
    entries.push(entry);
    await persist();
    return entry;
}
/** 既存エントリを更新して保存する */
export async function updateLotteryEntry(id, data) {
    entries = entries.map((e) => (e.id === id ? { ...e, ...data } : e));
    await persist();
}
/** 指定IDのエントリを削除して保存する */
export async function deleteLotteryEntry(id) {
    entries = entries.filter((e) => e.id !== id);
    await persist();
}
/** エントリ一覧をまるごと置き換えて保存する（バックアップからの復元用） */
export async function replaceAllLotteryEntries(newEntries) {
    entries = newEntries;
    await persist();
}
/** 指定した推しIDに紐づく抽選件数を返す（oshiCleanupRegistry 用） */
export function countLotteriesByOshiId(oshiId) {
    return entries.filter((e) => e.oshiId === oshiId).length;
}
/** 指定した推しIDに紐づく抽選を削除する（oshiCleanupRegistry 用） */
export async function deleteLotteriesByOshiId(oshiId) {
    entries = entries.filter((e) => e.oshiId !== oshiId);
    await persist();
}
registerBackupTarget({
    jsonKey: "lotteryEntries",
    getData: getLotteryEntries,
    replaceAll: (data) => replaceAllLotteryEntries(data),
});
registerOshiCleanupHandler({
    domainName: "lottery",
    countByOshiId: countLotteriesByOshiId,
    deleteByOshiId: deleteLotteriesByOshiId,
});
