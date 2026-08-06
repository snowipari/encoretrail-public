// gmailNewsletterAdapter.ts
// Gmail APIを使って推しのメルマガからカレンダーイベントを取得するアダプタ。
// OAuth 2.0 PKCE フローでブラウザからGoogleに直接認可を受ける（バックエンド不要）。
// アクセストークンはlocalStorageに保存し、有効期限が切れたら自動的に再取得を試みる。
// リフレッシュトークンは7日で失効するため（Googleのテスト中アプリ制約）、
// 失効後はユーザーに再認可を促す。
// ── OAuth 設定 ─────────────────────────────────────────────
const OAUTH_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
// localStorageキー
const KEY_CLIENT_ID = "encoreTrail.gmailClientId";
const KEY_CLIENT_SECRET = "encoreTrail.gmailClientSecret";
const KEY_ACCESS_TOKEN = "encoreTrail.gmailAccessToken";
const KEY_REFRESH_TOKEN = "encoreTrail.gmailRefreshToken";
const KEY_TOKEN_EXPIRY = "encoreTrail.gmailTokenExpiry";
const KEY_CODE_VERIFIER = "encoreTrail.gmailCodeVerifier";
const KEY_EVER_FETCHED = "encoreTrail.gmailEverFetched";
// ── クライアントID・シークレット管理 ────────────────────────
export function getGmailClientId() {
    return localStorage.getItem(KEY_CLIENT_ID) ?? "";
}
export function setGmailClientId(clientId) {
    localStorage.setItem(KEY_CLIENT_ID, clientId);
}
export function getGmailClientSecret() {
    return localStorage.getItem(KEY_CLIENT_SECRET) ?? "";
}
export function setGmailClientSecret(secret) {
    localStorage.setItem(KEY_CLIENT_SECRET, secret);
}
export function isGmailConfigured() {
    return getGmailClientId() !== "" && getGmailClientSecret() !== "";
}
// ── トークン管理 ──────────────────────────────────────────
export function isGmailAuthorized() {
    const token = localStorage.getItem(KEY_ACCESS_TOKEN);
    const expiry = localStorage.getItem(KEY_TOKEN_EXPIRY);
    if (!token || !expiry)
        return false;
    return Date.now() < Number(expiry);
}
export function hasRefreshToken() {
    return localStorage.getItem(KEY_REFRESH_TOKEN) !== null;
}
export function clearGmailTokens() {
    localStorage.removeItem(KEY_ACCESS_TOKEN);
    localStorage.removeItem(KEY_REFRESH_TOKEN);
    localStorage.removeItem(KEY_TOKEN_EXPIRY);
}
export function isGmailEverFetched() {
    return localStorage.getItem(KEY_EVER_FETCHED) !== null;
}
export function markGmailFetched() {
    localStorage.setItem(KEY_EVER_FETCHED, "1");
}
function saveTokens(accessToken, expiresIn, refreshToken) {
    localStorage.setItem(KEY_ACCESS_TOKEN, accessToken);
    localStorage.setItem(KEY_TOKEN_EXPIRY, String(Date.now() + expiresIn * 1000));
    if (refreshToken) {
        localStorage.setItem(KEY_REFRESH_TOKEN, refreshToken);
    }
}
// ── PKCE ヘルパー ─────────────────────────────────────────
async function generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}
async function generateCodeChallenge(verifier) {
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}
// ── OAuth フロー ──────────────────────────────────────────
/**
 * Google OAuth 認可画面へリダイレクトする。
 * 認可後、コールバックURL（現在のページ）に ?code=... が付与される。
 * handleOAuthCallback() でコードをトークンに交換する。
 */
export async function startGmailAuth() {
    const clientId = getGmailClientId();
    if (!clientId)
        throw new Error("Google クライアントIDが未設定です");
    const verifier = await generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    localStorage.setItem(KEY_CODE_VERIFIER, verifier);
    const redirectUri = location.origin + location.pathname;
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: OAUTH_SCOPE,
        code_challenge: challenge,
        code_challenge_method: "S256",
        access_type: "offline",
        prompt: "consent",
    });
    location.href = `${AUTH_ENDPOINT}?${params}`;
}
/**
 * URLに ?code= パラメータがあれば OAuth コールバックとして処理する。
 * トークンを取得してlocalStorageに保存し、URLからコードを取り除く。
 * @returns トークン取得に成功した場合 true
 */
