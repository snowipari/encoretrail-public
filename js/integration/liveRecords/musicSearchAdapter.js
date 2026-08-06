// musicSearchAdapter.ts
// MusicBrainz API を使った楽曲検索アダプタ。
// アーティスト名をヒントに楽曲候補を返す（認証不要、CORS許可済み）。
const MUSICBRAINZ_API = "https://musicbrainz.org/ws/2/recording";
/** 楽曲名とアーティスト名ヒントで楽曲候補を検索して曲名一覧を返す */
export async function searchSongs(songQuery, artistHint) {
    if (!songQuery.trim())
        return [];
    const query = artistHint?.trim()
        ? `recording:"${songQuery}" AND artist:"${artistHint}"`
        : `recording:"${songQuery}"`;
    const params = new URLSearchParams({ query, fmt: "json", limit: "15" });
    const res = await fetch(`${MUSICBRAINZ_API}?${params.toString()}`);
    if (!res.ok)
        throw new Error(`MusicBrainz API error: ${res.status}`);
    const json = await res.json();
    // タイトルで重複除去して最大8件返す
    return [...new Set((json.recordings ?? []).map((r) => r.title))].slice(0, 8);
}
