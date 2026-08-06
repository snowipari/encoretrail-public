import { test } from "node:test";
import assert from "node:assert/strict";
import { todayStr, daysUntil, fmtDate, escapeHtml } from "./domUtils.js";
test("todayStrはローカルタイムゾーンでYYYY-MM-DD形式を返す", () => {
    assert.match(todayStr(), /^\d{4}-\d{2}-\d{2}$/);
});
test("daysUntil: 未来の日付は正の数を返す", () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    const dateStr = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-${String(future.getDate()).padStart(2, "0")}`;
    assert.equal(daysUntil(dateStr), 5);
});
test("daysUntil: 今日の日付は0を返す", () => {
    assert.equal(daysUntil(todayStr()), 0);
});
test("daysUntil: 過去の日付は負の数を返す", () => {
    const past = new Date();
    past.setDate(past.getDate() - 3);
    const dateStr = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, "0")}-${String(past.getDate()).padStart(2, "0")}`;
    assert.equal(daysUntil(dateStr), -3);
});
test("fmtDate はYYYY/M/D形式に整形する", () => {
    assert.equal(fmtDate("2026-07-12"), "2026/7/12");
});
test("escapeHtml は特殊文字をエスケープする", () => {
    assert.equal(escapeHtml(`<script>&"'`), "&lt;script&gt;&amp;&quot;&#39;");
});
test("escapeHtml は null/undefined を空文字として扱う", () => {
    assert.equal(escapeHtml(undefined), "");
    assert.equal(escapeHtml(null), "");
});
