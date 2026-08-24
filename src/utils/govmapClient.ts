/**
 * לקוח נתוני נדל"ן אמיתי — GovMap (govmap.gov.il) / רשות המסים.
 *
 * מושך עסקאות נדל"ן אמיתיות לפי כתובת (עיר + רחוב) ממאגר הנתונים הממשלתי,
 * מסנן לפי רדיוס/תאריך, ומחשב סטטיסטיקה (ממוצע, חציון, מחיר למ"ר).
 *
 * החוזה מבוסס על ה-API הציבורי של GovMap. שים לב: ה-API מוגבל בקצב
 * (rate-limited) ולא רשמי — ייתכנו שינויים בצד השרת של govmap.
 *
 * הזרימה:
 *   1. autocompleteAddress  → ממיר "רחוב עיר" לקואורדינטות ITM.
 *   2. getDealsByRadius     → מחזיר polygon_id של רחובות/שכונות סמוכים.
 *   3. getStreetDeals / getNeighborhoodDeals → עסקאות אמיתיות לכל polygon.
 *   4. findRecentDealsForAddress → מאחד, מסנן, ממיין ומחזיר עסקאות.
 */

const BASE_URL = "https://www.govmap.gov.il/api";
const USER_AGENT = "Nadlan360/1.0 (+market-survey)";

// ---- טיפוסים ----

export interface RawDeal {
  objectid: number;
  dealAmount: number; // מחיר בש"ח
  dealDate: string; // תאריך עסקה
  assetArea?: number; // שטח במ"ר
  settlementNameHeb?: string; // עיר
  propertyTypeDescription?: string; // סוג נכס (דירה, בית...)
  neighborhood?: string;
  streetName?: string;
  streetNameHeb?: string;
  houseNumber?: string;
  houseNum?: string;
  floor?: string;
  floorNo?: string; // תיאור קומה בעברית, למשל "קומה 3"
  floorNumber?: number;
  assetRoomNum?: number; // מספר חדרים
  dealNatureDescription?: string;
  shape?: string;
}

export interface Deal {
  objectid: number;
  price: number;
  date: string; // YYYY-MM-DD
  sqm: number | null;
  pricePerSqm: number | null;
  rooms: number | null;
  floor: number | null;
  city: string;
  neighborhood: string;
  street: string;
  houseNumber: string;
  propertyType: string;
  source: "same_building" | "street" | "neighborhood";
  distanceMeters: number;
}

interface PolygonMeta {
  polygon_id: string;
  distance: number;
  raw: any;
}

export interface DealStatistics {
  count: number;
  meanPrice: number;
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
  meanPricePerSqm: number | null;
  medianPricePerSqm: number | null;
  byRooms: Record<string, { count: number; medianPrice: number; medianPricePerSqm: number | null }>;
  dateRange: { from: string; to: string } | null;
}

// ---- עזרי רשת ----

async function postJson(url: string, body: any, timeoutMs = 30000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(url: string, timeoutMs = 30000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ריטריי עם השהיה מעריכית + הגבלת קצב עדינה
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        const wait = Math.min(1000 * 2 ** attempt, 8000);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastErr;
}

// ---- ITM helpers ----

// הקואורדינטות מ-GovMap הן Web Mercator (EPSG:3857). בקו הרוחב של ישראל
// (~31.8°) מטר מרקטור מנופח פי ~1/cos(31.8°). מכפלה ב-cos מחזירה מטרים אמיתיים.
const MERCATOR_TO_METERS = Math.cos((31.8 * Math.PI) / 180); // ≈ 0.85

/** מרחק אמיתי במטרים בין שתי נקודות Web Mercator. */
function distanceMeters(a: [number, number], b: [number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy) * MERCATOR_TO_METERS;
}

/** מפענח "POINT(lon lat)" לקואורדינטות ITM. */
function parsePoint(shape?: string): [number, number] | null {
  if (!shape || !shape.startsWith("POINT(")) return null;
  const inner = shape.slice(6, -1).trim().split(/\s+/);
  if (inner.length !== 2) return null;
  const x = parseFloat(inner[0]);
  const y = parseFloat(inner[1]);
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  return [x, y];
}

/** מרכז משוער של MULTIPOLYGON/POLYGON — ממוצע הקואורדינטות הראשונות. */
function shapeCentroid(shape?: string): [number, number] | null {
  if (!shape) return null;
  const nums = shape.match(/-?\d+\.?\d*/g);
  if (!nums || nums.length < 2) return null;
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    sx += parseFloat(nums[i]);
    sy += parseFloat(nums[i + 1]);
    n++;
  }
  if (n === 0) return null;
  return [sx / n, sy / n];
}

