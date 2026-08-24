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

/** מריץ אקטור וממתין לתוצאות. זורק שגיאה ברורה אם הטוקן חסר או שהריצה נכשלה. */
async function runActor(actor: string, input: unknown, timeoutMs = 240000): Promise<any[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN חסר בקובץ .env");

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
  return Array.isArray(data) ? data : [];
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
}

/** ממיר רשימת מודעות גולמית לסיכום, עם סינון לרחוב כשיש מספיק התאמות. */
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

  return {
    source,
    scope: useStreet ? "street" : "city",
    count: items.length,
    cityCount: rows.length,
    streetCount: onStreet.length,
    medianPrice: median(prices),
    medianPricePerSqm: ppsm.length ? median(ppsm) : null,
  };
}

/** יד2 — מודעות מכירה אמיתיות, כולל שם רחוב (מאפשר חיפוש מדויק). */
export async function fetchYad2(city: string, street: string, maxItems = 120): Promise<SourceResult> {
  const rows = await runActor(ACTORS.yad2, {
    city: toEnglishCity(city),
    dealType: "buy",
    maxItems,
  });
  return summarize(rows, "yad2", street, (r) => r.streetName || r.address, (r) => r.price, (r) => r.areaSqm);
}

/**
 * יד1 — פרויקטים מקבלן. אותו אקטור, adType מסמן מודעות קבלן/פרויקט;
 * אם אין כאלה נחזיר 0 ולא ניפול לרמת עיר מטעה.
 */
export async function fetchYad1(city: string, street: string, maxItems = 120): Promise<SourceResult> {
  const rows = await runActor(ACTORS.yad2, {
    city: toEnglishCity(city),
    dealType: "buy",
    maxItems,
  });
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
export async function fetchMadlan(city: string, neighbourhood?: string): Promise<MadlanAnalytics> {
  const input: Record<string, unknown> = { city: toEnglishCity(city), dataTypes: ["all"] };
  if (neighbourhood) input.neighbourhood = neighbourhood;
  const rows = await runActor(ACTORS.madlan, input);
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
export async function fetchFacebook(city: string, street: string, maxItems = 60): Promise<SourceResult> {
  // חיפוש חופשי (search/?query=) מתעלם מהמיקום ומחזיר מודעות אמריקאיות
  // בדולרים. כתובת מיקום ישראלית מחזירה מודעות בשקלים — אך הן ארציות,
  // כי רוב מפרסמי הנדל"ן בפייסבוק מכסים את כל הארץ. הסינון לעיר נעשה כאן.
  const rows = await runActor(ACTORS.facebook, {
    startUrls: [{ url: "https://www.facebook.com/marketplace/telaviv/propertyforsale" }],
    resultsLimit: maxItems,
  });
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

  // הפיד ארצי, ולכן שם העיר חייב להופיע בכותרת — אחרת החציון מערבב ערים.
  const cityName = (city || "").trim();
  const inCity = rows.filter((r) => toPrice(r) != null && (!cityName || titleOf(r).includes(cityName)));
  return summarize(inCity, "facebook", street, titleOf, toPrice, () => null);
}