export async function handleOAuthCallback() {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    if (!code)
        return false;
    const verifier = localStorage.getItem(KEY_CODE_VERIFIER);
    if (!verifier)
        return false;
    const clientId = getGmailClientId();
    const redirectUri = location.origin + location.pathname;
    try {
        const res = await fetch(TOKEN_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: getGmailClientSecret(),
                redirect_uri: redirectUri,
                code_verifier: verifier,
                grant_type: "authorization_code",
            }),
        });
        if (!res.ok)
            return false;
        const json = await res.json();
        saveTokens(json.access_token, json.expires_in, json.refresh_token);
        localStorage.removeItem(KEY_CODE_VERIFIER);
        // URLからcodeパラメータを消す
        history.replaceState({}, "", location.pathname);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * リフレッシュトークンを使ってアクセストークンを更新する。
 * 7日失効後は失敗するため、UIで再認可を促す。
 */
export async function refreshAccessToken() {
    const refreshToken = localStorage.getItem(KEY_REFRESH_TOKEN);
    const clientId = getGmailClientId();
    if (!refreshToken || !clientId)
        return false;
    try {
        const res = await fetch(TOKEN_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                refresh_token: refreshToken,
                client_id: clientId,
                client_secret: getGmailClientSecret(),
                grant_type: "refresh_token",
            }),
        });
        if (!res.ok) {
            clearGmailTokens();
            return false;
        }
        const json = await res.json();
        saveTokens(json.access_token, json.expires_in);
        return true;
    }
    catch {
        return false;
    }
}
// ── Gmail API 呼び出し ────────────────────────────────────
async function getValidAccessToken() {
    if (isGmailAuthorized()) {
        return localStorage.getItem(KEY_ACCESS_TOKEN);
    }
    const refreshed = await refreshAccessToken();
    return refreshed ? localStorage.getItem(KEY_ACCESS_TOKEN) : null;
}
/**
 * Gmail APIでメールを検索する。
 * @param query Gmail検索クエリ（例: "from:official@example.jp"）
 * @param maxResults 最大取得件数
 */