// ---- API calls ----

export interface AutocompleteMatch {
  text: string;
  type: string;
  score: number;
  point: [number, number] | null;
}

/** ממיר טקסט כתובת חופשי לרשימת התאמות עם קואורדינטות ITM. */
export async function autocompleteAddress(searchText: string): Promise<AutocompleteMatch[]> {
  const url = `${BASE_URL}/search-service/autocomplete`;
  const payload = { searchText, language: "he", isAccurate: false, maxResults: 10 };
  const data = await withRetry(() => postJson(url, payload));
  const results = Array.isArray(data?.results) ? data.results : [];
  return results.map((r: any) => ({
    text: r.text || "",
    type: r.type || "",
    score: r.score || 0,
    point: parsePoint(r.shape),
  }));
}

/** מחזיר metadata של פוליגונים (רחובות/שכונות) ברדיוס נתון סביב נקודה. */
export async function getDealsByRadius(
  point: [number, number],
  radius = 50,
): Promise<any[]> {
  const url = `${BASE_URL}/real-estate/deals/${point[0]},${point[1]}/${radius}`;
  const data = await withRetry(() => getJson(url));
  return Array.isArray(data) ? data : [];
}

async function getPolygonDeals(
  kind: "street-deals" | "neighborhood-deals",
  polygonId: string,
  opts: { limit?: number; dealType?: number; startDate?: string; endDate?: string },
): Promise<RawDeal[]> {
  const params = new URLSearchParams();
  params.set("limit", String(opts.limit ?? 100));
  params.set("dealType", String(opts.dealType ?? 2));
  if (opts.startDate) params.set("startDate", opts.startDate);
  if (opts.endDate) params.set("endDate", opts.endDate);
  const url = `${BASE_URL}/real-estate/${kind}/${polygonId}?${params.toString()}`;
  const data = await withRetry(() => getJson(url));
  if (Array.isArray(data)) return data as RawDeal[];
  if (data && Array.isArray(data.data)) return data.data as RawDeal[];
  return [];
}

// ---- נירמול ----

