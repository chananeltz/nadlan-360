import { readFromGithub, writeToGithub, isGithubStoreEnabled } from "./githubStore";
/**
 * שאיבת מקורות מחיר-מבוקש דרך Apify — יד2 · יד1 · מדלן · פייסבוק.
 *
 * למה דרך Apify ולא מהמחשב: ליד2/מדלן יש הגנות אנטי-בוט (Radware) שחוסמות
 * דפדפן מונחה-אוטומציה, ולפייסבוק אין API רשמי ל-Marketplace כלל. Apify מריצים
 * את התשתית אצלם, ולכן: אין קאפצ'ה במחשב שלך, לא נדרשת התחברות לחשבונות שלך,
 * ואין סיכון לחסימת ה-IP או השעיית חשבון. המחשב שלך גם לא צריך להיות דלוק.
 *
 * הטוקן נשאר בשרת בלבד (process.env.APIFY_TOKEN) ולעולם לא מגיע לדפדפן.
 */

const APIFY_BASE = "https://api.apify.com/v2/acts";

const ACTORS = {
  yad2: "swerve~yad2-scraper",
  madlan: "swerve~madlan-analytics",
  facebook: "apify~facebook-marketplace-scraper",
} as const;

/**
 * האקטורים מצפים לשם עיר באנגלית. המשתמש מקליד עברית, ולכן נדרש מיפוי.
 * ערים שאינן ברשימה מועברות כמו שהן — חלק מהאקטורים מזהים גם עברית.
 */
const CITY_EN: Record<string, string> = {
  "תל אביב": "Tel Aviv", "תל אביב יפו": "Tel Aviv", "תל אביב-יפו": "Tel Aviv",
  "ירושלים": "Jerusalem", "חיפה": "Haifa", "ראשון לציון": "Rishon LeZion",
  "פתח תקווה": "Petah Tikva", "אשדוד": "Ashdod", "נתניה": "Netanya",
  "באר שבע": "Beer Sheva", "בני ברק": "Bnei Brak", "חולון": "Holon",
  "רמת גן": "Ramat Gan", "אשקלון": "Ashkelon", "רחובות": "Rehovot",
  "בת ים": "Bat Yam", "הרצליה": "Herzliya", "כפר סבא": "Kfar Saba",
  "רעננה": "Raanana", "מודיעין": "Modiin", "גבעתיים": "Givatayim",
  "הוד השרון": "Hod Hasharon", "ראש העין": "Rosh Haayin",
  "נס ציונה": "Ness Ziona", "לוד": "Lod", "רמלה": "Ramla",
  "כרמיאל": "Karmiel", "עפולה": "Afula", "טבריה": "Tiberias",
  "נהריה": "Nahariya", "אילת": "Eilat", "דימונה": "Dimona",
  "קרית גת": "Kiryat Gat", "קרית אונו": "Kiryat Ono", "יבנה": "Yavne",
  "בית שמש": "Beit Shemesh", "אור יהודה": "Or Yehuda", "צפת": "Safed",
};

export function toEnglishCity(city: string): string {
  const clean = (city || "").trim();
  return CITY_EN[clean] || clean;
}

