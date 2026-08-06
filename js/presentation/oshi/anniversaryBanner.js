// anniversaryBanner.ts
// ホーム画面向け：誕生日・推し記念日が近づいている推しの通知バナーを描画する。
import { escapeHtml } from "../../businessLogic/domUtils.js";
/** 近づいている記念日の通知バナーをコンテナに描画する。対象がなければコンテナを空にする。 */
export function renderAnniversaryBanner(container, anniversaries) {
    if (anniversaries.length === 0) {
        container.innerHTML = "";
        return;
    }
    const items = anniversaries.map((a) => buildBannerItem(a)).join("");
    container.innerHTML = `<div class="space-y-2 mb-4">${items}</div>`;
}
function buildBannerItem(a) {
    const isBirthday = a.type === "birthday";
    const typeLabel = isBirthday ? "誕生日" : "記念日";
    // 誕生日: amber、推し記念日: rose
    const badgeCls = isBirthday
        ? "bg-amber-100 text-amber-700"
        : "bg-rose-100 text-rose-600";
    const borderCls = isBirthday ? "border-amber-200 bg-[#fffbf0]" : "border-rose-200 bg-[#fff5f5]";
    const message = buildMessage(a);
    return `
    <div class="flex items-center gap-2 px-3 py-2.5 rounded-xl border ${borderCls}">
      <span class="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${badgeCls}">${typeLabel}</span>
      <span class="text-xs text-[var(--et-ink)] leading-snug">${escapeHtml(message)}</span>
    </div>`;
}
function buildMessage(a) {
    const name = a.oshiName;
    const yearsStr = a.yearsCount !== undefined ? `（${a.yearsCount}周年）` : "";
    if (a.type === "birthday") {
        if (a.daysUntil === 0)
            return `今日は${name}の誕生日！`;
        if (a.daysUntil === 1)
            return `明日は${name}の誕生日`;
        return `${a.daysUntil}日後に${name}の誕生日`;
    }
    // anniversary
    if (a.daysUntil === 0)
        return `今日は${name}の推し記念日！${yearsStr}`;
    if (a.daysUntil === 1)
        return `明日は${name}の推し記念日${yearsStr}`;
    return `${a.daysUntil}日後に${name}の推し記念日${yearsStr}`;
}
