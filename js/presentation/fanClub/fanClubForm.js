// fanClubForm.ts
// ファンクラブ登録・編集フォームのヘルパー。
/** フォームにファンクラブ会員情報の値を設定する（編集時） */
export function fillFanClubForm(form, membership) {
    form.elements.namedItem("editingId").value = membership.id;
    form.elements.namedItem("clubName").value = membership.clubName;
    form.elements.namedItem("memberName").value = membership.memberName ?? "";
    form.elements.namedItem("annualFee").value =
        membership.annualFee !== undefined ? String(membership.annualFee) : "";
    form.elements.namedItem("renewalDate").value = membership.renewalDate;
    form.elements.namedItem("memo").value = membership.memo;
}
/** フォームをリセットしてデフォルト値に戻す */
export function resetFanClubForm(form) {
    form.reset();
    form.elements.namedItem("editingId").value = "";
}
/** フォームの入力値を FanClubMembershipInput として読み取る */
export function readFanClubFormData(form) {
    const clubName = form.elements.namedItem("clubName").value.trim();
    const memberName = form.elements.namedItem("memberName").value.trim() || undefined;
    const feeStr = form.elements.namedItem("annualFee").value.trim();
    const annualFee = feeStr !== "" ? Number(feeStr) : undefined;
    const renewalDate = form.elements.namedItem("renewalDate").value;
    const memo = form.elements.namedItem("memo").value.trim();
    return { clubName, memberName, annualFee, renewalDate, memo };
}
/** 編集中のファンクラブID（新規の場合は空文字） */
export function getFanClubEditingId(form) {
    return form.elements.namedItem("editingId").value;
}
