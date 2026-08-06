import { test } from "node:test";
import assert from "node:assert/strict";
import { countByArtist, countByVenue, countByYear } from "./statsUtils.js";
const make = (overrides) => ({
    id: "x",
    artist: "Artist A",
    date: "2026-01-01",
    venue: "会場A",
    tour: "",
    seat: "",
    memo: "",
    ...overrides,
});
// ── countByArtist ──────────────────────────────────
test("countByArtist: 空配列は空を返す", () => {
    assert.deepEqual(countByArtist([]), []);
});
test("countByArtist: 1アーティストを正しく集計する", () => {
    const result = countByArtist([make({ artist: "A" }), make({ artist: "A" })]);
    assert.deepEqual(result, [{ name: "A", count: 2 }]);
});
test("countByArtist: 複数アーティストを件数の降順で返す", () => {
    const records = [
        make({ artist: "B" }),
        make({ artist: "A" }), make({ artist: "A" }),
        make({ artist: "C" }), make({ artist: "C" }), make({ artist: "C" }),
    ];
    const result = countByArtist(records);
    assert.equal(result[0].name, "C");
    assert.equal(result[0].count, 3);
    assert.equal(result[1].name, "A");
    assert.equal(result[2].name, "B");
});
// ── countByVenue ──────────────────────────────────
test("countByVenue: 会場が空の記録は除外する", () => {
    const records = [make({ venue: "" }), make({ venue: "会場A" })];
    const result = countByVenue(records);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "会場A");
});
test("countByVenue: 複数会場を件数の降順で返す", () => {
    const records = [
        make({ venue: "会場A" }), make({ venue: "会場A" }),
        make({ venue: "会場B" }),
    ];
    const result = countByVenue(records);
    assert.equal(result[0].name, "会場A");
    assert.equal(result[0].count, 2);
});
// ── countByYear ──────────────────────────────────
test("countByYear: 年別に集計して昇順で返す", () => {
    const records = [
        make({ date: "2026-05-01" }), make({ date: "2026-08-01" }),
        make({ date: "2025-01-01" }),
    ];
    const result = countByYear(records);
    assert.equal(result[0].name, "2025");
    assert.equal(result[0].count, 1);
    assert.equal(result[1].name, "2026");
    assert.equal(result[1].count, 2);
});
test("countByYear: 空配列は空を返す", () => {
    assert.deepEqual(countByYear([]), []);
});