/** מחלץ מספר קומה מתיאור עברי כמו "קומה 3" או "קומה -1, קומה 0". */
function parseFloor(raw: RawDeal): number | null {
  if (raw.floorNumber != null && !Number.isNaN(Number(raw.floorNumber))) {
    return Number(raw.floorNumber);
  }
  const txt = raw.floorNo || raw.floor;
  if (!txt) return null;
  const m = String(txt).match(/-?\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function normalizeDeal(raw: RawDeal, source: Deal["source"], distance: number): Deal | null {
  const price = Number(raw.dealAmount) || 0;
  if (!price) return null;
  const sqm = raw.assetArea ? Number(raw.assetArea) : null;
  const date = (raw.dealDate || "").split("T")[0];
  return {
    objectid: raw.objectid,
    price,
    date,
    sqm,
    pricePerSqm: sqm && sqm > 0 ? Math.round(price / sqm) : null,
    rooms: raw.assetRoomNum != null ? Number(raw.assetRoomNum) : null,
    floor: parseFloor(raw),
    city: raw.settlementNameHeb || "",
    neighborhood: raw.neighborhood || "",
    street: raw.streetNameHeb || raw.streetName || "",
    houseNumber: String(raw.houseNum || raw.houseNumber || ""),
    propertyType: raw.propertyTypeDescription || raw.dealNatureDescription || "",
    source,
    distanceMeters: Math.round(distance),
  };
}

// ---- גוש וחלקה ----

/**
 * מזהה קלט של גוש/חלקה ומחזיר אותו בפורמט ש-GovMap מבין.
 * נתמך: "גוש 6638 חלקה 45", "6638/45", "6638 45".
 * מחזיר null אם זו לא נראית בקשת גוש/חלקה — ואז מטופל ככתובת רגילה.
 */
export function parseGushHelka(input: string): { gush: number; helka: number; query: string } | null {
  const t = (input || "").trim();
  if (!t) return null;

  const labeled = t.match(/גוש\s*(\d{1,6})\D+(?:חלקה\s*)?(\d{1,5})/);
  const slashed = t.match(/^(\d{3,6})\s*[\/\-\s]\s*(\d{1,5})$/);
  const m = labeled || slashed;
  if (!m) return null;

  const gush = parseInt(m[1], 10);
  const helka = parseInt(m[2], 10);
  if (!gush || !helka) return null;
  return { gush, helka, query: `גוש ${gush} חלקה ${helka}` };
}

/** מאתר עסקאות רשות המסים סביב גוש/חלקה. רדיוס צר — החלקה היא נקודה מדויקת. */
export async function findDealsByGushHelka(
  gushHelka: { gush: number; helka: number; query: string },
  options: FindDealsOptions = {},
): Promise<Deal[]> {
  return findRecentDealsForAddress(gushHelka.query, {
    radius: 200,
    ...options,
  });
}

// ---- הזרימה המרכזית ----

export interface FindDealsOptions {
  yearsBack?: number;
  radius?: number;
  maxDeals?: number;
  dealType?: number; // 1=חדש מקבלן, 2=יד שנייה
  maxPolygons?: number;
}

/**
 * מוצא עסקאות נדל"ן אמיתיות עבור כתובת (עיר + רחוב).
 * זהו הפונקציה המרכזית: כתובת → קואורדינטות → פוליגונים → עסקאות.
 */
export async function findRecentDealsForAddress(
  address: string,
  options: FindDealsOptions = {},
): Promise<Deal[]> {
  const yearsBack = options.yearsBack ?? 2;
  const radius = options.radius ?? 300;
  const maxDeals = options.maxDeals ?? 100;
  const dealType = options.dealType ?? 2;
  const maxPolygons = options.maxPolygons ?? 12;

  const matches = await autocompleteAddress(address);
  if (matches.length === 0) {
    throw new Error(`לא נמצאה כתובת תואמת עבור: ${address}`);
  }

  // רדיוס השאילתה ל-API הוא ביחידות מרקטור (מנופח). הסינון המדויק בהמשך
  // נעשה במטרים אמיתיים דרך distanceMeters.
  const apiRadius = Math.round(radius / MERCATOR_TO_METERS);

  // מנסים את 3 ההתאמות הטובות עד שנמצא פוליגונים סמוכים
  let point: [number, number] | null = null;
  let polygons: any[] = [];
  for (const m of matches.slice(0, 3)) {
    if (!m.point) continue;
    const found = await getDealsByRadius(m.point, apiRadius);
    if (found.length) {
      point = m.point;
      polygons = found;
      break;
    }
  }
  // הרחבת רדיוס אם לא נמצא
  if (!polygons.length) {
    for (const m of matches.slice(0, 3)) {
      if (!m.point) continue;
      const found = await getDealsByRadius(m.point, Math.round(600 / MERCATOR_TO_METERS));
      if (found.length) {
        point = m.point;
        polygons = found;
        break;
      }
    }
  }
  if (!point) {
    const first = matches.find((m) => m.point);
    if (!first?.point) throw new Error("לא התקבלו קואורדינטות עבור הכתובת");
    point = first.point;
  }

  // דה-דופ פוליגונים לפי polygon_id, ממוינים לפי מרחק
  const polyMap = new Map<string, PolygonMeta>();
  for (const meta of polygons) {
    const id = meta.polygon_id != null ? String(meta.polygon_id) : null;
    if (!id) continue;
    const centroid = shapeCentroid(meta.shape) || point;
    const dist = distanceMeters(point, centroid);
    const existing = polyMap.get(id);
    if (!existing || dist < existing.distance) {
      polyMap.set(id, { polygon_id: id, distance: dist, raw: meta });
    }
  }
  const polyList = Array.from(polyMap.values())
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxPolygons);

  // טווח תאריכים
  const now = new Date(); // מותר כאן — קוד שרת רץ בזמן אמת
  const from = new Date(now);
  // נספר בחודשים ולא בשנים, כדי לתמוך בחצאי שנים (0.5 → 6 חודשים).
  from.setMonth(now.getMonth() - Math.round(yearsBack * 12));
  const startDate = from.toISOString().slice(0, 7);
  const endDate = now.toISOString().slice(0, 7);

  const searchAddr = address.toLowerCase().trim();
  const seen = new Set<string>();
  const collected: Deal[] = [];

  for (const poly of polyList) {
    if (collected.length >= maxDeals) break;
    try {
      const streetRaw = await getPolygonDeals("street-deals", poly.polygon_id, {
        limit: Math.max(1, Math.floor(maxDeals / 2)),
        dealType,
        startDate,
        endDate,
      });
      for (const raw of streetRaw) {
        const key = `${raw.objectid}_${raw.dealDate}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const centroid = parsePoint(raw.shape) || shapeCentroid(raw.shape) || point;
        const dist = distanceMeters(point, centroid);
        const street = (raw.streetNameHeb || raw.streetName || "").toLowerCase().trim();
        const house = String(raw.houseNum || raw.houseNumber || "").trim();
        const dealAddr = `${street} ${house}`.trim();
        const sameBuilding = dealAddr.length > 0 && searchAddr.includes(street) && !!house && searchAddr.includes(house);
        const d = normalizeDeal(raw, sameBuilding ? "same_building" : "street", dist);
        if (d) collected.push(d);
      }

      if (collected.length < maxDeals) {
        const hoodRaw = await getPolygonDeals("neighborhood-deals", poly.polygon_id, {
          limit: Math.max(1, Math.floor(maxDeals / 4)),
          dealType,
          startDate,
          endDate,
        });
        for (const raw of hoodRaw) {
          const key = `${raw.objectid}_${raw.dealDate}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const centroid = parsePoint(raw.shape) || shapeCentroid(raw.shape) || point;
          const dist = distanceMeters(point, centroid);
          const d = normalizeDeal(raw, "neighborhood", dist);
          if (d) collected.push(d);
        }
      }
    } catch {
      // דילוג על פוליגון שנכשל, ממשיכים לבא
      continue;
    }
  }

  // סינון לפי רדיוס (עסקאות באותו בניין תמיד נכללות)
  const priorityOf = (s: Deal["source"]) => (s === "same_building" ? 0 : s === "street" ? 1 : 2);
  const filtered = collected.filter(
    (d) => d.source === "same_building" || d.distanceMeters <= radius,
  );

  // מיון: עדיפות → מרחק → תאריך (חדש קודם)
  filtered.sort((a, b) => {
    const p = priorityOf(a.source) - priorityOf(b.source);
    if (p !== 0) return p;
    if (a.distanceMeters !== b.distanceMeters) return a.distanceMeters - b.distanceMeters;
    return (b.date || "").localeCompare(a.date || "");
  });

  return filtered.slice(0, maxDeals);
}

