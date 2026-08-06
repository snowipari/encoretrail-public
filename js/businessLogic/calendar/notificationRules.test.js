import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveNotificationDates, isLongDurationEvent } from "./notificationRules.js";
describe("resolveNotificationDates", () => {
    it("endAt なし → startAt のみ返す", () => {
        const result = resolveNotificationDates("2026-07-10T10:00");
        assert.deepEqual(result, ["2026-07-10T10:00"]);
    });
    it("期間が2日以内 → startAt のみ返す", () => {
        const result = resolveNotificationDates("2026-07-10T00:00", "2026-07-11T23:59");
        assert.deepEqual(result, ["2026-07-10T00:00"]);
    });
    it("期間がちょうど2日 → startAt のみ返す", () => {
        const result = resolveNotificationDates("2026-07-10T00:00", "2026-07-12T00:00");
        assert.deepEqual(result, ["2026-07-10T00:00"]);
    });
    it("期間が3日以上 → startAt と endAt の 2 件を返す", () => {
        const result = resolveNotificationDates("2026-07-10T00:00", "2026-07-20T23:59");
        assert.deepEqual(result, ["2026-07-10T00:00", "2026-07-20T23:59"]);
    });
    it("期間がちょうど3日 → 2 件を返す", () => {
        const result = resolveNotificationDates("2026-07-10T00:00", "2026-07-13T00:00");
        assert.deepEqual(result, ["2026-07-10T00:00", "2026-07-13T00:00"]);
    });
});
describe("isLongDurationEvent", () => {
    it("endAt なし → false", () => {
        assert.equal(isLongDurationEvent("2026-07-10T00:00"), false);
    });
    it("2日以内 → false", () => {
        assert.equal(isLongDurationEvent("2026-07-10T00:00", "2026-07-11T00:00"), false);
    });
    it("3日以上 → true", () => {
        assert.equal(isLongDurationEvent("2026-07-01T00:00", "2026-07-14T00:00"), true);
    });
});
