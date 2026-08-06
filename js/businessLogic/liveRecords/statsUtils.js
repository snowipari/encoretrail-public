export function countByArtist(records) {
    return toSortedDesc(groupBy(records, (r) => r.artist));
}
/** 会場が空の記録は集計対象外 */
export function countByVenue(records) {
    return toSortedDesc(groupBy(records.filter((r) => r.venue), (r) => r.venue));
}
/** 年別・昇順（推移グラフ向け） */
export function countByYear(records) {
    const map = groupBy(records, (r) => r.date.slice(0, 4));
    return Object.entries(map)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name));
}
function groupBy(records, key) {
    return records.reduce((acc, r) => {
        const k = key(r);
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
    }, {});
}
function toSortedDesc(map) {
    return Object.entries(map)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
}
