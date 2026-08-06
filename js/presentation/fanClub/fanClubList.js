// fanClubList.ts
// ファンクラブ会員情報一覧の描画。更新期限の近いものを上位に表示し、30日以内は警告を表示する。
import { getFanClubs } from "../../integration/fanClub/fanClubStore.js";
import { escapeHtml, fmtDate, daysUntil } from "../../businessLogic/domUtils.js";
const RENEWAL_WARNING_DAYS = 30;
export function renderFanClubList(container, callbacks) {
    const clubs = getFanClubs().sort((a, b) => a.renewalDate.localeCompare(b.renewalDate));
    if (clubs.length === 0) {
        container.innerHTML = `
      <div class="text-center mt-1 mb-3">
        <p class="text-xs text-[var(--et-ink-muted)] mb-2">まだファンクラブが登録されていません</p>
        <button id="fanClubEmptyAddBtn"
          class="neu-raised px-5 py-2 rounded-xl text-xs font-bold"
          style="color:var(--et-accent-dark);">
          ファンクラブを追加する
        </button>
      </div>`;
        container.querySelector("#fanClubEmptyAddBtn")?.addEventListener("click", callbacks.onAddClick);
        return;
    }
    container.innerHTML = `
    <div class="space-y-2.5">
      ${clubs.map((m) => renderCard(m)).join("")}
    </div>`;
    container.querySelectorAll("[data-fanclub-edit]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            callbacks.onEdit(btn.dataset.fanclubEdit);
        });
    });
    container.querySelectorAll("[data-fanclub-delete]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            callbacks.onDelete(btn.dataset.fanclubDelete);
        });
    });
}
function renderCard(m) {
    const days = daysUntil(m.renewalDate);
    const isUrgent = days <= RENEWAL_WARNING_DAYS;
    const isPast = days < 0;
    const urgencyBadge = isPast
        ? `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600 shrink-0">更新期限切れ</span>`
        : isUrgent
            ? `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 shrink-0">${days}日後に更新</span>`
            : "";
    const feeText = m.annualFee !== undefined ? `年会費 ${m.annualFee.toLocaleString()}円` : "";
    const memberText = m.memberName ? `名義：${m.memberName}` : "";
    return `
    <div class="et-card rounded-2xl p-3.5 ${isUrgent ? "border-orange-200" : ""}">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <span class="font-bold text-sm truncate">${escapeHtml(m.clubName)}</span>
            ${urgencyBadge}
          </div>
          <p class="text-xs text-[var(--et-ink-muted)]">更新期限：${fmtDate(m.renewalDate)}</p>
          ${feeText || memberText ? `<p class="text-xs text-[var(--et-ink-muted)] mt-0.5">${[feeText, memberText].filter(Boolean).map(escapeHtml).join("　")}</p>` : ""}
          ${m.memo ? `<p class="text-xs text-[var(--et-ink-muted)] mt-1 truncate">${escapeHtml(m.memo)}</p>` : ""}
        </div>
        <div class="flex gap-1.5 shrink-0">
          <button data-fanclub-edit="${escapeHtml(m.id)}"
            class="text-xs px-2.5 py-1.5 rounded-lg border border-[#dde1e8] font-semibold">
            編集
          </button>
          <button data-fanclub-delete="${escapeHtml(m.id)}"
            class="text-xs px-2.5 py-1.5 rounded-lg border border-[#dde1e8] font-semibold text-red-400">
            削除
          </button>
        </div>
      </div>
    </div>`;
}