// ---- סטטיסטיקה ----

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
}

// ---- מקורות מחיר-מבוקש (יד2 · יד1 · מדלן · פייסבוק דרך השרת) ----

/**
 * הכתובת של ה-API. ריק = אותו מקור של האתר (פיתוח מקומי / הגשה מהשרת).
 * באתר סטטי (GitHub Pages) יש להצביע על השרת המאוחסן דרך VITE_API_URL.
 */
const API_BASE = (import.meta as any).env?.VITE_API_URL || "";

/** מודעה בודדת ממקור מחיר-מבוקש, להצגה ברשימה לפי תאריך. */
export interface SourceListing {
  source: string;
  price: number;
  sqm: number | null;
  pricePerSqm: number | null;
  rooms: number | null;
  floor: number | null;
  street: string;
  neighbourhood: string;
  date: string;
  url: string;
  title: string;
  isAgent: boolean;
}

export interface BridgeResult {
  source: string;
  /** "street" = סונן לרחוב המבוקש · "city" = רמת עיר (לא נמצאו מספיק ברחוב). */
  scope?: "street" | "city";
  count: number;
  cityCount?: number;
  streetCount?: number;
  medianPrice: number;
  medianPricePerSqm: number | null;
  /** המודעות עצמן, ממוינות מהחדשה לישנה. */
  listings?: SourceListing[];
}

