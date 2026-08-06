// oshiCleanupRegistry.ts
// 推し削除時の連鎖処理をドメインごとに登録するレジストリ。
// backupRegistry と対になる設計で、oshiProfileStore 自体は他ドメインの存在を知らなくて済む。
// Phase 8a 時点では空。Phase 3/9/10 実装時に各ストアが自分のハンドラを登録する。
const handlers = [];
export function registerOshiCleanupHandler(handler) {
    handlers.push(handler);
}
export function getOshiCleanupHandlers() {
    return [...handlers];
}
