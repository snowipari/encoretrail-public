// upcomingEventsView.ts
// ホーム画面「今後の予定」セクション。CalendarEvent と抽選の締切・当落を統合した
// TimelineItem を日付順で最大2件プレビュー表示する。3件以上はインライン展開できる。
import { escapeHtml } from "../../businessLogic/domUtils.js";
const MAX_VISIBLE = 2;
function formatEventDate(date) {
    const d = new Date(`${date}T00:00:00`);
    return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" });
}
function buildKindBadge(item) {
    switch (item.kind) {
        case "memo":
        case "user-memo":
            return `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">メモ</span>`;
        case "lottery-deadline":
            return `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">申込締切</span>${item.isUrgent
                ? ` <span class="text-[10px] font-bold text-orange-500">⚠️ 締切間近</span>`
                : ""}`;
        case "lottery-announcement":
            return `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">当落発表</span>`;
    }
}
function buildEventRow(item) {
    const dateStr = formatEventDate(item.date);
    const badge = buildKindBadge(item);
    const sourceHtml = item.sourceEventTitle
        ? `<p class="text-[10px] text-[var(--et-ink-muted)] mt-0.5 truncate">${escapeHtml(item.sourceEventTitle)}より</p>`
        : "";
    return `
    <div class="flex items-start gap-3 py-2.5 border-b border-[#f0f2f7] last:border-0 cursor-pointer active:opacity-70"
         data-calendar-date="${item.date}">
      <div class="shrink-0 text-right pointer-events-none" style="min-width:52px;">
        <p class="text-[11px] text-[var(--et-ink-muted)] whitespace-nowrap">${escapeHtml(dateStr)}</p>
        ${item.time ? `<p class="text-[11px] text-[var(--et-ink-muted)]">${escapeHtml(item.time)}</p>` : ""}
      </div>
      <div class="flex-1 min-w-0 pointer-events-none">
        <div class="flex items-center gap-1 flex-wrap mb-0.5">${badge}</div>
        <p class="text-sm text-[var(--et-ink)] leading-snug truncate">${escapeHtml(item.title)}</p>
        ${sourceHtml}
      </div>
    </div>`;
}
/** 「今後の予定」タイムラインをコンテナに描画する。 */
export function renderUpcomingEvents(container, items) {
    const total = items.length;
    const sectionHead = `
    <div class="flex items-center justify-between mb-2">
      <p class="text-xs font-semibold text-[var(--et-ink-muted)]">今後の予定</p>
      ${total > 0 ? `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#f0f2f7] text-[var(--et-ink-muted)]">${total}件</span>` : ""}
    </div>`;
    if (total === 0) {
        container.innerHTML = `
      <div class="mb-4">
        ${sectionHead}
        <p class="text-sm text-[var(--et-ink-muted)] py-3 text-center">14日以内の予定はありません</p>
      </div>`;
        return;
    }
    const visibleRows = items.slice(0, MAX_VISIBLE).map(buildEventRow).join("");
    const hiddenRows = items.slice(MAX_VISIBLE).map(buildEventRow).join("");
    const hasMore = total > MAX_VISIBLE;
    container.innerHTML = `
    <div class="mb-4">
      ${sectionHead}
      <div class="px-3 py-1 rounded-xl border border-[#e4e8ef] bg-white">
        ${visibleRows}
        ${hasMore ? `<div id="upcomingHidden" style="display:none;">${hiddenRows}</div>` : ""}
      </div>
      ${hasMore
        ? `<button id="upcomingExpandBtn" class="mt-2 w-full text-right pr-1 text-xs font-semibold" style="color:var(--et-accent);">
             全${total}件表示 →
           </button>`
        : ""}
    </div>`;
    if (!hasMore)
        return;
    container.querySelector("#upcomingExpandBtn")?.addEventListener("click", () => {
        const hidden = container.querySelector("#upcomingHidden");
        const btn = container.querySelector("#upcomingExpandBtn");
        if (!hidden || !btn)
            return;
        const expanded = hidden.style.display !== "none";
        hidden.style.display = expanded ? "none" : "block";
        btn.textContent = expanded ? `全${total}件表示 →` : "折りたたむ";
    });
}
