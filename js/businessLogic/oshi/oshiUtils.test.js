import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { daysAsFan, daysUntilBirthday, formatDaysAsFan, getUpcomingAnniversaries } from "./oshiUtils.js";
describe("daysAsFan", () => {
    test("推し始めた日が今日なら0を返す", () => {
        assert.equal(daysAsFan("2026-01-01", "2026-01-01"), 0);
    });
    test("100日後の日付を渡すと100を返す", () => {
        assert.equal(daysAsFan("2026-01-01", "2026-04-11"), 100);
    });
    test("anniversaryDateが未設定ならnullを返す", () => {
        assert.equal(daysAsFan(undefined, "2026-01-01"), null);
    });
    test("推し始めた日が今日より未来ならnullを返す", () => {
        assert.equal(daysAsFan("2026-12-31", "2026-01-01"), null);
    });
});
describe("daysUntilBirthday", () => {
    test("birthdayが未設定ならnullを返す", () => {
        assert.equal(daysUntilBirthday(undefined, "2026-01-01"), null);
    });
    test("今日が誕生日なら0を返す", () => {
        assert.equal(daysUntilBirthday("1990-06-01", "2026-06-01"), 0);
    });
    test("誕生日が1日後なら1を返す", () => {
        assert.equal(daysUntilBirthday("1990-07-03", "2026-07-02"), 1);
    });
    test("今年の誕生日が過ぎていれば来年の誕生日までの日数を返す", () => {
        // 2026-01-01 は既に過ぎているので 2027-01-01 まで
        const days = daysUntilBirthday("1990-01-01", "2026-07-02");
        assert.ok(days !== null && days > 0, "来年の誕生日まで正の日数が返るべき");
    });
});
describe("getUpcomingAnniversaries", () => {
    const base = { id: "1", name: "推しA", type: "individual", memo: "" };
    test("プロフィールが空なら空配列を返す", () => {
        assert.deepEqual(getUpcomingAnniversaries([], "2026-07-06"), []);
    });
    test("誕生日が今日（daysUntil=0）の場合に含まれる", () => {
        const p = { ...base, birthday: "1995-07-06" };
        const result = getUpcomingAnniversaries([p], "2026-07-06");
        assert.equal(result.length, 1);
        assert.equal(result[0].type, "birthday");
        assert.equal(result[0].daysUntil, 0);
    });
    test("誕生日が7日後の場合に含まれる（デフォルトdaysAhead=7）", () => {
        const p = { ...base, birthday: "1995-07-13" };
        const result = getUpcomingAnniversaries([p], "2026-07-06");
        assert.equal(result.length, 1);
        assert.equal(result[0].daysUntil, 7);
    });
    test("誕生日が8日後の場合は含まれない（デフォルトdaysAhead=7）", () => {
        const p = { ...base, birthday: "1995-07-14" };
        const result = getUpcomingAnniversaries([p], "2026-07-06");
        assert.equal(result.length, 0);
    });
    test("anniversaryDateが7日以内なら含まれ、yearsCountが計算される", () => {
        // 2024-07-10 から推し始め → 2026-07-10 は2周年（4日後）
        const p = { ...base, anniversaryDate: "2024-07-10" };
        const result = getUpcomingAnniversaries([p], "2026-07-06");
        assert.equal(result.length, 1);
        assert.equal(result[0].type, "anniversary");
        assert.equal(result[0].daysUntil, 4);
        assert.equal(result[0].yearsCount, 2);
    });
    test("誕生日と記念日の両方がある場合は2件返し、daysUntil昇順に並ぶ", () => {
        const p = { ...base, birthday: "1995-07-09", anniversaryDate: "2024-07-07" };
        const result = getUpcomingAnniversaries([p], "2026-07-06");
        assert.equal(result.length, 2);
        assert.ok(result[0].daysUntil <= result[1].daysUntil);
    });
    test("daysAheadを0にすると当日のみ含まれる", () => {
        const p = { ...base, birthday: "1995-07-06" };
        const result = getUpcomingAnniversaries([p], "2026-07-06", 0);
        assert.equal(result.length, 1);
        assert.equal(result[0].daysUntil, 0);
    });
});
describe("formatDaysAsFan", () => {
    test("0日は「推し始めた日」と表示", () => {
        assert.equal(formatDaysAsFan(0), "推し始めた日");
    });
    test("29日は「推して29日」と表示（1ヶ月未満は日数表示）", () => {
        assert.equal(formatDaysAsFan(29), "推して29日");
    });
    test("100日は「推して3ヶ月」と表示（1年未満はヶ月表示）", () => {
        assert.equal(formatDaysAsFan(100), "推して3ヶ月");
    });
    test("365日は「推して1年0ヶ月」と表示", () => {
        assert.equal(formatDaysAsFan(365), "推して1年0ヶ月");
    });
    test("500日は「推して1年4ヶ月」と表示", () => {
        assert.equal(formatDaysAsFan(500), "推して1年4ヶ月");
    });
});
