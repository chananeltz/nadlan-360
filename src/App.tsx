import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import * as XLSX from "xlsx";
import {
  Search,
  MapPin,
  Home,
  TrendingUp,
  Building2,
  Download,
  Loader2,
  Info,
  CalendarDays,
  Lock,
  LogOut,
  Gauge,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  FileUp,
  X,
  Scale,
  Layers,
} from "lucide-react";
import {
  findRecentDealsForAddress,
  calculateStatistics,
  analyzeInvestment,
  getSocioEconomic,
  bridgeHealth,
  bridgeScrape,
  fetchMadlanAnalytics,
  parseGushHelka,
  type Deal,
  type DealStatistics,
  type InvestmentAnalysis,
  type SocioEconomic,
  type BridgeResult,
  type MadlanAnalytics,
} from "./utils/govmapClient.ts";

/**
 * פרטי הכניסה לאתר. שנו את הערכים כאן לשם המשתמש והסיסמה שתרצו.
 * הערה: זהו שער כניסה בסיסי (client-side) המרחיק סקרנים — אין באתר סודות,
 * כל הנתונים ציבוריים, ולכן אין צורך באבטחה מתקדמת.
 */
const AUTH = { user: "chananel", pass: "Nadlan#360" };
const AUTH_KEY = "nadlan360_auth";

const nf = new Intl.NumberFormat("he-IL");
const shekel = (n: number | null | undefined) =>
  n == null ? "—" : "₪" + nf.format(Math.round(n));

/** התאמת מין דקדוקי: "חצי שנה אחרונה" מול "3 שנים אחרונות". */
function rangeSuffix(years: number): string {
  const plural = years >= 2 && years !== 2.5 ? "אחרונות" : "אחרונה";
  return `${rangeLabel(years)} ${plural}`;
}

