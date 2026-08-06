// appearanceStore.ts
// 外観設定（タブ背景・推しテーマカラー）の永続化。
// 背景設定はlocalStorage、カスタム画像はIndexedDBに保存する。
const SETTINGS_KEY = "encoreTrail.appearanceSettings";
const IDB_NAME = "encoreTrailImages";
const IDB_VERSION = 1;
const IDB_STORE = "backgroundImages";
const DEFAULT_SETTINGS = {
    home: { source: "none" },
    records: { source: "none" },
    oshi: { source: "none" },
};
let settings = { ...DEFAULT_SETTINGS };
const normalizeSource = (s) => s === "custom" ? "custom" : "none";
/** 起動時に一度呼ぶ。localStorageから外観設定を復元する */
export function loadAppearanceSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            settings = {
                home: { source: normalizeSource(parsed.home?.source), customImageId: parsed.home?.customImageId },
                records: { source: normalizeSource(parsed.records?.source), customImageId: parsed.records?.customImageId },
                oshi: { source: normalizeSource(parsed.oshi?.source), customImageId: parsed.oshi?.customImageId },
            };
        }
    }
    catch {
        settings = { ...DEFAULT_SETTINGS };
    }
    return { ...settings };
}
/** 現在の外観設定を返す */
export function getAppearanceSettings() {
    return { ...settings };
}
/** 特定タブの背景設定を返す */
export function getBackgroundFor(tab) {
    return { ...settings[tab] };
}
/** 特定タブの背景設定を保存する */
export function setBackgroundFor(tab, setting) {
    settings[tab] = { ...setting };
    persist();
}
function persist() {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
    catch (err) {
        console.error("外観設定の保存に失敗しました", err);
    }
}
// ── IndexedDB（カスタム画像） ──────────────────────────
function openIdb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = () => {
            req.result.createObjectStore(IDB_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
/**
 * 画像Blobを保存してIDを返す。
 * 長辺1080pxへのリサイズはappearanceView.ts側で実施済みの前提。
 */
export async function saveCustomImage(blob) {
    const id = `img_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const db = await openIdb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(blob, id);
        tx.oncomplete = () => resolve(id);
        tx.onerror = () => reject(tx.error);
    });
}
/** IDに対応する画像BlobをObjectURLとして返す */
export async function getCustomImageUrl(imageId) {
    const db = await openIdb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readonly");
        const req = tx.objectStore(IDB_STORE).get(imageId);
        req.onsuccess = () => {
            const blob = req.result;
            resolve(blob ? URL.createObjectURL(blob) : null);
        };
        req.onerror = () => reject(req.error);
    });
}
/** IDに対応する画像をIndexedDBから削除する */
export async function deleteCustomImage(imageId) {
    const db = await openIdb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).delete(imageId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
