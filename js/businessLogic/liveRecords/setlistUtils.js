/** 全公演のセトリを集計し、演奏回数の多い順で返す */
export function countBySong(records) {
    const map = {};
    for (const r of records) {
        for (const song of r.setlist ?? []) {
            map[song] = (map[song] ?? 0) + 1;
        }
    }
    return Object.entries(map)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
}
/** 指定した曲を含む公演を返す（公演日の降順） */
export function findRecordsBySong(records, song) {
    return records
        .filter((r) => (r.setlist ?? []).includes(song))
        .sort((a, b) => b.date.localeCompare(a.date));
}
/** テキストエリアの入力値（改行区切り）を配列に変換する */
export function parseSetlistText(text) {
    return text.split("\n").map((s) => s.trim()).filter(Boolean);
}