/**
 * מטמון בדפדפן — שכבה שנייה מעל המטמון שבשרת.
 *
 * למה צריך את שתיהן: המטמון בשרת משותף לכל המכשירים, אבל באירוח בשכבה
 * חינמית השרת נרדם אחרי רבע שעה והזיכרון שלו נמחק — כך שחיפוש חוזר למחרת
 * היה מחויב שוב. המטמון כאן שורד סגירת דפדפן וכיבוי מחשב, ולכן חיפוש חוזר
 * של אותה עיר לא עולה כלום גם אחרי שהשרת התאפס.
 */
const LOCAL_CACHE_PREFIX = "nadlan360_cache_";
const LOCAL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function readLocalCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - parsed.at > LOCAL_CACHE_TTL_MS) {
      localStorage.removeItem(LOCAL_CACHE_PREFIX + key);
      return null;
    }
    return parsed.data as T;
  } catch {
    return null;
  }
}

function writeLocalCache(key: string, data: unknown) {
  try {
    localStorage.setItem(LOCAL_CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // מכסת האחסון מלאה: מפנים רשומות ישנות ומנסים פעם אחת נוספת.
    try {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith(LOCAL_CACHE_PREFIX)) localStorage.removeItem(k);
      }
      localStorage.setItem(LOCAL_CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), data }));
    } catch {
      // עדיין לא נכנס — מוותרים בשקט; המטמון הוא אופטימיזציה, לא תנאי.
    }
  }
}

/** מוחק את המטמון המקומי, כדי לאלץ שאיבה טרייה. */
export function clearLocalCache(): number {
  let n = 0;
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(LOCAL_CACHE_PREFIX)) {
        localStorage.removeItem(k);
        n += 1;
      }
    }
  } catch {}
  return n;
}


/**
 * בודק שהשרת זמין ושמוגדר בו טוקן Apify.
 *
 * הפסקת זמן ארוכה בכוונה: באירוח בשכבה חינמית השרת נרדם אחרי חוסר פעילות,
 * וההתעוררות אורכת חצי דקה. המתנה קצרה החזירה "השרת לא זמין" גם כשהכול תקין.
 */
export async function bridgeHealth(): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) return false;
    const d = await r.json();
    return !!d?.hasApifyToken;
  } catch {
    return false;
  }
}

/**
 * שואב מקור אחד דרך השרת. השאיבה עצמה רצה בשרתי Apify, ולכן אין צורך
 * בדפדפן פתוח, בהתחברות לחשבונות, או במחשב דלוק.
 */
export async function bridgeScrape(source: string, city: string, street: string): Promise<BridgeResult | null> {
  const cacheKey = `src_${source}_${city.trim()}_${street.trim()}`;
  const cached = readLocalCache<BridgeResult>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${API_BASE}/api/sources/${encodeURIComponent(source)}?city=${encodeURIComponent(
      city,
    )}&street=${encodeURIComponent(street)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(280000) });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d || d.error || !d.count) return null;
    writeLocalCache(cacheKey, d);
    return d as BridgeResult;
  } catch {
    return null;
  }
}

