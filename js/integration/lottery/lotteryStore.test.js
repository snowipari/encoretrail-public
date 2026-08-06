import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
let store = {};
globalThis.localStorage = {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
};
const { loadLotteryEntries, getLotteryEntries, addLotteryEntry, updateLotteryEntry, deleteLotteryEntry, replaceAllLotteryEntries, } = await import("./lotteryStore.js");
const baseInput = {
    title: "SUMMER TOUR 1次先行",
    artist: "テストアーティスト",
    applicationDeadline: "2026-08-01",
    announcementDate: "2026-08-10",
    status: "pending",
    memo: "",
};
beforeEach(async () => {
    globalThis.localStorage.clear();
    await loadLotteryEntries();
});
test("loadLotteryEntries: 何も保存されていない場合は空配列", async () => {
    assert.deepEqual(getLotteryEntries(), []);
});
test("addLotteryEntry: idを自動生成してエントリを追加する", async () => {
    const entry = await addLotteryEntry(baseInput);
    assert.ok(entry.id);
    assert.equal(getLotteryEntries().length, 1);
    assert.equal(getLotteryEntries()[0].title, "SUMMER TOUR 1次先行");
});
test("updateLotteryEntry: ステータスを更新できる", async () => {
    const entry = await addLotteryEntry(baseInput);
    await updateLotteryEntry(entry.id, { status: "won" });
    assert.equal(getLotteryEntries()[0].status, "won");
});
test("deleteLotteryEntry: 指定したエントリを削除する", async () => {
    const entry = await addLotteryEntry(baseInput);
    await deleteLotteryEntry(entry.id);
    assert.equal(getLotteryEntries().length, 0);
});
test("replaceAllLotteryEntries: 一覧をまるごと置き換える", async () => {
    await addLotteryEntry(baseInput);
    await replaceAllLotteryEntries([
        { id: "x", title: "復元データ", artist: "A", applicationDeadline: "2026-09-01",
            announcementDate: "2026-09-10", status: "lost", memo: "" },
    ]);
    assert.equal(getLotteryEntries().length, 1);
    assert.equal(getLotteryEntries()[0].title, "復元データ");
});
test("再度loadLotteryEntriesを呼んでもデータが保持される", async () => {
    await addLotteryEntry(baseInput);
    await loadLotteryEntries();
    assert.equal(getLotteryEntries()[0].title, "SUMMER TOUR 1次先行");
});
