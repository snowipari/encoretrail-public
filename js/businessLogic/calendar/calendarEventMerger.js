// calendarEventMerger.ts
// 複数アダプタから取得した CalendarEvent を統合し重複を排除する純粋関数。
// 重複判定：oshiId + type + title + startAt + endAt がすべて一致した場合のみ重複とみなす。
// 優先順位：公式サイト取得（autoFetched from site）> メルマガ取得（autoFetched from gmail）> 手動入力
function isSameEvent(a, b) {
    return (a.oshiId === b.oshiId &&
        a.type === b.type &&
        a.title === b.title &&
        a.startAt === b.startAt &&
        a.endAt === b.endAt);
}
/**
 * 公式サイト側を優先し、メルマガ側の重複分を除外して統合する。
 * 公式サイトが取得できなかった（空配列）場合はメルマガ側全件を採用する。
 */
export function mergeCalendarEvents(siteEvents, gmailEvents) {
    const gmailOnly = gmailEvents.filter((g) => !siteEvents.some((s) => isSameEvent(s, g)));
    return [...siteEvents, ...gmailOnly];
}
/**
 * CalendarEvent 配列から指定した日付（YYYY-MM-DD）に属するイベントを返す。
 * startAt の日付、または endAt がある場合は期間内に含まれるかで判定する。
 */
export function getEventsForDate(events, dateStr) {
    return events.filter((ev) => {
        const start = ev.startAt.slice(0, 10);
        if (!ev.endAt)
            return start === dateStr;
        const end = ev.endAt.slice(0, 10);
        return start <= dateStr && dateStr <= end;
    });
}
/**
 * CalendarEvent 配列から指定した月（YYYY-MM）に属するイベントを返す。
 */
export function getEventsForMonth(events, yearMonth) {
    return events.filter((ev) => {
        const startMonth = ev.startAt.slice(0, 7);
        if (!ev.endAt)
            return startMonth === yearMonth;
        const endMonth = ev.endAt.slice(0, 7);
        return startMonth <= yearMonth && yearMonth <= endMonth;
    });
}
/**
 * 手動メモ・userMemo・抽選の締切/当落を日付昇順で統合したタイムラインを返す。
 * autoFetched な CalendarEvent（お知らせ）は「お知らせ」セクションに分離したため含まない。
 * userMemo の "this-day" / "date-range" はそれぞれの fromDate で、"all-days" はイベントの startAt で判定する。
 */
export function buildUpcomingTimeline(calEvents, lotteries, today, daysAhead) {
    const todayMs = new Date(`${today}T00:00:00`).getTime();
    const endMs = todayMs + daysAhead * 86_400_000;
    const inRange = (dateStr) => {
        const ms = new Date(`${dateStr}T00:00:00`).getTime();
        return ms >= todayMs && ms <= endMs;
    };
    const items = [];
    for (const ev of calEvents) {
        const date = ev.startAt.slice(0, 10);
        if (!ev.autoFetched) {
            // 手動メモ：startAt の日付が範囲内なら表示
            if (!inRange(date))
                continue;
            const timePart = ev.startAt.slice(11, 16);
            items.push({
                key: `cal-${ev.id}`,
                date,
                time: timePart && timePart !== "00:00" ? timePart : undefined,
                title: ev.title,
                kind: "memo",
            });
        }
        else if (ev.userMemos?.length) {
            // autoFetched イベントの userMemo を日付スコープごとに追加
            for (const entry of ev.userMemos) {
                let entryDate;
                if (entry.scope === "this-day")
                    entryDate = entry.fromDate;
                else if (entry.scope === "date-range")
                    entryDate = entry.fromDate;
                else
                    entryDate = date; // "all-days" → イベント開始日で代表
                if (!entryDate || !inRange(entryDate))
                    continue;
                items.push({
                    key: `usermemo-${ev.id}-${entry.id}`,
                    date: entryDate,
                    time: entry.time,
                    title: entry.text,
                    kind: "user-memo",
                    sourceEventTitle: ev.title,
                });
            }
        }
    }
    for (const entry of lotteries) {
        if (entry.status !== "pending")
            continue;
        if (inRange(entry.applicationDeadline)) {
            const daysLeft = Math.round((new Date(`${entry.applicationDeadline}T00:00:00`).getTime() - todayMs) / 86_400_000);
            items.push({
                key: `lottery-dl-${entry.id}`,
                date: entry.applicationDeadline,
                time: entry.deadlineTime,
                title: entry.title || entry.artist,
                kind: "lottery-deadline",
                isUrgent: daysLeft <= 3,
            });
        }
        if (inRange(entry.announcementDate)) {
            items.push({
                key: `lottery-ann-${entry.id}`,
                date: entry.announcementDate,
                time: entry.announcementTime,
                title: entry.title || entry.artist,
                kind: "lottery-announcement",
            });
        }
    }
    return items.sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        if (d !== 0)
            return d;
        if (a.time && b.time)
            return a.time.localeCompare(b.time);
        if (a.time)
            return -1;
        if (b.time)
            return 1;
        return 0;
    });
}
/**
 * today から daysAhead 日後までの期間（当日含む）に startAt が含まれるイベントを返す。
 * startAt の日付（時刻部分は除外）で判定し、開始日付の昇順にソートする。
 */
export function getUpcomingEvents(events, today, daysAhead) {
    const todayMs = new Date(`${today}T00:00:00`).getTime();
    const endMs = todayMs + daysAhead * 86_400_000;
    return events
        .filter((ev) => {
        const evMs = new Date(`${ev.startAt.slice(0, 10)}T00:00:00`).getTime();
        return evMs >= todayMs && evMs <= endMs;
    })
        .sort((a, b) => a.startAt.localeCompare(b.startAt));
}
