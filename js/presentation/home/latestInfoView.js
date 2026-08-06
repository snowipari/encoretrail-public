// latestInfoView.ts
// ホーム画面「最新情報」セクション。autoFetched=true の CalendarEvent を最大2件プレビュー表示する。
// 3件以上ある場合は「全N件表示」ボタンでインライン展開できる。
// Gmail 等の自動取得が有効でない（イベントが空）場合はコンテナを空にして非表示に戻す。
import { escapeHtml } from "../../businessLogic/domUtils.js";
const MAX_VISIBLE = 2;
function formatShortDate(startAt) {
    const d = new Date(`${startAt.slice(0, 10)}T00:00:00`);
    return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" });
}
function buildEventCard(ev, oshiName) {
    const dateStr = formatShortDate(ev.startAt);
    const calDate = ev.startAt.slice(0, 10);
    const oshiLine = oshiName
        ? `<p class="text-[10px] text-[var(--et-ink-muted)] mb-0.5">${escapeHtml(oshiName)}</p>`
        : "";
    return `
    <div class="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-[#e4e8ef] bg-white cursor-pointer active:opacity-70"
         data-calendar-date="${calDate}">
      <span class="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 mt-0.5 pointer-events-none">お知らせ</span>
      <div class="min-w-0 flex-1 pointer-events-none">
        ${oshiLine}
        <p class="text-sm font-semibold text-[var(--et-ink)] leading-snug">${escapeHtml(ev.title)}</p>
        <p class="text-[10px] text-[var(--et-ink-muted)] mt-0.5">${escapeHtml(dateStr)}</p>
      </div>
    </div>`;
}
/** 最新情報セクションをコンテナに描画する。イベントが空ならコンテナを空にする。 */
export function renderLatestInfo(container, autoFetchedEvents, oshiProfiles) {
    if (autoFetchedEvents.length === 0) {
        container.innerHTML = "";
        return;
    }
    const oshiMap = new Map(oshiProfiles.map((p) => [p.id, p.name]));
    const buildCard = (ev) => buildEventCard(ev, ev.oshiId ? (oshiMap.get(ev.oshiId) ?? "") : "");
    const total = autoFetchedEvents.length;
    const visibleCards = autoFetchedEvents.slice(0, MAX_VISIBLE).map(buildCard).join("");
    const hiddenCards = autoFetchedEvents.slice(MAX_VISIBLE).map(buildCard).join("");
    const hasMore = total > MAX_VISIBLE;
    container.innerHTML = `
    <div class="mb-4">
      <div class="flex items-center justify-between mb-2">
        <p class="text-xs font-semibold text-[var(--et-ink-muted)]">お知らせ</p>
        <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#f0f2f7] text-[var(--et-ink-muted)]">${total}件</span>
      </div>
      <div class="space-y-2">
        ${visibleCards}
        ${hasMore ? `<div id="latestInfoHidden" class="space-y-2" style="display:none;">${hiddenCards}</div>` : ""}
      </div>
      ${hasMore
        ? `<button id="latestInfoExpandBtn" class="mt-2 w-full text-right pr-1 text-xs font-semibold" style="color:var(--et-accent);">
             全${total}件表示 →
           </button>`
        : ""}
    </div>`;
    if (!hasMore)
        return;
    container.querySelector("#latestInfoExpandBtn")?.addEventListener("click", () => {
        const hidden = container.querySelector("#latestInfoHidden");
        const btn = container.querySelector("#latestInfoExpandBtn");
        if (!hidden || !btn)
            return;
        const expanded = hidden.style.display !== "none";
        hidden.style.display = expanded ? "none" : "block";
        btn.textContent = expanded ? `全${total}件表示 →` : "折りたたむ";
    });
}
