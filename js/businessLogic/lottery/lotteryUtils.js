// lotteryUtils.ts
// 抽選エントリに関するビジネスロジック（純粋関数）。DOM・localStorage に依存しない。
/**
 * 当選率を返す（0〜1）。確定済み（won + lost）が 0 件の場合は null。
 * pending は集計対象外。
 */
export function calcWinRate(entries) {
    const decided = entries.filter((e) => e.status === "won" || e.status === "lost");
    if (decided.length === 0)
        return null;
    const won = decided.filter((e) => e.status === "won").length;
    return won / decided.length;
}
/**
 * 申込中エントリを締切日昇順でソートして返す。
 * 締切が同日の場合は発表日昇順。
 */
export function sortPendingByDeadline(entries) {
    return entries
        .filter((e) => e.status === "pending")
        .sort((a, b) => {
        const dl = a.applicationDeadline.localeCompare(b.applicationDeadline);
        return dl !== 0 ? dl : a.announcementDate.localeCompare(b.announcementDate);
    });
}
/**
 * 締切まで N 日以内の申込中エントリを返す。
 * today は YYYY-MM-DD 形式（テスト可能にするため注入）。
 */
export function getUpcomingDeadlines(entries, today, withinDays) {
    return entries.filter((e) => {
        if (e.status !== "pending")
            return false;
        const diff = (new Date(`${e.applicationDeadline}T00:00:00`).getTime() -
            new Date(`${today}T00:00:00`).getTime()) /
            86_400_000;
        return diff >= 0 && diff <= withinDays;
    });
}
