// domUtils.ts
// 日付計算・文字列整形などの副作用を持たない純粋関数群。
/** 今日の日付を端末のローカルタイムゾーンで YYYY-MM-DD として返す */
export function todayStr() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
/** 指定日付(YYYY-MM-DD)が今日から何日後かを返す（過去はマイナス） */
export function daysUntil(dateStr) {
    const today = new Date(`${todayStr()}T00:00:00`);
    const target = new Date(`${dateStr}T00:00:00`);
    return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
/** YYYY-MM-DD を YYYY/M/D 表記に整形 */
export function fmtDate(dateStr) {
    const d = new Date(`${dateStr}T00:00:00`);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
/** XSS対策のための最低限のHTMLエスケープ */
export function escapeHtml(str) {
    const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    };
    return (str ?? "").replace(/[&<>"']/g, (c) => map[c] ?? c);
}
