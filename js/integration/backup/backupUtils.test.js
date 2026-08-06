import { test } from "node:test";
import assert from "node:assert/strict";
import { validateImportedData } from "./backupUtils.js";
test("validateImportedData: 正しい配列はそのまま返す", () => {
    const data = [{ artist: "A", date: "2026-01-01" }];
    assert.deepEqual(validateImportedData(data), data);
});
test("validateImportedData: 配列でない場合はエラーになる", () => {
    assert.throws(() => validateImportedData({ artist: "A" }));
});
test("validateImportedData: 必須項目（artist/date）が無い要素があるとエラーになる", () => {
    assert.throws(() => validateImportedData([{ artist: "A" }]));
});
