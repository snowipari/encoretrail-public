// notificationRules.ts
// カレンダーイベントの通知タイミングを決定する純粋関数。
// Phase7（カレンダー）・Phase3（抽選）・Phase9（グッズ）で共通利用する。
/**
 * 通知すべき日時の配列を返す。
 * - endAt がない、または startAt との差が 2 日以内 → startAt の 1 回のみ
 * - startAt との差が 3 日以上 → startAt と endAt の 2 回（長期イベントは開始・終了時のみ）
 * @param startAt ISO 8601 (YYYY-MM-DDTHH:mm)
 * @param endAt   ISO 8601。省略可
 * @returns 通知すべき ISO 8601 文字列の配列（重複なし・昇順）
 */
export function resolveNotificationDates(startAt, endAt) {
    if (!endAt)
        return [startAt];
    const startMs = new Date(startAt).getTime();
    const endMs = new Date(endAt).getTime();
    const diffDays = (endMs - startMs) / (1000 * 60 * 60 * 24);
    if (diffDays >= 3) {
        return [startAt, endAt];
    }
    return [startAt];
}
/**
 * イベントが長期間（3日以上）かどうかを判定する。
 * 長期間イベントは「開始・終了時のみ通知」の対象。
 */
export function isLongDurationEvent(startAt, endAt) {
    if (!endAt)
        return false;
    const diffDays = (new Date(endAt).getTime() - new Date(startAt).getTime()) /
        (1000 * 60 * 60 * 24);
    return diffDays >= 3;
}
