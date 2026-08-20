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
} from "lucide-react";
import {
  findRecentDealsForAddress,
  calculateStatistics,
  analyzeInvestment,
  type Deal,
  type DealStatistics,
  type InvestmentAnalysis,
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

const EXAMPLES = [
  { city: "תל אביב", street: "רוטשילד 1" },
  { city: "רמת גן", street: "ביאליק 20" },
  { city: "חיפה", street: "הנביאים 10" },
  { city: "באר שבע", street: "רגר 5" },
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
    <div className="min-h-screen grid place-items-center bg-gradient-to-b from-indigo-50 via-white to-white px-5" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="grid place-items-center w-14 h-14 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 mb-3">
            <Building2 size={28} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">נדל״ן 360</h1>
          <p className="text-slate-500 text-sm mt-1">התחברו כדי להיכנס למערכת</p>
        </div>
        <form onSubmit={submit} className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-6 space-y-3">
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
  const [hideSubsidized, setHideSubsidized] = useState(true); // הסתר מחיר למשתכן/חריגים
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [query, setQuery] = useState("");

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

  async function runSearch(c = city, s = street, dt = dealType) {
    const cityClean = c.trim();
    if (!cityClean) {
      setError("אנא הזינו לפחות שם עיר.");
      return;
    }
    const q = [s.trim(), cityClean].filter(Boolean).join(" ");
    setLoading(true);
    setError(null);
    setDeals(null);
    setQuery(q);
    try {
      const result = await findRecentDealsForAddress(q, {
        yearsBack: 3,
        radius: s.trim() ? 250 : 600,
        maxDeals: 100,
        dealType: dt,
      });
      setDeals(result);
      if (result.length === 0) {
        setError("לא נמצאו עסקאות מדווחות באזור זה בשלוש השנים האחרונות. נסו רחוב סמוך או עיר בלבד.");
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white text-slate-900" dir="rtl">
      <header className="sticky top-0 z-10 backdrop-blur-md bg-white/70 border-b border-slate-200/70">
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

          <div className="mt-7 bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <label className="flex-1 flex items-center gap-2 rounded-2xl bg-slate-50 border border-slate-200 px-3.5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition">
                <MapPin size={18} className="text-indigo-500 shrink-0" />
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                  placeholder="עיר (חובה) — למשל תל אביב"
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
                  placeholder="רחוב ומספר (רשות) — למשל רוטשילד 1"
                  className="w-full bg-transparent py-3.5 outline-none text-[15px] placeholder:text-slate-400"
                  aria-label="רחוב ומספר"
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
                  {ex.street}, {ex.city}
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
                <button
                  onClick={exportExcel}
                  className="flex items-center gap-1.5 text-[13px] font-medium rounded-xl border border-slate-200 hover:border-indigo-300 hover:text-indigo-700 px-3 py-2 text-slate-600 transition"
                >
                  <Download size={15} /> ייצוא לאקסל
                </button>
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

            {/* מדד השקעה */}
            {investment && <InvestmentPanel inv={investment} />}

            {roomsChart.length > 0 && (
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
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

            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
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

function InvestmentPanel({ inv }: { inv: InvestmentAnalysis }) {
  const theme = {
    recommended: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500", line: "#10b981" },
    neutral: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", dot: "bg-amber-500", line: "#f59e0b" },
    caution: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", dot: "bg-rose-500", line: "#f43f5e" },
  }[inv.verdict];

  const up = inv.appreciationPerYear >= 0;

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
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
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className={`inline-grid place-items-center w-9 h-9 rounded-xl mb-2.5 ${tints[tint]}`}>{icon}</div>
      <div className="text-[12px] text-slate-400">{label}</div>
      <div className={`font-bold text-slate-800 ${small ? "text-[15px]" : "text-xl"}`}>{value}</div>
    </div>
  );
}
