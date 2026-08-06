// backupUtils.ts
// データのエクスポート（ファイル書き出し）とインポート（ファイル読み込み・検証）を担当する。
// バックアップ対象は backupRegistry に登録された全ストアをまとめて扱う。
import { todayStr } from "../../businessLogic/domUtils.js";
import { getBackupTargets } from "../backupRegistry.js";
/** 全ストアのデータをまとめて JSON ファイルとしてダウンロードさせる */
export function exportAll() {
    const backup = { version: 1 };
    for (const target of getBackupTargets()) {
        backup[target.jsonKey] = target.getData();
    }
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const filenameDate = todayStr().replace(/-/g, "");
    const a = document.createElement("a");
    a.href = url;
    a.download = `encoreTrail-backup-${filenameDate}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
/**
 * インポートデータの形式を検証する純粋関数（DOM API に依存しないためテスト可能）。
 * 旧形式（LiveRecord[]）と新形式（BackupFile v1）の両方を受け付ける。
 * 戻り値は各ストアの jsonKey をキーとした Record。
 */
export function validateBackupData(data) {
    const HINT = "このファイルは読み込めませんでした。「encoreTrail-backup-」から始まるファイルを選んでください。";
    // 旧形式（LiveRecord[]）への後方互換
    if (Array.isArray(data)) {
        const isValid = data.every((r) => r && typeof r.artist === "string" && typeof r.date === "string");
        if (!isValid)
            throw new Error(HINT);
        return { records: data };
    }
    // 新形式（BackupFile v1）
    if (typeof data !== "object" || data === null || data.version !== 1) {
        throw new Error(HINT);
    }
    const result = {};
    for (const target of getBackupTargets()) {
        const raw = data[target.jsonKey];
        result[target.jsonKey] = Array.isArray(raw) ? raw : [];
    }
    return result;
}
/**
 * 選択されたファイルを読み込み、検証して各ストア用データの Map として返す。
 * 形式が不正な場合はエラーをthrowする。
 */
export function readBackupFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);
                resolve(validateBackupData(data));
            }
            catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました"));
        reader.readAsText(file);
    });
}
// 既存の呼び出し元との後方互換のためエイリアスを維持する
/** @deprecated exportAll() を使ってください */
export function exportRecordsAsFile(records) {
    void records; // 引数は無視し全ストアをエクスポート
    exportAll();
}
/**
 * インポートデータの形式を検証する純粋関数（後方互換エイリアス）。
 * @deprecated validateBackupData() を使ってください
 */
export function validateImportedData(data) {
    const result = validateBackupData(data);
    return (result["records"] ?? []);
}
/** ファイルを読み込んで LiveRecord[] を返す後方互換エイリアス */
export function readImportFile(file) {
    return readBackupFile(file).then((r) => (r["records"] ?? []));
}
