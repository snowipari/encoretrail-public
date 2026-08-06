// recordList.ts
// ヒーロー（次のライブまでのカウントダウン）と一覧表示の描画を担当する。
// データの取得は recordStore に委譲し、ここでは描画とイベント委譲のみを行う。
import { getRecords } from "../../integration/liveRecords/recordStore.js";
import { daysUntil, fmtDate, escapeHtml } from "../../businessLogic/domUtils.js";
/**
 * ヒーロー（次のライブまでのカウントダウン）を描画する。
 * 直近の未来日がなければ何も表示しない。
 */
export function renderHero(container) {
    const upcoming = getRecords()
        .filter((r) => daysUntil(r.date) >= 0)
        .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (!upcoming) {
        container.innerHTML = "";
        return;
    }
    const d = daysUntil(upcoming.date);
    const dayLabel = d === 0 ? "本日" : `${d}`;
    container.innerHTML = `
    <div class="neu-raised rounded-2xl p-3 mb-3 flex items-center gap-3">
      <div class="neu-pressed w-16 h-16 rounded-full flex flex-col items-center justify-center shrink-0">
        <span class="text-xl font-extrabold" style="color:var(--et-accent);">${escapeHtml(dayLabel)}</span>
        <span class="text-[10px] text-[var(--et-ink-muted)]">${d === 0 ? "" : "日後"}</span>
      </div>
      <div class="min-w-0">
        <p class="text-xs text-[var(--et-ink-muted)]">次のライブまで</p>
        <p class="font-bold truncate">${escapeHtml(upcoming.artist)}</p>
        <p class="text-sm text-[var(--et-ink-muted)] truncate">${escapeHtml(upcoming.venue || "")}</p>
      </div>
    </div>`;
}
const MAX_VISIBLE = 2;
function buildRecordCard(r) {
    return `
    <div class="et-card rounded-2xl p-4 mb-3 cursor-pointer" data-id="${r.id}">
      <div class="flex justify-between items-center">
        <span class="text-xs font-bold" style="color:var(--et-accent-dark);">${fmtDate(r.date)}</span>
        <svg class="et-expand-icon w-4 h-4 text-[var(--et-ink-muted)] transition-transform duration-200 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>
      <p class="font-bold mt-1">${escapeHtml(r.artist)}</p>
      <p class="text-sm text-[var(--et-ink-muted)]">${escapeHtml(r.venue || "")}</p>
      <div class="et-detail hidden mt-3 pt-3 border-t border-[#e4e8ef] text-sm text-[var(--et-ink-muted)] space-y-1">
        ${r.tour ? `<p>ツアー: ${escapeHtml(r.tour)}</p>` : ""}
        ${r.seat ? `<p>座席: ${escapeHtml(r.seat)}</p>` : ""}
        ${(r.setlist ?? []).length > 0
        ? `<p class="mt-1">セトリ:</p><ul class="list-disc list-inside space-y-0.5">${(r.setlist ?? []).map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>`
        : ""}
        ${r.memo ? `<p class="mt-1">メモ: ${escapeHtml(r.memo)}</p>` : ""}
        <div class="flex gap-2 pt-2">
          <button data-action="delete" data-id="${r.id}" class="flex-1 py-2 rounded-xl border font-semibold" style="color:var(--et-danger); border-color:#f1c6c4;">削除</button>
          <button data-action="edit" data-id="${r.id}" class="flex-1 py-2 rounded-xl border border-[#dde1e8] font-semibold text-[var(--et-ink)]">編集</button>
        </div>
      </div>
    </div>`;
}
/** 記録一覧を描画する。 */
export function renderList(container, handlers) {
    const records = getRecords();
    // カウントバッジを更新
    const badge = document.getElementById("recordListCount");
    if (badge)
        badge.textContent = records.length > 0 ? String(records.length) : "";
    if (records.length === 0) {
        container.innerHTML = `
      <div class="text-center py-16 text-[var(--et-ink-muted)]">
        <p class="text-sm leading-7 mb-4">まだ記録がありません。<br>最初のライブを追加しましょう。</p>
        <button id="emptyAddButton" class="neu-raised rounded-2xl px-6 py-3 font-bold" style="color:var(--et-accent);">
          ライブを追加する
        </button>
      </div>`;
        container.querySelector("#emptyAddButton")?.addEventListener("click", handlers.onEmptyAddClick);
        return;
    }
    const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
    const total = sorted.length;
    const hasMore = total > MAX_VISIBLE;
    const visibleCards = sorted.slice(0, MAX_VISIBLE).map(buildRecordCard).join("");
    const hiddenCards = sorted.slice(MAX_VISIBLE).map(buildRecordCard).join("");
    container.innerHTML =
        visibleCards +
            (hasMore
                ? `<div id="recordListHidden" style="display:none;">${hiddenCards}</div>
         <button id="recordListExpandBtn" class="mt-1 w-full text-right pr-1 text-xs font-semibold" style="color:var(--et-accent);">
           全${total}件表示 →
         </button>`
                : "");
    if (hasMore) {
        container.querySelector("#recordListExpandBtn")?.addEventListener("click", () => {
            const hidden = container.querySelector("#recordListHidden");
            const btn = container.querySelector("#recordListExpandBtn");
            if (!hidden || !btn)
                return;
            const expanded = hidden.style.display !== "none";
            hidden.style.display = expanded ? "none" : "block";
            btn.textContent = expanded ? `全${total}件表示 →` : "折りたたむ";
        });
    }
    // イベント委譲：カードタップで詳細開閉（アイコン回転も連動）、編集/削除ボタンで各操作
    container.onclick = (e) => {
        const target = e.target;
        if (target.id === "recordListExpandBtn")
            return;
        const actionBtn = target.closest("[data-action]");
        if (actionBtn) {
            const id = actionBtn.dataset.id;
            if (actionBtn.dataset.action === "edit")
                handlers.onEdit(id);
            if (actionBtn.dataset.action === "delete")
                handlers.onDelete(id);
            return;
        }
        const card = target.closest("[data-id]");
        if (card) {
            const detail = card.querySelector(".et-detail");
            const icon = card.querySelector(".et-expand-icon");
            detail?.classList.toggle("hidden");
            icon?.classList.toggle("rotate-180");
        }
    };
}
