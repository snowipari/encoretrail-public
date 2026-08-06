// recordForm.ts
// フォームDOMの値の読み書きとセトリチップ入力を担当する（保存処理はmain.tsからrecordStoreを呼ぶ）。
import { escapeHtml } from "../../businessLogic/domUtils.js";
import { searchSongs } from "../../integration/liveRecords/musicSearchAdapter.js";
// ── セトリ チップ入力の状態 ──────────────────────────────
let _setlist = [];
let _debounceTimer = null;
/** フォームに既存記録の値を流し込み、編集モードにする */
export function fillForm(formEl, record) {
    formEl.elements.namedItem("editingId").value = record.id;
    formEl.elements.namedItem("artist").value = record.artist;
    formEl.elements.namedItem("date").value = record.date;
    formEl.elements.namedItem("time").value = record.time ?? "";
    formEl.elements.namedItem("endDate").value = record.endDate ?? "";
    formEl.elements.namedItem("venue").value = record.venue || "";
    formEl.elements.namedItem("tour").value = record.tour || "";
    formEl.elements.namedItem("seat").value = record.seat || "";
    formEl.elements.namedItem("memo").value = record.memo || "";
    _setlist = [...(record.setlist ?? [])];
    renderChips(formEl);
}
/** フォームを新規追加モードに戻す */
export function resetForm(formEl) {
    formEl.reset();
    formEl.elements.namedItem("editingId").value = "";
    _setlist = [];
    renderChips(formEl);
    const suggestionsEl = formEl.querySelector("#setlistSuggestions");
    if (suggestionsEl)
        suggestionsEl.innerHTML = "";
    const searchInput = formEl.querySelector("#setlistSearchInput");
    if (searchInput)
        searchInput.value = "";
}
/** フォームの現在値を読み取り、保存用オブジェクトにする */
export function readFormData(formEl) {
    const value = (name) => formEl.elements.namedItem(name).value.trim();
    const dateOf = (name) => formEl.elements.namedItem(name).value || undefined;
    return {
        artist: value("artist"),
        date: formEl.elements.namedItem("date").value,
        time: dateOf("time"),
        endDate: dateOf("endDate"),
        venue: value("venue"),
        tour: value("tour"),
        seat: value("seat"),
        memo: value("memo"),
        setlist: [..._setlist],
    };
}
/** 現在編集中の記録IDを返す（空文字なら新規追加） */
export function getEditingId(formEl) {
    return formEl.elements.namedItem("editingId").value;
}
// ── セトリ チップ入力 ────────────────────────────────────
/** セトリの入力フィールドにイベントリスナーを設定する。init()時に一度呼ぶ。 */
export function initSetlistInput(formEl) {
    const searchInput = formEl.querySelector("#setlistSearchInput");
    const suggestionsEl = formEl.querySelector("#setlistSuggestions");
    if (!searchInput || !suggestionsEl)
        return;
    searchInput.addEventListener("input", () => {
        if (_debounceTimer)
            clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(async () => {
            const query = searchInput.value.trim();
            if (query.length < 1) {
                suggestionsEl.innerHTML = "";
                return;
            }
            const artistInput = formEl.elements.namedItem("artist");
            const artist = artistInput?.value.trim() ?? "";
            try {
                const songs = await searchSongs(query, artist);
                renderSongSuggestions(formEl, suggestionsEl, songs);
            }
            catch {
                suggestionsEl.innerHTML = "";
            }
        }, 300);
    });
    searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            const song = searchInput.value.trim();
            if (song) {
                addSong(formEl, song);
                searchInput.value = "";
                suggestionsEl.innerHTML = "";
            }
        }
    });
    searchInput.addEventListener("blur", () => {
        setTimeout(() => { suggestionsEl.innerHTML = ""; }, 200);
    });
}
function addSong(formEl, song) {
    if (!song || _setlist.includes(song))
        return;
    _setlist.push(song);
    renderChips(formEl);
}
function removeSong(formEl, idx) {
    _setlist.splice(idx, 1);
    renderChips(formEl);
}
function renderChips(formEl) {
    const chipsEl = formEl.querySelector("#setlistChips");
    if (!chipsEl)
        return;
    if (_setlist.length === 0) {
        chipsEl.innerHTML = `<span class="text-xs text-[var(--et-ink-muted)] italic py-0.5">追加した楽曲がここに表示されます</span>`;
        return;
    }
    chipsEl.innerHTML = _setlist
        .map((song, i) => `
      <div class="flex items-center gap-1 bg-[#e8ebf2] rounded-full pl-2 pr-1.5 py-1 text-xs">
        <span class="text-[10px] text-[var(--et-ink-muted)]">${i + 1}</span>
        <span class="ml-0.5">${escapeHtml(song)}</span>
        <button type="button" data-remove-idx="${i}"
          class="ml-0.5 w-3.5 h-3.5 flex items-center justify-center text-[var(--et-ink-muted)] hover:text-red-400 rounded-full shrink-0">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>`)
        .join("");
    chipsEl.querySelectorAll("[data-remove-idx]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const idx = parseInt(btn.dataset.removeIdx, 10);
            removeSong(formEl, idx);
        });
    });
}
function renderSongSuggestions(formEl, container, songs) {
    if (songs.length === 0) {
        container.innerHTML = "";
        return;
    }
    container.innerHTML = `
    <ul class="absolute z-10 w-full mt-0.5 bg-[var(--et-base)] border border-[#dde1e8] rounded-xl shadow-lg overflow-hidden">
      ${songs
        .map((song) => `
        <li data-song-name="${escapeHtml(song)}"
            class="px-4 py-2.5 cursor-pointer hover:bg-[var(--et-surface)] text-sm">
          ${escapeHtml(song)}
        </li>`)
        .join("")}
    </ul>`;
    container.querySelectorAll("li[data-song-name]").forEach((li) => {
        li.addEventListener("mousedown", (e) => {
            e.preventDefault();
            const song = li.dataset.songName;
            addSong(formEl, song);
            const searchInput = formEl.querySelector("#setlistSearchInput");
            if (searchInput)
                searchInput.value = "";
            container.innerHTML = "";
        });
    });
}
