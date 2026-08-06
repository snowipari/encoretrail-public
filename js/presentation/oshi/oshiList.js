// oshiList.ts
// 推し一覧の描画。データ取得はoshiProfileStore、ロジックはoshiUtilsに委譲する。
import { getOshiProfiles } from "../../integration/oshi/oshiProfileStore.js";
import { daysAsFan, formatDaysAsFan, } from "../../businessLogic/oshi/oshiUtils.js";
import { escapeHtml, todayStr } from "../../businessLogic/domUtils.js";
export function renderOshiList(container, callbacks) {
    const profiles = getOshiProfiles();
    if (profiles.length === 0) {
        container.innerHTML = `
      <div class="text-center py-12">
        <p class="text-[var(--et-ink-muted)] text-sm mb-4">まだ推しが登録されていません</p>
        <button id="oshiEmptyAddBtn"
          class="neu-raised px-6 py-2.5 rounded-xl text-sm font-bold"
          style="color:var(--et-accent-dark);">
          推しを追加する
        </button>
      </div>`;
        container
            .querySelector("#oshiEmptyAddBtn")
            ?.addEventListener("click", callbacks.onAddClick);
        return;
    }
    container.innerHTML = `
    <div class="space-y-3">
      ${profiles.map((p) => renderCard(p)).join("")}
    </div>`;
    container.querySelectorAll("[data-oshi-edit]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            callbacks.onEdit(btn.dataset.oshiEdit);
        });
    });
    container.querySelectorAll("[data-oshi-delete]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            callbacks.onDelete(btn.dataset.oshiDelete);
        });
    });
}
function renderCard(p) {
    const days = daysAsFan(p.anniversaryDate, todayStr());
    const typeLabel = p.type === "individual" ? "個人" : "グループ";
    const typeBadgeColor = p.type === "individual"
        ? "bg-pink-100 text-pink-600"
        : "bg-purple-100 text-purple-600";
    const siteLink = p.officialSiteUrl
        ? `<div class="mt-2.5 pt-2.5 border-t border-[#f0f2f7]">
         <a href="${escapeHtml(p.officialSiteUrl)}" target="_blank" rel="noopener noreferrer"
            class="flex items-center justify-between text-xs font-semibold"
            style="color:var(--et-accent);">
           <span class="flex items-center gap-1.5">
             <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
               <circle cx="12" cy="12" r="10"/>
               <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
             </svg>
             公式サイトを開く
           </span>
           <span>→</span>
         </a>
       </div>`
        : "";
    return `
    <div class="et-card rounded-2xl p-3.5">
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 mb-1">
            <span class="font-bold text-sm truncate">${escapeHtml(p.name)}</span>
            <span class="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeBadgeColor}">
              ${typeLabel}
            </span>
          </div>
          ${days !== null ? `<p class="text-xs text-[var(--et-ink-muted)]">${formatDaysAsFan(days)}</p>` : ""}
          ${p.memo ? `<p class="text-xs text-[var(--et-ink-muted)] mt-1 truncate">${escapeHtml(p.memo)}</p>` : ""}
        </div>
        <div class="flex gap-2 shrink-0">
          <button data-oshi-edit="${escapeHtml(p.id)}"
            class="text-xs px-2.5 py-1.5 rounded-lg border border-[#dde1e8] font-semibold">
            編集
          </button>
          <button data-oshi-delete="${escapeHtml(p.id)}"
            class="text-xs px-2.5 py-1.5 rounded-lg border border-[#dde1e8] font-semibold text-red-400">
            削除
          </button>
        </div>
      </div>
      ${siteLink}
    </div>`;
}
