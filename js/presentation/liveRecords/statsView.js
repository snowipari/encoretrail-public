// statsView.ts
// 「記録」タブ内の統計セクションを描画する。
// 集計ロジックは statsUtils に委譲し、ここでは描画のみを担う。
import { getRecords } from "../../integration/liveRecords/recordStore.js";
import { countByArtist, countByVenue, countByYear } from "../../businessLogic/liveRecords/statsUtils.js";
import { escapeHtml, todayStr } from "../../businessLogic/domUtils.js";
const MAX_ROWS = 10;
export function renderStats(container) {
    // 参戦済み＝公演日が今日以前の記録のみ集計する
    const past = getRecords().filter((r) => r.date <= todayStr());
    if (past.length === 0) {
        container.innerHTML = "";
        return;
    }
    const byArtist = countByArtist(past).slice(0, MAX_ROWS);
    const byVenue = countByVenue(past).slice(0, MAX_ROWS);
    const byYear = countByYear(past);
    container.innerHTML = `
    <p class="text-xs text-[var(--et-ink-muted)] mb-3">総参戦回数 <span class="font-bold text-[var(--et-ink)]">${past.length}回</span></p>
    ${renderGroup("アーティスト別", byArtist)}
    ${byVenue.length > 0 ? renderGroup("会場別", byVenue) : ""}
    ${renderGroup("年別推移", byYear)}`;
}
function renderGroup(label, entries) {
    if (entries.length === 0)
        return "";
    const max = entries[0].count;
    return `
    <p class="text-xs font-semibold text-[var(--et-ink-muted)] mt-4 mb-2">${escapeHtml(label)}</p>
    <div class="space-y-1.5">
      ${entries.map((e) => renderBar(e, max)).join("")}
    </div>`;
}
function renderBar(entry, max) {
    const pct = Math.round((entry.count / max) * 100);
    return `
    <div class="flex items-center gap-2 text-sm">
      <span class="w-28 shrink-0 truncate text-xs text-[var(--et-ink)]">${escapeHtml(entry.name)}</span>
      <div class="flex-1 h-4 rounded-full overflow-hidden" style="background:var(--et-surface);">
        <div class="h-full rounded-full" style="width:${pct}%; background:var(--et-accent); opacity:0.7;"></div>
      </div>
      <span class="w-6 text-right text-xs text-[var(--et-ink-muted)] shrink-0">${entry.count}</span>
    </div>`;
}