/** מתאר טווח זמן בעברית: 0.5 → "חצי שנה", 1.5 → "שנה וחצי", 3 → "3 שנים". */
function rangeLabel(years: number): string {
  if (years === 0.5) return "חצי שנה";
  if (years === 1) return "שנה";
  if (years === 1.5) return "שנה וחצי";
  if (years === 2.5) return "שנתיים וחצי";
  if (years === 2) return "שנתיים";
  return `${years} שנים`;
}

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = parseInt(String(v).replace(/[^\d-]/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}
function medianOf(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

interface UploadedData {
  source: string;
  count: number;
  medianPrice: number;
  medianPricePerSqm: number | null;
}

const EXAMPLES = [
  { city: "תל אביב", street: "רוטשילד 1" },
  { city: "תל אביב", street: "נווה צדק" },
  { city: "רמת גן", street: "" },
  { city: "חיפה", street: "כרמל" },
];

export default function App() {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem(AUTH_KEY) === "1",
  );
  if (!authed) return <LoginGate onSuccess={() => setAuthed(true)} />;
  return <Dashboard onLogout={() => { sessionStorage.removeItem(AUTH_KEY); setAuthed(false); }} />;
}

/* ---------- מסך כניסה ---------- */
function LoginGate({ onSuccess }: { onSuccess: () => void }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (user.trim() === AUTH.user && pass === AUTH.pass) {
      sessionStorage.setItem(AUTH_KEY, "1");
      onSuccess();
    } else {
      setErr(true);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-5 relative" dir="rtl">
      <div className="ambient-ios-bg" />
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="grid place-items-center w-14 h-14 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 mb-3">
            <Building2 size={28} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">נדל״ן 360</h1>
          <p className="text-slate-500 text-sm mt-1">התחברו כדי להיכנס למערכת</p>
        </div>
        <form onSubmit={submit} className="glass-ios rounded-3xl p-6 space-y-3">
          <input
            value={user}
            onChange={(e) => { setUser(e.target.value); setErr(false); }}
            placeholder="שם משתמש"
            aria-label="שם משתמש"
            className="w-full rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition text-[15px]"
          />
          <input
            type="password"
            value={pass}
            onChange={(e) => { setPass(e.target.value); setErr(false); }}
            placeholder="סיסמה"
            aria-label="סיסמה"
            className="w-full rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition text-[15px]"
          />
          {err && (
            <div className="text-[13px] text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              שם משתמש או סיסמה שגויים.
            </div>
          )}
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[.98] text-white font-semibold py-3.5 transition shadow-lg shadow-indigo-200"
          >
            <Lock size={18} /> כניסה
          </button>
        </form>
      </div>
    </div>
  );
}

/* ---------- הדשבורד ---------- */
function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [dealType, setDealType] = useState<1 | 2>(2); // 2=יד שנייה, 1=חדש מקבלן
  const [yearsBack, setYearsBack] = useState(3); // חצי שנה עד 3 שנים
  const [gushHelka, setGushHelka] = useState(""); // רשות המסים בלבד
  const [hideSubsidized, setHideSubsidized] = useState(true); // הסתר מחיר למשתכן/חריגים
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [socio, setSocio] = useState<SocioEconomic | null>(null);
  const [uploaded, setUploaded] = useState<UploadedData | null>(null);
  const [liveSources, setLiveSources] = useState<BridgeResult[]>([]);
  const [madlan, setMadlan] = useState<MadlanAnalytics | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [query, setQuery] = useState("");

  // שואב אוטומטית מכל מקורות המחיר-המבוקש דרך השרת (שרץ מול Apify).
  // כל מקור מתעדכן ברגע שהוא חוזר — אין המתנה לאיטי מכולם.
  async function runBridge(city: string, street: string) {
    setLiveSources([]);
    setMadlan(null);
    const up = await bridgeHealth();
    if (!up) return; // אין שרת/טוקן — מדלגים בשקט ומציגים רק את רשות המסים
    setLiveLoading(true);

    const listings = ["yad2", "yad1", "facebook"].map((s) =>
      bridgeScrape(s, city, street).then((res) => {
        if (res && res.count) setLiveSources((prev) => [...prev.filter((p) => p.source !== res.source), res]);
      }),
    );
    // מדלן מחזיר אנליטיקה עירונית (מגמה, היצע, מדד) ולא רשימת מודעות.
    const analytics = fetchMadlanAnalytics(city).then((d) => {
      if (d && d.pricePerSqm) setMadlan(d);
    });

    await Promise.all([...listings, analytics]);
    setLiveLoading(false);
  }

  // סינון מחיר למשתכן / עסקאות חריגות: מסיר עסקאות שמחיר המ"ר בהן נמוך
  // בצורה חריגה מהחציון (מתחת ל-60%) — סימן מובהק לדיור מסובסד או עסקה לא-שוקית.
  const shownDeals: Deal[] | null = useMemo(() => {
    if (!deals) return null;
    if (!hideSubsidized) return deals;
    const ppsm = deals.map((d) => d.pricePerSqm).filter((n): n is number => n != null && n > 0);
    if (ppsm.length < 4) return deals;
    const sorted = [...ppsm].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const med = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const floor = med * 0.6;
    return deals.filter((d) => d.pricePerSqm == null || d.pricePerSqm >= floor);
  }, [deals, hideSubsidized]);

  const removedCount = deals && shownDeals ? deals.length - shownDeals.length : 0;

  const stats: DealStatistics | null = useMemo(
    () => (shownDeals && shownDeals.length ? calculateStatistics(shownDeals) : null),
    [shownDeals],
  );

  const investment: InvestmentAnalysis | null = useMemo(
    () => (shownDeals && shownDeals.length ? analyzeInvestment(shownDeals) : null),
    [shownDeals],
  );

  const roomsChart = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.byRooms)
      .map(([rooms, v]) => ({
        rooms: `${rooms} חד׳`,
        roomsNum: parseFloat(rooms),
        pricePerSqm: v.medianPricePerSqm ?? 0,
        count: v.count,
      }))
      .filter((r) => r.pricePerSqm > 0)
      .sort((a, b) => a.roomsNum - b.roomsNum);
  }, [stats]);

  async function runSearch(c = city, s = street, dt = dealType, yb = yearsBack, gh = gushHelka) {
    const cityClean = c.trim();
    const streetClean = s.trim();
    const gushClean = gh.trim();
    const parsedGush = gushClean ? parseGushHelka(gushClean) : null;

    if (gushClean && !parsedGush) {
      setError('גוש/חלקה לא תקין. פורמט: "גוש 6638 חלקה 45" או "6638/45".');
      return;
    }
    // גמיש: אפשר למלא רק שדה אחד — עיר, שכונה, רחוב, כתובת מלאה או גוש/חלקה
    if (!cityClean && !streetClean && !parsedGush) {
      setError("הזינו לפחות עיר, שכונה, רחוב או גוש/חלקה כדי להתחיל לחפש.");
      return;
    }

    // גוש/חלקה הוא איתור קדסטרלי מדויק של רשות המסים — הוא גובר על הכתובת.
    const q = parsedGush ? parsedGush.query : [streetClean, cityClean].filter(Boolean).join(" ");
    setLoading(true);
    setError(null);
    setDeals(null);
    setSocio(null);
    setLiveSources([]);
    setMadlan(null);
    setLiveLoading(false);
    setQuery(q);

    // מקורות המחיר-המבוקש הם ברמת עיר/רחוב ואין להם מושג של גוש/חלקה,
    // ולכן בחיפוש קדסטרלי מציגים אך ורק את נתוני רשות המסים.
    if (cityClean && !parsedGush) {
      getSocioEconomic(cityClean).then(setSocio).catch(() => setSocio(null));
      runBridge(cityClean, streetClean);
    }
    try {
      const result = await findRecentDealsForAddress(q, {
        yearsBack: yb,
        // גוש/חלקה → רדיוס צר מאוד; כתובת מדויקת → צר; שכונה/עיר → רחב
        radius: parsedGush ? 200 : /\d/.test(streetClean) ? 250 : streetClean ? 450 : 600,
        maxDeals: 100,
        dealType: dt,
      });
      setDeals(result);
      if (result.length === 0) {
        setError(`לא נמצאו עסקאות מדווחות באזור זה ב-${rangeLabel(yb)} האחרונות. נסו טווח ארוך יותר או אזור סמוך.`);
      }
    } catch (e: any) {
      setError(e?.message || "אירעה שגיאה בשליפת הנתונים. נסו שוב בעוד רגע.");
    } finally {
      setLoading(false);
    }
  }

  function exportExcel() {
    if (!shownDeals || !shownDeals.length) return;
    const rows = shownDeals.map((d) => ({
      "מקור": "רשות המסים (מחיר סגירה)",
      "תאריך": d.date,
      "עיר": d.city,
      "שכונה": d.neighborhood,
      "רחוב": d.street,
      "מספר": d.houseNumber,
      "חדרים": d.rooms ?? "",
      'שטח (מ"ר)': d.sqm ?? "",
      "קומה": d.floor ?? "",
      "מחיר (₪)": d.price,
      'מחיר למ"ר (₪)': d.pricePerSqm ?? "",
      "סוג נכס": d.propertyType,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "עסקאות");
    XLSX.writeFile(wb, `נדלן-360-${query || "דוח"}.xlsx`);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const listings = rows
        .map((r) => {
          const price = toNum(r["מחיר מבוקש (₪)"] ?? r["מחיר (₪)"] ?? r["מחיר מבוקש"] ?? r["מחיר"]);
          const sqm = toNum(r['שטח (מ"ר)'] ?? r["שטח"] ?? r["שטח (מ'ר)"]);
          return { price, ppsm: price && sqm ? Math.round(price / sqm) : null };
        })
        .filter((x) => x.price);
      if (!listings.length) {
        setError("לא נמצאו מודעות עם מחיר בקובץ. ודא שזה קובץ שנוצר על ידי כלי השאיבה.");
        return;
      }
      const source = String(rows.find((r) => r["מקור"])?.["מקור"] || "קובץ שהועלה");
      const prices = listings.map((l) => l.price!) as number[];
      const ppsm = listings.map((l) => l.ppsm).filter((n): n is number => n != null);
      setUploaded({
        source,
        count: listings.length,
        medianPrice: medianOf(prices),
        medianPricePerSqm: ppsm.length ? medianOf(ppsm) : null,
      });
      setError(null);
    } catch {
      setError("שגיאה בקריאת הקובץ. ודא שזה Excel או CSV תקין.");
    } finally {
      e.target.value = "";
    }
  }

  return (
    <div className="min-h-screen text-slate-900 relative" dir="rtl">
      <div className="ambient-ios-bg" />
      <header className="sticky top-0 z-10 glass-ios-bar">
        <div className="mx-auto max-w-5xl px-5 py-3.5 flex items-center gap-2.5">
          <div className="grid place-items-center w-9 h-9 rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
            <Building2 size={20} />
          </div>
          <div className="leading-tight">
            <div className="font-bold text-[17px]">נדל״ן 360</div>
            <div className="text-[11px] text-slate-500">נתוני עסקאות אמת · רשות המסים</div>
          </div>
          <button
            onClick={onLogout}
            className="ms-auto flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-slate-800 rounded-xl px-2.5 py-1.5 transition"
          >
            <LogOut size={15} /> יציאה
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-24">
        <section className="pt-10 pb-6 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            כמה באמת עולה דירה שם?
          </h1>
          <p className="mt-3 text-slate-500 text-[15px] max-w-xl mx-auto">
            הזינו עיר ורחוב וקבלו את העסקאות האמיתיות שדווחו לרשות המסים —
            מחיר חציוני, מחיר למ״ר, וכל העסקאות. מיידי, בלי המצאות.
          </p>

          <div className="mt-7 glass-ios rounded-3xl p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <label className="flex-1 flex items-center gap-2 rounded-2xl bg-slate-50 border border-slate-200 px-3.5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition">
                <MapPin size={18} className="text-indigo-500 shrink-0" />
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                  placeholder="עיר — למשל תל אביב"
                  className="w-full bg-transparent py-3.5 outline-none text-[15px] placeholder:text-slate-400"
                  aria-label="עיר"
                />
              </label>
              <label className="flex-1 flex items-center gap-2 rounded-2xl bg-slate-50 border border-slate-200 px-3.5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition">
                <Home size={18} className="text-indigo-500 shrink-0" />
                <input
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                  placeholder="שכונה / רחוב / מספר — למשל נווה צדק"
                  className="w-full bg-transparent py-3.5 outline-none text-[15px] placeholder:text-slate-400"
                  aria-label="שכונה, רחוב או מספר בית"
                  disabled={!!gushHelka.trim()}
                />
              </label>
              <button
                onClick={() => runSearch()}
                disabled={loading}
                className="shrink-0 flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[.98] disabled:opacity-60 text-white font-semibold px-6 py-3.5 transition shadow-lg shadow-indigo-200"
              >
                {loading ? <Loader2 size={19} className="animate-spin" /> : <Search size={19} />}
                <span>חיפוש</span>
              </button>
            </div>

            {/* גוש וחלקה — איתור קדסטרלי מדויק. רק רשות המסים מכירה גוש/חלקה,
                ולכן כשהשדה מלא מוצגות עסקאות בלבד, ללא מקורות מחיר-מבוקש. */}
            <div className="mt-2.5 flex flex-col sm:flex-row gap-2.5">
              <label className="flex-1 flex items-center gap-2 rounded-2xl bg-slate-50 border border-slate-200 px-3.5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition">
                <Layers size={18} className="text-indigo-500 shrink-0" />
                <input
                  value={gushHelka}
                  onChange={(e) => setGushHelka(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                  placeholder='גוש וחלקה — למשל "6638/45" (רשות המסים בלבד)'
                  className="w-full bg-transparent py-3.5 outline-none text-[15px] placeholder:text-slate-400"
                  aria-label="גוש וחלקה"
                />
                {gushHelka.trim() && (
                  <button
                    onClick={() => setGushHelka("")}
                    aria-label="נקה גוש וחלקה"
                    className="shrink-0 text-slate-400 hover:text-slate-600 transition"
                  >
                    <X size={16} />
                  </button>
                )}
              </label>

              {/* טווח זמן: חצי שנה עד 3 שנים, בקפיצות של חצי שנה */}
              <label className="sm:w-56 flex items-center gap-2 rounded-2xl bg-slate-50 border border-slate-200 px-3.5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition">
                <CalendarDays size={18} className="text-indigo-500 shrink-0" />
                <select
                  value={yearsBack}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setYearsBack(v);
                    if (city.trim() || street.trim() || gushHelka.trim()) runSearch(city, street, dealType, v);
                  }}
                  className="w-full bg-transparent py-3.5 outline-none text-[15px] cursor-pointer"
                  aria-label="טווח זמן לחיפוש"
                >
                  {[0.5, 1, 1.5, 2, 2.5, 3].map((v) => (
                    <option key={v} value={v}>
                      {rangeSuffix(v)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* בורר סוג עסקה */}
            <div className="mt-3 flex items-center justify-center gap-1 rounded-2xl bg-slate-100 p-1 w-fit mx-auto">
              {([
                { v: 2, label: "יד שנייה" },
                { v: 1, label: "חדש מקבלן" },
              ] as const).map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => {
                    setDealType(opt.v);
                    if (city.trim()) runSearch(city, street, opt.v);
                  }}
                  className={`px-4 py-1.5 rounded-xl text-[13px] font-medium transition ${
                    dealType === opt.v ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {!deals && !loading && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="text-[13px] text-slate-400">נסו לדוגמה:</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.city + ex.street}
                  onClick={() => {
                    setCity(ex.city);
                    setStreet(ex.street);
                    runSearch(ex.city, ex.street);
                  }}
                  className="text-[13px] rounded-full bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-700 px-3.5 py-1.5 text-slate-600 transition"
                >
                  {[ex.street, ex.city].filter(Boolean).join(", ")}
                </button>
              ))}
            </div>
          )}
        </section>

        {loading && (
          <div className="mt-6 grid place-items-center py-16 text-slate-400">
            <Loader2 size={34} className="animate-spin text-indigo-500" />
            <p className="mt-3 text-sm">שולף עסקאות אמת מ‑govmap…</p>
          </div>
        )}

        {error && !loading && (
          <div className="mt-6 flex items-start gap-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3.5 text-[14px]">
            <Info size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {stats && !loading && (
          <section className="mt-8 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-slate-800">
                  תוצאות עבור <span className="text-indigo-600">{query}</span>
                </h2>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[13px] font-medium rounded-xl border border-slate-200 hover:border-indigo-300 hover:text-indigo-700 px-3 py-2 text-slate-600 transition cursor-pointer">
                    <FileUp size={15} /> העלה קובץ יד2/יד1/מדלן
                    <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} />
                  </label>
                  <button
                    onClick={exportExcel}
                    className="flex items-center gap-1.5 text-[13px] font-medium rounded-xl border border-slate-200 hover:border-indigo-300 hover:text-indigo-700 px-3 py-2 text-slate-600 transition"
                  >
                    <Download size={15} /> ייצוא לאקסל
                  </button>
                </div>
              </div>

              {/* הסבר על מקורות נוספים */}
              <div className="flex items-start gap-2 mb-3 rounded-2xl bg-indigo-50/70 border border-indigo-100 px-3.5 py-2.5 text-[12.5px] text-indigo-900/80">
                <Info size={15} className="shrink-0 mt-0.5 text-indigo-500" />
                <span>
                  הנתונים כאן הם <b>מחירי סגירה אמיתיים מרשות המסים</b>. <b>מחירי המבוקש</b> מיד2 / יד1 / מדלן /
                  פייסבוק נשאבים <b>אוטומטית</b> ומוצגים למטה — אין צורך בדפדפן פתוח או בהתחברות. חיפוש לפי{" "}
                  <b>גוש וחלקה</b> מציג עסקאות רשות המסים בלבד.
                </span>
              </div>

              {/* מתג סינון מחיר למשתכן */}
              <label className="flex items-center gap-2.5 mb-3 cursor-pointer select-none w-fit">
                <button
                  type="button"
                  role="switch"
                  aria-checked={hideSubsidized}
                  onClick={() => setHideSubsidized((v) => !v)}
                  className={`relative w-10 h-6 rounded-full transition ${hideSubsidized ? "bg-indigo-600" : "bg-slate-300"}`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${hideSubsidized ? "right-0.5" : "right-[18px]"}`}
                  />
                </button>
                <span className="text-[13px] text-slate-600">
                  הסתר מחיר למשתכן ועסקאות חריגות
                  {hideSubsidized && removedCount > 0 && (
                    <span className="text-slate-400"> ({removedCount} הוסתרו)</span>
                  )}
                </span>
              </label>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={<Building2 size={18} />} label="עסקאות שנמצאו" value={nf.format(stats.count)} tint="indigo" />
                <StatCard icon={<TrendingUp size={18} />} label="מחיר חציוני" value={shekel(stats.medianPrice)} tint="emerald" />
                <StatCard icon={<Home size={18} />} label='מחיר חציוני למ״ר' value={shekel(stats.medianPricePerSqm)} tint="violet" />
                <StatCard
                  icon={<CalendarDays size={18} />}
                  label="טווח תאריכים"
                  value={stats.dateRange ? `${stats.dateRange.from.slice(0, 7)} — ${stats.dateRange.to.slice(0, 7)}` : "—"}
                  tint="sky"
                  small
                />
              </div>
            </div>

            {/* השוואת מחיר מבוקש (יד2/מדלן) מול מחיר סגירה (רשות המסים) */}
            {uploaded && (
              <ComparePanel
                uploaded={uploaded}
                closingMedianPrice={stats.medianPrice}
                closingMedianPpsm={stats.medianPricePerSqm}
                onClear={() => setUploaded(null)}
              />
            )}

            {/* מחירי מבוקש חיים (יד2 · יד1 · פייסבוק) */}
            {(liveLoading || liveSources.length > 0) && (
              <LiveSourcesPanel
                sources={liveSources}
                loading={liveLoading}
                closingPrice={stats.medianPrice}
                closingPpsm={stats.medianPricePerSqm}
              />
            )}

            {/* אנליטיקת מדלן — מגמה, היצע ומחיר למ"ר ברמת העיר */}
            {madlan && <MadlanPanel m={madlan} closingPpsm={stats.medianPricePerSqm} />}

            {/* מדד חברתי-כלכלי (הלמ"ס) */}
            {socio && <SocioPanel s={socio} />}

            {/* מדד השקעה */}
            {investment && <InvestmentPanel inv={investment} />}

            {roomsChart.length > 0 && (
              <div className="glass-ios rounded-3xl p-5">
                <h3 className="font-bold text-slate-800 mb-1">מחיר חציוני למ״ר לפי מספר חדרים</h3>
                <p className="text-[12px] text-slate-400 mb-4">מבוסס על {nf.format(stats.count)} עסקאות אמיתיות</p>
                <div className="h-64" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={roomsChart} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                      <XAxis dataKey="rooms" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                      />
                      <Tooltip
                        formatter={(v: any) => [shekel(v), 'חציון למ״ר']}
                        contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
                      />
                      <Bar dataKey="pricePerSqm" radius={[8, 8, 0, 0]}>
                        {roomsChart.map((_, i) => (
                          <Cell key={i} fill="#6366f1" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="glass-ios rounded-3xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">כל העסקאות</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-slate-400 text-right bg-slate-50/60">
                      <th className="font-medium px-4 py-2.5 whitespace-nowrap">תאריך</th>
                      <th className="font-medium px-4 py-2.5 whitespace-nowrap">כתובת</th>
                      <th className="font-medium px-4 py-2.5 whitespace-nowrap">חדרים</th>
                      <th className="font-medium px-4 py-2.5 whitespace-nowrap">מ״ר</th>
                      <th className="font-medium px-4 py-2.5 whitespace-nowrap">מחיר</th>
                      <th className="font-medium px-4 py-2.5 whitespace-nowrap">למ״ר</th>
                      <th className="font-medium px-4 py-2.5 whitespace-nowrap">מקור</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownDeals!.map((d, i) => (
                      <tr key={d.objectid + "_" + i} className="border-t border-slate-50 hover:bg-indigo-50/40 transition">
                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">{d.date}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap font-medium text-slate-700">
                          {[d.street, d.houseNumber].filter(Boolean).join(" ") || d.neighborhood || d.city}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{d.rooms ?? "—"}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{d.sqm ?? "—"}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap font-semibold text-slate-800">{shekel(d.price)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">{shekel(d.pricePerSqm)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="inline-block text-[11px] rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 border border-emerald-100">
                            רשות המסים
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-center text-[12px] text-slate-400 pt-2">
              המקור: מאגר עסקאות הנדל״ן של רשות המסים דרך govmap.gov.il · הנתונים ציבוריים ומתעדכנים באיחור מסוים.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  facebook: "פייסבוק",
  yad2: "יד2",
  yad1: "יד1",
  madlan: "מדלן PRO",
};

/* ---------- אנליטיקת מדלן ---------- */
function MadlanPanel({ m, closingPpsm }: { m: MadlanAnalytics; closingPpsm: number | null }) {
  const gap =
    m.pricePerSqm && closingPpsm
      ? Math.round(((m.pricePerSqm - closingPpsm) / closingPpsm) * 1000) / 10
      : null;
  const rooms = m.pricesByRooms.filter((r) => r.medianBuyPrice && /^\d+$/.test(r.rooms));

  return (
    <div className="glass-ios rounded-3xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Activity size={18} className="text-indigo-500" />
        <h3 className="font-bold text-slate-800">מדלן — תמונת שוק עירונית</h3>
        <span className="ms-2 text-[11px] text-slate-400">{m.cityHebrew}</span>
      </div>
      <p className="text-[12px] text-slate-400 mb-4">
        נתוני מדלן הציבוריים — מחיר למ״ר, מגמה שנתית והיצע
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
          <div className="text-[12px] text-slate-500 mb-1">מחיר למ״ר</div>
          <div className="text-lg font-bold text-slate-800">{shekel(m.pricePerSqm)}</div>
          {gap != null && (
            <div className={`text-[11px] mt-1 font-semibold ${gap > 0 ? "text-amber-600" : "text-emerald-600"}`}>
              {gap > 0 ? "+" : ""}
              {gap}% מול הסגירה
            </div>
          )}
        </div>
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
          <div className="text-[12px] text-slate-500 mb-1">מגמה שנתית</div>
          <div
            className={`text-lg font-bold flex items-center gap-1 ${
              (m.yearlyChangePct ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {m.yearlyChangePct != null ? (
              <>
                {m.yearlyChangePct >= 0 ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}
                {Math.abs(m.yearlyChangePct)}%
              </>
            ) : (
              "—"
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">{nf.format(m.yearlyDeals || 0)} עסקאות בשנה</div>
        </div>
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
          <div className="text-[12px] text-slate-500 mb-1">היצע למכירה</div>
          <div className="text-lg font-bold text-slate-800">{nf.format(m.bulletinsForSale || 0)}</div>
          <div className="text-[11px] text-slate-400 mt-1">{nf.format(m.bulletinsForRent || 0)} להשכרה</div>
        </div>
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
          <div className="text-[12px] text-slate-500 mb-1">מדד חברתי-כלכלי</div>
          <div className="text-lg font-bold text-slate-800">
            {m.socioeconomicIndex != null ? `${m.socioeconomicIndex}/10` : "—"}
          </div>
        </div>
      </div>

      {rooms.length > 0 && (
        <div className="mt-4">
          <div className="text-[12px] font-bold text-slate-600 mb-2">מחיר חציוני לפי חדרים (מדלן)</div>
          <div className="flex flex-wrap gap-2">
            {rooms.map((r) => (
              <div key={r.rooms} className="rounded-xl bg-white border border-slate-200 px-3 py-2">
                <span className="text-[12px] text-slate-500">{r.rooms} חד׳ · </span>
                <span className="text-[13px] font-bold text-slate-800">{shekel(r.medianBuyPrice)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LiveSourcesPanel({
  sources,
  loading,
  closingPrice,
  closingPpsm,
}: {
  sources: BridgeResult[];
  loading: boolean;
  closingPrice: number;
  closingPpsm: number | null;
}) {
  return (
    <div className="glass-ios rounded-3xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Scale size={18} className="text-indigo-500" />
        <h3 className="font-bold text-slate-800">מחירי מבוקש חיים — יד2 · יד1 · מדלן</h3>
        <span className="ms-2 inline-flex items-center gap-1 text-[11px] text-emerald-600">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> גשר פעיל
        </span>
      </div>
      <p className="text-[12px] text-slate-400 mb-4">נשאב אוטומטית מול מחיר הסגירה של רשות המסים</p>

      <div className="grid sm:grid-cols-3 gap-3">
        {["yad2", "yad1", "madlan"].map((src) => {
          const r = sources.find((s) => s.source === src);
          const gap =
            r?.medianPricePerSqm && closingPpsm
              ? Math.round(((r.medianPricePerSqm - closingPpsm) / closingPpsm) * 1000) / 10
              : null;
          return (
            <div key={src} className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
              <div className="text-[13px] font-bold text-slate-700 mb-1">{SOURCE_LABEL[src]}</div>
              {r ? (
                <>
                  <div className="text-lg font-bold text-slate-800">{shekel(r.medianPrice)}</div>
                  <div className="text-[12px] text-slate-500">
                    {nf.format(r.count)} מודעות · {shekel(r.medianPricePerSqm)}/מ״ר
                  </div>
                  {r.scope === "street" ? (
                    <div className="text-[11px] mt-1 inline-flex items-center gap-1 text-emerald-600 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> מדויק לפי רחוב
                    </div>
                  ) : r.scope === "city" ? (
                    <div className="text-[11px] mt-1 text-slate-400">רמת עיר</div>
                  ) : null}
                  {gap != null && (
                    <div className={`text-[12px] mt-1 font-semibold ${gap > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                      {gap > 0 ? "+" : ""}
                      {gap}% מעל הסגירה
                    </div>
                  )}
                </>
              ) : loading ? (
                <div className="flex items-center gap-1.5 text-[12px] text-slate-400 mt-1">
                  <Loader2 size={13} className="animate-spin" /> שואב…
                </div>
              ) : (
                <div className="text-[12px] text-slate-400 mt-1">אין נתונים</div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-400 mt-3">
        מחיר סגירה (רשות המסים): חציון {shekel(closingPrice)} · {shekel(closingPpsm)}/מ״ר. פייסבוק — הזנה ידנית.
      </p>
    </div>
  );
}

function ComparePanel({
  uploaded,
  closingMedianPrice,
  closingMedianPpsm,
  onClear,
}: {
  uploaded: UploadedData;
  closingMedianPrice: number;
  closingMedianPpsm: number | null;
  onClear: () => void;
}) {
  // פער מיקוח: כמה המחיר המבוקש גבוה ממחיר הסגירה בפועל
  const askPpsm = uploaded.medianPricePerSqm;
  const gapPct =
    askPpsm && closingMedianPpsm ? Math.round(((askPpsm - closingMedianPpsm) / closingMedianPpsm) * 1000) / 10 : null;
  const priceGapPct =
    uploaded.medianPrice && closingMedianPrice
      ? Math.round(((uploaded.medianPrice - closingMedianPrice) / closingMedianPrice) * 1000) / 10
      : null;

  return (
    <div className="glass-ios rounded-3xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Scale size={18} className="text-indigo-500" />
          <h3 className="font-bold text-slate-800">מבוקש מול סגירה — {uploaded.source}</h3>
        </div>
        <button onClick={onClear} className="text-slate-400 hover:text-slate-600" title="הסר">
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-2xl bg-sky-50 border border-sky-100 p-4">
          <div className="text-[12px] text-sky-700 font-medium mb-1">מחיר מבוקש (מהקובץ)</div>
          <div className="text-xl font-bold text-slate-800">{shekel(uploaded.medianPrice)}</div>
          <div className="text-[12px] text-slate-500 mt-0.5">
            חציון · {nf.format(uploaded.count)} מודעות · {shekel(askPpsm)}/מ״ר
          </div>
        </div>
        <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
          <div className="text-[12px] text-emerald-700 font-medium mb-1">מחיר סגירה (רשות המסים)</div>
          <div className="text-xl font-bold text-slate-800">{shekel(closingMedianPrice)}</div>
          <div className="text-[12px] text-slate-500 mt-0.5">חציון · {shekel(closingMedianPpsm)}/מ״ר</div>
        </div>
      </div>

      {gapPct != null && (
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-center">
          <div className="text-[13px] text-slate-500">פער מיקוח (מבוקש מעל סגירה, למ״ר)</div>
          <div className={`text-2xl font-extrabold ${gapPct > 0 ? "text-amber-600" : "text-emerald-600"}`}>
            {gapPct > 0 ? "+" : ""}
            {gapPct}%
          </div>
          <p className="text-[12px] text-slate-500 mt-1">
            {gapPct > 0
              ? `בממוצע מבקשים כ-${gapPct}% מעל מה שבאמת נסגר. יש מקום למשא ומתן.`
              : `המחיר המבוקש קרוב או נמוך ממחיר הסגירה בפועל — שוק "חם".`}
            {priceGapPct != null && ` (פער במחיר הכולל: ${priceGapPct > 0 ? "+" : ""}${priceGapPct}%)`}
          </p>
        </div>
      )}
      <p className="text-[11px] text-slate-400 text-center mt-3">
        מחיר מבוקש מקורו בקובץ שהעלית (יד2/מדלן/ידני). מחיר סגירה מרשות המסים. השוואה אינדיקטיבית.
      </p>
    </div>
  );
}

function SocioPanel({ s }: { s: SocioEconomic }) {
  const tone =
    s.cluster <= 3
      ? { text: "text-rose-600", bg: "bg-rose-500" }
      : s.cluster <= 6
        ? { text: "text-amber-600", bg: "bg-amber-500" }
        : s.cluster <= 8
          ? { text: "text-emerald-600", bg: "bg-emerald-500" }
          : { text: "text-indigo-600", bg: "bg-indigo-600" };
  return (
    <div className="glass-ios rounded-3xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={18} className="text-indigo-500" />
        <h3 className="font-bold text-slate-800">מדד חברתי-כלכלי — {s.name}</h3>
      </div>
      <div className="flex items-baseline gap-2 mb-3">
        <span className={`text-3xl font-extrabold ${tone.text}`}>{s.cluster}</span>
        <span className="text-slate-400 text-sm">/ 10</span>
        <span className={`ms-2 font-bold ${tone.text}`}>{s.label}</span>
      </div>
      {/* סקאלה 1–10 */}
      <div className="flex gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <div
            key={n}
            className={`flex-1 h-2.5 rounded-full ${n <= s.cluster ? tone.bg : "bg-slate-200"}`}
            title={`אשכול ${n}`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-slate-400 mt-1.5">
        <span>1 · נמוך</span>
        <span>10 · גבוה</span>
      </div>
      <p className="text-[11px] text-slate-400 mt-3">
        מקור: הלשכה המרכזית לסטטיסטיקה (הלמ״ס) דרך data.gov.il · אשכול חברתי-כלכלי ברמת הרשות המקומית.
      </p>
    </div>
  );
}

function InvestmentPanel({ inv }: { inv: InvestmentAnalysis }) {
  const theme = {
    recommended: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500", line: "#10b981" },
    neutral: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", dot: "bg-amber-500", line: "#f59e0b" },
    caution: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", dot: "bg-rose-500", line: "#f43f5e" },
  }[inv.verdict];

  const up = inv.appreciationPerYear >= 0;

  return (
    <div className="glass-ios rounded-3xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Gauge size={18} className="text-indigo-500" />
        <h3 className="font-bold text-slate-800">מדד השקעה — מגמת הרחוב ב‑3 שנים</h3>
      </div>

      {/* המלצה */}
      <div className={`flex items-start gap-3 rounded-2xl ${theme.bg} ${theme.border} border px-4 py-3.5 mb-4`}>
        <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${theme.dot}`} />
        <div>
          <div className={`font-bold ${theme.text}`}>{inv.verdictLabel}</div>
          <p className="text-[13px] text-slate-600 mt-0.5 leading-relaxed">{inv.reason}</p>
        </div>
      </div>

      {/* מדדים */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Metric
          icon={up ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          label="עליית ערך שנתית"
          value={`${up ? "+" : ""}${inv.appreciationPerYear}%`}
          good={up}
        />
        <Metric icon={<Activity size={16} />} label="נזילות (עסקאות/חודש)" value={`${inv.dealsPerMonth}`} />
        <Metric icon={<Gauge size={16} />} label="תנודתיות" value={`${inv.volatility}%`} />
      </div>

      {/* גרף מגמה */}
      {inv.trend.length >= 2 && (
        <div className="h-56" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={inv.trend} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              />
              <Tooltip
                formatter={(v: any) => ["₪" + new Intl.NumberFormat("he-IL").format(Math.round(v)), 'חציון למ״ר']}
                contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
              />
              <Line type="monotone" dataKey="medianPricePerSqm" stroke={theme.line} strokeWidth={3} dot={{ r: 4, fill: theme.line }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="text-[11px] text-slate-400 text-center mt-2">
        המדד מבוסס על מגמת מחיר למ״ר בעסקאות אמת. אינדיקציה לתכנון בלבד — אינו ייעוץ השקעות.
      </p>
    </div>
  );
}

function Metric({ icon, label, value, good }: { icon: React.ReactNode; label: string; value: string; good?: boolean }) {
  const color = good === undefined ? "text-slate-700" : good ? "text-emerald-600" : "text-rose-600";
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-center">
      <div className={`inline-flex items-center justify-center gap-1 ${color} font-bold text-lg`}>
        {icon}
        {value}
      </div>
      <div className="text-[11px] text-slate-400 mt-0.5 leading-tight">{label}</div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tint,
  small,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: "indigo" | "emerald" | "violet" | "sky";
  small?: boolean;
}) {
  const tints: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    violet: "bg-violet-50 text-violet-600",
    sky: "bg-sky-50 text-sky-600",
  };
  return (
    <div className="glass-ios rounded-2xl p-4">
      <div className={`inline-grid place-items-center w-9 h-9 rounded-xl mb-2.5 ${tints[tint]}`}>{icon}</div>
      <div className="text-[12px] text-slate-400">{label}</div>
      <div className={`font-bold text-slate-800 ${small ? "text-[15px]" : "text-xl"}`}>{value}</div>
    </div>
  );
}
