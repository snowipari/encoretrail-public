// colorContrast.ts
// テーマカラー（HEX）から読みやすい文字色・アクセント濃淡を導出する純粋関数。
// DOMにもlocalStorageにも依存しない。
/** "#RRGGBB" → { r, g, b } */
function hexToRgb(hex) {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
    if (!m || !m[1] || !m[2] || !m[3])
        return null;
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
/** sRGB 相対輝度（WCAG 2.1 定義） */
function relativeLuminance(r, g, b) {
    const lin = (c) => {
        const s = c / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
/**
 * テーマカラーに対して白と黒のどちらかコントラスト比が高い方を返す。
 * 文字色の選択に使用する。
 */
export function getContrastColor(themeColor) {
    const rgb = hexToRgb(themeColor);
    if (!rgb)
        return "#1a1a2e";
    const lum = relativeLuminance(rgb.r, rgb.g, rgb.b);
    // 白の輝度 = 1、黒（#1a1a2e）の輝度 ≒ 0.011
    const contrastWhite = (1 + 0.05) / (lum + 0.05);
    const contrastDark = (lum + 0.05) / (0.011 + 0.05);
    return contrastWhite >= contrastDark ? "#ffffff" : "#1a1a2e";
}
/**
 * テーマカラーを少し暗くした「ダーク」バリアントを返す（`--et-accent-dark` 相当）。
 * ホバー・アクティブ状態に使用する。
 */
export function getDarkVariant(themeColor) {
    const rgb = hexToRgb(themeColor);
    if (!rgb)
        return themeColor;
    const darken = (c) => Math.max(0, Math.round(c * 0.75));
    const r = darken(rgb.r).toString(16).padStart(2, "0");
    const g = darken(rgb.g).toString(16).padStart(2, "0");
    const b = darken(rgb.b).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
}
