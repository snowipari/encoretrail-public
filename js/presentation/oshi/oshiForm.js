// oshiForm.ts
// 推し登録・編集フォームのヘルパー。Wikidataの検索サジェスト表示も担う。
import { escapeHtml } from "../../businessLogic/domUtils.js";
import { searchWikidata } from "../../integration/oshi/wikidataAdapter.js";
/** フォームに推しプロフィールの値を設定する（編集時） */
export function fillOshiForm(form, profile) {
    form.elements.namedItem("editingId").value = profile.id;
    form.elements.namedItem("name").value = profile.name;
    form.elements.namedItem("type").value = profile.type;
    form.elements.namedItem("birthday").value = profile.birthday ?? "";
    form.elements.namedItem("anniversaryDate").value = profile.anniversaryDate ?? "";
    form.elements.namedItem("newsletterSenderAddress").value =
        profile.newsletterSenderAddress ?? "";
    form.elements.namedItem("officialSiteUrl").value =
        profile.officialSiteUrl ?? "";
    form.elements.namedItem("memo").value = profile.memo;
    // externalId は hidden フィールドに保持する
    form.elements.namedItem("externalId").value = profile.externalId ?? "";
}
/** フォームをリセットしてデフォルト値に戻す */
export function resetOshiForm(form) {
    form.reset();
    form.elements.namedItem("editingId").value = "";
    form.elements.namedItem("externalId").value = "";
    // サジェストリストを消す
    const suggestionList = form.querySelector("#oshiSuggestions");
    if (suggestionList)
        suggestionList.innerHTML = "";
}
/** フォームの入力値を OshiProfileInput として読み取る */
export function readOshiFormData(form) {
    const name = form.elements.namedItem("name").value.trim();
    const type = form.elements.namedItem("type").value;
    const birthday = form.elements.namedItem("birthday").value || undefined;
    const anniversaryDate = form.elements.namedItem("anniversaryDate").value || undefined;
    const newsletterSenderAddress = form.elements.namedItem("newsletterSenderAddress").value.trim() || undefined;
    const officialSiteUrl = form.elements.namedItem("officialSiteUrl").value.trim() || undefined;
    const memo = form.elements.namedItem("memo").value.trim();
    const externalId = form.elements.namedItem("externalId").value.trim() || undefined;
    return { name, type, birthday, anniversaryDate, newsletterSenderAddress, officialSiteUrl, memo, externalId };
}
/** 編集中の推しID（新規の場合は空文字） */
export function getOshiEditingId(form) {
    return form.elements.namedItem("editingId").value;
}
// ── Wikidata 検索サジェスト ────────────────────────────────
let debounceTimer = null;
/**
 * name フィールドへのイベントリスナーを設定する。
 * 入力から300msデバウンス後にWikidataを検索し、サジェストリストを更新する。
 */
export function initOshiSuggest(form) {
    const nameInput = form.elements.namedItem("name");
    const suggestionList = form.querySelector("#oshiSuggestions");
    if (!nameInput || !suggestionList)
        return;
    nameInput.addEventListener("input", () => {
        if (debounceTimer)
            clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            const query = nameInput.value.trim();
            if (query.length < 2) {
                suggestionList.innerHTML = "";
                return;
            }
            try {
                const results = await searchWikidata(query);
                renderSuggestions(suggestionList, results, (entity) => {
                    nameInput.value = entity.label;
                    form.elements.namedItem("externalId").value = entity.id;
                    suggestionList.innerHTML = "";
                });
            }
            catch {
                // ネットワークエラー等は無視（サジェストは任意機能）
                suggestionList.innerHTML = "";
            }
        }, 300);
    });
    // フォーカスが外れたら少し遅らせて消す（クリックを処理するため）
    nameInput.addEventListener("blur", () => {
        setTimeout(() => { suggestionList.innerHTML = ""; }, 200);
    });
}
function renderSuggestions(container, entities, onSelect) {
    if (entities.length === 0) {
        container.innerHTML = "";
        return;
    }
    container.innerHTML = `
    <ul class="absolute z-10 w-full mt-1 bg-[var(--et-base)] border border-[#dde1e8] rounded-xl shadow-lg overflow-hidden">
      ${entities
        .map((e) => `
        <li data-entity-id="${escapeHtml(e.id)}"
            class="px-4 py-2.5 cursor-pointer hover:bg-[var(--et-surface)] text-sm">
          <span class="font-semibold">${escapeHtml(e.label)}</span>
          ${e.description ? `<span class="text-xs text-[var(--et-ink-muted)] ml-2">${escapeHtml(e.description)}</span>` : ""}
        </li>`)
        .join("")}
    </ul>`;
    container.querySelectorAll("li[data-entity-id]").forEach((li, idx) => {
        li.addEventListener("mousedown", (e) => {
            e.preventDefault(); // blur を先に発火させない
            onSelect(entities[idx]);
        });
    });
}
