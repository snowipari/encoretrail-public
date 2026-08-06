// lotteryForm.ts
// 抽選エントリフォームの読み書きを担当する。DOM操作のみ、永続化は行わない。
import { escapeHtml } from "../../businessLogic/domUtils.js";
/** フォームに既存エントリの値を書き込む（編集モード開始時） */
export function fillLotteryForm(form, entry) {
    form.elements.namedItem("editingId").value = entry.id;
    form.elements.namedItem("title").value = entry.title;
    form.elements.namedItem("artist").value = entry.artist;
    form.elements.namedItem("applicationDeadline").value = entry.applicationDeadline;
    form.elements.namedItem("deadlineTime").value = entry.deadlineTime ?? "";
    form.elements.namedItem("announcementDate").value = entry.announcementDate;
    form.elements.namedItem("announcementTime").value = entry.announcementTime ?? "";
    form.elements.namedItem("liveDate").value = entry.liveDate ?? "";
    form.elements.namedItem("liveTime").value = entry.liveTime ?? "";
    form.elements.namedItem("status").value = entry.status;
    form.elements.namedItem("memo").value = entry.memo;
}
/** フォームをリセットする（編集モード終了時） */
export function resetLotteryForm(form) {
    form.reset();
    form.elements.namedItem("editingId").value = "";
}
/** フォームの現在値を読み取って LotteryEntryInput を返す */
export function readLotteryFormData(form) {
    const v = (name) => (form.elements.namedItem(name)
        ?.value ?? "").trim();
    const opt = (name) => v(name) || undefined;
    return {
        title: v("title"),
        artist: v("artist"),
        applicationDeadline: v("applicationDeadline"),
        deadlineTime: opt("deadlineTime"),
        announcementDate: v("announcementDate"),
        announcementTime: opt("announcementTime"),
        liveDate: opt("liveDate"),
        liveTime: opt("liveTime"),
        status: v("status"),
        memo: v("memo"),
    };
}
/** 編集中のエントリIDを返す（新規追加中は null） */
export function getLotteryEditingId(form) {
    const id = form.elements.namedItem("editingId").value;
    return id || null;
}
/** 当選エントリからライブ記録フォームに引き渡す初期値を生成する */
export function buildRecordPrefill(entry) {
    return {
        artist: escapeHtml(entry.artist),
        memo: entry.title ? `抽選: ${escapeHtml(entry.title)}` : "",
    };
}
