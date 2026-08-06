// setlistView.ts
// 「記録」タブ内の楽曲セクション（演奏回数バー＋公演逆引き）を描画する。
import { getRecords } from "../../integration/liveRecords/recordStore.js";
import { countBySong, findRecordsBySong } from "../../businessLogic/liveRecords/setlistUtils.js";
import { escapeHtml, fmtDate } from "../../businessLogic/domUtils.js";
const MAX_SONGS = 20;
export function renderSetlistView(container) {
    const records = getRecords();
    const songs = countBySong(records).slice(0, MAX_SONGS);
    if (songs.length === 0) {
        container.innerHTML = "";
        return;
    }
    const maxCount = songs[0]?.count ?? 1;
    container.innerHTML = `
    <p class="text-xs text-[var(--et-ink-muted)] mb-3">
      セトリに登録された楽曲 <span class="font-bold text-[var(--et-ink)]">${songs.length}曲</span>
    </p>
    <div class="space-y-1">
      ${songs
        .map((s, i) => {
        const barPct = Math.round((s.count / maxCount) * 100);
        return `
          <div>
            <button data-song="${escapeHtml(s.name)}" class="w-full text-left py-1.5 group">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-[10px] text-[var(--et-ink-muted)] w-5 shrink-0 text-right">${i + 1}</span>
                <span class="text-sm truncate flex-1 group-hover:text-[var(--et-accent)]">${escapeHtml(s.name)}</span>
                <span class="text-xs text-[var(--et-ink-muted)] shrink-0 tabular-nums">${s.count}回</span>
              </div>
              <div class="ml-7 h-1.5 rounded-full bg-[#e4e8ef] overflow-hidden">
                <div class="h-full rounded-full bg-[var(--et-accent)] transition-all"
                     style="width:${barPct}%"></div>
              </div>
            </button>
            <div data-song-detail="${escapeHtml(s.name)}" class="hidden ml-7 pb-2 mt-1 space-y-0.5 border-l-2 border-[#e4e8ef] pl-3">
              ${findRecordsBySong(records, s.name)
            .map((r) => `
                <p class="text-xs text-[var(--et-ink-muted)]">
                  ${fmtDate(r.date)}　${escapeHtml(r.artist)}${r.venue ? `／${escapeHtml(r.venue)}` : ""}
                </p>`)
            .join("")}
            </div>
          </div>`;
    })
        .join("")}
    </div>`;
    container.onclick = (e) => {
        const btn = e.target.closest("[data-song]");
        if (!btn)
            return;
        const song = btn.dataset.song;
        const detail = container.querySelector(`[data-song-detail="${CSS.escape(song)}"]`);
        detail?.classList.toggle("hidden");
    };
}
