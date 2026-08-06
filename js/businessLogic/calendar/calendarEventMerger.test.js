import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeCalendarEvents, getEventsForDate, getEventsForMonth, getUpcomingEvents, buildUpcomingTimeline, } from "./calendarEventMerger.js";
function makeEvent(overrides) {
    return {
        id: "id1",
        type: "release",
        title: "新曲リリース",
        oshiId: "oshi1",
        startAt: "2026-07-10T00:00",
        sourceUrl: "",
        autoFetched: true,
        ...overrides,
    };
}
describe("mergeCalendarEvents", () => {
    it("重複なし → 全件返す", () => {
        const site = [makeEvent({ id: "s1", title: "リリースA" })];
        const gmail = [makeEvent({ id: "g1", title: "リリースB" })];
        const result = mergeCalendarEvents(site, gmail);
        assert.equal(result.length, 2);
    });
    it("同一イベントは公式サイト側を採用しメルマガ側を除外", () => {
        const event = makeEvent({ title: "リリースA" });
        const siteVer = { ...event, id: "site1", sourceUrl: "https://official.jp" };
        const gmailVer = { ...event, id: "gmail1", sourceUrl: "https://gmail" };
        const result = mergeCalendarEvents([siteVer], [gmailVer]);
        assert.equal(result.length, 1);
        assert.equal(result[0].id, "site1");
    });
    it("サイトが空の場合 → メルマガ全件採用", () => {
        const gmail = [makeEvent({ id: "g1" }), makeEvent({ id: "g2", title: "B" })];
        const result = mergeCalendarEvents([], gmail);
        assert.equal(result.length, 2);
    });
    it("両方空 → 空配列", () => {
        assert.deepEqual(mergeCalendarEvents([], []), []);
    });
});
describe("getEventsForDate", () => {
    it("startAt が一致するイベントを返す（endAt なし）", () => {
        const ev = makeEvent({ startAt: "2026-07-10T00:00" });
        assert.equal(getEventsForDate([ev], "2026-07-10").length, 1);
        assert.equal(getEventsForDate([ev], "2026-07-11").length, 0);
    });
    it("期間内の日付に一致するイベントを返す（endAt あり）", () => {
        const ev = makeEvent({ startAt: "2026-07-10T00:00", endAt: "2026-07-20T23:59" });
        assert.equal(getEventsForDate([ev], "2026-07-10").length, 1);
        assert.equal(getEventsForDate([ev], "2026-07-15").length, 1);
        assert.equal(getEventsForDate([ev], "2026-07-20").length, 1);
        assert.equal(getEventsForDate([ev], "2026-07-21").length, 0);
    });
});
describe("getUpcomingEvents", () => {
    it("今日から daysAhead 日後の範囲（当日含む）のイベントを返す", () => {
        const today = makeEvent({ id: "today", startAt: "2026-07-07T10:00" });
        const day7 = makeEvent({ id: "day7", startAt: "2026-07-14T00:00" });
        const day8 = makeEvent({ id: "day8", startAt: "2026-07-15T00:00" });
        const result = getUpcomingEvents([today, day7, day8], "2026-07-07", 7);
        assert.equal(result.length, 2);
        assert.equal(result[0].id, "today");
        assert.equal(result[1].id, "day7");
    });
    it("過去のイベントは含まれない", () => {
        const past = makeEvent({ id: "past", startAt: "2026-07-06T00:00" });
        const result = getUpcomingEvents([past], "2026-07-07", 7);
        assert.equal(result.length, 0);
    });
    it("空配列は空を返す", () => {
        assert.deepEqual(getUpcomingEvents([], "2026-07-07", 14), []);
    });
    it("startAt の昇順でソートされる", () => {
        const a = makeEvent({ id: "a", startAt: "2026-07-10T00:00" });
        const b = makeEvent({ id: "b", startAt: "2026-07-08T00:00" });
        const result = getUpcomingEvents([a, b], "2026-07-07", 14);
        assert.equal(result[0].id, "b");
        assert.equal(result[1].id, "a");
    });
});
describe("buildUpcomingTimeline", () => {
    it("autoFetched のお知らせは今後の予定に含まれない", () => {
        const notice = makeEvent({ id: "n1", autoFetched: true, startAt: "2026-07-15T10:00" });
        const items = buildUpcomingTimeline([notice], [], "2026-07-14", 14);
        assert.equal(items.length, 0);
    });
    it("手動メモ（autoFetched:false）は今後の予定に含まれる", () => {
        const memo = makeEvent({ id: "m1", title: "グッズ発売日", autoFetched: false, startAt: "2026-07-15T00:00" });
        const items = buildUpcomingTimeline([memo], [], "2026-07-14", 14);
        assert.equal(items.length, 1);
        assert.equal(items[0].kind, "memo");
        assert.equal(items[0].title, "グッズ発売日");
    });
    it("autoFetched イベントの this-day userMemo は fromDate で追加される", () => {
        const notice = makeEvent({
            id: "n1",
            autoFetched: true,
            startAt: "2026-07-10T00:00",
            userMemos: [{
                    id: "um1",
                    text: "特典会あり",
                    scope: "this-day",
                    fromDate: "2026-07-20",
                }],
        });
        const items = buildUpcomingTimeline([notice], [], "2026-07-14", 14);
        assert.equal(items.length, 1);
        assert.equal(items[0].kind, "user-memo");
        assert.equal(items[0].date, "2026-07-20");
        assert.equal(items[0].title, "特典会あり");
        assert.equal(items[0].sourceEventTitle, "新曲リリース");
    });
    it("this-day userMemo の fromDate が範囲外なら含まれない", () => {
        const notice = makeEvent({
            id: "n1",
            autoFetched: true,
            startAt: "2026-07-10T00:00",
            userMemos: [{ id: "um1", text: "メモ", scope: "this-day", fromDate: "2026-08-01" }],
        });
        const items = buildUpcomingTimeline([notice], [], "2026-07-14", 14);
        assert.equal(items.length, 0);
    });
});
describe("getEventsForMonth", () => {
    it("startAt が同月のイベントを返す", () => {
        const ev = makeEvent({ startAt: "2026-07-10T00:00" });
        assert.equal(getEventsForMonth([ev], "2026-07").length, 1);
        assert.equal(getEventsForMonth([ev], "2026-08").length, 0);
    });
    it("月をまたぐ期間は両月で返す", () => {
        const ev = makeEvent({
            startAt: "2026-06-28T00:00",
            endAt: "2026-07-05T23:59",
        });
        assert.equal(getEventsForMonth([ev], "2026-06").length, 1);
        assert.equal(getEventsForMonth([ev], "2026-07").length, 1);
        assert.equal(getEventsForMonth([ev], "2026-08").length, 0);
    });
});