async function searchGmailMessages(query, maxResults = 20) {
    const token = await getValidAccessToken();
    if (!token)
        return [];
    const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
    const res = await fetch(`${GMAIL_API_BASE}/messages?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok)
        return [];
    const json = await res.json();
    return json.messages ?? [];
}
async function fetchMessageFull(messageId, token) {
    const res = await fetch(`${GMAIL_API_BASE}/messages/${messageId}?format=full`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok)
        return null;
    return res.json();
}
function decodeBase64Url(data) {
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++)
        bytes[i] = binary.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
}
function extractTextFromPayload(payload) {
    if (payload.body?.data) {
        const decoded = decodeBase64Url(payload.body.data);
        return payload.mimeType === "text/html" ? stripHtmlTags(decoded) : decoded;
    }
    if (payload.parts) {
        const plain = payload.parts.find((p) => p.mimeType === "text/plain");
        if (plain)
            return extractTextFromPayload(plain);
        const html = payload.parts.find((p) => p.mimeType === "text/html");
        if (html)
            return extractTextFromPayload(html);
        for (const part of payload.parts) {
            const text = extractTextFromPayload(part);
            if (text)
                return text;
        }
    }
    return "";
}
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
// イベント日程を示す可能性が高いキーワード（フェス・フェスティバル・出演等を含む）
const EVENT_KEYWORDS_RE = /ライブ|コンサート|LIVE|Live|公演|ツアー|TOUR|Tour|イベント|EVENT|Event|発売|リリース|開演|開場|FC限定|先行|チケット|握手会|サイン会|フェス|FESTIVAL|Festival|出演|出場|サマーソニック|サマソニ/u;
/** 「MM月DD日(曜)～MM月DD日」のような範囲表現の終了日かどうかを判定する */
function isEndOfRange(bodyText, matchIndex) {
    const before = bodyText.slice(Math.max(0, matchIndex - 6), matchIndex);
    return /[～〜~]/.test(before);
}
/**
 * 「■━━━━━━■」「━━━━━」等のメルマガ装飾セパレーター行かどうかを判定する。
 * これらをイベントタイトルとして誤抽出しないためにフィルタする。
 */
function isSeparatorLine(line) {
    return /^[■●◆□○▪━─—=＝ー－\s*＊×◇▬]+$/.test(line);
}
/** ラベル行（「■開催期間」「会場：」「時間：」等）かどうかを判定する */
function isLabelLine(line) {
    const LABEL_WORDS = "開催期間|期間|会場|場所|時間|営業時間|開演|開場|日程|開催会場|開催地";
    // 純粋なラベル行: "開催期間", "開催期間：", "■開催期間" など（後続コンテンツなし）
    if (new RegExp(`^[■●▶◆※▼▲]?\\s*(?:${LABEL_WORDS})\\s*[：:]?\\s*$`).test(line))
        return true;
    // 記号付きラベル: "■開催期間 7月16日～" など（記号＋ラベル語で始まる行）
    if (new RegExp(`^[■●▶◆※▼▲]\\s*(?:${LABEL_WORDS})`).test(line))
        return true;
    // ラベル＋コロン＋値: "開催期間：2026年..." など
    if (new RegExp(`^(?:${LABEL_WORDS})\\s*[：:]`).test(line))
        return true;
    // コロン終わり: "開催期間：" のみの行
    if (/[：:]\s*$/.test(line))
        return true;
    return false;
}
/**
 * 日付マッチ位置の前後テキストからイベント名を抽出する。
 * ラベル行（「開催期間：」「■会場」等）を除外した上で、
 * イベントキーワードを含む行を優先して返す。見つからない場合は emailSubject にフォールバック。
 */
function extractEventTitleFromContext(bodyText, matchIndex, emailSubject) {
    const before = bodyText.slice(Math.max(0, matchIndex - 500), matchIndex);
    const lines = before
        .split(/[\n\r]+/)
        .map((l) => l.trim())
        .filter((l) => l.length > 3 && l.length <= 80 && !isLabelLine(l) && !isSeparatorLine(l));
    // イベントキーワードを含む行を後ろから探す（日付に近いほど優先）
    for (let i = lines.length - 1; i >= 0; i--) {
        if (EVENT_KEYWORDS_RE.test(lines[i]))
            return lines[i];
    }
    // キーワードなしなら最後の空でない行
    return lines[lines.length - 1] ?? emailSubject;
}
/**
 * 「期間：7/16～7/31」のような文字列から終了日（YYYY-MM-DD）を解析する。
 * 年なしの場合は startDate の年を基準に推定し、月が逆転していれば翌年とみなす。
 */
function parseEndDateFromPeriod(periodStr, startDate) {
    const endPart = periodStr.split(/[～〜~]/).pop()?.trim();
    if (!endPart)
        return undefined;
    const refYear = parseInt(startDate.slice(0, 4), 10);
    const startMo = parseInt(startDate.slice(5, 7), 10);
    // YYYY年MM月DD日
    let m = endPart.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (m)
        return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    // MM月DD日
    m = endPart.match(/(\d{1,2})月(\d{1,2})日/);
    if (m) {
        const mo = m[1].padStart(2, "0");
        const d = m[2].padStart(2, "0");
        const year = parseInt(mo, 10) < startMo ? refYear + 1 : refYear;
        return `${year}-${mo}-${d}`;
    }
    // MM/DD
    m = endPart.match(/(\d{1,2})\/(\d{1,2})/);
    if (m) {
        const mo = m[1].padStart(2, "0");
        const d = m[2].padStart(2, "0");
        const year = parseInt(mo, 10) < startMo ? refYear + 1 : refYear;
        return `${year}-${mo}-${d}`;
    }
    return undefined;
}
/**
 * 日付マッチ位置の前後テキストから構造化フィールド（会場・期間・時間）を抽出し、
 * note（"ラベル：値\n" 形式）と endAt（期間終了日、YYYY-MM-DD）を返す。
 * 抽出できたフィールドのみ含め、何も取れない場合は空文字 / undefined を返す。
 */
function extractStructuredNote(bodyText, matchIndex, startDate) {
    const contextStart = Math.max(0, matchIndex - 200);
    const contextEnd = Math.min(bodyText.length, matchIndex + 400);
    const context = bodyText.slice(contextStart, contextEnd);
    const fields = [];
    let endAt;
    // 会場 / 場所
    const venueMatch = context.match(/(?:場所|会場|開催場所|開催会場|開催地)\s*[：:]\s*([\s\S]{1,150}?)(?=\n\n|\n[^\s　]|$)/);
    if (venueMatch?.[1]) {
        const raw = venueMatch[1].trim();
        const firstLine = (raw.split("\n")[0] ?? "").trim();
        // ＜地域＞タグと括弧内の住所を除去
        const cleaned = firstLine
            .replace(/[＜<][^＞>]+[＞>]/g, "")
            .replace(/[\(（][^）)]{5,}[）)]/g, "")
            .trim();
        const hasMultiple = raw.split("\n").filter((l) => l.trim()).length > 1;
        const venue = cleaned.slice(0, 20).trim();
        if (venue)
            fields.push({ label: "会場", value: hasMultiple ? `${venue} 他` : venue });
    }
    // 開催期間 / 期間 / 日程（"開催期間：値" と "■開催期間\n値" の両形式に対応）
    const periodMatch = context.match(/(?:■?\s*開催期間|期間|日程)\s*[：:\n]\s*([^\n]{2,40})/);
    if (periodMatch?.[1]) {
        // 住所・詳細説明を含む長い文はスキップ
        const value = periodMatch[1].trim();
        if (value.length <= 35) {
            fields.push({ label: "期間", value });
            endAt = parseEndDateFromPeriod(value, startDate);
        }
    }
    // 期間ラベルがない場合のフォールバック:「7月16日(木)～8月9日(日)」のようなインライン範囲
    if (!endAt) {
        const localCtx = bodyText.slice(matchIndex, Math.min(bodyText.length, matchIndex + 300));
        // MM月DD日 形式のインライン範囲
        const inlineRangeRe = /[～〜~]\s*(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日/;
        const rangeM = localCtx.match(inlineRangeRe);
        if (rangeM) {
            const refYear = parseInt(startDate.slice(0, 4), 10);
            const startMo = parseInt(startDate.slice(5, 7), 10);
            const endMo = parseInt(rangeM[2], 10);
            const year = rangeM[1] ? parseInt(rangeM[1]) : (endMo < startMo ? refYear + 1 : refYear);
            const candidate = `${year}-${String(endMo).padStart(2, "0")}-${rangeM[3].padStart(2, "0")}`;
            if (candidate > startDate)
                endAt = candidate;
        }
        // MM/DD 形式のインライン範囲（上記で未検出の場合）
        if (!endAt) {
            const shortRangeRe = /[～〜~]\s*(\d{1,2})\/(\d{1,2})/;
            const shortM = localCtx.match(shortRangeRe);
            if (shortM) {
                const refYear = parseInt(startDate.slice(0, 4), 10);
                const startMo = parseInt(startDate.slice(5, 7), 10);
                const endMo = parseInt(shortM[1], 10);
                const year = endMo < startMo ? refYear + 1 : refYear;
                const candidate = `${year}-${String(endMo).padStart(2, "0")}-${shortM[2].padStart(2, "0")}`;
                if (candidate > startDate)
                    endAt = candidate;
            }
        }
    }
    // 営業時間 / 開演 / 開場 / 時間
    const timeMatch = context.match(/(?:営業時間|開演|開場|時間|OPEN|START)\s*[：:全日]*\s*([^\n]{1,25})/i);
    if (timeMatch?.[1]) {
        const value = timeMatch[1].trim();
        if (value.length <= 20)
            fields.push({ label: "時間", value });
    }
    return {
        note: fields.map((f) => `${f.label}：${f.value}`).join("\n"),
        endAt,
    };
}
/**
 * メール本文から将来のイベント日程を抽出する。
 * - YYYY年MM月DD日 / MM月DD日 の両パターンに対応
 * - 日付前後500文字にイベント系キーワードがあるものだけ採用
 * - メール受信日より過去の日付は除外
 */
function extractEventDatesFromBody(bodyText, emailReceivedAt, emailSubject, oshiId, msgId, threadId) {
    const candidates = [];
    // パターン1: YYYY年MM月DD日
    const fullDateRe = /(\d{4})年(\d{1,2})月(\d{1,2})日/g;
    let m;
    while ((m = fullDateRe.exec(bodyText)) !== null) {
        // 「7月16日(木)～2026年7月31日」のような範囲表現の終了日はスキップ
        if (isEndOfRange(bodyText, m.index))
            continue;
        const y = m[1];
        const mo = m[2];
        const d = m[3];
        const dateStr = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
        const afterSnippet = bodyText.slice(m.index + m[0].length, m.index + m[0].length + 40);
        const timeMatch = afterSnippet.match(/[\s（(]?(\d{1,2}):(\d{2})/);
        candidates.push({
            dateStr,
            time: timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : undefined,
            matchIndex: m.index,
        });
    }
    // パターン2: MM月DD日（年なし。既にフルパターンで拾った箇所はスキップ）
    const shortDateRe = /(?<!\d年\s*)(\d{1,2})月(\d{1,2})日/g;
    while ((m = shortDateRe.exec(bodyText)) !== null) {
        // 「7月16日(木)～7月31日」の終了日はスキップ
        if (isEndOfRange(bodyText, m.index))
            continue;
        const mo = m[1];
        const d = m[2];
        // フルパターンで既に拾った日付と重複していないか確認（インデックス近傍）
        const alreadyCovered = candidates.some((c) => Math.abs(c.matchIndex - m.index) < 8);
        if (alreadyCovered)
            continue;
        // 年を推定：メール受信年をそのまま使う。
        // 受信日より前の月日（例：6月受信のメルマガに「5月4日」）は
        // 過去日付として下のフィルター（todayStart比較）で除外される。
        // 年をまたぐ案内（「1月10日」など）は通常フルパターン（YYYY年MM月DD日）で
        // 書かれるためパターン1で拾われる。
        const year = emailReceivedAt.getFullYear();
        const dateStr = `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
        const afterSnippet = bodyText.slice(m.index + m[0].length, m.index + m[0].length + 40);
        const timeMatch = afterSnippet.match(/[\s（(]?(\d{1,2}):(\d{2})/);
        candidates.push({
            dateStr,
            time: timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : undefined,
            matchIndex: m.index,
        });
    }
    const CONTEXT_WINDOW = 500;
    const events = [];
    for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        if (!candidate)
            continue;
        const { dateStr, time, matchIndex } = candidate;
        // 今日より前の日付は除外（メール受信日基準ではなく今日基準にすることで、
        // 過去に配信されたメルマガに含まれる未来の予定も正しく拾える）
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        if (new Date(dateStr) < todayStart)
            continue;
        // 周辺テキストにイベントキーワードがあるかチェック
        const contextStart = Math.max(0, matchIndex - CONTEXT_WINDOW);
        const contextEnd = Math.min(bodyText.length, matchIndex + CONTEXT_WINDOW);
        const context = bodyText.slice(contextStart, contextEnd);
        if (!EVENT_KEYWORDS_RE.test(context))
            continue;
        const startAt = time ? `${dateStr}T${time}` : `${dateStr}T00:00`;
        const title = extractEventTitleFromContext(bodyText, matchIndex, emailSubject);
        const { note, endAt } = extractStructuredNote(bodyText, matchIndex, dateStr);
        events.push({
            id: `gmail-${msgId}-${i}`,
            type: "release",
            title,
            note: note || undefined,
            oshiId,
            startAt,
            endAt: endAt ? `${endAt}T23:59` : undefined,
            sourceUrl: `https://mail.google.com/mail/u/0/#inbox/${threadId}`,
            autoFetched: true,
        });
    }
    return events;
}
function parseDateHeader(dateHeader) {
    try {
        return new Date(dateHeader);
    }
    catch {
        return new Date();
    }
}
/**
 * 指定した推し（OshiProfile.newsletterSenderAddress）のメルマガから
 * 本文を解析してイベント日程の CalendarEvent を取得する。
 * @param oshiId 推しのID
 * @param senderAddress 送信元アドレス（OshiProfile.newsletterSenderAddress）
 */
