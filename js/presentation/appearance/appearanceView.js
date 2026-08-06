// appearanceView.ts
// 外観設定画面（タブ背景画像）の描画とイベントハンドリング。
// 設定の保存は appearanceStore に委譲し、背景の適用は main.ts 側で行う。
import { getAppearanceSettings, setBackgroundFor, saveCustomImage, deleteCustomImage, } from "../../integration/appearanceStore.js";
const TAB_LABELS = {
    home: "ホーム",
    records: "ライブ記録",
    oshi: "推し",
};
const TABS = ["home", "records", "oshi"];
/** 長辺1080px以内にリサイズしてBlobを返す */
async function resizeImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const MAX = 1080;
            let { width, height } = img;
            if (width > MAX || height > MAX) {
                if (width > height) {
                    height = Math.round((height * MAX) / width);
                    width = MAX;
                }
                else {
                    width = Math.round((width * MAX) / height);
                    height = MAX;
                }
            }
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            canvas.getContext("2d").drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
                if (blob)
                    resolve(blob);
                else
                    reject(new Error("画像の変換に失敗しました"));
            }, "image/jpeg", 0.85);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("画像を読み込めませんでした")); };
        img.src = url;
    });
}
export function renderAppearanceView(container, onBack) {
    const settings = getAppearanceSettings();
    const bgRows = TABS.map((tab) => {
        const s = settings[tab];
        const statusText = s.source === "custom" ? "アップロード済み" : "なし";
        return `
      <div class="flex items-center justify-between py-3 border-b border-[#f0f2f7] last:border-0">
        <span class="text-sm font-semibold">${TAB_LABELS[tab]}</span>
        <div class="flex items-center gap-3">
          <span class="text-xs text-[var(--et-ink-muted)]">${statusText}</span>
          <button data-tab-bg="${tab}"
            class="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#dde1e8]">
            変更
          </button>
        </div>
      </div>`;
    }).join("");
    container.innerHTML = `
    <div class="pt-4">
      <div class="flex items-center gap-3 mb-6">
        <button id="appearanceBackBtn"
          class="w-8 h-8 flex items-center justify-center rounded-full border border-[#dde1e8]">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <p class="font-bold text-base">外観設定</p>
      </div>

      <section class="mb-6">
        <p class="text-xs text-[var(--et-ink-muted)] mb-2">タブの背景画像</p>
        <div class="rounded-2xl border border-[#e4e8ef] px-4">${bgRows}</div>
      </section>
    </div>`;
    container.querySelector("#appearanceBackBtn")?.addEventListener("click", onBack);
    // 背景変更ボタン
    container.querySelectorAll("[data-tab-bg]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const tab = btn.dataset.tabBg;
            openBgPicker(tab, () => renderAppearanceView(container, onBack));
        });
    });
}
/** 背景変更のボトムシートを表示する */
function openBgPicker(tab, onDone) {
    const existing = document.getElementById("bgPickerSheet");
    existing?.remove();
    const sheet = document.createElement("div");
    sheet.id = "bgPickerSheet";
    sheet.className = "fixed inset-0 z-50 flex items-end justify-center";
    sheet.innerHTML = `
    <div id="bgPickerBackdrop" class="absolute inset-0 bg-black/40"></div>
    <div class="relative w-full max-w-md bg-white rounded-t-2xl pb-safe overflow-hidden" style="padding-bottom: calc(1.5rem + var(--et-safe-bottom, 0px));">
      <div class="px-4 pt-4 pb-2 border-b border-[#f0f2f7]">
        <p class="text-sm font-bold">「${TAB_LABELS[tab]}」タブの背景</p>
      </div>
      <button data-pick-none class="w-full text-left px-4 py-3 text-sm font-semibold border-b border-[#f0f2f7]">
        なし
      </button>
      <button data-pick-upload
        class="w-full text-left px-4 py-3 text-sm font-semibold border-b border-[#f0f2f7]">
        画像をアップロード
      </button>
      <button id="bgPickerCancel" class="w-full text-left px-4 py-3 text-sm text-[var(--et-ink-muted)]">
        キャンセル
      </button>
    </div>`;
    document.body.appendChild(sheet);
    const close = () => sheet.remove();
    sheet.querySelector("#bgPickerBackdrop")?.addEventListener("click", close);
    sheet.querySelector("#bgPickerCancel")?.addEventListener("click", close);
    sheet.querySelector("[data-pick-none]")?.addEventListener("click", async () => {
        const prev = getAppearanceSettings()[tab];
        if (prev.source === "custom" && prev.customImageId) {
            await deleteCustomImage(prev.customImageId);
        }
        setBackgroundFor(tab, { source: "none" });
        close();
        onDone();
        document.dispatchEvent(new CustomEvent("encoretrail:background-changed", { detail: { tab } }));
    });
    sheet.querySelector("[data-pick-upload]")?.addEventListener("click", () => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.addEventListener("change", async () => {
            const file = fileInput.files?.[0];
            if (!file)
                return;
            try {
                const blob = await resizeImage(file);
                const prev = getAppearanceSettings()[tab];
                if (prev.source === "custom" && prev.customImageId) {
                    await deleteCustomImage(prev.customImageId);
                }
                const imageId = await saveCustomImage(blob);
                setBackgroundFor(tab, { source: "custom", customImageId: imageId });
                close();
                onDone();
                document.dispatchEvent(new CustomEvent("encoretrail:background-changed", { detail: { tab } }));
            }
            catch {
                alert("この画像は使用できませんでした。別の画像をお試しください。");
            }
        });
        fileInput.click();
    });
}
