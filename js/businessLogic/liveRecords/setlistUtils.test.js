import { test } from "node:test";
import assert from "node:assert/strict";
import { countBySong, findRecordsBySong, parseSetlistText } from "./setlistUtils.js";
const make = (overrides) => ({
    id: "x", artist: "A", date: "2026-01-01", venue: "", tour: "", seat: "", memo: "",
    ...overrides,
});
// ── countBySong ──────────────────────────────────
test("countBySong: セトリがない記録は無視する", () => {
    assert.deepEqual(countBySong([make({})]), []);
});
test("countBySong: setlist が undefined の記録も安全に処理する", () => {
    const r = make({});
    delete r.setlist;
    assert.deepEqual(countBySong([r]), []);
});
test("countBySong: 演奏回数の多い順に返す", () => {
    const records = [
        make({ setlist: ["曲A", "曲B"] }),
        make({ setlist: ["曲A", "曲C"] }),
        make({ setlist: ["曲A"] }),
    ];
    const result = countBySong(records);
    assert.equal(result[0].name, "曲A");
    assert.equal(result[0].count, 3);
    assert.equal(result.length, 3);
});
// ── findRecordsBySong ─────────────────────────────
test("findRecordsBySong: 曲を含む公演を返す", () => {
    const records = [
        make({ id: "1", setlist: ["曲A"], date: "2026-01-01" }),
        make({ id: "2", setlist: ["曲B"], date: "2026-02-01" }),
    ];
    const result = findRecordsBySong(records, "曲A");
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "1");
});
test("findRecordsBySong: 公演日の降順で返す", () => {
    const records = [
        make({ id: "old", setlist: ["曲A"], date: "2025-01-01" }),
        make({ id: "new", setlist: ["曲A"], date: "2026-01-01" }),
    ];
    const result = findRecordsBySong(records, "曲A");
    assert.equal(result[0].id, "new");
});
test("findRecordsBySong: setlist未定義の記録は対象外", () => {
    const r = make({ id: "no-setlist" });
    delete r.setlist;
    assert.deepEqual(findRecordsBySong([r], "曲A"), []);
});
// ── parseSetlistText ─────────────────────────────
test("parseSetlistText: 改行で分割し空行を除く", () => {
    assert.deepEqual(parseSetlistText("曲A\n曲B\n\n曲C"), ["曲A", "曲B", "曲C"]);
});
test("parseSetlistText: 前後の空白をトリムする", () => {
    assert.deepEqual(parseSetlistText("  曲A  \n曲B"), ["曲A", "曲B"]);
});
test("parseSetlistText: 空文字列は空配列を返す", () => {
    assert.deepEqual(parseSetlistText(""), []);
});