/** משווה שם רחוב אחרי הסרת "רחוב"/"רח׳", פסיקים ומספר בית. */
function normStreet(s: unknown): string {
  return String(s || "")
    .replace(/רח['׳]?\s*/g, "")
    .replace(/רחוב\s*/g, "")
    .replace(/[",]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function streetMatches(itemStreet: unknown, query: string): boolean {
  const name = normStreet(query).replace(/\d+.*$/, "").trim();
  if (name.length < 2) return false;
  return normStreet(itemStreet).includes(name);
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/**
 * מטמון תוצאות — החיסכון העיקרי בעלות.
 *
 * כל קריאה ל-Apify עולה כסף, ומחירי נדל"ן אינם משתנים תוך שעות. שמירת
 * התוצאה לכל צירוף (אקטור + קלט) הופכת חיפוש חוזר באותה עיר לחינמי לגמרי.
 * המטמון בזיכרון בלבד: הוא מתאפס בהפעלה מחדש של השרת, וזה מקובל — לכל
 * היותר נשלם שוב על החיפוש הראשון.
 */
/**
 * חודש. ארוך בכוונה: שאיבה עולה כסף, ומחירי נדל"ן זזים לאט. עדיף להציג
 * נתון בן שבועיים בחינם מאשר לחייב שוב על אותה עיר — ובכל מקרה יש כפתור
 * "רענן" למי שרוצה נתון טרי עכשיו.
 */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // חודש
const MAX_CACHE_ENTRIES = 300; // תקרה כדי שהזיכרון לא יגדל ללא הגבלה

interface CacheEntry {
  at: number;
  rows: any[];
}
const resultCache = new Map<string, CacheEntry>();

/** מנקה רשומות שפג תוקפן, ואם עדיין צפוף — מוחק את הישנות ביותר. */
function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of resultCache) {
    if (now - entry.at > CACHE_TTL_MS) resultCache.delete(key);
  }
  if (resultCache.size <= MAX_CACHE_ENTRIES) return;
  const byAge = [...resultCache.entries()].sort((a, b) => a[1].at - b[1].at);
  for (const [key] of byAge.slice(0, resultCache.size - MAX_CACHE_ENTRIES)) {
    resultCache.delete(key);
  }
}

/**
 * מסיר פרטים אישיים של מפרסמים לפני עיבוד ואחסון.
 *
 * מודעות יד2 מגיעות עם טלפון ושם של המוכר, ופייסבוק עם פרטי מוכר. האתר
 * אינו מציג אותם ואינו זקוק להם, ואחסונם — במיוחד מחוץ לשרת — היה הופך
 * שמירת מטמון לפרסום מידע אישי של אנשים אמיתיים. מוסרים אותם במקור.
 */
const PERSONAL_FIELDS = [
  "contactPhone",
  "contactName",
  "phone",
  "sellerName",
  "seller",
  "userName",
  "profileUrl",
  "actorId",
  "listingVideo",
];

function stripPersonalData<T extends Record<string, any>>(row: T): T {
  if (!row || typeof row !== "object") return row;
  const clean: Record<string, any> = { ...row };
  for (const f of PERSONAL_FIELDS) delete clean[f];
  return clean as T;
}

/** נזרקת כשהתבקש מטמון בלבד ואין רשומה מתאימה — כדי להבדיל מכשל אמיתי. */
export class CacheMissError extends Error {
  constructor(actor: string) {
    super(`אין נתונים שמורים עבור ${actor}`);
    this.name = "CacheMissError";
  }
}

/**
 * מריץ אקטור וממתין לתוצאות.
 * cacheOnly=true מחזיר רק מהמטמון ולעולם לא פונה ל-Apify — כך שכשנגמר
 * הקרדיט עדיין אפשר להציג את מה שכבר נשאב, במקום מסך ריק.
 */
async function runActor(
  actor: string,
  input: unknown,
  timeoutMs = 240000,
  cacheOnly = false,
): Promise<any[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token && !cacheOnly) throw new Error("APIFY_TOKEN חסר בקובץ .env");

  const cacheKey = `${actor}|${JSON.stringify(input)}`;
  const cached = resultCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    const ageMin = Math.round((Date.now() - cached.at) / 60000);
    console.log(`[apify] מטמון: ${actor} (גיל ${ageMin} דק׳) — לא חויב`);
    return cached.rows;
  }
  // המטמון בזיכרון מת עם כל אתחול של השרת. לפני שמשלמים על שאיבה,
  // בודקים את האחסון המתמיד — שם התוצאה שורדת אתחולים ופריסות.
  if (isGithubStoreEnabled()) {
    const stored = await readFromGithub(cacheKey, CACHE_TTL_MS);
    if (stored) {
      resultCache.set(cacheKey, { at: stored.at, rows: stored.rows });
      const ageH = Math.round((Date.now() - stored.at) / 3600000);
      console.log(`[apify] אחסון מתמיד: ${actor} (גיל ${ageH} ש׳) — לא חויב`);
      return stored.rows;
    }
  }

  if (cacheOnly) throw new CacheMissError(actor);

  const url = `${APIFY_BASE}/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;

  // ה-DNS של api.apify.com מחזיר כמה כתובות ולא כולן מגיבות, מה שמייצר
  // UND_ERR_CONNECT_TIMEOUT אקראי. ניסיון חוזר בוחר כתובת אחרת ופותר את זה.
  let res: Response | null = null;
  let lastErr: any = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(timeoutMs),
      });
      break;
    } catch (err: any) {
      lastErr = err;
      // חריגה מהתקציב הכולל אינה תקלת רשת חולפת — אין טעם לנסות שוב.
      if (err?.name === "TimeoutError") break;
      if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
  if (!res) {
    const cause = lastErr?.cause?.code || lastErr?.cause?.message || lastErr?.cause || "";
    throw new Error(
      `חיבור ל-Apify נכשל (${actor}): ${lastErr?.name || ""} ${lastErr?.message || ""} ${cause}`.trim(),
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Apify ${actor} החזיר ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const rows = (Array.isArray(data) ? data : []).map(stripPersonalData);

  // שומרים גם תוצאה ריקה: אם המקור לא מכסה את העיר, אין טעם לשלם על
  // אותה תשובה שוב ושוב באותו יום.
  resultCache.set(cacheKey, { at: Date.now(), rows });
  pruneCache();
  console.log(`[apify] חויב: ${actor} — ${rows.length} תוצאות`);

  // כתיבה ברקע: אין סיבה להשהות את התשובה למשתמש בשביל שמירה.
  if (isGithubStoreEnabled() && rows.length > 0) {
    writeToGithub(cacheKey, rows).catch(() => {});
  }

  return rows;
}

/** מודעה בודדת, כדי שאפשר יהיה להציג רשימה לפי תאריך ולא רק חציון. */
export interface SourceListing {
  source: string;
  price: number;
  sqm: number | null;
  pricePerSqm: number | null;
  rooms: number | null;
  floor: number | null;
  street: string;
  neighbourhood: string;
  /** תאריך פרסום המודעה (YYYY-MM-DD). ריק כשהמקור אינו מספק אותו. */
  date: string;
  url: string;
  title: string;
  isAgent: boolean;
}

export interface SourceResult {
  source: string;
  /** "street" = סונן לרחוב המבוקש · "city" = רמת עיר. */
  scope: "street" | "city";
  count: number;
  cityCount: number;
  streetCount: number;
  medianPrice: number;
  medianPricePerSqm: number | null;
  /** המודעות עצמן, ממוינות מהחדשה לישנה. */
  listings: SourceListing[];
}

/** ממיר רשימת מודעות גולמית לסיכום, עם סינון לרחוב כשיש מספיק התאמות. */
/** מנרמל תאריך פרסום לפורמט YYYY-MM-DD; מחזיר ריק כשאין תאריך תקין. */
function toDateStr(value: unknown): string {
  if (!value) return "";
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function summarize(
  rows: any[],
  source: string,
  street: string,
  getStreet: (r: any) => unknown,
  getPrice: (r: any) => number | null,
  getSqm: (r: any) => number | null,
): SourceResult {
  const onStreet = street ? rows.filter((r) => streetMatches(getStreet(r), street)) : [];
  // פחות מ-3 התאמות ברחוב אינו מדגם — נופלים לרמת עיר ומסמנים זאת.
  const useStreet = onStreet.length >= 3;
  const items = useStreet ? onStreet : rows;

  const prices = items.map(getPrice).filter((n): n is number => !!n && n > 0);
  const ppsm = items
    .map((r) => {
      const p = getPrice(r);
      const a = getSqm(r);
      return p && a && a > 0 ? Math.round(p / a) : null;
    })
    .filter((n): n is number => n != null);

  // המודעות עצמן — ממוינות מהחדשה לישנה. מודעה ללא תאריך יורדת לסוף,
  // כדי שהמיון לא ייראה שרירותי.
  const listings: SourceListing[] = items
    .map((r) => {
      const price = getPrice(r);
      if (!price) return null;
      const sqm = getSqm(r);
      return {
        source,
        price,
        sqm: sqm ?? null,
        pricePerSqm: sqm && sqm > 0 ? Math.round(price / sqm) : null,
        rooms: r.rooms != null && !Number.isNaN(Number(r.rooms)) ? Number(r.rooms) : null,
        floor: r.floor != null && !Number.isNaN(Number(r.floor)) ? Number(r.floor) : null,
        street: String(getStreet(r) ?? "").slice(0, 80),
        neighbourhood: String(r.neighbourhood ?? "").slice(0, 60),
        date: toDateStr(r.publishedAt ?? r.updatedAt ?? r.creation_time),
        url: String(r.url ?? r.listingUrl ?? ""),
        title: String(r.listingDescription ?? r.marketplace_listing_title ?? r.title ?? "").slice(0, 120),
        isAgent: !!(r.hasAgent || r.agencyName),
      } as SourceListing;
    })
    .filter((x): x is SourceListing => x !== null)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return {
    source,
    scope: useStreet ? "street" : "city",
    count: items.length,
    cityCount: rows.length,
    streetCount: onStreet.length,
    medianPrice: median(prices),
    medianPricePerSqm: ppsm.length ? median(ppsm) : null,
    listings,
  };
}

/** יד2 — מודעות מכירה אמיתיות, כולל שם רחוב (מאפשר חיפוש מדויק). */
export async function fetchYad2(
  city: string,
  street: string,
  maxItems = 120,
  cacheOnly = false,
): Promise<SourceResult> {
  const rows = await runActor(
    ACTORS.yad2,
    { city: toEnglishCity(city), dealType: "buy", maxItems },
    240000,
    cacheOnly,
  );
  return summarize(rows, "yad2", street, (r) => r.streetName || r.address, (r) => r.price, (r) => r.areaSqm);
}

/**
 * יד1 — פרויקטים מקבלן. אותו אקטור, adType מסמן מודעות קבלן/פרויקט;
 * אם אין כאלה נחזיר 0 ולא ניפול לרמת עיר מטעה.
 */
export async function fetchYad1(
  city: string,
  street: string,
  maxItems = 120,
  cacheOnly = false,
): Promise<SourceResult> {
  const rows = await runActor(
    ACTORS.yad2,
    { city: toEnglishCity(city), dealType: "buy", maxItems },
    240000,
    cacheOnly,
  );
  const fromDeveloper = rows.filter(
    (r) => r.adType === "project" || r.adType === "agency" || r.hasAgent === true,
  );
  return summarize(fromDeveloper, "yad1", street, (r) => r.streetName || r.address, (r) => r.price, (r) => r.areaSqm);
}

export interface MadlanAnalytics {
  source: "madlan";
  cityHebrew: string | null;
  pricePerSqm: number | null;
  yearlyDeals: number | null;
  bulletinsForSale: number | null;
  bulletinsForRent: number | null;
  socioeconomicIndex: number | null;
  pricesByRooms: { rooms: string; medianBuyPrice: number | null; previousBuyPrice: number | null }[];
  /** שינוי שנתי משוקלל באחוזים — מחושב מהחציונים הנוכחיים מול הקודמים. */
  yearlyChangePct: number | null;
}

/** מדלן — אנליטיקה עירונית מה-GraphQL הציבורי שלהם (ללא עקיפת הגנות). */
export async function fetchMadlan(
  city: string,
  neighbourhood?: string,
  cacheOnly = false,
): Promise<MadlanAnalytics> {
  const input: Record<string, unknown> = { city: toEnglishCity(city), dataTypes: ["all"] };
  if (neighbourhood) input.neighbourhood = neighbourhood;
  const rows = await runActor(ACTORS.madlan, input, 240000, cacheOnly);
  const d = rows[0] || {};

  const byRooms = Array.isArray(d.pricesByRooms) ? d.pricesByRooms : [];
  const withBoth = byRooms.filter((r: any) => r.medianBuyPrice > 0 && r.previousBuyPrice > 0);
  const yearlyChangePct = withBoth.length
    ? Math.round(
        (withBoth.reduce((s: number, r: any) => s + (r.medianBuyPrice / r.previousBuyPrice - 1), 0) /
          withBoth.length) *
          1000,
      ) / 10
    : null;

  return {
    source: "madlan",
    cityHebrew: d.cityHebrew ?? null,
    pricePerSqm: d.pricePerSqm ?? null,
    yearlyDeals: d.yearlyDeals ?? null,
    bulletinsForSale: d.bulletinsForSale ?? null,
    bulletinsForRent: d.bulletinsForRent ?? null,
    socioeconomicIndex: d.demographics?.socioeconomicIndex ?? d.demographicIndex ?? null,
    pricesByRooms: byRooms.map((r: any) => ({
      rooms: String(r.rooms ?? ""),
      medianBuyPrice: r.medianBuyPrice ?? null,
      previousBuyPrice: r.previousBuyPrice ?? null,
    })),
    yearlyChangePct,
  };
}

/**
 * פייסבוק Marketplace — אין API רשמי, ולכן דרך Apify בלבד.
 * הערה: התוצאות עשויות לכלול פרטים אישיים של מוכרים; אנחנו שומרים רק
 * מחיר/שטח/כותרת לצורך החציון, ולא שם או קשר.
 */
export async function fetchFacebook(
  city: string,
  street: string,
  maxItems = 140,
  cacheOnly = false,
): Promise<SourceResult> {
  // חיפוש חופשי (search/?query=) מתעלם מהמיקום ומחזיר מודעות אמריקאיות
  // בדולרים. כתובת מיקום ישראלית מחזירה מודעות בשקלים — אך הן ארציות,
  // כי רוב מפרסמי הנדל"ן בפייסבוק מכסים את כל הארץ. הסינון לעיר נעשה כאן.
  const rows = await runActor(
    ACTORS.facebook,
    {
      startUrls: [{ url: "https://www.facebook.com/marketplace/telaviv/propertyforsale" }],
      resultsLimit: maxItems,
    },
    240000,
    cacheOnly,
  );
  // חיפוש חופשי ב-Marketplace מחזיר גם רהיטים ורכבים, שמושכים את החציון
  // מטה עד לחוסר משמעות. שומרים רק פריטים שגם נראים כמו דירה בכותרת וגם
  // מתומחרים בטווח דירות סביר.
  const HOME_WORDS = /דירה|דירת|פנטהאוז|פנטהאוס|קוטג|וילה|בית פרטי|יחידת דיור|נכס|חדרים|חד['׳]/;
  const MIN_HOME_PRICE = 500_000; // מתחת לזה: מבנים ניידים, מגרשים חקלאיים ותקלות תמחור
  const MAX_HOME_PRICE = 40_000_000;

  const titleOf = (r: any) => String(r.marketplace_listing_title ?? r.title ?? r.custom_title ?? r.name ?? "");
  const toPrice = (r: any) => {
    const lp = r.listing_price;
    const raw = (lp && typeof lp === "object" ? lp.formatted_amount ?? lp.amount : lp) ?? r.price;
    const n = parseInt(String(raw ?? "").replace(/[^\d]/g, ""), 10);
    if (Number.isNaN(n) || n < MIN_HOME_PRICE || n > MAX_HOME_PRICE) return null;
    return HOME_WORDS.test(titleOf(r)) ? n : null;
  };

  /**
   * הפיד ארצי, ולכן חייבים לסנן לעיר — אחרת החציון מערבב ערים ואיננו אומר כלום.
   * ההשוואה סלחנית: פייסבוק כתובה בשפה חופשית ("ת״א", "תל אביב יפו", "רמת-גן"),
   * והשוואה מדויקת פספסה מודעות אמיתיות והחזירה רשימה ריקה.
   */
  const cityName = (city || "").trim();
  const cityAliases = new Set<string>([cityName]);
  const noHyphen = cityName.replace(/[-־]/g, " ");
  cityAliases.add(noHyphen);
  if (/^תל אביב/.test(noHyphen)) ["תל אביב", "תל-אביב", "ת\"א", "תא"].forEach((a) => cityAliases.add(a));
  // "רמת גן" צריך להימצא גם ב"רמת-גן"; משווים מול טקסט מנורמל.
  const normalize = (t: string) => t.replace(/[-־]/g, " ").replace(/\s+/g, " ");

  const matchesCity = (r: any) => {
    if (!cityName) return true;
    const t = normalize(titleOf(r));
    for (const alias of cityAliases) if (alias && t.includes(normalize(alias))) return true;
    // המיקום שפייסבוק מדווח עליו, כשקיים, אמין יותר מהכותרת.
    const loc = r.location?.reverse_geocode?.city || r.location?.text || "";
    return !!loc && normalize(String(loc)).includes(normalize(cityName));
  };

  const inCity = rows.filter((r) => toPrice(r) != null && matchesCity(r));
  return summarize(inCity, "facebook", street, titleOf, toPrice, () => null);
}
