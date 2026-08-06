// wikidataAdapter.ts
// Wikidata Entity Search API を使った推し検索アダプタ。
// 認証不要でブラウザから直接呼び出せる（CORS許可済み、origin=* を付与）。
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
// 人物・グループを示す説明文キーワード（日英両対応）
const PERSON_KEYWORDS = [
    "歌手", "アーティスト", "俳優", "女優", "タレント", "声優", "ミュージシャン",
    "シンガー", "モデル", "アイドル", "ラッパー", "ダンサー", "クリエイター",
    "YouTuber", "ユーチューバー", "ボーカル", "作詞家", "作曲家", "演奏家",
    "musician", "singer", "actor", "actress", "idol", "rapper", "dancer",
    "artist", "vocalist", "model", "performer", "youtuber",
    "グループ", "バンド", "デュオ", "トリオ", "ユニット",
    "band", "group", "duo", "trio",
];
function isPersonOrGroup(description) {
    if (!description)
        return false;
    const d = description.toLowerCase();
    return PERSON_KEYWORDS.some((k) => d.includes(k.toLowerCase()));
}
/** Wikidataで人物・グループ名を検索して候補一覧を返す（人物・グループのみに絞り込む） */
export async function searchWikidata(query) {
    if (!query.trim())
        return [];
    // limit を多めに取ってフィルタリング後に8件まで返す
    const params = new URLSearchParams({
        action: "wbsearchentities",
        search: query,
        language: "ja",
        uselang: "ja",
        type: "item",
        limit: "20",
        format: "json",
        origin: "*",
    });
    const res = await fetch(`${WIKIDATA_API}?${params.toString()}`);
    if (!res.ok)
        throw new Error(`Wikidata API エラー: ${res.status}`);
    const json = await res.json();
    return (json.search ?? [])
        .filter((item) => isPersonOrGroup(item.description))
        .slice(0, 8)
        .map((item) => ({
        id: item.id,
        label: item.label,
        description: item.description,
    }));
}
