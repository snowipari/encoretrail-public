import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
// Node単体にはlocalStorageが存在しないため、テスト用の最小限のインメモリ実装を用意する。
// recordStore.tsをimportする前に定義する必要があるため、動的importを使う。
let store = {};
globalThis.localStorage = {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
        store[key] = String(value);
    },
    removeItem: (key) => {
        delete store[key];
    },
    clear: () => {
        store = {};
    },
};
const { loadRecords, getRecords, addRecord, updateRecord, deleteRecord, replaceAllRecords } = await import("./recordStore.js");
beforeEach(async () => {
    globalThis.localStorage.clear();
    await loadRecords();
});
test("loadRecords: 何も保存されていない場合は空配列になる", async () => {
    assert.deepEqual(getRecords(), []);
});
test("addRecord: idを自動生成して記録を追加する", async () => {
    const record = await addRecord({ artist: "Test Artist", date: "2026-07-01", venue: "Test Hall", tour: "", seat: "", memo: "" });
    assert.ok(record.id);
    assert.equal(getRecords().length, 1);
    assert.equal(getRecords()[0].artist, "Test Artist");
});
test("updateRecord: 既存の記録を更新する", async () => {
    const record = await addRecord({ artist: "A", date: "2026-07-01", venue: "", tour: "", seat: "", memo: "" });
    await updateRecord(record.id, { artist: "B" });
    assert.equal(getRecords()[0].artist, "B");
});
test("deleteRecord: 指定した記録を削除する", async () => {
    const record = await addRecord({ artist: "A", date: "2026-07-01", venue: "", tour: "", seat: "", memo: "" });
    await deleteRecord(record.id);
    assert.equal(getRecords().length, 0);
});
test("replaceAllRecords: 一覧をまるごと置き換える（復元機能用）", async () => {
    await addRecord({ artist: "A", date: "2026-07-01", venue: "", tour: "", seat: "", memo: "" });
    await replaceAllRecords([{ id: "x", artist: "Imported", date: "2026-01-01", venue: "", tour: "", seat: "", memo: "" }]);
    assert.equal(getRecords().length, 1);
    assert.equal(getRecords()[0].artist, "Imported");
});
test("再度loadRecordsを呼んでもデータが保持される（アプリ再起動を模擬）", async () => {
    await addRecord({ artist: "Persisted", date: "2026-08-01", venue: "", tour: "", seat: "", memo: "" });
    await loadRecords();
    assert.equal(getRecords()[0].artist, "Persisted");
});
