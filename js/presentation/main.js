// main.ts
// エントリポイント。DOM取得・タブ切り替え・フォーム送信のハンドリングを行い、
// データ操作は各ストア、描画は各 list / form モジュールに委譲する。
import { loadRecords, getRecords, addRecord, updateRecord, deleteRecord, } from "../integration/liveRecords/recordStore.js";
import { loadLotteryEntries, getLotteryEntries, addLotteryEntry, updateLotteryEntry, deleteLotteryEntry, replaceAllLotteryEntries, } from "../integration/lottery/lotteryStore.js";
import { loadOshiProfiles, getOshiProfiles, addOshiProfile, updateOshiProfile, deleteOshiProfile, replaceAllOshiProfiles, } from "../integration/oshi/oshiProfileStore.js";
import { loadCalendarEvents } from "../integration/calendar/calendarEventStore.js";
import { renderCalendarView, showToast, reopenDayModal } from "./calendar/calendarView.js";
import { handleOAuthCallback } from "../integration/calendar/calendarAdapters/gmailNewsletterAdapter.js";
import { loadFanClubs, getFanClubs, addFanClub, updateFanClub, deleteFanClub, replaceAllFanClubs, } from "../integration/fanClub/fanClubStore.js";
import { renderHero, renderList } from "./liveRecords/recordList.js";
import { renderStats } from "./liveRecords/statsView.js";
import { renderSetlistView } from "./liveRecords/setlistView.js";
import { fillForm, resetForm, readFormData, getEditingId, initSetlistInput } from "./liveRecords/recordForm.js";
import { renderLotteryList } from "./lottery/lotteryList.js";
import { fillLotteryForm, resetLotteryForm, readLotteryFormData, getLotteryEditingId, } from "./lottery/lotteryForm.js";
import { renderOshiList } from "./oshi/oshiList.js";
import { renderAnniversaryBanner } from "./oshi/anniversaryBanner.js";
import { renderLatestInfo } from "./home/latestInfoView.js";
import { renderUpcomingEvents } from "./home/upcomingEventsView.js";
import { getUpcomingAnniversaries } from "../businessLogic/oshi/oshiUtils.js";
import { getUpcomingEvents, buildUpcomingTimeline } from "../businessLogic/calendar/calendarEventMerger.js";
import { todayStr } from "../businessLogic/domUtils.js";
import { getCalendarEvents } from "../integration/calendar/calendarEventStore.js";
import { fillOshiForm, resetOshiForm, readOshiFormData, getOshiEditingId, initOshiSuggest, } from "./oshi/oshiForm.js";
import { renderFanClubList } from "./fanClub/fanClubList.js";
import { fillFanClubForm, resetFanClubForm, readFanClubFormData, getFanClubEditingId, } from "./fanClub/fanClubForm.js";
import { exportAll, readBackupFile } from "../integration/backup/backupUtils.js";
import { getBackupTargets } from "../integration/backupRegistry.js";
import { getOshiCleanupHandlers } from "../integration/oshiCleanupRegistry.js";
import { loadAppearanceSettings, getBackgroundFor, getCustomImageUrl, } from "../integration/appearanceStore.js";
import { renderAppearanceView } from "./appearance/appearanceView.js";
// ── DOM 要素取得 ──────────────────────────────────
const heroSlot = document.getElementById("heroSlot");
const listContent = document.getElementById("listContent");
const lotteryContent = document.getElementById("lotteryContent");
const oshiContent = document.getElementById("oshiContent");
const recordForm = document.getElementById("recordForm");
const formTitle = document.getElementById("formTitle");
const submitButton = document.getElementById("submitButton");
const cancelEditButton = document.getElementById("cancelEditButton");
const lotteryForm = document.getElementById("lotteryForm");
const lotteryFormTitle = document.getElementById("lotteryFormTitle");
const lotterySubmitButton = document.getElementById("lotterySubmitButton");
const lotteryCancelEditButton = document.getElementById("lotteryCancelEditButton");
const oshiForm = document.getElementById("oshiForm");
const oshiFormTitle = document.getElementById("oshiFormTitle");
const oshiSubmitButton = document.getElementById("oshiSubmitButton");
const oshiCancelEditButton = document.getElementById("oshiCancelEditButton");
const fanClubContent = document.getElementById("fanClubContent");
const fanClubForm = document.getElementById("fanClubForm");
const fanClubFormTitle = document.getElementById("fanClubFormTitle");
const fanClubSubmitButton = document.getElementById("fanClubSubmitButton");
const fanClubCancelEditButton = document.getElementById("fanClubCancelEditButton");
const tabButtons = document.querySelectorAll("[data-view-tab]");
const views = document.querySelectorAll("[data-view]");
const exportButton = document.getElementById("exportButton");
const importButton = document.getElementById("importButton");
const importFileInput = document.getElementById("importFileInput");
const statsContent = document.getElementById("statsContent");
const setlistContent = document.getElementById("setlistContent");
const setlistSection = document.getElementById("setlistSection");
const calendarContent = document.getElementById("calendarContent");
const appearanceContent = document.getElementById("appearanceContent");
const fabAddButton = document.getElementById("fabAddButton");
const fabOshiMenu = document.getElementById("fabOshiMenu");
const todaySlot = document.getElementById("todaySlot");
const anniversaryBanner = document.getElementById("anniversaryBanner");
const latestInfoSlot = document.getElementById("latestInfoSlot");
const upcomingEventsSlot = document.getElementById("upcomingEventsSlot");
// ── ライブ記録 ────────────────────────────────────
function renderRecords() {
    renderHero(heroSlot);
    renderList(listContent, {
        onEdit: startEdit,
        onDelete: handleDelete,
        onEmptyAddClick: () => switchView("add"),
    });
    renderSetlistView(setlistContent);
    setlistSection.hidden = setlistContent.innerHTML === "";
    renderStats(statsContent);
}
async function handleDelete(id) {
    await deleteRecord(id);
    renderRecords();
}
function startEdit(id) {
    const record = getRecords().find((r) => r.id === id);
    if (!record)
        return;
    fillForm(recordForm, record);
    formTitle.textContent = "ライブを編集";
    submitButton.textContent = "更新する";
    switchView("add");
}
function exitEditMode() {
    resetForm(recordForm);
    formTitle.textContent = "ライブを追加";
    submitButton.textContent = "追加する";
    cancelEditButton.textContent = "戻る";
}
recordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = readFormData(recordForm);
    if (!data.artist || !data.date)
        return;
    const editingId = getEditingId(recordForm);
    if (editingId) {
        await updateRecord(editingId, data);
    }
    else {
        await addRecord(data);
    }
    calendarReturnDate = null;
    exitEditMode();
    switchView("records");
});
// ── 抽選エントリ ──────────────────────────────────
function renderLottery() {
    renderLotteryList(lotteryContent, {
        onEdit: startLotteryEdit,
        onDelete: handleLotteryDelete,
        onConvertToRecord: handleConvertToRecord,
        onAddClick: () => switchView("lottery-add"),
    });
}
async function handleLotteryDelete(id) {
    await deleteLotteryEntry(id);
    renderHome();
}
function startLotteryEdit(id) {
    const entry = getLotteryEntries().find((e) => e.id === id);
    if (!entry)
        return;
    fillLotteryForm(lotteryForm, entry);
    lotteryFormTitle.textContent = "抽選を編集";
    lotterySubmitButton.textContent = "更新する";
    switchView("lottery-add");
}
function exitLotteryEditMode() {
    resetLotteryForm(lotteryForm);
    lotteryFormTitle.textContent = "抽選を追加";
    lotterySubmitButton.textContent = "追加する";
}
function handleConvertToRecord(id) {
    const entry = getLotteryEntries().find((e) => e.id === id);
    if (!entry)
        return;
    resetForm(recordForm);
    const artistInput = recordForm.elements.namedItem("artist");
    const memoInput = recordForm.elements.namedItem("memo");
    artistInput.value = entry.artist;
    memoInput.value = entry.title ? `抽選: ${entry.title}` : "";
    formTitle.textContent = "ライブを追加";
    submitButton.textContent = "追加する";
    switchView("add");
}
lotteryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = readLotteryFormData(lotteryForm);
    if (!data.title || !data.artist || !data.applicationDeadline || !data.announcementDate)
        return;
    const editingId = getLotteryEditingId(lotteryForm);
    if (editingId) {
        await updateLotteryEntry(editingId, data);
    }
    else {
        await addLotteryEntry(data);
    }
    calendarReturnDate = null;
    exitLotteryEditMode();
    switchView("home");
});
lotteryCancelEditButton.addEventListener("click", () => {
    exitLotteryEditMode();
    if (calendarReturnDate) {
        const date = calendarReturnDate;
        calendarReturnDate = null;
        switchView("calendar");
        reopenDayModal(date);
    }
    else {
        switchView("home");
    }
});
// ── 推しプロフィール ──────────────────────────────
function renderOshi() {
    renderOshiList(oshiContent, {
        onEdit: startOshiEdit,
        onDelete: handleOshiDelete,
        onAddClick: () => switchView("oshi-add"),
    });
    renderFanClubList(fanClubContent, {
        onEdit: startFanClubEdit,
        onDelete: handleFanClubDelete,
        onAddClick: () => switchView("fanclub-add"),
    });
}
async function handleOshiDelete(id) {
    const profile = getOshiProfiles().find((p) => p.id === id);
    if (!profile)
        return;
    const handlers = getOshiCleanupHandlers();
    const affected = handlers
        .map((h) => ({ handler: h, count: h.countByOshiId(id) }))
        .filter((c) => c.count > 0);
    // 取り消し用スナップショット（削除対象の紐づきデータのみ）
    const lotterySnapshot = getLotteryEntries().filter((e) => e.oshiId === id);
    const fanClubSnapshot = getFanClubs().filter((m) => m.oshiId === id);
    const detail = affected
        .map((c) => {
        const label = c.handler.domainName === "lottery" ? "抽選" : "ファンクラブ";
        return `${label}${c.count}件`;
    })
        .join("・");
    const toastMsg = detail
        ? `「${profile.name}」と、紐づく${detail}を削除しました`
        : `「${profile.name}」を削除しました`;
    // 即座に削除してUIを更新（楽観的更新）
    await deleteOshiProfile(id);
    for (const { handler } of affected)
        await handler.deleteByOshiId(id);
    renderOshi();
    // 取り消しトースト（5秒間）
    const existing = document.querySelector(".et-undo-toast");
    existing?.remove();
    const toast = document.createElement("div");
    toast.className =
        "et-undo-toast fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[var(--et-ink)] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg flex items-center gap-3 whitespace-nowrap";
    toast.innerHTML = `<span>${toastMsg}</span><button class="underline shrink-0 pointer-events-auto">元に戻す</button>`;
    document.body.appendChild(toast);
    let undone = false;
    toast.querySelector("button")?.addEventListener("click", async () => {
        undone = true;
        toast.remove();
        // 削除したデータを復元
        await replaceAllOshiProfiles([...getOshiProfiles(), profile]);
        await replaceAllLotteryEntries([...getLotteryEntries(), ...lotterySnapshot]);
        await replaceAllFanClubs([...getFanClubs(), ...fanClubSnapshot]);
        renderOshi();
    });
    setTimeout(() => {
        if (!undone)
            toast.remove();
    }, 5000);
}
function startOshiEdit(id) {
    const profile = getOshiProfiles().find((p) => p.id === id);
    if (!profile)
        return;
    fillOshiForm(oshiForm, profile);
    oshiFormTitle.textContent = "推しを編集";
    oshiSubmitButton.textContent = "更新する";
    switchView("oshi-add");
}
function exitOshiEditMode() {
    resetOshiForm(oshiForm);
    oshiFormTitle.textContent = "推しを追加";
    oshiSubmitButton.textContent = "追加する";
    oshiCancelEditButton.textContent = "戻る";
}
oshiForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = readOshiFormData(oshiForm);
    if (!data.name)
        return;
    const editingId = getOshiEditingId(oshiForm);
    if (editingId) {
        await updateOshiProfile(editingId, data);
    }
    else {
        await addOshiProfile(data);
    }
    exitOshiEditMode();
    switchView("oshi");
});
oshiCancelEditButton.addEventListener("click", () => {
    const wasFromHome = fromHome;
    fromHome = false;
    exitOshiEditMode();
    switchView(wasFromHome ? "home" : "oshi");
});
// ── ファンクラブ管理 ──────────────────────────────
async function handleFanClubDelete(id) {
    await deleteFanClub(id);
    renderOshi();
}
function startFanClubEdit(id) {
    const membership = getFanClubs().find((m) => m.id === id);
    if (!membership)
        return;
    fillFanClubForm(fanClubForm, membership);
    fanClubFormTitle.textContent = "ファンクラブを編集";
    fanClubSubmitButton.textContent = "更新する";
    switchView("fanclub-add");
}
function exitFanClubEditMode() {
    resetFanClubForm(fanClubForm);
    fanClubFormTitle.textContent = "ファンクラブを追加";
    fanClubSubmitButton.textContent = "追加する";
}
fanClubForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = readFanClubFormData(fanClubForm);
    if (!data.clubName || !data.renewalDate)
        return;
    const editingId = getFanClubEditingId(fanClubForm);
    if (editingId) {
        await updateFanClub(editingId, data);
    }
    else {
        await addFanClub(data);
    }
    exitFanClubEditMode();
    switchView("oshi");
});
fanClubCancelEditButton.addEventListener("click", () => {
    exitFanClubEditMode();
    switchView("oshi");
});
// ── フローティングアクションボタン（+） ──────────────────
// 現在のタブに応じて適切な追加フォームへ切り替える
let currentTab = "home";
// カレンダーモーダルから遷移してきた場合の元の日付（「戻る」時にモーダルを再表示するため）
let calendarReturnDate = null;
// ホーム画面のクイックアクションから遷移してきた場合（「戻る」でホームに戻るため）
let fromHome = false;
fabAddButton.addEventListener("click", () => {
    if (currentTab === "records")
        switchView("add");
    else if (currentTab === "oshi")
        fabOshiMenu.classList.remove("hidden");
});
document.getElementById("fabOshiMenuBackdrop")?.addEventListener("click", () => {
    fabOshiMenu.classList.add("hidden");
});
document.getElementById("fabOshiMenuCancel")?.addEventListener("click", () => {
    fabOshiMenu.classList.add("hidden");
});
document.getElementById("fabMenuAddOshi")?.addEventListener("click", () => {
    fabOshiMenu.classList.add("hidden");
    exitOshiEditMode();
    switchView("oshi-add");
});
document.getElementById("fabMenuAddFanClub")?.addEventListener("click", () => {
    fabOshiMenu.classList.add("hidden");
    exitFanClubEditMode();
    switchView("fanclub-add");
});
// ── タブ切り替え ──────────────────────────────────
function switchView(viewName) {
    views.forEach((v) => v.classList.toggle("hidden", v.dataset.view !== viewName));
    // タブバーのアクティブ状態
    const tabName = resolveTabName(viewName);
    tabButtons.forEach((t) => {
        const isActive = t.dataset.viewTab === tabName;
        t.classList.toggle("text-[var(--et-accent)]", isActive);
        t.classList.toggle("text-[var(--et-ink-muted)]", !isActive);
        t.querySelector(".tabPill")?.classList.toggle("neu-pressed", isActive);
    });
    // FABの表示切り替え（記録タブ・推しタブのルートビューのみ表示）
    const showFab = viewName === "records" || viewName === "oshi";
    fabAddButton.classList.toggle("hidden", !showFab);
    // ビューに応じてデータを再描画
    if (viewName === "home")
        renderHome();
    if (viewName === "records")
        renderRecords();
    if (viewName === "oshi")
        renderOshi();
    if (viewName === "calendar")
        renderCalendarView(calendarContent);
    if (viewName === "appearance")
        renderAppearanceView(appearanceContent, () => switchView("home"));
    // タブの背景画像・テーマカラーを適用
    applyTabBackground(viewName);
}
// 現在適用中のObjectURL（再適用時にrevokeして漏れを防ぐ）
let currentBgObjectUrl = null;
async function applyTabBackground(viewName) {
    const tabMap = {
        home: "home",
        records: "records",
        oshi: "oshi",
    };
    const tab = tabMap[viewName];
    // 前回のObjectURLを解放
    if (currentBgObjectUrl) {
        URL.revokeObjectURL(currentBgObjectUrl);
        currentBgObjectUrl = null;
    }
    // 全ビューコンテナのbg-imageをリセット
    document.querySelectorAll("[data-view]").forEach((el) => {
        el.style.backgroundImage = "";
        el.style.backgroundSize = "";
        el.style.backgroundPosition = "";
        el.style.backgroundRepeat = "";
    });
    // CSS変数をデフォルトに戻す
    document.documentElement.style.removeProperty("--et-accent");
    document.documentElement.style.removeProperty("--et-accent-dark");
    document.documentElement.style.removeProperty("--et-ink");
    if (!tab)
        return;
    const setting = getBackgroundFor(tab);
    const activeEl = document.querySelector(`[data-view="${viewName}"]`);
    if (!activeEl)
        return;
    if (setting.source === "custom" && setting.customImageId) {
        const url = await getCustomImageUrl(setting.customImageId);
        if (url) {
            currentBgObjectUrl = url;
            activeEl.style.backgroundImage = `url(${url})`;
            activeEl.style.backgroundSize = "cover";
            activeEl.style.backgroundPosition = "center";
            activeEl.style.backgroundRepeat = "no-repeat";
        }
    }
}
function resolveTabName(viewName) {
    if (viewName === "add")
        return "records";
    if (viewName === "lottery-add")
        return "home";
    if (viewName === "oshi-add")
        return "oshi";
    if (viewName === "fanclub-add")
        return "oshi";
    if (viewName === "calendar")
        return "calendar";
    if (viewName === "appearance")
        return "home";
    return viewName;
}
function renderHome() {
    const today = todayStr();
    const allEvents = getCalendarEvents();
    const lotteries = getLotteryEntries();
    // 1段目: 今日の日付
    const d = new Date(`${today}T00:00:00`);
    const dateText = d.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });
    todaySlot.innerHTML = `<p class="text-sm font-semibold text-[var(--et-ink-muted)] pb-2 border-b border-[#e4e8ef] mb-3">${dateText}</p>`;
    // 2段目: ヒーロー
    renderHero(heroSlot);
    // 記念日バナー
    renderAnniversaryBanner(anniversaryBanner, getUpcomingAnniversaries(getOshiProfiles(), today));
    // 3段目: 最新情報（自動取得イベントのみ）
    const upcoming = getUpcomingEvents(allEvents, today, 14);
    renderLatestInfo(latestInfoSlot, upcoming.filter((ev) => ev.autoFetched), getOshiProfiles());
    // 4段目: 統合タイムライン（CalendarEvent + 申込中の抽選締切・当落）
    const timeline = buildUpcomingTimeline(allEvents, lotteries, today, 14);
    renderUpcomingEvents(upcomingEventsSlot, timeline);
    // 抽選管理
    renderLottery();
}
tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        const tab = btn.dataset.viewTab;
        currentTab = tab;
        fromHome = false;
        if (tab === "records")
            exitEditMode();
        if (tab === "home")
            exitLotteryEditMode();
        if (tab === "oshi") {
            exitOshiEditMode();
            exitFanClubEditMode();
        }
        if (tab === "calendar")
            currentTab = "calendar";
        switchView(tab);
    });
});
cancelEditButton.addEventListener("click", () => {
    const wasFromHome = fromHome;
    fromHome = false;
    exitEditMode();
    if (calendarReturnDate) {
        const date = calendarReturnDate;
        calendarReturnDate = null;
        switchView("calendar");
        reopenDayModal(date);
    }
    else if (wasFromHome) {
        switchView("home");
    }
    else {
        switchView("records");
    }
});
// ── バックアップ ──────────────────────────────────
exportButton.addEventListener("click", () => {
    exportAll();
});
importButton.addEventListener("click", () => {
    importFileInput.click();
});
importFileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file)
        return;
    try {
        const backupData = await readBackupFile(file);
        const targets = getBackupTargets();
        const totalImport = Object.values(backupData).reduce((s, a) => s + a.length, 0);
        const confirmed = confirm(`バックアップから${totalImport}件のデータを復元します。現在のデータはすべて置き換えられます。続けますか？`);
        if (!confirmed)
            return;
        for (const target of targets) {
            await target.replaceAll(backupData[target.jsonKey] ?? []);
        }
        renderHome();
        renderRecords();
        renderOshi();
        alert("復元が完了しました");
    }
    catch (err) {
        alert(`読み込みに失敗しました: ${err.message}`);
    }
    finally {
        importFileInput.value = "";
    }
});
// ── Service Worker ────────────────────────────────
function registerServiceWorker() {
    if (!("serviceWorker" in navigator))
        return;
    navigator.serviceWorker.register("./serviceWorker.js").catch((err) => {
        console.error("Service Worker登録に失敗しました", err);
    });
}
// ── 初期化 ────────────────────────────────────────
(async function init() {
    // OAuthコールバック処理（URL に ?code= があれば処理）。
    // カレンダータブを開く前にページリロードで確実にトークン取得できるよう、ここで実行する。
    const wasGmailCallback = await handleOAuthCallback();
    loadAppearanceSettings();
    await Promise.all([loadRecords(), loadLotteryEntries(), loadOshiProfiles(), loadFanClubs(), loadCalendarEvents()]);
    currentTab = "home";
    initOshiSuggest(oshiForm);
    initSetlistInput(recordForm);
    // switchView でタブのアクティブ状態・FAB表示・初期描画をまとめて設定する
    switchView("home");
    if (wasGmailCallback)
        showToast("Gmailに接続しました");
    // ── クイックアクション（ホーム画面） ──
    document.getElementById("qaAddLive")?.addEventListener("click", () => {
        exitEditMode();
        fromHome = true;
        cancelEditButton.textContent = "ホームに戻る";
        switchView("add");
    });
    document.getElementById("qaAddLottery")?.addEventListener("click", () => {
        exitLotteryEditMode();
        switchView("lottery-add");
    });
    document.getElementById("qaAddOshi")?.addEventListener("click", () => {
        exitOshiEditMode();
        fromHome = true;
        oshiCancelEditButton.textContent = "ホームに戻る";
        switchView("oshi-add");
    });
    // ── ホーム → カレンダー日付モーダルへの遷移 ──
    function openCalendarFromHome(dateStr) {
        currentTab = "calendar";
        switchView("calendar");
        reopenDayModal(dateStr);
    }
    latestInfoSlot.addEventListener("click", (e) => {
        const card = e.target.closest("[data-calendar-date]");
        if (card?.dataset.calendarDate)
            openCalendarFromHome(card.dataset.calendarDate);
    });
    upcomingEventsSlot.addEventListener("click", (e) => {
        const row = e.target.closest("[data-calendar-date]");
        if (row?.dataset.calendarDate)
            openCalendarFromHome(row.dataset.calendarDate);
    });
    // カレンダーモーダルからの追加ナビゲーション
    document.addEventListener("encoretrail:add-from-calendar", (e) => {
        const { view, date } = e.detail;
        calendarReturnDate = date; // 「戻る」時に元のモーダルを再表示するために記憶
        if (view === "add") {
            exitEditMode();
            switchView("add");
            const dateInput = recordForm.elements.namedItem("date");
            if (dateInput)
                dateInput.value = date;
        }
        else if (view === "lottery-add") {
            exitLotteryEditMode();
            switchView("lottery-add");
            const deadlineInput = lotteryForm.elements.namedItem("applicationDeadline");
            if (deadlineInput)
                deadlineInput.value = date;
        }
    });
    // ── 外観設定 ──
    document.getElementById("appearanceSettingsBtn")?.addEventListener("click", () => {
        switchView("appearance");
    });
    document.addEventListener("encoretrail:background-changed", () => {
        applyTabBackground(currentTab);
    });
    registerServiceWorker();
})();
