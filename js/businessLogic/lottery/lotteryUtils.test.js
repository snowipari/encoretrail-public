import { test } from "node:test";
import assert from "node:assert/strict";
import { calcWinRate, sortPendingByDeadline, getUpcomingDeadlines } from "./lotteryUtils.js";
const make = (overrides) => ({
    id: "test-id",
    title: "テスト先行",
    artist: "テストアーティスト",
    applicationDeadline: "2026-08-01",
    announcementDate: "2026-08-10",
    status: "pending",
    memo: "",
    ...overrides,
});
// ── calcWinRate ──────────────────────────────────
test("calcWinRate: 確定済みが0件の場合はnullを返す", () => {
    assert.equal(calcWinRate([make({ status: "pending" })]), null);
});
test("calcWinRate: 全件当選の場合は1を返す", () => {
    assert.equal(calcWinRate([make({ status: "won" }), make({ status: "won" })]), 1);
});
test("calcWinRate: 全件落選の場合は0を返す", () => {
    assert.equal(calcWinRate([make({ status: "lost" })]), 0);
});
test("calcWinRate: 1件当選・1件落選の場合は0.5を返す", () => {
    assert.equal(calcWinRate([make({ status: "won" }), make({ status: "lost" })]), 0.5);
});
test("calcWinRate: pendingは集計対象外", () => {
    const entries = [
        make({ status: "won" }),
        make({ status: "lost" }),
        make({ status: "pending" }),
    ];
    assert.equal(calcWinRate(entries), 0.5);
});
// ── sortPendingByDeadline ────────────────────────
test("sortPendingByDeadline: 締切日昇順に並ぶ", () => {
    const entries = [
        make({ id: "b", applicationDeadline: "2026-09-01" }),
        make({ id: "a", applicationDeadline: "2026-08-01" }),
    ];
    const sorted = sortPendingByDeadline(entries);
    assert.equal(sorted[0].id, "a");
    assert.equal(sorted[1].id, "b");
});
test("sortPendingByDeadline: won/lostは含まれない", () => {
    const entries = [
        make({ id: "won", status: "won", applicationDeadline: "2026-07-01" }),
        make({ id: "pending", status: "pending", applicationDeadline: "2026-08-01" }),
    ];
    const sorted = sortPendingByDeadline(entries);
    assert.equal(sorted.length, 1);
    assert.equal(sorted[0].id, "pending");
});
// ── getUpcomingDeadlines ─────────────────────────
test("getUpcomingDeadlines: 3日以内の申込中エントリを返す", () => {
    const entries = [
        make({ id: "today", applicationDeadline: "2026-08-01" }),
        make({ id: "3days", applicationDeadline: "2026-08-04" }),
        make({ id: "4days", applicationDeadline: "2026-08-05" }),
    ];
    const result = getUpcomingDeadlines(entries, "2026-08-01", 3);
    assert.deepEqual(result.map((e) => e.id), ["today", "3days"]);
});
test("getUpcomingDeadlines: 過去の締切は含まれない", () => {
    const entries = [make({ id: "past", applicationDeadline: "2026-07-31" })];
    const result = getUpcomingDeadlines(entries, "2026-08-01", 3);
    assert.equal(result.length, 0);
});
test("getUpcomingDeadlines: won/lostは含まれない", () => {
    const entries = [make({ id: "won", status: "won", applicationDeadline: "2026-08-01" })];
    const result = getUpcomingDeadlines(entries, "2026-08-01", 3);
    assert.equal(result.length, 0);
});
