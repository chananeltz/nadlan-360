/**
 * סיווג ועיבוד נתוני נדל"ן — פורט מהלוגיקה שהייתה ב-processRealEstateData
 * (מתוך קובץ ה-ZIP המקורי), מותאם לשדות הזמינים ממודעות/עסקאות.
 *
 * שלבי העיבוד:
 *   1. סינון עסקאות 'מסחרי'.
 *   2. סיווג יד-שנייה / חדש מקבלן (פער שנים בין בנייה למכירה >= 3).
 *   3. זיהוי 'מחיר למשתכן' (מחיר נמוך מ-85% מחציון הקבוצה).
 *   4. זיהוי חריגים (סטייה של 30% מממוצע הקבוצה).
 *   5. נירמול מחיר למ"ר לקומה 1 (1% לקומה).
 *   6. טבלת סיכום השוואתית לפי קבוצות (רחוב/פרויקט + חדרים).
 */

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * @param {Array} listings אובייקטים עם: price, sqm, rooms, floor, street/project,
 *   ואופציונלית buildYear, saleYear, type, date.
 */
export function processRealEstateData(listings) {
  // 1. סינון מסחרי + שורות בלי מחיר/שטח
  const filtered = listings.filter((t) => {
    const type = String(t.type || "").toLowerCase();
    const isCommercial = type.includes("commercial") || type.includes("מסחרי") || type.includes("משרד") || type.includes("חנות");
    return !isCommercial && Number(t.price) > 0;
  });

  // 2. סיווג יד-שנייה / חדש מקבלן
  const classified = filtered.map((t, i) => {
    const price = Number(t.price) || 0;
    const sqm = Number(t.sqm) || 0;
    const buildYear = Number(t.buildYear) || null;
    const saleYear = Number(t.saleYear) || (t.date ? parseInt(String(t.date).slice(0, 4), 10) : null);
    let saleType = "לא ידוע";
    if (buildYear && saleYear) {
      saleType = saleYear - buildYear >= 3 ? "יד שנייה" : "חדש מקבלן";
    }
    const floor = Number(t.floor) || 0;
    return {
      idx: i,
      project: t.street || t.project || t.neighborhood || "כללי",
      rooms: t.rooms != null ? Number(t.rooms) || String(t.rooms) : "",
      price,
      sqm,
      floor,
      street: t.street || "",
      houseNumber: t.houseNumber || "",
      city: t.city || "",
      neighborhood: t.neighborhood || "",
      buildYear,
      saleYear,
      saleType,
      pricePerSqm: sqm > 0 ? Math.round(price / sqm) : 0,
      normalizedPricePerSqm: 0,
      isMechirLamishtaken: false,
      isOutlier: false,
    };
  });

  // קיבוץ לפי פרויקט+חדרים
  const groups = new Map();
  for (const t of classified) {
    const key = `${t.project}__${t.rooms}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }

  // 3. מחיר למשתכן — מתחת ל-85% מחציון הקבוצה
  for (const [, arr] of groups) {
    const med = median(arr.map((t) => t.price));
    for (const t of arr) if (t.price < med * 0.85) t.isMechirLamishtaken = true;
  }

  // 4. חריגים — סטייה של 30% מממוצע הקבוצה (בלי מחיר למשתכן)
  for (const [, arr] of groups) {
    const valid = arr.filter((t) => !t.isMechirLamishtaken);
    if (!valid.length) continue;
    const avg = valid.reduce((s, t) => s + t.price, 0) / valid.length;
    for (const t of valid) if (t.price > avg * 1.3 || t.price < avg * 0.7) t.isOutlier = true;
  }

  // 5. נירמול מחיר למ"ר לקומה 1
  for (const t of classified) {
    const factor = t.floor > 1 ? 1 + (t.floor - 1) * 0.01 : 1;
    t.normalizedPricePerSqm = t.pricePerSqm ? Math.round(t.pricePerSqm / factor) : 0;
  }

  // 6. טבלת סיכום השוואתית
  const summary = [];
  for (const [key, arr] of groups) {
    const clean = arr.filter((t) => !t.isMechirLamishtaken && !t.isOutlier);
    const [project, rooms] = key.split("__");
    summary.push({
      project,
      rooms,
      עסקאות_תקינות: clean.length,
      מחיר_ממוצע: clean.length ? Math.round(clean.reduce((s, t) => s + t.price, 0) / clean.length) : 0,
      מחיר_למר_מנורמל_ממוצע: clean.length
        ? Math.round(clean.reduce((s, t) => s + t.normalizedPricePerSqm, 0) / clean.length)
        : 0,
    });
  }

  return {
    all: classified,
    firstHand: classified.filter((t) => t.saleType === "חדש מקבלן" && !t.isMechirLamishtaken && !t.isOutlier),
    secondHand: classified.filter((t) => t.saleType === "יד שנייה" && !t.isMechirLamishtaken && !t.isOutlier),
    mechirLamishtaken: classified.filter((t) => t.isMechirLamishtaken),
    outliers: classified.filter((t) => t.isOutlier),
    summary,
  };
}
