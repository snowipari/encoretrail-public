// lotteryList.ts
// 抽選エントリ一覧の描画を担当する。データ取得は lotteryStore に委譲する。
import { getLotteryEntries } from "../../integration/lottery/lotteryStore.js";
import { calcWinRate, sortPendingByDeadline, getUpcomingDeadlines } from "../../businessLogic/lottery/lotteryUtils.js";
import { escapeHtml, fmtDate, todayStr } from "../../businessLogic/domUtils.js";
const STATUS_LABEL = {
    pending: "申込中",
    won: "当選",
    lost: "落選",
};
const STATUS_COLOR = {
    pending: "var(--et-ink-muted)",
    won: "var(--et-accent-dark)",
    lost: "var(--et-danger)",
};
export function renderLotteryList(container, handlers) {
    const entries = getLotteryEntries();
    if (entries.length === 0) {
        container.innerHTML = "";
        return;
    }
    const today = todayStr();
    const upcoming = getUpcomingDeadlines(entries, today, 3);
    const pending = sortPendingByDeadline(entries);
    const won = entries.filter((e) => e.status === "won")
        .sort((a, b) => b.announcementDate.localeCompare(a.announcementDate));
    const lost = entries.filter((e) => e.status === "lost")
        .sort((a, b) => b.announcementDate.localeCompare(a.announcementDate));
    const winRate = calcWinRate(entries);
    const winRateBadge = winRate !== null
        ? `<div class="mb-4 p-3 rounded-2xl border border-[#dde1e8] text-sm text-center">
           当選率 <span class="font-bold" style="color:var(--et-accent-dark);">${Math.round(winRate * 100)}%</span>
           <span class="text-[var(--et-ink-muted)] ml-1">(確定済み ${entries.filter(e => e.status !== "pending").length}件)</span>
         </div>`
        : "";
    const urgentBanner = upcoming.length > 0
        ? `<div class="mb-4 p-3 rounded-2xl text-sm" style="background:var(--et-accent);color:#fff;">
           ⚠️ 締切が3日以内のエントリが${upcoming.length}件あります
         </div>`
        : "";
    const renderCard = (e) => {
        const isUrgent = upcoming.some((u) => u.id === e.id);
        const convertBtn = e.status === "won"
            ? `<button data-action="convert" data-id="${e.id}"
             class="flex-1 py-2 rounded-xl font-semibold text-sm border"
             style="color:var(--et-accent-dark); border-color:var(--et-accent);">
             ライブ記録に変換
           </button>`
            : "";
        return `
      <div class="et-card rounded-2xl p-4 mb-3${isUrgent ? " border border-orange-300" : ""}" data-id="${e.id}">
        <div class="flex justify-between items-center">
          <span class="text-xs font-bold" style="color:${STATUS_COLOR[e.status]};">${STATUS_LABEL[e.status]}</span>
          ${isUrgent ? '<span class="text-xs font-bold text-orange-500">締切間近</span>' : ""}
        </div>
        <p class="font-bold mt-1 truncate">${escapeHtml(e.title)}</p>
        <p class="text-sm text-[var(--et-ink-muted)]">${escapeHtml(e.artist)}</p>
        <div class="et-detail hidden mt-3 pt-3 border-t border-[#e4e8ef] text-sm text-[var(--et-ink-muted)] space-y-1">
          <p>申込締切: ${fmtDate(e.applicationDeadline)}</p>
          <p>当落発表: ${fmtDate(e.announcementDate)}</p>
          ${e.memo ? `<p>メモ: ${escapeHtml(e.memo)}</p>` : ""}
          <div class="flex gap-2 pt-2">
            ${convertBtn}
            <button data-action="edit" data-id="${e.id}" class="flex-1 py-2 rounded-xl border border-[#dde1e8] font-semibold text-[var(--et-ink)]">編集</button>
            <button data-action="delete" data-id="${e.id}" class="flex-1 py-2 rounded-xl border font-semibold" style="color:var(--et-danger); border-color:#f1c6c4;">削除</button>
          </div>
        </div>
      </div>`;
    };
    const addBtn = `
    <div class="mt-3 pt-3 border-t border-[#f0f2f7]">
      <button id="lotteryAddButton" class="w-full py-2 text-xs font-semibold text-center" style="color:var(--et-accent);">
        + 抽選を追加
      </button>
    </div>`;
    container.innerHTML = `
    ${urgentBanner}
    ${winRateBadge}
    ${[...pending, ...won, ...lost].map(renderCard).join("")}
    ${addBtn}`;
    container.querySelector("#lotteryAddButton")?.addEventListener("click", handlers.onAddClick);
    container.onclick = (e) => {
        const target = e.target;
        const actionBtn = target.closest("[data-action]");
        if (actionBtn) {
            const id = actionBtn.dataset.id;
            if (actionBtn.dataset.action === "edit")
                handlers.onEdit(id);
            if (actionBtn.dataset.action === "delete")
                handlers.onDelete(id);
            if (actionBtn.dataset.action === "convert")
                handlers.onConvertToRecord(id);
            return;
        }
        const card = target.closest("[data-id]");
        card?.querySelector(".et-detail")?.classList.toggle("hidden");
    };
}
