/**
 * מעבד קובץ מודעות ידני (CSV/Excel) — למשל מודעות שראית בפייסבוק והזנת ידנית —
 * ומריץ עליהן את אותו סיווג חכם (מסחרי/יד-שנייה/מחיר למשתכן/חריגים),
 * ושומר Excel מסודר.
 *
 * הרצה:
 *   node scraper/classify-file.mjs "scraper/תבנית-ידנית.csv"
 *
 * עמודות מזוהות (עברית): עיר, שכונה, רחוב, מספר, חדרים, שטח, קומה, מחיר,
 *                        שנת בנייה, שנת מכירה, סוג, מקור.
 */
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { processRealEstateData } from "./classify.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputPath = process.argv[2];
if (!inputPath || !fs.existsSync(inputPath)) {
  console.error("שימוש: node scraper/classify-file.mjs <נתיב לקובץ CSV/Excel>");
  process.exit(1);
}

function num(v) {
  if (v == null || v === "") return null;
  const n = parseInt(String(v).replace(/[^\d-]/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

let wb;
if (/\.csv$/i.test(inputPath)) {
  // קריאת CSV כטקסט UTF-8 (מפענח עברית נכון, כולל הסרת BOM)
  const text = fs.readFileSync(inputPath, "utf8").replace(/^﻿/, "");
  wb = XLSX.read(text, { type: "string" });
} else {
  wb = XLSX.read(fs.readFileSync(inputPath), { type: "buffer" });
}
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

const listings = rows
  .map((r) => ({
    source: r["מקור"] || "ידני",
    city: r["עיר"] || "",
    neighborhood: r["שכונה"] || "",
    street: r["רחוב"] || r["כתובת"] || "",
    houseNumber: r["מספר"] || "",
    rooms: num(r["חדרים"]),
    sqm: num(r["שטח"] || r['שטח (מ"ר)']),
    floor: num(r["קומה"]),
    price: num(r["מחיר"] || r["מחיר מבוקש"]),
    buildYear: num(r["שנת בנייה"]),
    saleYear: num(r["שנת מכירה"]),
    type: r["סוג"] || "",
  }))
  .filter((x) => x.price);

if (!listings.length) {
  console.error("לא נמצאו שורות עם מחיר בקובץ. ודא שהעמודות בעברית ושיש ערכי מחיר.");
  process.exit(1);
}

const processed = processRealEstateData(listings);
const out = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  out,
  XLSX.utils.json_to_sheet(
    processed.all.map((d) => ({
      "מקור": listings[d.idx]?.source || "ידני",
      "עיר": d.city,
      "שכונה": d.neighborhood,
      "רחוב": d.street,
      "מספר": d.houseNumber,
      "חדרים": d.rooms,
      'שטח (מ"ר)': d.sqm || "",
      "קומה": d.floor || "",
      "מחיר (₪)": d.price || "",
      'מחיר למ"ר (₪)': d.pricePerSqm || "",
      "סיווג": d.saleType,
      "מחיר למשתכן?": d.isMechirLamishtaken ? "כן" : "",
      "חריג?": d.isOutlier ? "כן" : "",
    })),
  ),
  "מודעות מסווגות",
);
if (processed.summary.length)
  XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(processed.summary), "סיכום השוואתי");

const outPath = inputPath.replace(/\.(csv|xlsx)$/i, "") + "-מסווג.xlsx";
fs.writeFileSync(outPath, XLSX.write(out, { type: "buffer", bookType: "xlsx" }));
console.log(`✅ נשמר: ${outPath}`);
console.log(
  `סיווג: יד-שנייה ${processed.secondHand.length} | מקבלן ${processed.firstHand.length} | ` +
    `מחיר למשתכן ${processed.mechirLamishtaken.length} | חריגים ${processed.outliers.length}`,
);
