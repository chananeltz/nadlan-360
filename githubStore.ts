/**
 * אחסון מתמיד למאגר השמור, מבוסס ריפו GitHub.
 *
 * למה זה נדרש: המטמון בשרת יושב בזיכרון בלבד, ובאירוח בשכבה חינמית התהליך
 * נרדם אחרי רבע שעה ומאבד אותו. כך חיפוש חוזר של אותה עיר חויב שוב אף
 * שהנתונים כבר נשאבו. GitHub משמש כאן כמסד קבצים פשוט: כל תוצאה נשמרת
 * כקובץ JSON, ושורדת אתחולים, פריסות וכיבוי.
 *
 * ⚠️ הריפו חייב להיות **פרטי**. הנתונים הם תוצרי שאיבה של מודעות אנשים,
 * ופרסומם בריפו ציבורי היה הופך מטמון להפצת מידע. פרטים אישיים (טלפון,
 * שם מוכר) מוסרים ממילא בשלב השאיבה — ראה stripPersonalData.
 *
 * הכל כאן best-effort: תקלה באחסון לעולם לא תפיל בקשה, לכל היותר תגרום
 * לשאיבה חוזרת.
 */
import { createHash } from "crypto";

const API = "https://api.github.com";

function config() {
  const token = process.env.GITHUB_CACHE_TOKEN;
  const repo = process.env.GITHUB_CACHE_REPO; // בפורמט owner/repo
  if (!token || !repo || !repo.includes("/")) return null;
  return { token, repo, branch: process.env.GITHUB_CACHE_BRANCH || "main" };
}

export function isGithubStoreEnabled(): boolean {
  return config() !== null;
}

/** שם קובץ יציב וקצר למפתח מטמון כלשהו. */
function pathFor(key: string): string {
  const hash = createHash("sha256").update(key).digest("hex").slice(0, 32);
  return `cache/${hash}.json`;
}

async function ghFetch(path: string, init: RequestInit = {}, timeoutMs = 12000) {
  const cfg = config();
  if (!cfg) throw new Error("GitHub store לא מוגדר");
  return fetch(`${API}/repos/${cfg.repo}/contents/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export interface StoredEntry {
  at: number;
  rows: any[];
}

/** קורא רשומה שמורה. מחזיר null כשאין, כשפג תוקפה, או בכל תקלה. */
export async function readFromGithub(key: string, maxAgeMs: number): Promise<StoredEntry | null> {
  const cfg = config();
  if (!cfg) return null;
  try {
    const res = await ghFetch(`${pathFor(key)}?ref=${encodeURIComponent(cfg.branch)}`);
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const meta = await res.json();
    if (!meta?.content) return null;
    const json = Buffer.from(meta.content, "base64").toString("utf8");
    const entry = JSON.parse(json) as StoredEntry;
    if (!entry?.at || !Array.isArray(entry.rows)) return null;
    if (Date.now() - entry.at > maxAgeMs) return null;
    return entry;
  } catch {
    return null;
  }
}

/**
 * כותב רשומה. עדכון קובץ קיים דורש את ה-sha שלו, ולכן קוראים אותו קודם.
 * כישלון נבלע בכוונה — אחסון הוא אופטימיזציה, לא תנאי לתפקוד.
 */
export async function writeToGithub(key: string, rows: any[]): Promise<boolean> {
  const cfg = config();
  if (!cfg) return false;
  const path = pathFor(key);
  try {
    let sha: string | undefined;
    const head = await ghFetch(`${path}?ref=${encodeURIComponent(cfg.branch)}`);
    if (head.ok) {
      const meta = await head.json();
      sha = meta?.sha;
    }

    const payload: StoredEntry = { at: Date.now(), rows };
    const res = await ghFetch(path, {
      method: "PUT",
      body: JSON.stringify({
        message: `cache: ${key.slice(0, 60)}`,
        content: Buffer.from(JSON.stringify(payload), "utf8").toString("base64"),
        branch: cfg.branch,
        ...(sha ? { sha } : {}),
      }),
    }, 20000);

    if (!res.ok) {
      console.warn(`[github-store] כתיבה נכשלה (${res.status})`);
      return false;
    }
    return true;
  } catch (error: any) {
    console.warn("[github-store] כתיבה נכשלה:", error?.message || error);
    return false;
  }
}
