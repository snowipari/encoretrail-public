// oshiUtils.ts
// 推しプロフィールに関する純粋関数群。DOMにもlocalStorageにも依存しない。
/**
 * 推し始めた日から今日までの日数（推し歴）を返す。
 * anniversaryDate が未設定の場合は null を返す。
 */
export function daysAsFan(anniversaryDate, today) {
    if (!anniversaryDate)
        return null;
    const start = new Date(`${anniversaryDate}T00:00:00`);
    const now = new Date(`${today}T00:00:00`);
    const diff = Math.round((now.getTime() - start.getTime()) / 86_400_000);
    return diff >= 0 ? diff : null;
}
/**
 * 誕生日から今日まで何日後（または何日前）かを返す。
 * birthday が未設定の場合は null を返す。
 * 今年の誕生日が過ぎていれば来年の誕生日までの日数を返す。
 */
export function daysUntilBirthday(birthday, today) {
    if (!birthday)
        return null;
    const todayDate = new Date(`${today}T00:00:00`);
    const year = todayDate.getFullYear();
    const mmdd = birthday.slice(5); // "MM-DD"
    let candidate = new Date(`${year}-${mmdd}T00:00:00`);
    if (candidate.getTime() < todayDate.getTime()) {
        candidate = new Date(`${year + 1}-${mmdd}T00:00:00`);
    }
    return Math.round((candidate.getTime() - todayDate.getTime()) / 86_400_000);
}
/**
 * 指定した日数以内に誕生日または推し記念日が来る推しの一覧を返す。
 * 今日が当日（daysUntil === 0）も含む。結果は日付が近い順にソートする。
 */
export function getUpcomingAnniversaries(profiles, today, daysAhead = 7) {
    const result = [];
    const thisYear = new Date(`${today}T00:00:00`).getFullYear();
    for (const p of profiles) {
        if (p.birthday) {
            const d = daysUntilBirthday(p.birthday, today);
            if (d !== null && d <= daysAhead) {
                result.push({ oshiId: p.id, oshiName: p.name, type: "birthday", daysUntil: d });
            }
        }
        if (p.anniversaryDate) {
            const d = daysUntilBirthday(p.anniversaryDate, today); // 毎年繰り返す点でbirthday と同ロジック
            if (d !== null && d <= daysAhead) {
                // 何周年になるかを計算。今日が記念日より前か後かで対象年が変わる
                const mmdd = p.anniversaryDate.slice(5);
                const anniversaryThisYear = `${thisYear}-${mmdd}`;
                const upcomingYear = today > anniversaryThisYear ? thisYear + 1 : thisYear;
                const startYear = Number(p.anniversaryDate.slice(0, 4));
                const yearsCount = upcomingYear - startYear;
                result.push({
                    oshiId: p.id,
                    oshiName: p.name,
                    type: "anniversary",
                    daysUntil: d,
                    yearsCount: yearsCount >= 1 ? yearsCount : undefined,
                });
            }
        }
    }
    return result.sort((a, b) => a.daysUntil - b.daysUntil);
}
/** 推し歴の日数を「推してX年Yヶ月」形式の文字列に整形する */
export function formatDaysAsFan(days) {
    if (days === 0)
        return "推し始めた日";
    const totalMonths = Math.floor((days * 12) / 365); // 365日=12ヶ月として計算
    if (totalMonths < 1)
        return `推して${days}日`;
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    if (years === 0)
        return `推して${months}ヶ月`;
    return `推して${years}年${months}ヶ月`;
}
