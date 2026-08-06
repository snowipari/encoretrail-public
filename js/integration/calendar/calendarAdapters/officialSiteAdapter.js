// officialSiteAdapter.ts
// 公式サイトの公開ページからイベント情報を取得するアダプタ。
// CORSが許可されているサイトのみ取得できる（ベストエフォート）。
// CORS制約により失敗した場合は例外を投げず空配列を返す。
const EVENT_KEYWORDS_RE = /ライブ|コンサート|LIVE|Live|公演|ツアー|TOUR|Tour|イベント|EVENT|Event|発売|リリース|開演|開場|FC限定|先行|チケット|握手会|サイン会|フェス|FESTIVAL|Festival|出演|出場|サマーソニック|サマソニ/u;
function stripHtmlTags(html) {
    return html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(?:p|div|tr|li|h[1-6])>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
function extractEventsFromText(text, oshiId, sourceUrl, siteId) {
    const now = new Date();
    const events = [];
    const seen = new Set();
    const fullDateRe = /(\d{4})年(\d{1,2})月(\d{1,2})日/g;
    let m;
    while ((m = fullDateRe.exec(text)) !== null) {
        const dateStr = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
        if (new Date(dateStr) < now)
            continue;
        const ctx = text.slice(Math.max(0, m.index - 300), Math.min(text.length, m.index + 300));
        if (!EVENT_KEYWORDS_RE.test(ctx))
            continue;
        // 日付の前テキストからイベント名を探す
        const before = text.slice(Math.max(0, m.index - 300), m.index);
        const lines = before.split(/[\n\r]+/).map((l) => l.trim()).filter((l) => l.length > 3 && l.length <= 80);
        let title = "";
        for (let i = lines.length - 1; i >= 0; i--) {
            if (EVENT_KEYWORDS_RE.test(lines[i])) {
                title = lines[i];
                break;
            }
        }
        if (!title)
            title = lines[lines.length - 1] ?? "";
        if (!title)
            continue;
        const key = `${dateStr}|${title}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        events.push({
            id: `site-${siteId}-${events.length}`,
            type: "release",
            title,
            oshiId,
            startAt: `${dateStr}T00:00`,
            sourceUrl,
            autoFetched: true,
        });
    }
    return events;
}
/**
 * 登録済み推しの公式サイトURLからイベント情報を取得する。
 * CORS制約などで失敗したサイトは静かにスキップし、取得成否をカウントして返す。
 */
export async function fetchOfficialSiteEvents(oshiList) {
    let succeeded = 0;
    let failed = 0;
    const allEvents = [];
    for (const oshi of oshiList) {
        if (!oshi.officialSiteUrl)
            continue;
        try {
            const res = await fetch(oshi.officialSiteUrl, { signal: AbortSignal.timeout(8000) });
            if (!res.ok) {
                failed++;
                continue;
            }
            const html = await res.text();
            const text = stripHtmlTags(html);
            const events = extractEventsFromText(text, oshi.id, oshi.officialSiteUrl, `${oshi.id}-${allEvents.length}`);
            allEvents.push(...events);
            succeeded++;
        }
        catch {
            failed++;
        }
    }
    return { events: allEvents, succeeded, failed };
}