// ---- התחברות מול השרת ----

export interface LoginResult {
  ok: boolean;
  error?: string;
  /** true = השרת לא זמין ויש להשתמש בבדיקה המקומית כגיבוי. */
  offline?: boolean;
  usingDefaultPassword?: boolean;
}

/** מאמת מול השרת. אם השרת לא זמין מסמן offline כדי שהאתר יישאר שמיש. */
export async function serverLogin(user: string, pass: string): Promise<LoginResult> {
  try {
    const r = await fetch(`${API_BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, pass }),
      // השרת עשוי להיות רדום — נותנים לו זמן להתעורר לפני שנכריז על כישלון.
      signal: AbortSignal.timeout(60000),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d?.ok) return { ok: true, usingDefaultPassword: d.usingDefaultPassword };
    return { ok: false, error: d?.error || "שם משתמש או סיסמה שגויים." };
  } catch {
    return { ok: false, offline: true };
  }
}

export interface ChangePasswordResult {
  ok: boolean;
  error?: string;
  note?: string;
  offline?: boolean;
}

export async function serverChangePassword(
  user: string,
  currentPass: string,
  newPass: string,
): Promise<ChangePasswordResult> {
  try {
    const r = await fetch(`${API_BASE}/api/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, currentPass, newPass }),
      signal: AbortSignal.timeout(60000),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d?.ok) return { ok: true, note: d.note };
    return { ok: false, error: d?.error || "שינוי הסיסמה נכשל." };
  } catch {
    return { ok: false, offline: true, error: "השרת אינו זמין — לא ניתן לשנות סיסמה כרגע." };
  }
}

// ---- מצב הקרדיט ב-Apify ----

export interface CreditStatus {
  configured: boolean;
  usedUsd?: number;
  capUsd?: number | null;
  exhausted?: boolean;
  unknown?: boolean;
  /** true = השרת עצמו אינו זמין (אתר סטטי ללא שרת). */
  offline?: boolean;
}

/**
 * בודק כמה קרדיט נשאר. משמש להסביר למשתמש למה מקורות חסרים,
 * במקום שהם פשוט ייעלמו מהמסך בלי הסבר.
 */
export async function fetchCreditStatus(): Promise<CreditStatus> {
  try {
    const r = await fetch(`${API_BASE}/api/credit`, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) return { configured: false, offline: true };
    return (await r.json()) as CreditStatus;
  } catch {
    return { configured: false, offline: true };
  }
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
  yearlyChangePct: number | null;
}