export async function fetchGmailEventsForOshi(oshiId, senderAddress) {
    if (!isGmailConfigured() || !isGmailAuthorized())
        return [];
    const token = await getValidAccessToken();
    if (!token)
        return [];
    // 過去に配信されたメルマガも対象にするため取得件数を増やす（50件）
    const messages = await searchGmailMessages(`from:${senderAddress}`, 50);
    const allEvents = [];
    for (const msg of messages) {
        const full = await fetchMessageFull(msg.id, token);
        if (!full?.payload)
            continue;
        const headers = full.payload.headers ?? [];
        const subject = headers.find((h) => h.name === "Subject")?.value ?? "(件名なし)";
        const dateHeader = headers.find((h) => h.name === "Date")?.value ?? "";
        // internalDate はエポックミリ秒（文字列）。Date ヘッダより信頼性が高い
        const receivedAt = full.internalDate
            ? new Date(Number(full.internalDate))
            : parseDateHeader(dateHeader);
        const bodyText = extractTextFromPayload(full.payload);
        const extracted = extractEventDatesFromBody(bodyText, receivedAt, subject, oshiId, msg.id, msg.threadId);
        allEvents.push(...extracted);
    }
    // 同じ日時・タイトルの重複を排除（複数のメールで同じイベントが告知される場合）
    const seen = new Set();
    return allEvents.filter((ev) => {
        const key = `${ev.startAt}|${ev.title}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
/**
 * 全推しのメルマガを一括取得する。
 * 各推しに newsletterSenderAddress が設定されていない場合はスキップする。
 * onProgress(current, total) は各メール解析完了後に呼ばれる（total が 0 の場合は呼ばない）。
 */
/**
 * 認証失敗を「イベント0件」と区別するためのエラークラス。
 * syncGmailEvents 側でキャッチして既存イベントを消さないようにする。
 */
export class GmailAuthError extends Error {
    constructor() { super("Gmail認証エラー"); }
}
export async function fetchAllGmailEvents(oshiList, onProgress) {
    if (!onProgress) {
        // 進捗不要の場合は従来通り
        const results = [];
        for (const oshi of oshiList) {
            if (!oshi.newsletterSenderAddress)
                continue;
            const events = await fetchGmailEventsForOshi(oshi.id, oshi.newsletterSenderAddress);
            results.push(...events);
        }
        return results;
    }
    const pending = [];
    for (const oshi of oshiList) {
        if (!oshi.newsletterSenderAddress)
            continue;
        const msgs = await searchGmailMessages(`from:${oshi.newsletterSenderAddress}`, 50);
        pending.push(...msgs.map((m) => ({ oshiId: oshi.id, msgId: m.id, threadId: m.threadId })));
    }
    const total = pending.length;
    if (total === 0)
        return [];
    onProgress(0, total);
    // フェーズ2: メール1件ずつ解析して進捗を報告
    const token = await getValidAccessToken();
    if (!token)
        throw new GmailAuthError();
    const allEvents = [];
    for (let i = 0; i < pending.length; i++) {
        const { oshiId, msgId, threadId } = pending[i];
        const full = await fetchMessageFull(msgId, token);
        if (full?.payload) {
            const headers = full.payload.headers ?? [];
            const subject = headers.find((h) => h.name === "Subject")?.value ?? "(件名なし)";
            const dateHeader = headers.find((h) => h.name === "Date")?.value ?? "";
            const receivedAt = full.internalDate
                ? new Date(Number(full.internalDate))
                : parseDateHeader(dateHeader);
            const bodyText = extractTextFromPayload(full.payload);
            allEvents.push(...extractEventDatesFromBody(bodyText, receivedAt, subject, oshiId, msgId, threadId));
        }
        onProgress(i + 1, total);
    }
    // 重複排除
    const seen = new Set();
    return allEvents.filter((ev) => {
        const key = `${ev.startAt}|${ev.title}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
