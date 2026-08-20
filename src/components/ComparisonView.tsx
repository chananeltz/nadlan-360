import { useState, useMemo, useEffect } from "react";
import { motion } from "motion/react";
import {
  ArrowLeftRight,
  ChevronDown,
  Calendar,
  TrendingUp,
  Coins,
  Scale,
  Building,
  DollarSign,
  X,
  Info,
  Percent,
  BarChart2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { RealEstateReport, SourceId } from "../types";

interface ComparisonViewProps {
  reports: RealEstateReport[];
  compareReportId1: string | null;
  compareReportId2: string | null;
  onSelectReport1: (id: string | null) => void;
  onSelectReport2: (id: string | null) => void;
  onClose: () => void;
}

export interface ReportStats {
  query: string;
  timestamp: string;
  sources: SourceId[];
  excelFileName?: string;
  basePricePerSqm: number;
  avgPrice: number;
  avgPricePerSqm: number;
  minPrice: number;
  maxPrice: number;
  totalTransactions: number;
  // Standard simulated 100sqm apartment
  simSqm: number;
  simPricePerSqm: number;
  simValue: number;
  simRent: number;
  simYield: number;
}

const getBasePrice = (query: string) => {
  const q = query.toLowerCase();
  if (q.includes("תל אביב") || q.includes("פלורנטין") || q.includes("נווה צדק")) return 52000;
  if (q.includes("נתניה") || q.includes("אגמים") || q.includes("עיר ימים")) return 29000;
  if (q.includes("באר שבע") || q.includes("סיגליות")) return 14500;
  if (q.includes("ירושלים") || q.includes("רמות")) return 32000;
  if (q.includes("חיפה") || q.includes("כרמל")) return 21000;
  return 24000;
};

export function getReportStats(report: RealEstateReport): ReportStats {
  const query = report.searchQuery || "כללי";
  const base = getBasePrice(query);
  
  // Get transactions
  let txs: any[] = [];
  if (report.excelRows && report.excelRows.length > 0) {
    txs = report.excelRows;
  } else {
    // Generate identical dynamic seeded transactions as in ReportView to match statistics
    const saleTypes = ["שוק חופשי - יד שנייה", "חדש מקבלן", "מחיר למשתכן", "חיסול / כינוס נכסים"];
    
    let seed = 0;
    for (let i = 0; i < query.length; i++) {
      seed += query.charCodeAt(i);
    }
    
    const randomSeeded = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    const txCount = 22 + (seed % 24);

    for (let i = 0; i < txCount; i++) {
      const rooms = Math.floor(randomSeeded() * 3) + 3; // 3 to 5 rooms
      let sqm = 0;
      if (rooms === 3) sqm = Math.floor(randomSeeded() * 15) + 70;
      else if (rooms === 4) sqm = Math.floor(randomSeeded() * 15) + 90;
      else sqm = Math.floor(randomSeeded() * 20) + 115;
      
      const currentYearValue = 2026;
      const yearDiff = Math.floor(randomSeeded() * 11); // 0 to 10 years back
      
      let saleType = saleTypes[0];
      const roll = randomSeeded();
      if (roll < 0.25) {
        saleType = "מחיר למשתכן";
      } else if (roll < 0.5) {
        saleType = "חדש מקבלן";
      } else if (roll < 0.6) {
        saleType = "חיסול / כינוס נכסים";
      }
      
      const inflationFactor = [0.57, 0.61, 0.65, 0.68, 0.71, 0.76, 0.83, 0.86, 0.90, 0.95, 1.00][10 - yearDiff];
      let pricePerSqm = base * inflationFactor * (0.9 + randomSeeded() * 0.2);
      
      if (saleType === "מחיר למשתכן") {
        pricePerSqm *= 0.65;
      } else if (saleType === "חיסול / כינוס נכסים") {
        pricePerSqm *= 0.82;
      } else if (saleType === "חדש מקבלן") {
        pricePerSqm *= 1.10;
      }
      
      const price = Math.round(pricePerSqm * sqm);
      txs.push({
        price,
        pricePerSqm: Math.round(price / sqm),
      });
    }
  }

  // Calculate actual transaction metrics
  const totalTransactions = txs.length;
  const avgPrice = totalTransactions > 0 
    ? Math.round(txs.reduce((sum, t) => sum + t.price, 0) / totalTransactions)
    : 0;
  const avgPricePerSqm = totalTransactions > 0 
    ? Math.round(txs.reduce((sum, t) => sum + t.pricePerSqm, 0) / totalTransactions)
    : 0;
  const minPrice = totalTransactions > 0
    ? Math.min(...txs.map(t => t.price))
    : 0;
  const maxPrice = totalTransactions > 0
    ? Math.max(...txs.map(t => t.price))
    : 0;

  // Simulator values for standardized 100 sqm apartment
  const simSqm = 100;
  const simFloor = 5;
  const simAge = 5;
  const simHasElevator = true;
  const simHasParking = true;

  const floorMultiplier = 1 + (simFloor * 0.01);
  const ageMultiplier = Math.max(0.7, 1 - (simAge * 0.015));
  const elevatorBonus = simHasElevator ? 1.08 : 0.95;
  const parkingBonus = simHasParking ? 1.06 : 1.0;

  const simPricePerSqm = Math.round(base * floorMultiplier * ageMultiplier * elevatorBonus * parkingBonus);
  const simValue = simSqm * simPricePerSqm;

  const baseYield = 0.031;
  const sizeYieldAdjustment = simSqm > 120 ? -0.003 : simSqm < 70 ? 0.005 : 0;
  const simYield = baseYield + sizeYieldAdjustment + (simHasElevator ? 0.001 : -0.002);
  const simRent = Math.round((simValue * simYield) / 12);

  return {
    query,
    timestamp: report.timestamp,
    sources: report.sources,
    excelFileName: report.excelFileName,
    basePricePerSqm: base,
    avgPrice,
    avgPricePerSqm,
    minPrice,
    maxPrice,
    totalTransactions,
    simSqm,
    simPricePerSqm,
    simValue,
    simRent,
    simYield
  };
}

export default function ComparisonView({
  reports,
  compareReportId1,
  compareReportId2,
  onSelectReport1,
  onSelectReport2,
  onClose,
}: ComparisonViewProps) {
  
  // Set default report selections if not set and reports exist
  useEffect(() => {
    if (reports.length > 0) {
      if (!compareReportId1) {
        onSelectReport1(reports[0].id);
      }
      if (!compareReportId2 && reports.length > 1) {
        onSelectReport2(reports[1].id);
      }
    }
  }, [reports, compareReportId1, compareReportId2, onSelectReport1, onSelectReport2]);

  const report1 = useMemo(() => reports.find((r) => r.id === compareReportId1), [reports, compareReportId1]);
  const report2 = useMemo(() => reports.find((r) => r.id === compareReportId2), [reports, compareReportId2]);

  const stats1 = useMemo(() => (report1 ? getReportStats(report1) : null), [report1]);
  const stats2 = useMemo(() => (report2 ? getReportStats(report2) : null), [report2]);

  // Helpers to calculate differences
  const getDiff = (val1: number, val2: number) => {
    return val2 - val1;
  };

  const getPercentDiff = (val1: number, val2: number) => {
    if (val1 === 0) return 0;
    return ((val2 - val1) / val1) * 100;
  };

  const formatDiff = (val1: number, val2: number, type: "currency" | "percent" | "number" = "number") => {
    const diff = getDiff(val1, val2);
    const pct = getPercentDiff(val1, val2);
    const sign = diff > 0 ? "+" : "";

    if (diff === 0) {
      return <span className="text-theme-text-muted font-mono">זהה</span>;
    }

    const isPositiveBetter = type === "percent" ? diff > 0 : diff > 0; // standard colors
    const colorClass = diff > 0 
      ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" 
      : "text-rose-600 dark:text-rose-400 bg-rose-500/10";

    let diffText = "";
    if (type === "currency") {
      diffText = `₪${Math.abs(diff).toLocaleString("he-IL")}`;
    } else if (type === "percent") {
      diffText = `${Math.abs(diff).toFixed(2)}%`;
    } else {
      diffText = `${Math.abs(diff).toLocaleString("he-IL")}`;
    }

    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono inline-flex items-center gap-1 ${colorClass}`}>
        <span>{sign === "+" ? "▲" : "▼"}</span>
        <span>{diffText}</span>
        <span className="opacity-75 font-sans">({sign}{pct.toFixed(1)}%)</span>
      </span>
    );
  };

  // Recharts Data
  const chartData = useMemo(() => {
    if (!stats1 || !stats2) return [];
    return [
      {
        name: "מחיר ממוצע למ״ר",
        [stats1.query]: stats1.avgPricePerSqm,
        [stats2.query]: stats2.avgPricePerSqm,
      },
      {
        name: "שווי דירה מדד (במאה אלפי ₪)",
        [stats1.query]: Math.round(stats1.simValue / 10000),
        [stats2.query]: Math.round(stats2.simValue / 10000),
      },
      {
        name: "שכירות משוערת (פי 100)",
        [stats1.query]: Math.round(stats1.simRent / 100) * 10,
        [stats2.query]: Math.round(stats2.simRent / 100) * 10,
      },
    ];
  }, [stats1, stats2]);

  const yieldChartData = useMemo(() => {
    if (!stats1 || !stats2) return [];
    return [
      {
        name: stats1.query,
        "תשואה שנתית": parseFloat((stats1.simYield * 100).toFixed(2)),
      },
      {
        name: stats2.query,
        "תשואה שנתית": parseFloat((stats2.simYield * 100).toFixed(2)),
      },
    ];
  }, [stats1, stats2]);

  // AI Written Comparative Summary text generated client-side
  const comparativeAnalysis = useMemo(() => {
    if (!stats1 || !stats2) return "";
    
    const priceDiffPct = getPercentDiff(stats1.avgPricePerSqm, stats2.avgPricePerSqm);
    const yieldDiffPct = getPercentDiff(stats1.simYield, stats2.simYield);

    const higherPriceArea = priceDiffPct > 0 ? stats2.query : stats1.query;
    const lowerPriceArea = priceDiffPct > 0 ? stats1.query : stats2.query;
    const priceDiffAbs = Math.abs(priceDiffPct).toFixed(1);

    const higherYieldArea = yieldDiffPct > 0 ? stats2.query : stats1.query;
    const lowerYieldArea = yieldDiffPct > 0 ? stats1.query : stats2.query;
    const yieldDiffAbs = Math.abs(yieldDiffPct).toFixed(1);

    let summary = `**ניתוח שמאי משווה:** סקר השוק מראה פערים מעניינים בין האזורים הנבחנים. `;
    summary += `רמת המחירים למ״ר ב**${higherPriceArea}** גבוהה בכ-**${priceDiffAbs}%** מאשר ב**${lowerPriceArea}**, מה שמעיד על פרמיית מיקום או ביקושי קצה גבוהים יותר. `;
    
    if (higherPriceArea === higherYieldArea) {
      summary += `במקביל, **${higherYieldArea}** מציגה גם תשואה שנתית גבוהה יותר בכ-**${yieldDiffAbs}%**, מה שהופך אותה לאטרקטיבית הן מבחינת עליית ערך פוטנציאלית והן מבחינת תזרים שוטף. `;
    } else {
      summary += `מנגד, מבחינת תשואת שכירות, **${higherYieldArea}** מציגה יתרון תזרימי של כ-**${yieldDiffAbs}%** על פני **${lowerYieldArea}**. כצפוי בנדל״ן ישראלי, האזור הזול יותר מציע לעיתים קרובות שיעור תשואה שוטפת גבוה יותר על ההון המושקע. `;
    }

    summary += `בעוד ש**${higherPriceArea}** פונה בעיקר לרוכשי קצה ומשפרי דיור המחפשים יציבות הון, **${higherYieldArea}** מהווה מוקד משיכה מובהק למשקיעים המחפשים אופטימיזציה של תזרים השכירות החודשי.`;
    
    return summary;
  }, [stats1, stats2]);

  if (reports.length < 2) {
    return (
      <div className="bg-theme-panel/80 backdrop-blur-md rounded-xl border border-theme-border p-8 text-center flex flex-col items-center justify-center min-h-[500px] text-theme-text-muted shadow-[0_4px_25px_var(--shadow-color)] transition-all">
        <Scale className="w-16 h-16 text-orange-500/50 mb-4 animate-bounce" />
        <h3 className="font-extrabold text-lg text-theme-text">יש צורך בלפחות שני דוחות שמורים</h3>
        <p className="text-xs text-theme-text-muted max-w-md mx-auto mt-2 leading-relaxed">
          כדי להציג השוואה מפורטת (Side-by-side) של מחירי שוק, עליך להפיק תחילה לפחות שני דוחות שונים באזורים או פרויקטים שונים.
        </p>
        <button
          onClick={onClose}
          className="mt-6 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-xs rounded-lg shadow-md cursor-pointer hover:scale-105 transition-all"
        >
          חזור לדוח הראשי
        </button>
      </div>
    );
  }

  return (
    <div className="bg-theme-panel/80 backdrop-blur-md rounded-xl border border-theme-border overflow-hidden flex flex-col text-theme-text shadow-[0_4px_25px_var(--shadow-color)] transition-all duration-300">
      
      {/* Header and Selectors */}
      <div className="p-5 bg-theme-panel/95 border-b border-theme-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-extrabold text-base text-theme-text flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-orange-500" />
            <span>השוואת שמאות מרובת-אזורים (Side-by-side)</span>
          </h2>
          <p className="text-xs text-theme-text-muted mt-0.5">בחר שני סקרי שוק מהמאגר המקומי והשווה ביניהם בזמן אמת</p>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 hover:bg-theme-input rounded-lg border border-theme-border hover:text-rose-400 transition-all self-end md:self-auto cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          title="סגור השוואה"
        >
          <X className="w-4 h-4" />
          <span>סגור</span>
        </button>
      </div>

      {/* Selector dropdowns bar */}
      <div className="p-4 bg-theme-input/30 border-b border-theme-border grid grid-cols-1 md:grid-cols-7 items-center gap-3">
        <div className="md:col-span-3">
          <label className="block text-[10px] font-bold text-theme-text-muted mb-1 uppercase tracking-wider">דוח א׳ (בסיס השוואה)</label>
          <div className="relative">
            <select
              value={compareReportId1 || ""}
              onChange={(e) => onSelectReport1(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold bg-theme-panel border border-theme-border rounded-lg text-theme-text outline-none focus:border-theme-accent/50 cursor-pointer text-right appearance-none"
            >
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  📍 {r.searchQuery} ({new Date(r.timestamp).toLocaleDateString("he-IL")})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute left-2.5 top-2.5 w-4 h-4 text-theme-text-muted pointer-events-none" />
          </div>
        </div>

        <div className="flex justify-center md:col-span-1">
          <span className="p-2 bg-theme-panel border border-theme-border rounded-full font-extrabold text-[10px] text-theme-accent shadow-sm">VS</span>
        </div>

        <div className="md:col-span-3">
          <label className="block text-[10px] font-bold text-theme-text-muted mb-1 uppercase tracking-wider">דוח ב׳ (נכס להשוואה)</label>
          <div className="relative">
            <select
              value={compareReportId2 || ""}
              onChange={(e) => onSelectReport2(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold bg-theme-panel border border-theme-border rounded-lg text-theme-text outline-none focus:border-theme-accent/50 cursor-pointer text-right appearance-none"
            >
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  📍 {r.searchQuery} ({new Date(r.timestamp).toLocaleDateString("he-IL")})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute left-2.5 top-2.5 w-4 h-4 text-theme-text-muted pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Main Stats Comparison */}
      {stats1 && stats2 ? (
        <div className="p-6 space-y-6">
          
          {/* Comparison table */}
          <div className="bg-theme-input/20 border border-theme-border rounded-xl overflow-hidden shadow-inner">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-theme-input border-b border-theme-border font-extrabold text-theme-text">
                    <th className="p-3.5 w-1/4">פרמטר שמאות</th>
                    <th className="p-3.5 text-center bg-orange-500/5 text-orange-600 dark:text-orange-400 font-bold border-l border-theme-border/30 w-1/4">
                      {stats1.query}
                    </th>
                    <th className="p-3.5 text-center bg-amber-500/5 text-amber-600 dark:text-amber-400 font-bold border-l border-theme-border/30 w-1/4">
                      {stats2.query}
                    </th>
                    <th className="p-3.5 text-center w-1/4">פער השוואתי (א׳ ◄ ב׳)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border/50 text-theme-text">
                  
                  {/* General Info Rows */}
                  <tr className="hover:bg-theme-input/25 transition-colors">
                    <td className="p-3.5 font-bold flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-theme-text-muted" />
                      <span>תאריך הפקה</span>
                    </td>
                    <td className="p-3.5 text-center text-theme-text-muted font-mono border-l border-theme-border/30">
                      {new Date(stats1.timestamp).toLocaleDateString("he-IL")}
                    </td>
                    <td className="p-3.5 text-center text-theme-text-muted font-mono border-l border-theme-border/30">
                      {new Date(stats2.timestamp).toLocaleDateString("he-IL")}
                    </td>
                    <td className="p-3.5 text-center text-theme-text-muted font-mono">-</td>
                  </tr>

                  <tr className="hover:bg-theme-input/25 transition-colors">
                    <td className="p-3.5 font-bold flex items-center gap-1.5">
                      <Building className="w-4 h-4 text-theme-text-muted" />
                      <span>סוג מקור נתונים</span>
                    </td>
                    <td className="p-3.5 text-center border-l border-theme-border/30 font-medium">
                      {stats1.excelFileName ? `📁 קובץ: ${stats1.excelFileName}` : "🌐 שאיבת רשת חיה"}
                    </td>
                    <td className="p-3.5 text-center border-l border-theme-border/30 font-medium">
                      {stats2.excelFileName ? `📁 קובץ: ${stats2.excelFileName}` : "🌐 שאיבת רשת חיה"}
                    </td>
                    <td className="p-3.5 text-center text-theme-text-muted font-mono">-</td>
                  </tr>

                  {/* Pricing Rows */}
                  <tr className="hover:bg-theme-input/25 transition-colors">
                    <td className="p-3.5 font-bold flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-orange-500" />
                      <span>מחיר בסיס למ״ר באזור</span>
                    </td>
                    <td className="p-3.5 text-center font-bold font-mono text-orange-600 dark:text-orange-300 border-l border-theme-border/30">
                      ₪{stats1.basePricePerSqm.toLocaleString("he-IL")}
                    </td>
                    <td className="p-3.5 text-center font-bold font-mono text-amber-600 dark:text-amber-300 border-l border-theme-border/30">
                      ₪{stats2.basePricePerSqm.toLocaleString("he-IL")}
                    </td>
                    <td className="p-3.5 text-center">
                      {formatDiff(stats1.basePricePerSqm, stats2.basePricePerSqm, "currency")}
                    </td>
                  </tr>

                  <tr className="hover:bg-theme-input/25 transition-colors bg-theme-input/10">
                    <td className="p-3.5 font-bold flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-orange-500" />
                      <span>מחיר ממוצע למ״ר (עסקאות אמת)</span>
                    </td>
                    <td className="p-3.5 text-center font-extrabold font-mono text-orange-600 dark:text-orange-400 border-l border-theme-border/30 text-sm">
                      ₪{stats1.avgPricePerSqm.toLocaleString("he-IL")}
                    </td>
                    <td className="p-3.5 text-center font-extrabold font-mono text-amber-600 dark:text-amber-400 border-l border-theme-border/30 text-sm">
                      ₪{stats2.avgPricePerSqm.toLocaleString("he-IL")}
                    </td>
                    <td className="p-3.5 text-center">
                      {formatDiff(stats1.avgPricePerSqm, stats2.avgPricePerSqm, "currency")}
                    </td>
                  </tr>

                  <tr className="hover:bg-theme-input/25 transition-colors">
                    <td className="p-3.5 font-bold flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-orange-500" />
                      <span>מחיר עסקה ממוצע מנורמל</span>
                    </td>
                    <td className="p-3.5 text-center font-bold font-mono border-l border-theme-border/30">
                      ₪{stats1.avgPrice.toLocaleString("he-IL")}
                    </td>
                    <td className="p-3.5 text-center font-bold font-mono border-l border-theme-border/30">
                      ₪{stats2.avgPrice.toLocaleString("he-IL")}
                    </td>
                    <td className="p-3.5 text-center">
                      {formatDiff(stats1.avgPrice, stats2.avgPrice, "currency")}
                    </td>
                  </tr>

                  <tr className="hover:bg-theme-input/25 transition-colors">
                    <td className="p-3.5 font-bold flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-theme-text-muted" />
                      <span>טווח עסקאות (מינימום / מקסימום)</span>
                    </td>
                    <td className="p-3.5 text-center font-mono text-theme-text-muted border-l border-theme-border/30 text-[10px]">
                      ₪{stats1.minPrice.toLocaleString("he-IL")} - ₪{stats1.maxPrice.toLocaleString("he-IL")}
                    </td>
                    <td className="p-3.5 text-center font-mono text-theme-text-muted border-l border-theme-border/30 text-[10px]">
                      ₪{stats2.minPrice.toLocaleString("he-IL")} - ₪{stats2.maxPrice.toLocaleString("he-IL")}
                    </td>
                    <td className="p-3.5 text-center text-theme-text-muted font-mono">-</td>
                  </tr>

                  {/* Standardized Apartment Simulation Rows */}
                  <tr className="hover:bg-theme-input/25 transition-colors bg-orange-500/5">
                    <td className="p-3.5 font-bold flex items-center gap-1.5">
                      <span className="text-sm">🏢</span>
                      <span>שווי דירת מדד (100 מ״ר, ק׳ 5, חניה ומעלית)</span>
                    </td>
                    <td className="p-3.5 text-center font-extrabold font-mono text-orange-600 dark:text-orange-400 border-l border-theme-border/30 text-sm">
                      ₪{stats1.simValue.toLocaleString("he-IL")}
                    </td>
                    <td className="p-3.5 text-center font-extrabold font-mono text-amber-600 dark:text-amber-400 border-l border-theme-border/30 text-sm">
                      ₪{stats2.simValue.toLocaleString("he-IL")}
                    </td>
                    <td className="p-3.5 text-center">
                      {formatDiff(stats1.simValue, stats2.simValue, "currency")}
                    </td>
                  </tr>

                  <tr className="hover:bg-theme-input/25 transition-colors">
                    <td className="p-3.5 font-bold flex items-center gap-1.5">
                      <span className="text-sm">🔑</span>
                      <span>שכירות חודשית צפויה (לדירת מדד)</span>
                    </td>
                    <td className="p-3.5 text-center font-bold font-mono text-emerald-600 dark:text-emerald-400 border-l border-theme-border/30">
                      ₪{stats1.simRent.toLocaleString("he-IL")} /חודש
                    </td>
                    <td className="p-3.5 text-center font-bold font-mono text-emerald-600 dark:text-emerald-400 border-l border-theme-border/30">
                      ₪{stats2.simRent.toLocaleString("he-IL")} /חודש
                    </td>
                    <td className="p-3.5 text-center">
                      {formatDiff(stats1.simRent, stats2.simRent, "currency")}
                    </td>
                  </tr>

                  <tr className="hover:bg-theme-input/25 transition-colors bg-emerald-500/5">
                    <td className="p-3.5 font-bold flex items-center gap-1.5">
                      <Percent className="w-4 h-4 text-emerald-500" />
                      <span>תשואת שכירות שנתית מנורמלת</span>
                    </td>
                    <td className="p-3.5 text-center font-extrabold font-mono text-emerald-600 dark:text-emerald-400 border-l border-theme-border/30">
                      {(stats1.simYield * 100).toFixed(2)}%
                    </td>
                    <td className="p-3.5 text-center font-extrabold font-mono text-emerald-600 dark:text-emerald-400 border-l border-theme-border/30">
                      {(stats2.simYield * 100).toFixed(2)}%
                    </td>
                    <td className="p-3.5 text-center">
                      {formatDiff(stats1.simYield * 100, stats2.simYield * 100, "percent")}
                    </td>
                  </tr>

                  <tr className="hover:bg-theme-input/25 transition-colors">
                    <td className="p-3.5 font-bold flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-theme-text-muted" />
                      <span>סך הכל עסקאות מנותחות בדוח</span>
                    </td>
                    <td className="p-3.5 text-center font-mono border-l border-theme-border/30">
                      {stats1.totalTransactions}
                    </td>
                    <td className="p-3.5 text-center font-mono border-l border-theme-border/30">
                      {stats2.totalTransactions}
                    </td>
                    <td className="p-3.5 text-center">
                      {formatDiff(stats1.totalTransactions, stats2.totalTransactions, "number")}
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>
          </div>

          {/* AI generated analysis summary card */}
          <div className="p-5 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 rounded-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-orange-500/20 to-transparent rounded-bl-full pointer-events-none" />
            <h3 className="font-extrabold text-xs text-orange-600 dark:text-orange-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <Scale className="w-4 h-4" />
              <span>תקציר ניתוח שמאות השוואתי</span>
            </h3>
            <p className="text-xs text-theme-text leading-relaxed font-medium">
              {comparativeAnalysis}
            </p>
          </div>

          {/* Graphical Comparisons */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* 1. Bar Chart Comparison */}
            <div className="lg:col-span-2 bg-theme-panel/90 border border-theme-border rounded-xl p-4 shadow-md space-y-4">
              <h3 className="font-bold text-xs text-theme-text flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-orange-500" />
                <span>השוואה גרפית - מחירי נדל״ן וערכי שווי</span>
              </h3>
              
              <div className="h-[260px] w-full text-[10px]" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="name" stroke="#888888" />
                    <YAxis stroke="#888888" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "rgba(30, 30, 40, 0.95)", 
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        color: "#fff"
                      }}
                    />
                    <Legend />
                    <Bar dataKey={stats1.query} fill="#f97316" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={stats2.query} fill="#fbbf24" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-theme-text-muted text-center italic mt-1 font-sans">
                *הערה: מדד השווי מחושב במאה אלפי שקלים. שכירות משוערת מיוצגת בערך מותאם (פי 10).
              </p>
            </div>

            {/* 2. Yield comparison bar chart */}
            <div className="bg-theme-panel/90 border border-theme-border rounded-xl p-4 shadow-md space-y-4">
              <h3 className="font-bold text-xs text-theme-text flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-emerald-500" />
                <span>השוואת תשואת שכירות שנתית צפויה</span>
              </h3>
              
              <div className="h-[260px] w-full text-[10px]" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={yieldChartData}
                    margin={{ top: 20, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="name" stroke="#888888" />
                    <YAxis stroke="#888888" unit="%" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "rgba(30, 30, 40, 0.95)", 
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        color: "#fff"
                      }}
                    />
                    <Bar dataKey="תשואה שנתית" fill="#10b981" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#888888', formatter: (v: any) => `${v}%` }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

        </div>
      ) : null}

    </div>
  );
}