/** אנליטיקת מדלן ברמת עיר — מחיר למ"ר, מגמה שנתית, היצע ומדד חברתי. */
export async function fetchMadlanAnalytics(city: string): Promise<MadlanAnalytics | null> {
  const cacheKey = `madlan_${city.trim()}`;
  const cached = readLocalCache<MadlanAnalytics>(cacheKey);
  if (cached) return cached;

  try {
    const r = await fetch(`${API_BASE}/api/sources/madlan?city=${encodeURIComponent(city)}`, {
      signal: AbortSignal.timeout(280000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d || d.error) return null;
    writeLocalCache(cacheKey, d);
    return d as MadlanAnalytics;
  } catch {
    return null;
  }
}

// ---- מדד חברתי-כלכלי (הלמ"ס דרך data.gov.il) ----

const SOCIO_RESOURCE = "b6dcbb4c-4102-43d2-a5a1-8e049457fe7a";

export interface SocioEconomic {
  name: string;
  cluster: number; // אשכול 1–10 (1=נמוך, 10=גבוה)
  label: string; // נמוך / בינוני / גבוה / גבוה מאוד
}

/** שולף את המדד החברתי-כלכלי (אשכול הלמ"ס 1–10) לעיר מנתוני data.gov.il. */
export async function getSocioEconomic(city: string): Promise<SocioEconomic | null> {
  const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${SOCIO_RESOURCE}&q=${encodeURIComponent(
    city.trim(),
  )}&limit=8`;
  try {
    const data = await withRetry(() => getJson(url), 1);
    const recs: any[] = data?.result?.records || [];
    if (!recs.length) return null;
    const target = city.trim();
    const exact =
      recs.find((r) => String(r["שם רשות"]).trim() === target) ||
      recs.find((r) => String(r["שם רשות"]).includes(target)) ||
      recs[0];
    const cluster = Number(exact["אשכול חברתי כלכלי"]);
    if (!cluster || Number.isNaN(cluster)) return null;
    const label = cluster <= 3 ? "נמוך" : cluster <= 6 ? "בינוני" : cluster <= 8 ? "גבוה" : "גבוה מאוד";
    return { name: String(exact["שם רשות"]).trim(), cluster, label };
  } catch {
    return null;
  }
}

// ---- ניתוח השקעה (מדד לחברת בנייה) ----

export interface TrendPoint {
  period: string; // שנה, למשל "2024"
  medianPricePerSqm: number;
  medianPrice: number;
  count: number;
}

export interface InvestmentAnalysis {
  trend: TrendPoint[]; // מגמה לפי שנה
  appreciationPerYear: number; // שיעור עליית ערך שנתי ממוצע (%)
  totalAppreciation: number; // עליית ערך כוללת בתקופה (%)
  dealsPerMonth: number; // נזילות — מספר עסקאות בחודש
  volatility: number; // תנודתיות בין שנים (%)
  verdict: "recommended" | "neutral" | "caution";
  verdictLabel: string;
  reason: string;
}

/** מנתח פוטנציאל השקעה: מגמת מחיר למ"ר לאורך זמן, נזילות ותנודתיות. */
export function analyzeInvestment(deals: Deal[]): InvestmentAnalysis | null {
  const withPpsm = deals.filter((d) => d.pricePerSqm && d.pricePerSqm > 0 && d.date);
  if (withPpsm.length < 3) return null;

  // קיבוץ לפי שנה
  const byYear = new Map<string, Deal[]>();
  for (const d of withPpsm) {
    const year = d.date.slice(0, 4);
    (byYear.get(year) ?? byYear.set(year, []).get(year)!).push(d);
  }
  const trend: TrendPoint[] = Array.from(byYear.entries())
    .map(([period, ds]) => ({
      period,
      medianPricePerSqm: median(ds.map((d) => d.pricePerSqm!).filter((n) => n > 0)),
      medianPrice: median(ds.map((d) => d.price).filter((n) => n > 0)),
      count: ds.length,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  if (trend.length < 2) {
    // אין מספיק שנים למגמה — מחזירים נזילות בלבד
    const months = monthSpan(withPpsm);
    return {
      trend,
      appreciationPerYear: 0,
      totalAppreciation: 0,
      dealsPerMonth: months > 0 ? +(withPpsm.length / months).toFixed(1) : withPpsm.length,
      volatility: 0,
      verdict: "neutral",
      verdictLabel: "נתונים חלקיים",
      reason: "אין מספיק שנים עם עסקאות כדי לזהות מגמת מחירים ברורה. מומלץ להרחיב את טווח החיפוש.",
    };
  }

  const first = trend[0].medianPricePerSqm;
  const last = trend[trend.length - 1].medianPricePerSqm;
  const yearsSpan = Math.max(1, parseInt(trend[trend.length - 1].period) - parseInt(trend[0].period));
  const totalAppreciation = first > 0 ? ((last - first) / first) * 100 : 0;
  const appreciationPerYear = totalAppreciation / yearsSpan;

  // תנודתיות: סטיית שינויי המחיר בין שנים עוקבות
  const changes: number[] = [];
  for (let i = 1; i < trend.length; i++) {
    const prev = trend[i - 1].medianPricePerSqm;
    if (prev > 0) changes.push(((trend[i].medianPricePerSqm - prev) / prev) * 100);
  }
  const volatility = changes.length ? stdDev(changes) : 0;

  const months = monthSpan(withPpsm);
  const dealsPerMonth = months > 0 ? +(withPpsm.length / months).toFixed(1) : withPpsm.length;

  // המלצה — היוריסטיקה שקופה: עלייה יציבה + נזילות סבירה = מומלץ
  let verdict: InvestmentAnalysis["verdict"];
  let verdictLabel: string;
  let reason: string;
  if (appreciationPerYear >= 4 && dealsPerMonth >= 0.5 && volatility < 25) {
    verdict = "recommended";
    verdictLabel = "מומלץ להשקעה";
    reason = `מחיר למ"ר עלה בכ-${appreciationPerYear.toFixed(1)}% בשנה בממוצע, עם שוק פעיל (${dealsPerMonth} עסקאות בחודש) ותנודתיות נמוכה. מגמה חיובית ויציבה.`;
  } else if (appreciationPerYear < 0 || dealsPerMonth < 0.2) {
    verdict = "caution";
    verdictLabel = "דורש זהירות";
    reason =
      appreciationPerYear < 0
        ? `מחיר למ"ר ירד בכ-${Math.abs(appreciationPerYear).toFixed(1)}% בשנה בממוצע — מגמה שלילית. יש לבחון היטב לפני רכישה.`
        : `שוק דליל מאוד (${dealsPerMonth} עסקאות בחודש) — קשה להעריך שווי ונזילות. סיכון גבוה יותר.`;
  } else {
    verdict = "neutral";
    verdictLabel = "ניטרלי";
    reason = `מחיר למ"ר עלה בכ-${appreciationPerYear.toFixed(1)}% בשנה, עם ${dealsPerMonth} עסקאות בחודש. מגמה מתונה — כדאי להשוות לאזורים חלופיים.`;
  }

  return {
    trend,
    appreciationPerYear: +appreciationPerYear.toFixed(1),
    totalAppreciation: +totalAppreciation.toFixed(1),
    dealsPerMonth,
    volatility: +volatility.toFixed(1),
    verdict,
    verdictLabel,
    reason,
  };
}

function monthSpan(deals: Deal[]): number {
  const dates = deals.map((d) => d.date).filter(Boolean).sort();
  if (dates.length < 2) return 1;
  const a = new Date(dates[0]);
  const b = new Date(dates[dates.length - 1]);
  return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1);
}

