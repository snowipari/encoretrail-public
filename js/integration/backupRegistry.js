// backupRegistry.ts
// 各ストアが自身をバックアップ対象として登録するレジストリ。
// backupUtils.ts はここを読んで全ドメインをまとめてエクスポート／インポートする。
// 新規ストアを追加する際は、そのストアファイル内で registerBackupTarget を呼ぶだけでよい。
const targets = [];
export function registerBackupTarget(target) {
    targets.push(target);
}
export function getBackupTargets() {
    return [...targets];
}
