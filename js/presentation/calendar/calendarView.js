// calendarView.ts
// 月表示カレンダーUI。CalendarEvent・ライブ記録・抽選エントリを統合して表示する。
// Gmail OAuth 設定・接続管理UIも担当する。
import { getCalendarEvents, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent, replaceAutoFetchedEvents } from "../../integration/calendar/calendarEventStore.js";
import { getRecords } from "../../integration/liveRecords/recordStore.js";
import { getLotteryEntries } from "../../integration/lottery/lotteryStore.js";
import { getOshiProfiles } from "../../integration/oshi/oshiProfileStore.js";
import { getEventsForDate, getEventsForMonth } from "../../businessLogic/calendar/calendarEventMerger.js";
import { isGmailConfigured, isGmailAuthorized, isGmailEverFetched, markGmailFetched, getGmailClientId, setGmailClientId, getGmailClientSecret, setGmailClientSecret, startGmailAuth, clearGmailTokens, fetchAllGmailEvents, GmailAuthError, } from "../../integration/calendar/calendarAdapters/gmailNewsletterAdapter.js";
import { escapeHtml } from "../../businessLogic/domUtils.js";
// ── ユーザーメモヘルパー ─────────────────────────────────────
// M/D 形式の短縮日付（モーダル内スコープラベル用）
function fmtMD(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return `${d.getMonth() + 1}/${d.getDate()}`;
}
// メモエントリのスコープを人読みラベルに変換
function buildScopeLabel(entry) {
    if (entry.scope === "this-day")
        return entry.fromDate ? `${fmtMD(entry.fromDate)}のみ` : "指定日のみ";
    if (entry.scope === "all-days")
        return "期間全体";
    return entry.fromDate && entry.toDate
        ? `${fmtMD(entry.fromDate)}〜${fmtMD(entry.toDate)}`
        : "期間指定";
}
// その日に表示すべきメモエントリを絞り込む
function getApplicableMemos(userMemos, dateStr) {
    if (!userMemos)
        return [];
    return userMemos.filter((entry) => {
        if (entry.scope === "this-day")
            return entry.fromDate === dateStr;
        if (entry.scope === "all-days")
            return true;
        if (!entry.fromDate || !entry.toDate)
            return false;
        return entry.fromDate <= dateStr && entry.toDate >= dateStr;
    });
}
// モーダル内のスコープセレクタのアクティブ状態を切り替える
function setUserMemoScope(bodyEl, evId, scope) {
    const form = bodyEl.querySelector(`#userMemoForm-${evId}`);
    if (!form)
        return;
    form.dataset.memoScope = scope;
    const btns = [
        [bodyEl.querySelector(`#userMemoScopeThisDay-${evId}`), scope === "this-day"],
        [bodyEl.querySelector(`#userMemoScopeAllDays-${evId}`), scope === "all-days"],
        [bodyEl.querySelector(`#userMemoScopeDateRange-${evId}`), scope === "date-range"],
    ];
    for (const [btn, active] of btns) {
        if (!btn)
            continue;
        if (active) {
            btn.classList.add("bg-[var(--et-ink)]", "text-white");
            btn.classList.remove("text-[var(--et-ink-muted)]");
        }
        else {
            btn.classList.remove("bg-[var(--et-ink)]", "text-white");
            btn.classList.add("text-[var(--et-ink-muted)]");
        }
    }
    const thisDayF = bodyEl.querySelector(`#userMemoThisDayFields-${evId}`);
    const rangeF = bodyEl.querySelector(`#userMemoDateRangeFields-${evId}`);
    if (thisDayF)
        thisDayF.style.display = scope === "this-day" ? "block" : "none";
    if (rangeF)
        rangeF.style.display = scope === "date-range" ? "block" : "none";
}
// 自動取得イベントのユーザーメモセクションHTML生成
function buildUserMemoSectionHtml(ev, dateStr) {
    const evId = escapeHtml(ev.id);
    const applicableMemos = getApplicableMemos(ev.userMemos, dateStr);
    const entriesHtml = applicableMemos
        .map((entry) => {
        const label = buildScopeLabel(entry);
        const timeParts = [entry.time, entry.endTime ? `〜${entry.endTime}` : ""].filter(Boolean).join("");
        return `
        <div class="flex items-start gap-1 mb-1.5">
          <div class="flex-1 min-w-0">
            <p class="text-xs text-[var(--et-ink-muted)] leading-relaxed break-words">${escapeHtml(entry.text)}</p>
            <span class="text-[10px] opacity-60" style="color:var(--et-ink-muted);">${label}${timeParts ? `　${timeParts}` : ""}</span>
          </div>
          <button data-edit-user-memo-entry="${evId}:${escapeHtml(entry.id)}"
            class="text-[10px] shrink-0 font-bold px-1.5 py-0.5 rounded" style="color:var(--et-accent);">編集</button>
          <button data-delete-user-memo-entry="${evId}:${escapeHtml(entry.id)}"
            class="text-[10px] shrink-0 font-bold text-red-400 px-1.5 py-0.5 rounded">削除</button>
        </div>`;
    })
        .join("");
    return `
    <div class="mt-2.5 pt-2 border-t border-[#f0f2f7]">
      <div id="userMemoList-${evId}" class="${applicableMemos.length ? "mb-2" : ""}">${entriesHtml}</div>
      <button data-add-user-memo="${evId}" class="text-[10px] font-bold" style="color:var(--et-accent);">＋ メモを追加</button>
      <div id="userMemoForm-${evId}" data-memo-scope="this-day" style="display:none;" class="mt-2 space-y-2">
        <input type="hidden" id="userMemoEditId-${evId}" value="" />
        <textarea id="userMemoTextarea-${evId}"
          class="et-input w-full px-3 py-2 text-xs resize-none" rows="3"
          placeholder="参加予定の時間帯など自由に書けます"></textarea>
        <p class="text-[10px] text-[var(--et-ink-muted)]">適用する日付</p>
        <div class="flex rounded-xl border border-[#dde1e8] overflow-hidden text-[10px]">
          <button id="userMemoScopeThisDay-${evId}"
            class="flex-1 py-1.5 font-bold bg-[var(--et-ink)] text-white">この日（${fmtMD(dateStr)}）のみ</button>
          <button id="userMemoScopeAllDays-${evId}"
            class="flex-1 py-1.5 font-bold text-[var(--et-ink-muted)]">期間全体</button>
          <button id="userMemoScopeDateRange-${evId}"
            class="flex-1 py-1.5 font-bold text-[var(--et-ink-muted)]">日付指定</button>
        </div>
        <div id="userMemoThisDayFields-${evId}">
          <label class="block">
            <span class="text-[10px] text-[var(--et-ink-muted)]">時刻（任意）</span>
            <input id="userMemoTime-${evId}" type="time" class="et-input w-full px-2 py-1.5 text-sm" />
          </label>
        </div>
        <div id="userMemoDateRangeFields-${evId}" style="display:none;" class="space-y-1">
          <div class="flex gap-2">
            <label class="flex-1 block">
              <span class="text-[10px] text-[var(--et-ink-muted)]">開始日</span>
              <input id="userMemoFromDate-${evId}" type="date" value="${dateStr}" class="et-input w-full px-2 py-1.5 text-sm" />
            </label>
            <label class="flex-1 block">
              <span class="text-[10px] text-[var(--et-ink-muted)]">時刻（任意）</span>
              <input id="userMemoFromTime-${evId}" type="time" class="et-input w-full px-2 py-1.5 text-sm" />
            </label>
          </div>
          <div class="flex gap-2">
            <label class="flex-1 block">
              <span class="text-[10px] text-[var(--et-ink-muted)]">終了日</span>
              <input id="userMemoToDate-${evId}" type="date" value="${dateStr}" class="et-input w-full px-2 py-1.5 text-sm" />
            </label>
            <label class="flex-1 block">
              <span class="text-[10px] text-[var(--et-ink-muted)]">時刻（任意）</span>
              <input id="userMemoToTime-${evId}" type="time" class="et-input w-full px-2 py-1.5 text-sm" />
            </label>
          </div>
        </div>
        <div class="flex gap-2">
          <button data-cancel-user-memo="${evId}"
            class="flex-none px-3 py-1.5 rounded-xl border border-[#dde1e8] text-xs font-bold text-[var(--et-ink-muted)]">キャンセル</button>
          <button data-save-user-memo="${evId}"
            class="flex-1 py-1.5 rounded-xl text-xs font-bold text-white" style="background:var(--et-accent-dark);">保存する</button>
        </div>
      </div>
    </div>`;
}
// ── 状態 ────────────────────────────────────────────────
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-indexed
let _currentContainer = null;
// ── カレンダービュー全体 ─────────────────────────────────
export async function renderCalendarView(container) {
    _currentContainer = container;
    renderCalendar(container);
}
// モーダルは body 直下に一度だけ生成し、container の overflow 制約を受けないようにする
function ensureDayModal() {
    let modal = document.getElementById("calDayModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "calDayModal";
        modal.setAttribute("role", "dialog");
        modal.style.cssText = "display:none; position:fixed; inset:0; z-index:50; align-items:center; justify-content:center; padding:1rem; background:rgba(0,0,0,0.5);";
        modal.innerHTML = `
      <div style="background:var(--et-surface,#fff); border-radius:1.5rem; width:100%; max-width:22rem; max-height:80vh; overflow-y:auto; padding:1.25rem 1rem 1.5rem; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <div class="flex items-center justify-between mb-3">
          <p id="calDayModalTitle" class="font-bold text-base"></p>
          <button id="calDayModalClose" class="p-1.5 rounded-full hover:bg-[#e4e8ef]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div id="calDayModalBody"></div>
      </div>`;
        document.body.appendChild(modal);
        modal.querySelector("#calDayModalClose")?.addEventListener("click", () => {
            modal.style.display = "none";
        });
        modal.addEventListener("click", (e) => {
            if (e.target === modal)
                modal.style.display = "none";
        });
    }
    return modal;
}
function renderCalendar(container) {
    const yearMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
    const calEvents = getEventsForMonth(getCalendarEvents(), yearMonth);
    const records = getRecords();
    const lotteries = getLotteryEntries();
    const monthName = new Date(currentYear, currentMonth, 1).toLocaleDateString("ja-JP", { month: "long" });
    const gmailBar = renderGmailStatusBar();
    container.innerHTML = `
    <!-- 月ヘッダー -->
    <div class="flex items-end justify-between pt-4 pb-3">
      <div>
        <p class="text-3xl font-black tracking-tight leading-none text-[var(--et-ink)]">${escapeHtml(monthName)}</p>
        <p class="text-sm font-semibold text-[var(--et-ink-muted)] mt-1">${currentYear}</p>
      </div>
      <div class="flex items-center gap-1">
        ${gmailBar ? `<div id="gmailStatusBar" class="mr-2">${gmailBar}</div>` : ""}
        <button id="calPrevMonth" class="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#dde1e8] shadow-sm" aria-label="前の月">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <button id="calNextMonth" class="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#dde1e8] shadow-sm" aria-label="次の月">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
    </div>

    <!-- 曜日ヘッダー -->
    <div class="grid grid-cols-7 mb-2">
      ${["月", "火", "水", "木", "金", "土", "日"].map((d, i) => `<div class="text-center text-[10px] font-bold py-1 ${i === 5 ? "text-[#5b9bd5]" : i === 6 ? "text-[#d95f5f]" : "text-[var(--et-ink-muted)]"}">${d}</div>`).join("")}
    </div>

    <!-- カレンダーグリッド -->
    <div class="grid grid-cols-7 gap-1" id="calGrid">
      ${renderGridDays(currentYear, currentMonth, calEvents, records, lotteries)}
    </div>

    <!-- 凡例 -->
    <div class="flex gap-x-3 gap-y-1 mt-4 px-1 flex-wrap">
      <span class="flex items-center gap-1 text-[10px] text-[var(--et-ink-muted)]">
        <span class="w-2.5 h-2.5 rounded-sm inline-block" style="background:#ffd5a0;"></span>記録
      </span>
      <span class="flex items-center gap-1 text-[10px] text-[var(--et-ink-muted)]">
        <span class="w-2.5 h-2.5 rounded-sm inline-block" style="background:#d8b4fe;"></span>抽選
      </span>
      <span class="flex items-center gap-1 text-[10px] text-[var(--et-ink-muted)]">
        <span class="w-2.5 h-2.5 rounded-sm inline-block" style="background:#a7f3d0;"></span>お知らせ
      </span>
      <span class="flex items-center gap-1 text-[10px] text-[var(--et-ink-muted)]">
        <span class="w-2.5 h-2.5 rounded-sm inline-block" style="background:#e2e8f0;"></span>メモ
      </span>
    </div>

    <!-- Gmail同期オーバーレイ（取得中のみ表示） -->
    <div id="calSyncOverlay" class="fixed inset-0 z-50 flex items-center justify-center" style="display:none;background:rgba(0,0,0,0.45);">
      <div id="calSyncOverlayCard" class="bg-white rounded-2xl px-8 py-6 text-center shadow-2xl" style="min-width:200px;max-width:280px;">
        <div id="calSyncSpinner" class="w-8 h-8 border-[3px] border-[var(--et-accent)] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p id="calSyncStatusText" class="text-sm font-bold text-[var(--et-ink)] mb-1">更新中...</p>
        <p id="calSyncProgressText" class="text-xs text-[var(--et-ink-muted)]"></p>
      </div>
    </div>

    <!-- Gmail設定セクション（折りたたみ式） -->
    <details class="mt-4 border-t border-[#dde8f0] pt-2" id="gmailSettingsSection">
      <summary class="flex items-center gap-1 cursor-pointer select-none list-none text-xs text-[var(--et-ink-muted)] py-1">
        <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
        <span>メルマガ自動取得の設定</span>
      </summary>
      <div id="gmailSettingsContent" class="mt-3">
        ${renderGmailSettings()}
      </div>
    </details>

    `;
    // モーダルを body 直下に確保（初回のみ生成）
    ensureDayModal();
    // ── イベントリスナー ──
    container.querySelector("#calPrevMonth")?.addEventListener("click", () => {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        renderCalendar(container);
    });
    container.querySelector("#calNextMonth")?.addEventListener("click", () => {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderCalendar(container);
    });
    // 日をタップして詳細モーダルを表示
    container.querySelectorAll("[data-cal-date]").forEach((cell) => {
        cell.addEventListener("click", () => {
            const dateStr = cell.dataset.calDate;
            openDayModal(dateStr, calEvents, records, lotteries);
        });
    });
    // Gmail設定フォームのイベントリスナー
    attachGmailSettingsListeners(container);
    // Gmail同期ボタン
    container.querySelector("#gmailSyncButton")?.addEventListener("click", async () => {
        await syncGmailEvents(container);
    });
}
// ── カレンダーグリッド描画 ───────────────────────────────
// "ラベル：値\n" 形式のnoteをラベル付きテーブルHTMLに変換する。空文字の場合は""を返す
function renderEventNoteTable(note) {
    if (!note)
        return "";
    const rows = note
        .split("\n")
        .filter(Boolean)
        .map((line) => {
        const idx = line.indexOf("：");
        if (idx === -1)
            return "";
        const label = line.slice(0, idx);
        const value = line.slice(idx + 1);
        return `<div class="flex gap-2 text-xs mt-1 leading-snug">
        <span class="text-[var(--et-ink-muted)] shrink-0 w-7">${escapeHtml(label)}</span>
        <span style="color:var(--et-ink);">${escapeHtml(value)}</span>
      </div>`;
    })
        .filter(Boolean)
        .join("");
    return rows ? `<div class="mt-1.5">${rows}</div>` : "";
}
// startAt（"YYYY-MM-DDThh:mm"）から時刻文字列を取り出す。00:00は返さない
function extractCellTime(startAt) {
    const timePart = startAt.split("T")[1] ?? "";
    return timePart && timePart !== "00:00" ? timePart.slice(0, 5) : "";
}
// endAt（"YYYY-MM-DDThh:mm"）から終了時刻を取り出す。23:59（時刻未入力時のデフォルト値）は返さない
function extractEndTime(endAt) {
    const timePart = endAt.split("T")[1] ?? "";
    return timePart && timePart !== "23:59" ? timePart.slice(0, 5) : "";
}
// メモ種別 → 日本語ラベル
function memoTypeLabel(type) {
    const map = {
        release: "リリース",
        lottery: "抽選",
        goods: "グッズ",
        other: "その他",
    };
    return map[type] ?? type;
}
// 手動メモのインライン編集フォームHTMLを生成する
function renderManualEditFormHtml(ev) {
    const startDate = ev.startAt.slice(0, 10);
    const startTime = extractCellTime(ev.startAt);
    const endDate = ev.endAt ? ev.endAt.slice(0, 10) : "";
    const endTime = ev.endAt ? extractEndTime(ev.endAt) : "";
    const isSpan = Boolean(endDate && endDate !== startDate);
    const id = escapeHtml(ev.id);
    const dayBtnClass = isSpan
        ? "flex-1 py-1.5 font-bold text-[var(--et-ink-muted)]"
        : "flex-1 py-1.5 font-bold bg-[var(--et-ink)] text-white";
    const spanBtnClass = isSpan
        ? "flex-1 py-1.5 font-bold bg-[var(--et-ink)] text-white"
        : "flex-1 py-1.5 font-bold text-[var(--et-ink-muted)]";
    const types = ["release", "lottery", "goods", "other"];
    const typeOptions = types
        .map((t) => `<option value="${t}" ${ev.type === t ? "selected" : ""}>${memoTypeLabel(t)}</option>`)
        .join("");
    return `
    <div id="manualEditForm-${id}" data-start-date="${escapeHtml(startDate)}"
      style="display:none;" class="mt-2 space-y-2 pt-2 border-t border-[#f0f2f7]">
      <input data-manual-title="${id}" type="text" value="${escapeHtml(ev.title)}"
        class="et-input w-full px-3 py-2 text-sm" placeholder="メモのタイトル" />

      <div class="flex rounded-xl border border-[#dde1e8] overflow-hidden text-xs">
        <button data-manual-mode-day="${id}" class="${dayBtnClass}">当日のみ</button>
        <button data-manual-mode-span="${id}" class="${spanBtnClass}">複数日程</button>
      </div>

      <div id="manualDayFields-${id}" ${isSpan ? 'style="display:none;"' : 'class="flex gap-2"'}>
        <label class="flex-1 block">
          <span class="text-[10px] text-[var(--et-ink-muted)]">開始時刻（任意）</span>
          <input data-manual-start-time-day="${id}" type="time" value="${escapeHtml(startTime)}"
            class="et-input w-full px-2 py-1.5 text-sm" />
        </label>
        <label class="flex-1 block">
          <span class="text-[10px] text-[var(--et-ink-muted)]">終了時刻（任意）</span>
          <input data-manual-end-time-day="${id}" type="time" value="${escapeHtml(isSpan ? "" : endTime)}"
            class="et-input w-full px-2 py-1.5 text-sm" />
        </label>
      </div>

      <div id="manualSpanFields-${id}" ${!isSpan ? 'style="display:none;"' : 'class="space-y-2"'}>
        <div class="flex gap-2">
          <label class="flex-1 block">
            <span class="text-[10px] text-[var(--et-ink-muted)]">開始日</span>
            <input data-manual-start-date="${id}" type="date" value="${escapeHtml(startDate)}"
              class="et-input w-full px-2 py-1.5 text-sm" />
          </label>
          <label class="flex-1 block">
            <span class="text-[10px] text-[var(--et-ink-muted)]">開始時刻（任意）</span>
            <input data-manual-start-time-span="${id}" type="time" value="${escapeHtml(startTime)}"
              class="et-input w-full px-2 py-1.5 text-sm" />
          </label>
        </div>
        <div class="flex gap-2">
          <label class="flex-1 block">
            <span class="text-[10px] text-[var(--et-ink-muted)]">終了日</span>
            <input data-manual-end-date="${id}" type="date" value="${escapeHtml(endDate)}"
              class="et-input w-full px-2 py-1.5 text-sm" />
          </label>
          <label class="flex-1 block">
            <span class="text-[10px] text-[var(--et-ink-muted)]">終了時刻（任意）</span>
            <input data-manual-end-time-span="${id}" type="time" value="${escapeHtml(isSpan ? endTime : "")}"
              class="et-input w-full px-2 py-1.5 text-sm" />
          </label>
        </div>
      </div>

      <select data-manual-type="${id}" class="et-input w-full px-3 py-2 text-sm">
        ${typeOptions}
      </select>

      <div class="flex gap-2">
        <button data-cancel-manual="${id}"
          class="flex-none px-4 py-2 rounded-xl border border-[#dde1e8] text-xs font-bold text-[var(--et-ink-muted)]">
          キャンセル
        </button>
        <button data-save-manual="${id}"
          class="flex-1 py-2 rounded-xl text-xs font-bold text-white" style="background:var(--et-accent-dark);">
          保存する
        </button>
      </div>
    </div>`;
}
// セル内に表示するイベントテキスト（最大3件）を生成する
function buildCellEventItems(dayRecords, dayLotteries, dayCalEvents, dateStr, isToday) {
    const items = [];
    for (const r of dayRecords) {
        items.push({ text: r.artist, bg: isToday ? "rgba(255,255,255,0.25)" : "#ffecd6", fg: isToday ? "#fff" : "#b45309" });
    }
    for (const l of dayLotteries) {
        const label = l.applicationDeadline === dateStr ? "締切" : "当落";
        items.push({ text: `${label} ${l.artist}`, bg: isToday ? "rgba(255,255,255,0.25)" : "#ede9fe", fg: isToday ? "#fff" : "#7c3aed" });
    }
    for (const ev of dayCalEvents) {
        const time = extractCellTime(ev.startAt);
        const bg = ev.autoFetched
            ? (isToday ? "rgba(255,255,255,0.25)" : "#d1fae5")
            : (isToday ? "rgba(255,255,255,0.25)" : "#e2e8f0");
        const fg = ev.autoFetched
            ? (isToday ? "#fff" : "#065f46")
            : (isToday ? "#fff" : "#475569");
        items.push({ text: time ? `${time} ${ev.title}` : ev.title, bg, fg });
    }
    const MAX = 3;
    const extra = items.length - MAX;
    return (items
        .slice(0, MAX)
        .map(({ text, bg, fg }) => `<span class="w-full text-[8px] leading-tight truncate block rounded px-0.5" style="background:${bg};color:${fg};">${escapeHtml(text)}</span>`)
        .join("") +
        (extra > 0 ? `<span class="w-full text-[8px] block" style="color:${isToday ? "rgba(255,255,255,0.7)" : "var(--et-ink-muted)"};">+${extra}</span>` : ""));
}
function renderGridDays(year, month, calEvents, records, lotteries) {
    const firstDay = new Date(year, month, 1);
    // 月曜始まりに変換（0=日, 1=月... → 月=0）
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date().toLocaleDateString("sv"); // YYYY-MM-DD
    let html = "";
    // 前月の空白セル
    for (let i = 0; i < startOffset; i++) {
        html += `<div class="min-h-[52px]"></div>`;
    }
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const isToday = dateStr === today;
        const dow = (new Date(year, month, day).getDay() + 6) % 7; // 月=0, 日=6
        const isSat = dow === 5;
        const isSun = dow === 6;
        const dayRecords = records.filter((r) => r.date === dateStr);
        const dayLotteries = lotteries.filter((l) => l.applicationDeadline === dateStr || l.announcementDate === dateStr);
        // セル内のテキスト表示はその日が開始日のイベントのみ（期間中日はバーのみ）
        const dayCalEvents = calEvents.filter((ev) => ev.startAt.slice(0, 10) === dateStr);
        // 期間バー：種別ごとに色を分ける
        // お知らせ（緑） autoFetched CalendarEvent の endAt 期間
        const hasNoticeBar = calEvents.some((ev) => {
            if (!ev.endAt || !ev.autoFetched)
                return false;
            return ev.startAt.slice(0, 10) <= dateStr && ev.endAt.slice(0, 10) >= dateStr;
        });
        // ライブ記録（オレンジ） endDate のある LiveRecord の期間
        const hasRecordBar = records.some((r) => {
            if (!r.endDate)
                return false;
            return r.date <= dateStr && r.endDate >= dateStr;
        });
        // 抽選（紫） pending 抽選の申込締切〜当落発表の期間
        const hasLotteryBar = lotteries.some((l) => {
            if (l.status !== "pending")
                return false;
            return l.applicationDeadline <= dateStr && l.announcementDate >= dateStr;
        });
        // メモ（グレー） 手動 CalendarEvent の endAt 期間 + userMemo の date-range / all-days
        const hasMemoBar = calEvents.some((ev) => {
            if (!ev.endAt || ev.autoFetched)
                return false;
            return ev.startAt.slice(0, 10) <= dateStr && ev.endAt.slice(0, 10) >= dateStr;
        }) ||
            calEvents.some((ev) => {
                if (!ev.autoFetched || !ev.userMemos?.length)
                    return false;
                return ev.userMemos.some((m) => {
                    if (m.scope === "date-range" && m.fromDate && m.toDate) {
                        return m.fromDate <= dateStr && m.toDate >= dateStr;
                    }
                    if (m.scope === "all-days") {
                        const evEnd = ev.endAt?.slice(0, 10);
                        if (!evEnd)
                            return false;
                        return ev.startAt.slice(0, 10) <= dateStr && evEnd >= dateStr;
                    }
                    return false;
                });
            });
        // 優先度：お知らせ > ライブ記録 > 抽選 > メモ
        const hasBar = hasNoticeBar || hasRecordBar || hasLotteryBar || hasMemoBar;
        const barColorClass = hasNoticeBar ? "bg-emerald-400"
            : hasRecordBar ? "bg-orange-400"
                : hasLotteryBar ? "bg-violet-400"
                    : "bg-slate-300";
        const eventItems = buildCellEventItems(dayRecords, dayLotteries, dayCalEvents, dateStr, isToday);
        const dateColor = !isToday && isSat ? "text-[#5b9bd5]" : !isToday && isSun ? "text-[#d95f5f]" : "";
        html += `
      <button data-cal-date="${dateStr}"
        class="relative min-h-[64px] flex flex-col items-start p-1.5 gap-0.5 rounded-xl
               ${isToday ? "bg-[var(--et-accent)]" : "bg-white border border-[#dde8f0]"}
               active:opacity-80">
        ${hasBar ? `<div class="absolute top-0 left-0 right-0 h-[3px] ${barColorClass} rounded-t-xl pointer-events-none"></div>` : ""}
        <span class="text-[11px] font-bold leading-none ${isToday ? "text-white" : dateColor}">${day}</span>
        ${eventItems}
      </button>`;
    }
    return html;
}
// ── 日の詳細モーダル ────────────────────────────────────
function openDayModal(dateStr, calEvents, records, lotteries) {
    const modal = ensureDayModal();
    const titleEl = document.getElementById("calDayModalTitle");
    const bodyEl = document.getElementById("calDayModalBody");
    if (!titleEl || !bodyEl)
        return;
    const d = new Date(dateStr + "T00:00");
    titleEl.textContent = d.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });
    // 期間内の記録も表示（endDate がある場合は最終日まで）
    const dayRecords = records.filter((r) => {
        if (r.endDate)
            return r.date <= dateStr && r.endDate >= dateStr;
        return r.date === dateStr;
    });
    const dayLotteries = lotteries.filter((l) => l.applicationDeadline === dateStr || l.announcementDate === dateStr);
    const dayCalEvents = getEventsForDate(calEvents, dateStr);
    let html = "";
    if (dayRecords.length === 0 && dayLotteries.length === 0 && dayCalEvents.length === 0) {
        html = `<p class="text-xs text-[var(--et-ink-muted)] text-center py-4">この日の予定はありません</p>`;
    }
    for (const r of dayRecords) {
        const isSpanningRecord = r.endDate && r.date < dateStr;
        html += `
      <div class="flex items-start gap-2 py-2.5 border-b border-[#f0f2f7] last:border-0">
        <span class="w-2 h-2 rounded-full bg-[var(--et-accent)] shrink-0" style="margin-top:0.45rem;"></span>
        <div>
          <p style="font-size:15px; font-weight:700; line-height:1.3;">${escapeHtml(r.artist)}</p>
          ${isSpanningRecord ? `<p class="text-xs text-[var(--et-accent)] mt-0.5 font-medium">期間中</p>` : r.time ? `<p class="text-sm font-semibold mt-0.5" style="color:var(--et-ink);">開演 ${escapeHtml(r.time)}</p>` : ""}
          ${r.venue ? `<p class="text-sm text-[var(--et-ink-muted)] mt-0.5">${escapeHtml(r.venue)}</p>` : ""}
        </div>
      </div>`;
    }
    for (const l of dayLotteries) {
        const isDeadline = l.applicationDeadline === dateStr;
        const eventTime = isDeadline ? l.deadlineTime : l.announcementTime;
        const liveDateStr = l.liveDate
            ? `公演予定 ${new Date(l.liveDate + "T00:00").toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}${l.liveTime ? " " + l.liveTime : ""}`
            : "";
        html += `
      <div class="flex items-start gap-2 py-2.5 border-b border-[#f0f2f7] last:border-0">
        <span class="w-2 h-2 rounded-full bg-violet-400 shrink-0" style="margin-top:0.45rem;"></span>
        <div>
          <p style="font-size:15px; font-weight:700; line-height:1.3;">${escapeHtml(l.artist)}</p>
          <p class="text-sm text-[var(--et-ink-muted)] mt-0.5">${escapeHtml(l.title)}</p>
          <p class="text-xs text-violet-500 mt-0.5">${isDeadline ? "申込締切" : "当落発表"}${eventTime ? " " + escapeHtml(eventTime) : ""}</p>
          ${liveDateStr ? `<p class="text-xs text-[var(--et-ink-muted)] mt-0.5">${escapeHtml(liveDateStr)}</p>` : ""}
        </div>
      </div>`;
    }
    for (const ev of dayCalEvents) {
        const dotColor = ev.autoFetched ? "bg-emerald-400" : "bg-slate-300";
        const isStartDate = ev.startAt.slice(0, 10) === dateStr;
        const isEndDate = !!ev.endAt && ev.endAt.slice(0, 10) === dateStr && !isStartDate;
        const noteHtml = renderEventNoteTable(ev.note ?? "");
        // 時刻・状態表示
        let statusHtml = "";
        if (isStartDate) {
            const evTime = extractCellTime(ev.startAt);
            if (!ev.autoFetched && ev.endAt) {
                const endDate = ev.endAt.slice(0, 10);
                const endTime = extractEndTime(ev.endAt);
                if (endDate === dateStr) {
                    // 同日 → 時刻のみ（日付は不要）
                    const parts = [evTime, endTime].filter(Boolean);
                    if (parts.length > 0) {
                        statusHtml = `<p class="text-xs text-[var(--et-ink-muted)] mt-0.5">${parts.join(" 〜 ")}</p>`;
                    }
                }
                else {
                    // 複数日程 → 日付付きで表示
                    const endDateFmt = new Date(endDate + "T00:00").toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
                    const to = endTime ? `${endDateFmt} ${endTime}` : endDateFmt;
                    statusHtml = `<p class="text-xs text-[var(--et-ink-muted)] mt-0.5">${evTime ? evTime + " 〜 " : "〜 "}${to}</p>`;
                }
            }
            else if (evTime) {
                statusHtml = `<p class="text-sm font-semibold mt-0.5" style="color:var(--et-ink);">${evTime}</p>`;
            }
        }
        else if (isEndDate && ev.endAt) {
            // 終了日 → 終了時刻を表示（issue②修正箇所）
            const endTime = extractEndTime(ev.endAt);
            const spanColor = ev.autoFetched ? "text-emerald-600" : "text-[var(--et-ink-muted)]";
            statusHtml = endTime
                ? `<p class="text-xs ${spanColor} mt-0.5 font-medium">〜 ${endTime} 終了</p>`
                : `<p class="text-xs ${spanColor} mt-0.5 font-medium">最終日</p>`;
        }
        else {
            // 期間中（中間日）
            const spanColor = ev.autoFetched ? "text-emerald-600" : "text-[var(--et-ink-muted)]";
            statusHtml = `<p class="text-xs ${spanColor} mt-0.5 font-medium">期間中</p>`;
        }
        // ユーザーメモのみ種別バッジを表示（issue①詳細表示）
        const typeBadge = !ev.autoFetched
            ? `<span class="inline-block text-[10px] px-1.5 py-0.5 rounded bg-[#f0f2f7] text-[var(--et-ink-muted)] mt-0.5">${escapeHtml(memoTypeLabel(ev.type))}</span>`
            : "";
        const userMemoSection = ev.autoFetched ? buildUserMemoSectionHtml(ev, dateStr) : "";
        const manualEditForm = !ev.autoFetched ? renderManualEditFormHtml(ev) : "";
        const actionButtons = ev.autoFetched
            ? `<button data-delete-cal-event="${escapeHtml(ev.id)}"
           class="text-[10px] text-red-400 shrink-0 px-2 py-1 rounded border border-[#f0ddd8] font-semibold">
           削除
         </button>`
            : `<div class="flex flex-col gap-1 shrink-0">
           <button data-edit-manual-event="${escapeHtml(ev.id)}"
             class="text-[10px] text-[var(--et-ink-muted)] px-2 py-1 rounded border border-[#dde1e8] font-semibold">
             編集
           </button>
           <button data-delete-cal-event="${escapeHtml(ev.id)}"
             class="text-[10px] text-red-400 px-2 py-1 rounded border border-[#f0ddd8] font-semibold">
             削除
           </button>
         </div>`;
        html += `
      <div class="flex items-start gap-2 py-2.5 border-b border-[#f0f2f7] last:border-0">
        <span class="w-2 h-2 rounded-full ${dotColor} shrink-0" style="margin-top:0.45rem;"></span>
        <div class="min-w-0 flex-1">
          <p style="font-size:15px; font-weight:700; line-height:1.3;">${escapeHtml(ev.title)}</p>
          ${typeBadge}
          ${statusHtml}
          ${noteHtml}
          ${ev.sourceUrl ? `<a href="${escapeHtml(ev.sourceUrl)}" target="_blank" rel="noopener" class="text-[10px] text-[var(--et-ink-muted)] mt-2 block">元メールを確認 →</a>` : ""}
          ${userMemoSection}
          ${manualEditForm}
        </div>
        ${actionButtons}
      </div>`;
    }
    // 追加ボタンセクション
    html += `
    <div class="mt-4 pt-3 border-t border-[#f0f2f7]">
      <div class="flex gap-2">
        <button id="calAddRecord" class="flex-1 py-2 rounded-xl text-xs font-bold border border-[#dde1e8]">ライブを追加</button>
        <button id="calAddLottery" class="flex-1 py-2 rounded-xl text-xs font-bold border border-[#dde1e8]">抽選を追加</button>
        <button id="calAddMemo" class="flex-1 py-2 rounded-xl text-xs font-bold border border-[#dde1e8]">メモを追加</button>
      </div>
      <div id="calMemoForm" style="display:none;" class="mt-3 space-y-2.5">
        <input id="calMemoTitle" type="text" placeholder="メモのタイトル" class="et-input w-full px-3 py-2 text-sm" />

        <div class="flex rounded-xl border border-[#dde1e8] overflow-hidden text-xs">
          <button id="calMemoModeDay"
            class="flex-1 py-1.5 font-bold bg-[var(--et-ink)] text-white">当日のみ</button>
          <button id="calMemoModeSpan"
            class="flex-1 py-1.5 font-bold text-[var(--et-ink-muted)]">複数日程</button>
        </div>

        <div id="calMemoDayFields" class="flex gap-2">
          <label class="flex-1 block">
            <span class="text-[10px] text-[var(--et-ink-muted)]">開始時刻（任意）</span>
            <input id="calMemoStartTime" type="time" class="et-input w-full px-2 py-1.5 text-sm" />
          </label>
          <label class="flex-1 block">
            <span class="text-[10px] text-[var(--et-ink-muted)]">終了時刻（任意）</span>
            <input id="calMemoEndTimeSingle" type="time" class="et-input w-full px-2 py-1.5 text-sm" />
          </label>
        </div>

        <div id="calMemoSpanFields" style="display:none;" class="space-y-2">
          <div class="flex gap-2">
            <label class="flex-1 block">
              <span class="text-[10px] text-[var(--et-ink-muted)]">開始日</span>
              <input id="calMemoStartDate" type="date" value="${dateStr}" class="et-input w-full px-2 py-1.5 text-sm" />
            </label>
            <label class="flex-1 block">
              <span class="text-[10px] text-[var(--et-ink-muted)]">開始時刻（任意）</span>
              <input id="calMemoStartTimeSpan" type="time" class="et-input w-full px-2 py-1.5 text-sm" />
            </label>
          </div>
          <div class="flex gap-2">
            <label class="flex-1 block">
              <span class="text-[10px] text-[var(--et-ink-muted)]">終了日</span>
              <input id="calMemoEndDate" type="date" value="${dateStr}" class="et-input w-full px-2 py-1.5 text-sm" />
            </label>
            <label class="flex-1 block">
              <span class="text-[10px] text-[var(--et-ink-muted)]">終了時刻（任意）</span>
              <input id="calMemoEndTimeSpan" type="time" class="et-input w-full px-2 py-1.5 text-sm" />
            </label>
          </div>
        </div>

        <select id="calMemoType" class="et-input w-full px-3 py-2 text-sm">
          <option value="release">リリース</option>
          <option value="lottery">抽選</option>
          <option value="goods">グッズ</option>
          <option value="other">その他</option>
        </select>
        <div class="flex gap-2 pt-1">
          <button id="calMemoBack" type="button"
            class="flex-none px-5 py-2.5 rounded-xl border border-[#dde1e8] text-xs font-bold text-[var(--et-ink-muted)]">
            戻る
          </button>
          <button id="calMemoSave" type="button"
            class="flex-1 py-2.5 rounded-xl text-xs font-bold text-white" style="background:var(--et-accent-dark);">
            追加する
          </button>
        </div>
      </div>
    </div>`;
    bodyEl.innerHTML = html;
    // カレンダーイベント削除
    bodyEl.querySelectorAll("[data-delete-cal-event]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.deleteCalEvent;
            await deleteCalendarEvent(id);
            modal.style.display = "none";
            if (_currentContainer)
                renderCalendar(_currentContainer);
        });
    });
    // ユーザーメモ：メモを追加ボタン
    bodyEl.querySelectorAll("[data-add-user-memo]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const evId = btn.dataset.addUserMemo;
            const form = bodyEl.querySelector(`#userMemoForm-${evId}`);
            if (!form)
                return;
            const editIdInput = bodyEl.querySelector(`#userMemoEditId-${evId}`);
            const textarea = bodyEl.querySelector(`#userMemoTextarea-${evId}`);
            if (editIdInput)
                editIdInput.value = "";
            if (textarea)
                textarea.value = "";
            const timeInput = bodyEl.querySelector(`#userMemoTime-${evId}`);
            const fromDateInput = bodyEl.querySelector(`#userMemoFromDate-${evId}`);
            const fromTimeInput = bodyEl.querySelector(`#userMemoFromTime-${evId}`);
            const toDateInput = bodyEl.querySelector(`#userMemoToDate-${evId}`);
            const toTimeInput = bodyEl.querySelector(`#userMemoToTime-${evId}`);
            if (timeInput)
                timeInput.value = "";
            if (fromDateInput)
                fromDateInput.value = dateStr;
            if (fromTimeInput)
                fromTimeInput.value = "";
            if (toDateInput)
                toDateInput.value = "";
            if (toTimeInput)
                toTimeInput.value = "";
            setUserMemoScope(bodyEl, evId, "this-day");
            form.style.display = "block";
        });
    });
    // ユーザーメモ：エントリを編集
    bodyEl.querySelectorAll("[data-edit-user-memo-entry]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const raw = btn.dataset.editUserMemoEntry;
            const colonIdx = raw.indexOf(":");
            const evId = raw.slice(0, colonIdx);
            const entryId = raw.slice(colonIdx + 1);
            const ev = getCalendarEvents().find((e) => e.id === evId);
            const entry = ev?.userMemos?.find((m) => m.id === entryId);
            if (!entry)
                return;
            const editIdInput = bodyEl.querySelector(`#userMemoEditId-${evId}`);
            const textarea = bodyEl.querySelector(`#userMemoTextarea-${evId}`);
            if (editIdInput)
                editIdInput.value = entryId;
            if (textarea)
                textarea.value = entry.text;
            setUserMemoScope(bodyEl, evId, entry.scope);
            if (entry.scope === "this-day") {
                const timeInput = bodyEl.querySelector(`#userMemoTime-${evId}`);
                if (timeInput)
                    timeInput.value = entry.time ?? "";
            }
            else if (entry.scope === "date-range") {
                const fromDate = bodyEl.querySelector(`#userMemoFromDate-${evId}`);
                const fromTime = bodyEl.querySelector(`#userMemoFromTime-${evId}`);
                const toDate = bodyEl.querySelector(`#userMemoToDate-${evId}`);
                const toTime = bodyEl.querySelector(`#userMemoToTime-${evId}`);
                if (fromDate)
                    fromDate.value = entry.fromDate ?? dateStr;
                if (fromTime)
                    fromTime.value = entry.time ?? "";
                if (toDate)
                    toDate.value = entry.toDate ?? "";
                if (toTime)
                    toTime.value = entry.endTime ?? "";
            }
            const form = bodyEl.querySelector(`#userMemoForm-${evId}`);
            if (form)
                form.style.display = "block";
        });
    });
    // ユーザーメモ：エントリを削除（トースト＋5秒取り消し）
    bodyEl.querySelectorAll("[data-delete-user-memo-entry]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const raw = btn.dataset.deleteUserMemoEntry;
            const colonIdx = raw.indexOf(":");
            const evId = raw.slice(0, colonIdx);
            const entryId = raw.slice(colonIdx + 1);
            const ev = getCalendarEvents().find((e) => e.id === evId);
            if (!ev)
                return;
            const snapshot = ev.userMemos?.find((m) => m.id === entryId);
            if (!snapshot)
                return;
            const newMemos = (ev.userMemos ?? []).filter((m) => m.id !== entryId);
            await updateCalendarEvent(evId, { userMemos: newMemos.length ? newMemos : undefined });
            modal.style.display = "none";
            if (_currentContainer)
                renderCalendar(_currentContainer);
            let undone = false;
            document.querySelector(".et-undo-toast")?.remove();
            const toast = document.createElement("div");
            toast.className = "et-undo-toast fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[var(--et-ink)] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg flex items-center gap-3 whitespace-nowrap";
            toast.innerHTML = `<span>メモを削除しました</span><button class="underline shrink-0 pointer-events-auto">元に戻す</button>`;
            document.body.appendChild(toast);
            toast.querySelector("button")?.addEventListener("click", async () => {
                undone = true;
                toast.remove();
                const current = getCalendarEvents().find((e) => e.id === evId);
                await updateCalendarEvent(evId, { userMemos: [...(current?.userMemos ?? []), snapshot] });
                if (_currentContainer)
                    renderCalendar(_currentContainer);
                reopenDayModal(dateStr);
            });
            setTimeout(() => { if (!undone)
                toast.remove(); }, 5000);
        });
    });
    // ユーザーメモ：スコープセレクタ
    bodyEl.querySelectorAll("[id^='userMemoScopeThisDay-']").forEach((btn) => {
        const evId = btn.id.replace("userMemoScopeThisDay-", "");
        btn.addEventListener("click", () => setUserMemoScope(bodyEl, evId, "this-day"));
    });
    bodyEl.querySelectorAll("[id^='userMemoScopeAllDays-']").forEach((btn) => {
        const evId = btn.id.replace("userMemoScopeAllDays-", "");
        btn.addEventListener("click", () => setUserMemoScope(bodyEl, evId, "all-days"));
    });
    bodyEl.querySelectorAll("[id^='userMemoScopeDateRange-']").forEach((btn) => {
        const evId = btn.id.replace("userMemoScopeDateRange-", "");
        btn.addEventListener("click", () => setUserMemoScope(bodyEl, evId, "date-range"));
    });
    // ユーザーメモ：キャンセル
    bodyEl.querySelectorAll("[data-cancel-user-memo]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const evId = btn.dataset.cancelUserMemo;
            const form = bodyEl.querySelector(`#userMemoForm-${evId}`);
            if (form)
                form.style.display = "none";
        });
    });
    // ユーザーメモ：保存
    bodyEl.querySelectorAll("[data-save-user-memo]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const evId = btn.dataset.saveUserMemo;
            const ev = getCalendarEvents().find((e) => e.id === evId);
            if (!ev)
                return;
            const editId = bodyEl.querySelector(`#userMemoEditId-${evId}`)?.value.trim() ?? "";
            const text = bodyEl.querySelector(`#userMemoTextarea-${evId}`)?.value.trim() ?? "";
            if (!text) {
                showToast("メモの内容を入力してください");
                return;
            }
            const scope = (bodyEl.querySelector(`#userMemoForm-${evId}`)?.dataset.memoScope ?? "this-day");
            const entry = {
                id: editId || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
                text,
                scope,
            };
            if (scope === "this-day") {
                entry.fromDate = dateStr;
                const time = bodyEl.querySelector(`#userMemoTime-${evId}`)?.value.trim();
                if (time)
                    entry.time = time;
            }
            else if (scope === "date-range") {
                const fromDate = bodyEl.querySelector(`#userMemoFromDate-${evId}`)?.value.trim();
                const fromTime = bodyEl.querySelector(`#userMemoFromTime-${evId}`)?.value.trim();
                const toDate = bodyEl.querySelector(`#userMemoToDate-${evId}`)?.value.trim();
                const toTime = bodyEl.querySelector(`#userMemoToTime-${evId}`)?.value.trim();
                if (!fromDate || !toDate) {
                    showToast("開始日と終了日を入力してください");
                    return;
                }
                entry.fromDate = fromDate;
                if (fromTime)
                    entry.time = fromTime;
                entry.toDate = toDate;
                if (toTime)
                    entry.endTime = toTime;
            }
            const existing = ev.userMemos ?? [];
            const newMemos = editId
                ? existing.map((m) => (m.id === editId ? entry : m))
                : [...existing, entry];
            await updateCalendarEvent(evId, { userMemos: newMemos });
            modal.style.display = "none";
            if (_currentContainer)
                renderCalendar(_currentContainer);
            showToast("メモを保存しました");
        });
    });
    // ライブを追加
    bodyEl.querySelector("#calAddRecord")?.addEventListener("click", () => {
        modal.style.display = "none";
        document.dispatchEvent(new CustomEvent("encoretrail:add-from-calendar", { detail: { view: "add", date: dateStr } }));
    });
    // 抽選を追加
    bodyEl.querySelector("#calAddLottery")?.addEventListener("click", () => {
        modal.style.display = "none";
        document.dispatchEvent(new CustomEvent("encoretrail:add-from-calendar", { detail: { view: "lottery-add", date: dateStr } }));
    });
    // メモを追加（インラインフォームのトグル）
    bodyEl.querySelector("#calAddMemo")?.addEventListener("click", () => {
        const memoForm = bodyEl.querySelector("#calMemoForm");
        if (memoForm) {
            const isVisible = memoForm.style.display !== "none";
            memoForm.style.display = isVisible ? "none" : "block";
        }
    });
    // セグメントコントロール（当日のみ / 複数日程）
    bodyEl.querySelector("#calMemoModeDay")?.addEventListener("click", () => {
        bodyEl.querySelector("#calMemoModeDay")?.classList.add("bg-[var(--et-ink)]", "text-white");
        bodyEl.querySelector("#calMemoModeDay")?.classList.remove("text-[var(--et-ink-muted)]");
        bodyEl.querySelector("#calMemoModeSpan")?.classList.remove("bg-[var(--et-ink)]", "text-white");
        bodyEl.querySelector("#calMemoModeSpan")?.classList.add("text-[var(--et-ink-muted)]");
        const dayF = bodyEl.querySelector("#calMemoDayFields");
        const spanF = bodyEl.querySelector("#calMemoSpanFields");
        if (dayF)
            dayF.style.display = "flex";
        if (spanF)
            spanF.style.display = "none";
    });
    bodyEl.querySelector("#calMemoModeSpan")?.addEventListener("click", () => {
        bodyEl.querySelector("#calMemoModeSpan")?.classList.add("bg-[var(--et-ink)]", "text-white");
        bodyEl.querySelector("#calMemoModeSpan")?.classList.remove("text-[var(--et-ink-muted)]");
        bodyEl.querySelector("#calMemoModeDay")?.classList.remove("bg-[var(--et-ink)]", "text-white");
        bodyEl.querySelector("#calMemoModeDay")?.classList.add("text-[var(--et-ink-muted)]");
        const dayF = bodyEl.querySelector("#calMemoDayFields");
        const spanF = bodyEl.querySelector("#calMemoSpanFields");
        if (dayF)
            dayF.style.display = "none";
        if (spanF)
            spanF.style.display = "block";
    });
    // メモ保存
    bodyEl.querySelector("#calMemoSave")?.addEventListener("click", async () => {
        const titleInput = bodyEl.querySelector("#calMemoTitle");
        const typeSelect = bodyEl.querySelector("#calMemoType");
        const title = titleInput?.value.trim() ?? "";
        if (!title) {
            titleInput?.focus();
            return;
        }
        const isSpanMode = bodyEl.querySelector("#calMemoSpanFields")?.style.display !== "none";
        let startAt;
        let endAt;
        if (isSpanMode) {
            const startDate = bodyEl.querySelector("#calMemoStartDate")?.value || dateStr;
            const startTime = bodyEl.querySelector("#calMemoStartTimeSpan")?.value?.trim() || undefined;
            const endDate = bodyEl.querySelector("#calMemoEndDate")?.value?.trim() || undefined;
            const endTime = bodyEl.querySelector("#calMemoEndTimeSpan")?.value?.trim() || undefined;
            if (endDate && endDate < startDate) {
                showToast("終了日は開始日以降にしてください");
                return;
            }
            startAt = startTime ? `${startDate}T${startTime}` : `${startDate}T00:00`;
            endAt = endDate ? `${endDate}T${endTime ?? "23:59"}` : undefined;
        }
        else {
            const startTime = bodyEl.querySelector("#calMemoStartTime")?.value?.trim() || undefined;
            const endTime = bodyEl.querySelector("#calMemoEndTimeSingle")?.value?.trim() || undefined;
            startAt = startTime ? `${dateStr}T${startTime}` : `${dateStr}T00:00`;
            endAt = endTime ? `${dateStr}T${endTime}` : undefined;
        }
        await addCalendarEvent({
            type: (typeSelect?.value ?? "other"),
            title,
            startAt,
            endAt,
            sourceUrl: "",
            autoFetched: false,
        });
        modal.style.display = "none";
        if (_currentContainer)
            renderCalendar(_currentContainer);
        showToast("メモを追加しました");
    });
    // メモフォームの戻るボタン
    bodyEl.querySelector("#calMemoBack")?.addEventListener("click", () => {
        const memoForm = bodyEl.querySelector("#calMemoForm");
        if (memoForm)
            memoForm.style.display = "none";
    });
    // 手動メモ 編集ボタン（インラインフォームのトグル）
    bodyEl.querySelectorAll("[data-edit-manual-event]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.editManualEvent;
            const form = bodyEl.querySelector(`#manualEditForm-${id}`);
            if (form)
                form.style.display = form.style.display === "none" ? "block" : "none";
        });
    });
    // 手動メモ 編集フォームのセグメントコントロール（当日のみ）
    bodyEl.querySelectorAll("[data-manual-mode-day]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.manualModeDay;
            bodyEl.querySelector(`[data-manual-mode-day="${id}"]`)?.classList.add("bg-[var(--et-ink)]", "text-white");
            bodyEl.querySelector(`[data-manual-mode-day="${id}"]`)?.classList.remove("text-[var(--et-ink-muted)]");
            bodyEl.querySelector(`[data-manual-mode-span="${id}"]`)?.classList.remove("bg-[var(--et-ink)]", "text-white");
            bodyEl.querySelector(`[data-manual-mode-span="${id}"]`)?.classList.add("text-[var(--et-ink-muted)]");
            const dayF = bodyEl.querySelector(`#manualDayFields-${id}`);
            const spanF = bodyEl.querySelector(`#manualSpanFields-${id}`);
            if (dayF)
                dayF.style.display = "flex";
            if (spanF)
                spanF.style.display = "none";
        });
    });
    // 手動メモ 編集フォームのセグメントコントロール（複数日程）
    bodyEl.querySelectorAll("[data-manual-mode-span]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.manualModeSpan;
            bodyEl.querySelector(`[data-manual-mode-span="${id}"]`)?.classList.add("bg-[var(--et-ink)]", "text-white");
            bodyEl.querySelector(`[data-manual-mode-span="${id}"]`)?.classList.remove("text-[var(--et-ink-muted)]");
            bodyEl.querySelector(`[data-manual-mode-day="${id}"]`)?.classList.remove("bg-[var(--et-ink)]", "text-white");
            bodyEl.querySelector(`[data-manual-mode-day="${id}"]`)?.classList.add("text-[var(--et-ink-muted)]");
            const dayF = bodyEl.querySelector(`#manualDayFields-${id}`);
            const spanF = bodyEl.querySelector(`#manualSpanFields-${id}`);
            if (spanF)
                spanF.style.display = "block";
            if (dayF)
                dayF.style.display = "none";
        });
    });
    // 手動メモ キャンセル
    bodyEl.querySelectorAll("[data-cancel-manual]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.cancelManual;
            const form = bodyEl.querySelector(`#manualEditForm-${id}`);
            if (form)
                form.style.display = "none";
        });
    });
    // 手動メモ 保存
    bodyEl.querySelectorAll("[data-save-manual]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.saveManual;
            const titleInput = bodyEl.querySelector(`[data-manual-title="${id}"]`);
            const typeSelect = bodyEl.querySelector(`[data-manual-type="${id}"]`);
            const title = titleInput?.value.trim() ?? "";
            if (!title) {
                titleInput?.focus();
                return;
            }
            const isSpanMode = bodyEl.querySelector(`#manualSpanFields-${id}`)?.style.display !== "none";
            const originalStartDate = bodyEl.querySelector(`#manualEditForm-${id}`)?.dataset.startDate ?? dateStr;
            let startAt;
            let endAt;
            if (isSpanMode) {
                const startDate = bodyEl.querySelector(`[data-manual-start-date="${id}"]`)?.value || originalStartDate;
                const startTime = bodyEl.querySelector(`[data-manual-start-time-span="${id}"]`)?.value?.trim() || undefined;
                const endDate = bodyEl.querySelector(`[data-manual-end-date="${id}"]`)?.value?.trim() || undefined;
                const endTime = bodyEl.querySelector(`[data-manual-end-time-span="${id}"]`)?.value?.trim() || undefined;
                if (endDate && endDate < startDate) {
                    showToast("終了日は開始日以降にしてください");
                    return;
                }
                startAt = startTime ? `${startDate}T${startTime}` : `${startDate}T00:00`;
                endAt = endDate ? `${endDate}T${endTime ?? "23:59"}` : undefined;
            }
            else {
                const startTime = bodyEl.querySelector(`[data-manual-start-time-day="${id}"]`)?.value?.trim() || undefined;
                const endTime = bodyEl.querySelector(`[data-manual-end-time-day="${id}"]`)?.value?.trim() || undefined;
                startAt = startTime ? `${originalStartDate}T${startTime}` : `${originalStartDate}T00:00`;
                endAt = endTime ? `${originalStartDate}T${endTime}` : undefined;
            }
            await updateCalendarEvent(id, {
                type: (typeSelect?.value ?? "other"),
                title,
                startAt,
                endAt,
            });
            modal.style.display = "none";
            if (_currentContainer)
                renderCalendar(_currentContainer);
            showToast("メモを編集しました");
        });
    });
    modal.style.display = "flex";
}
// ── Gmail 設定UI ─────────────────────────────────────────
function renderGmailStatusBar() {
    if (!isGmailConfigured()) {
        return ""; // 未設定時はカレンダーをメインに見せるため非表示
    }
    if (isGmailAuthorized()) {
        const btnLabel = isGmailEverFetched() ? "更新する" : "今すぐ取得";
        return `
      <div class="flex items-center justify-between">
        <span class="text-[11px] text-emerald-600 font-semibold">● Gmail 接続中</span>
        <button id="gmailSyncButton" class="text-[11px] px-3 py-1 rounded-lg border border-[#dde1e8] font-semibold">
          ${btnLabel}
        </button>
      </div>`;
    }
    return `
    <div class="flex items-center justify-between">
      <span class="text-[11px] text-orange-500 font-semibold">● 再接続が必要です（7日で接続が切れます）</span>
      <button id="gmailReconnectButton" class="text-[11px] px-3 py-1 rounded-lg border border-[#dde1e8] font-semibold">
        再接続
      </button>
    </div>`;
}
function renderGmailSettings() {
    const clientId = getGmailClientId();
    const clientSecret = getGmailClientSecret();
    const isConnected = isGmailAuthorized();
    if (isConnected) {
        return `
      <div class="space-y-3">
        <p class="text-[11px] text-[var(--et-ink-muted)]">Gmailに接続中です。「${isGmailEverFetched() ? "更新する" : "今すぐ取得"}」で最新のメルマガを取得できます。</p>
        <button id="gmailDisconnectButton"
          class="w-full py-2 rounded-xl border border-red-200 text-xs font-semibold text-red-400">
          接続を切断
        </button>
      </div>`;
    }
    return `
    <div class="space-y-3">
      <p class="text-[11px] text-[var(--et-ink-muted)]">
        メルマガで配信される情報をカレンダーに反映させたい場合は、Google Cloud Console の
        「OAuth 2.0 クライアント ID」ページからIDとシークレットを取得してここに登録してください。
      </p>
      <label class="block">
        <span class="text-xs text-[var(--et-ink-muted)]">クライアントID</span>
        <input id="gmailClientIdInput" type="text"
               value="${escapeHtml(clientId)}"
               placeholder="xxxx.apps.googleusercontent.com"
               class="et-input w-full mt-1 px-3 py-2 text-xs" />
      </label>
      <label class="block">
        <span class="text-xs text-[var(--et-ink-muted)]">クライアントシークレット</span>
        <input id="gmailClientSecretInput" type="password"
               value="${escapeHtml(clientSecret)}"
               placeholder="GOCSPX-..."
               class="et-input w-full mt-1 px-3 py-2 text-xs" />
      </label>
      <p class="text-[10px] text-[var(--et-ink-muted)]">
        クライアントIDとシークレットの両方を入力してから「Googleでログイン」を押してください。
      </p>
      <button id="gmailConnectButton"
        class="w-full py-2.5 rounded-xl text-xs font-bold text-white"
        style="background:var(--et-accent-dark);">
        Googleでログイン
      </button>
    </div>`;
}
function attachGmailSettingsListeners(container) {
    // 「Googleでログイン」— クリック時にIDとシークレットを保存してからOAuth開始
    container.querySelector("#gmailConnectButton")?.addEventListener("click", async () => {
        const idInput = container.querySelector("#gmailClientIdInput");
        const secretInput = container.querySelector("#gmailClientSecretInput");
        const clientId = idInput?.value.trim() ?? "";
        const clientSecret = secretInput?.value.trim() ?? "";
        if (!clientId) {
            showToast("クライアントIDを入力してください");
            idInput?.focus();
            return;
        }
        if (!clientSecret) {
            showToast("クライアントシークレットを入力してください");
            secretInput?.focus();
            return;
        }
        setGmailClientId(clientId);
        setGmailClientSecret(clientSecret);
        await startGmailAuth();
    });
    container.querySelector("#gmailReconnectButton")?.addEventListener("click", async () => {
        await startGmailAuth();
    });
    container.querySelector("#gmailDisconnectButton")?.addEventListener("click", () => {
        clearGmailTokens();
        showToast("Gmail接続を切断しました");
        renderCalendar(container);
    });
    container.querySelector("#gmailSyncButton")?.addEventListener("click", async () => {
        await syncGmailEvents(container);
    });
}
async function syncGmailEvents(container) {
    const syncBtn = container.querySelector("#gmailSyncButton");
    const overlay = container.querySelector("#calSyncOverlay");
    const spinner = container.querySelector("#calSyncSpinner");
    const statusText = container.querySelector("#calSyncStatusText");
    const progressText = container.querySelector("#calSyncProgressText");
    // 初回取得か更新かで挙動を変える
    const isFirstFetch = !isGmailEverFetched();
    if (syncBtn)
        syncBtn.disabled = true;
    if (overlay)
        overlay.style.display = "flex";
    if (spinner)
        spinner.style.display = "block";
    if (statusText)
        statusText.textContent = isFirstFetch ? "メルマガを取得中..." : "更新中...";
    if (progressText)
        progressText.textContent = "";
    try {
        const profiles = getOshiProfiles();
        const oshiList = profiles.map((p) => ({
            id: p.id,
            newsletterSenderAddress: p.newsletterSenderAddress,
        }));
        // 更新時のみ：取得前の既存イベントをキーとして記録（差分表示に使う）
        const existingKeys = isFirstFetch
            ? null
            : new Set(getCalendarEvents()
                .filter((e) => e.autoFetched)
                .map((e) => `${e.oshiId}|${e.title}|${e.startAt}`));
        const gmailEvents = await fetchAllGmailEvents(oshiList, (current, total) => {
            if (progressText)
                progressText.textContent = `${current} / ${total} 件`;
        });
        await replaceAutoFetchedEvents(gmailEvents);
        markGmailFetched();
        // オーバーレイを先に隠してから再描画（render中に例外が出ても隠れたままにする）
        if (overlay)
            overlay.style.display = "none";
        renderCalendar(container);
        if (isFirstFetch) {
            // 初回：オーバーレイをすぐ閉じてトーストで通知（元の挙動）
            if (overlay)
                overlay.style.display = "none";
            showToast(`${gmailEvents.length}件のお知らせを取得しました`);
        }
        else {
            // 更新：差分を算出してオーバーレイに結果を2秒表示
            const newEvents = gmailEvents.filter((ev) => !existingKeys.has(`${ev.oshiId}|${ev.title}|${ev.startAt}`));
            if (spinner)
                spinner.style.display = "none";
            if (progressText)
                progressText.textContent = "";
            if (newEvents.length === 0) {
                if (statusText)
                    statusText.textContent = "すでに最新です";
            }
            else {
                const oshiMap = new Map(profiles.map((p) => [p.id, p.name]));
                const uniqueNames = [...new Set(newEvents.map((ev) => oshiMap.get(ev.oshiId ?? "") ?? "").filter(Boolean))];
                const namesStr = uniqueNames.slice(0, 3).join("、") + (uniqueNames.length > 3 ? "…" : "");
                if (statusText)
                    statusText.textContent = `${newEvents.length}件更新しました`;
                if (progressText)
                    progressText.textContent = namesStr;
            }
            setTimeout(() => {
                if (overlay)
                    overlay.style.display = "none";
            }, 2000);
        }
    }
    catch (err) {
        if (overlay)
            overlay.style.display = "none";
        if (err instanceof GmailAuthError) {
            // 認証切れ：既存イベントは消さず、再接続を促す
            renderCalendar(container);
            showToast("Gmailの接続が切れました。再接続してください");
        }
        else {
            console.error("Gmail取得に失敗しました", err);
            showToast("取得に失敗しました。再度お試しください");
        }
    }
    finally {
        if (syncBtn) {
            syncBtn.disabled = false;
            syncBtn.textContent = isGmailEverFetched() ? "更新する" : "今すぐ取得";
        }
    }
}
// ── 公開API：カレンダーモーダルを再表示 ─────────────────────
// main.ts でフォームからカレンダーへ戻る際、またはホーム画面からカード経由で開く際に使用する
export function reopenDayModal(dateStr) {
    // 対象日付の年月へ移動してからモーダルを開く
    const [y, m] = dateStr.split("-").map(Number);
    if (y && m) {
        currentYear = y;
        currentMonth = m - 1; // 0-indexed
        if (_currentContainer)
            renderCalendar(_currentContainer);
    }
    const yearMonth = dateStr.slice(0, 7);
    const calEvents = getEventsForMonth(getCalendarEvents(), yearMonth);
    openDayModal(dateStr, calEvents, getRecords(), getLotteryEntries());
}
// ── トースト通知 ─────────────────────────────────────────
export function showToast(message) {
    const existing = document.querySelector(".cal-toast");
    existing?.remove();
    const toast = document.createElement("div");
    toast.className =
        "cal-toast fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[var(--et-ink)] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg pointer-events-none";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