function stdDev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = nums.reduce((s, n) => s + n, 0) / nums.length;
  const variance = nums.reduce((s, n) => s + (n - m) ** 2, 0) / nums.length;
  return Math.sqrt(variance);
}

/** מחשב סטטיסטיקה על עסקאות, כולל פילוח לפי מספר חדרים. */
export function calculateStatistics(deals: Deal[]): DealStatistics {
  const prices = deals.map((d) => d.price).filter((p) => p > 0);
  const ppsm = deals.map((d) => d.pricePerSqm).filter((p): p is number => p != null && p > 0);

  const byRooms: DealStatistics["byRooms"] = {};
  for (const d of deals) {
    if (d.rooms == null) continue;
    const k = String(d.rooms);
    (byRooms[k] ??= { count: 0, medianPrice: 0, medianPricePerSqm: null }).count++;
  }
  for (const k of Object.keys(byRooms)) {
    const group = deals.filter((d) => String(d.rooms) === k);
    byRooms[k].medianPrice = median(group.map((d) => d.price).filter((p) => p > 0));
    const gp = group.map((d) => d.pricePerSqm).filter((p): p is number => p != null && p > 0);
    byRooms[k].medianPricePerSqm = gp.length ? median(gp) : null;
  }

  const dates = deals.map((d) => d.date).filter(Boolean).sort();

  return {
    count: deals.length,
    meanPrice: mean(prices),
    medianPrice: median(prices),
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
    meanPricePerSqm: ppsm.length ? mean(ppsm) : null,
    medianPricePerSqm: ppsm.length ? median(ppsm) : null,
    byRooms,
    dateRange: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
  };
}
