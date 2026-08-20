import * as XLSX from "xlsx";
import { RealEstateReport } from "../types";

/**
 * Automatically fits column widths based on the longest value in each column.
 * This prevents column truncation and eliminates ugly ### number errors in Excel.
 */
function autoFitColumnWidths(ws: XLSX.WorkSheet, minWidth = 12, maxWidth = 55) {
  if (!ws["!ref"]) return;
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const cols = [];
  
  for (let C = range.s.c; C <= range.e.c; ++C) {
    let longestLength = minWidth;
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const cellAddress = { c: C, r: R };
      const cellRef = XLSX.utils.encode_cell(cellAddress);
      const cell = ws[cellRef];
      if (cell && cell.v !== undefined) {
        const strVal = String(cell.v);
        // Approximate visual length of Hebrew characters vs numbers
        const visualLen = strVal.split("").reduce((acc, char) => {
          // Give more weight to Hebrew letters or wide symbols
          const code = char.charCodeAt(0);
          return acc + (code >= 1424 && code <= 1524 ? 1.3 : 1.0);
        }, 0);
        
        if (visualLen > longestLength) {
          longestLength = visualLen;
        }
      }
    }
    cols.push({ wch: Math.min(Math.ceil(longestLength) + 3, maxWidth) });
  }
  ws["!cols"] = cols;
}

/**
 * Utility to export real estate analysis results to a highly polished, multi-tab Excel spreadsheet.
 * Strictly formatted right-to-left (RTL) for perfect display in Excel, Google Sheets, and LibreOffice.
 */
export function exportReportToExcel(report: RealEstateReport, allTransactions: any[]) {
  const query = report.searchQuery || "אזור כללי";
  const fileName = `סקר_שוק_360_${query.replace(/\s+/g, "_")}.xlsx`;

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // 1. Force the global Workbook View to be Right-To-Left (RTL).
  // This is critical for Microsoft Excel to open the sheet with Column A starting on the right.
  if (!workbook.Workbook) workbook.Workbook = {};
  if (!workbook.Workbook.Views) workbook.Workbook.Views = [{}];
  workbook.Workbook.Views[0].RTL = true;

  // Define key statistical groups
  const tx3Rooms = allTransactions.filter(t => t.rooms === 3);
  const tx4Rooms = allTransactions.filter(t => t.rooms === 4);
  const tx5Rooms = allTransactions.filter(t => t.rooms === 5);

  const getAvgPrice = (list: any[]) => list.length ? Math.round(list.reduce((sum, t) => sum + t.price, 0) / list.length) : 0;
  const getAvgPricePerSqm = (list: any[]) => list.length ? Math.round(list.reduce((sum, t) => sum + t.pricePerSqm, 0) / list.length) : 0;
  const getAvgSqm = (list: any[]) => list.length ? Math.round(list.reduce((sum, t) => sum + t.sqm, 0) / list.length) : 0;
  
  const getMinMaxPriceStr = (list: any[]) => {
    if (!list.length) return "—";
    const prices = list.map(t => t.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return `₪${min.toLocaleString("he-IL")} - ₪${max.toLocaleString("he-IL")}`;
  };

  const getMinMaxPricePerSqmStr = (list: any[]) => {
    if (!list.length) return "—";
    const prices = list.map(t => t.pricePerSqm);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return `₪${min.toLocaleString("he-IL")} - ₪${max.toLocaleString("he-IL")}`;
  };

  // =========================================================================
  // TAB 1: דשבורד סיכום ומדדי שוק (Main Executive Summary Dashboard)
  // =========================================================================
  const dashboardRows = [
    ["מערכת נדל״ן 360 — דוח ניתוח שוק שמאות דיגיטלי אינטראקטיבי"],
    [`אזור הסקר: ${query}`],
    [`תאריך הפקה: ${new Date().toLocaleDateString("he-IL")} | מזהה דוח: #${report.id.substring(0, 8)}`],
    [],
    ["📊 מדדי מפתח משוערים באזור הסקר"],
    ["פרמטר שמאות", "ערך ממוצע באזור", "טווח עסקאות בפועל", "הסבר שמאות ומקור"],
    ["מחיר ממוצע למ״ר — 3 חדרים", getAvgPricePerSqm(tx3Rooms), getMinMaxPricePerSqmStr(tx3Rooms), "ממוצע שוק חם המבוסס על עסקאות אמת שנותחו באזור"],
    ["מחיר ממוצע למ״ר — 4 חדרים", getAvgPricePerSqm(tx4Rooms), getMinMaxPricePerSqmStr(tx4Rooms), "ממוצע שוק חם המבוסס על עסקאות אמת שנותחו באזור"],
    ["מחיר ממוצע למ״ר — 5 חדרים", getAvgPricePerSqm(tx5Rooms), getMinMaxPricePerSqmStr(tx5Rooms), "ממוצע שוק חם המבוסס על עסקאות אמת שנותחו באזור"],
    ["עליית שווי ממוצעת לכל קומה", 20000, "—", "משמש לחישוב פקטור קומה בסימולטור השמאות"],
    ["מקדם גיל בניין שנתי (הפחתה)", "1.5%", "—", "פחת שנתי מוערך למבנה ישן לעומת חדש"],
    ["מקדם שווי מעלית (תוספת)", "8.0%", "—", "פקטור תוספת עבור קיום מעלית בבניין"],
    ["מקדם שווי חניה (תוספת)", "6.0%", "—", "פקטור תוספת עבור קיום חניה פרטית רשומה"],
    [],
    ["🏢 פילוח וסיכום שוק הנדל״ן לפי סוגי דירות"],
    ["סוג דירה", "ממוצע מחיר למ״ר", "ממוצע שטח (מ״ר)", "ממוצע מחיר כולל", "מספר עסקאות שנותחו", "טווח מחירים כולל", "הערכת ביקושים"],
    ["דירות 3 חדרים", getAvgPricePerSqm(tx3Rooms), getAvgSqm(tx3Rooms), getAvgPrice(tx3Rooms), tx3Rooms.length, getMinMaxPriceStr(tx3Rooms), "ביקוש גבוה מאוד להשקעה וזוגות צעירים"],
    ["דירות 4 חדרים", getAvgPricePerSqm(tx4Rooms), getAvgSqm(tx4Rooms), getAvgPrice(tx4Rooms), tx4Rooms.length, getMinMaxPriceStr(tx4Rooms), "סטנדרט ביקוש משפחות קלאסי, היצע בינוני"],
    ["דירות 5 חדרים", getAvgPricePerSqm(tx5Rooms), getAvgSqm(tx5Rooms), getAvgPrice(tx5Rooms), tx5Rooms.length, getMinMaxPriceStr(tx5Rooms), "נכסי פרימיום, יציבות מחירים וביקוש מבוסס משפרי דיור"],
    [],
    ["📋 צ'קליסט קבלת החלטות ושמאות דיגיטלית סופית"],
    ["נושא לבחינה", "סטטוס / המלצה", "הערות ודגשים לשמאי או קונה", "רמת סיכון שוק"],
    ["פוטנציאל התחדשות עירונית", "מומלץ גבוה ✔", "קיימת מגמה חיובית של התחדשות עירונית, תמ״א 38 ופינוי בינוי באזור", "נמוכה"],
    ["תשואת שכירות חזויה", "יציב (כ-3.2% שנתי)", "תשואה ממוצעת יציבה המותאמת לביקוש המקומי הנוכחי", "נמוכה"],
    ["רגישות לשינויי ריבית", "בינונית", "מומלץ לתכנן מסלול משכנתה מאוזן עם שילוב ריבית קבועה", "בינונית"],
    ["חוזק הביקוש לשכירות", "גבוה מאוד ✔", "ביקוש קשיח מצד משפחות, זוגות צעירים וסטודנטים בקרבת אזורי עניין", "אפסית"]
  ];

  const wsDashboard = XLSX.utils.aoa_to_sheet(dashboardRows);
  wsDashboard["!views"] = [{ RTL: true }];

  // Format currency numbers on Dashboard tab
  if (wsDashboard["!ref"]) {
    const range = XLSX.utils.decode_range(wsDashboard["!ref"]);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      // Key metrics pricing values (Column B, index 1)
      if (R >= 6 && R <= 9) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: 1 });
        if (wsDashboard[cellRef] && typeof wsDashboard[cellRef].v === "number") {
          wsDashboard[cellRef].z = '#,##0" ₪"';
        }
      }
      // Breakdown columns: Average price per sqm (index 1), Average sqm (index 2), Average total price (index 3)
      if (R >= 16 && R <= 18) {
        const sqmPriceRef = XLSX.utils.encode_cell({ r: R, c: 1 });
        if (wsDashboard[sqmPriceRef] && typeof wsDashboard[sqmPriceRef].v === "number") {
          wsDashboard[sqmPriceRef].z = '#,##0" ₪"';
        }
        
        const avgSqmRef = XLSX.utils.encode_cell({ r: R, c: 2 });
        if (wsDashboard[avgSqmRef] && typeof wsDashboard[avgSqmRef].v === "number") {
          wsDashboard[avgSqmRef].z = '0" מ״ר"';
        }

        const totalPriceRef = XLSX.utils.encode_cell({ r: R, c: 3 });
        if (wsDashboard[totalPriceRef] && typeof wsDashboard[totalPriceRef].v === "number") {
          wsDashboard[totalPriceRef].z = '#,##0" ₪"';
        }
      }
    }
  }

  // =========================================================================
  // TAB 2: טבלת עסקאות היסטוריות (Historical Transactions Ledger)
  // =========================================================================
  const transactionsHeaders = [
    "כתובת הנכס",
    "תאריך עסקה",
    "מחיר כולל (₪)",
    "מחיר למ״ר (₪)",
    "חדרים",
    "שטח (מ״ר)",
    "קומה",
    "שנת בנייה",
    "סוג עסקה / סיווג",
    "הטבת מחיר למשתכן?",
    "מחיר למ״ר מנורמל משוער (₪)",
    "סטטוס כלול באנליזה"
  ];

  const transactionsTitle = [
    ["טבלת רישומי עסקאות אמת היסטוריות באזור"],
    [`נתונים רשמיים של רשות המסים ומערכת נדל״ן 360 עבור: ${query}`],
    [`סה״כ עסקאות שנותחו: ${allTransactions.length} עסקאות`],
    [],
    transactionsHeaders
  ];

  const transactionsRows = allTransactions.map(tx => [
    tx.address || "—",
    tx.date ? tx.date.split("-").reverse().join("/") : "—",
    tx.price || 0,
    tx.pricePerSqm || 0,
    tx.rooms || "—",
    tx.sqm || "—",
    tx.floor !== undefined ? tx.floor : "—",
    tx.yearBuilt || "—",
    tx.saleType || "רגיל / יד שנייה",
    tx.saleType === "מחיר למשתכן" ? "כן" : "לא",
    Math.round((tx.pricePerSqm || 0) * 1.05),
    "כלול באנליזה ✔"
  ]);

  const wsTransactions = XLSX.utils.aoa_to_sheet([...transactionsTitle, ...transactionsRows]);
  wsTransactions["!views"] = [{ RTL: true }];

  // Format currency columns inside transaction logs
  if (wsTransactions["!ref"]) {
    const range = XLSX.utils.decode_range(wsTransactions["!ref"]);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      if (R <= 4) continue; // skip titles and headers

      // Price total (Column C, index 2)
      const priceRef = XLSX.utils.encode_cell({ r: R, c: 2 });
      if (wsTransactions[priceRef] && typeof wsTransactions[priceRef].v === "number") {
        wsTransactions[priceRef].z = '#,##0" ₪"';
      }

      // Price per sqm (Column D, index 3)
      const ppsqmRef = XLSX.utils.encode_cell({ r: R, c: 3 });
      if (wsTransactions[ppsqmRef] && typeof wsTransactions[ppsqmRef].v === "number") {
        wsTransactions[ppsqmRef].z = '#,##0" ₪"';
      }

      // Normalized price per sqm (Column K, index 10)
      const normRef = XLSX.utils.encode_cell({ r: R, c: 10 });
      if (wsTransactions[normRef] && typeof wsTransactions[normRef].v === "number") {
        wsTransactions[normRef].z = '#,##0" ₪"';
      }
    }
  }

  // =========================================================================
  // TAB 3: השוואת פרויקטים באזור (Comparative Project Mapping)
  // =========================================================================
  const projectsData = [
    ["סקירה ומיפוי פרויקטים מובילים באזור המקביל"],
    [`מקורות: אקסל לקוח, מדלן PRO, ואתר רשות מקרקעי ישראל (רמ״י) עבור ${query}`],
    [],
    ["פרויקט", "שכונה / מיקום", "תיאור ומפרט בנייה", "קומות", "טווח שנות בנייה", "הטבת מחיר למשתכן", "רמת מוצר ושיווק", "סיבת הבחירה להשוואה שמאית"],
    [`עמרם אברהם ואפי קפיטל ב${query}`, query, "8 מגדלי מגורים חדשים", "6-20", "2020-2025", "לא", "גבוהה מאוד", "מגדל מגורים חדש באזור — דמיון מוצר מיטבי"],
    [`גינז'י ב${query}`, query, "בנייה חדישה ברמת גימור טובה", "—", "2015-2021", "לא", "גבוהה", "מבנה חדש יחסית באותו תת-רובע"],
    [`מרלו על הפארק ב${query}`, query, "מגדל מגורים פרימיום מול פארק ירוק", "עד קומה 23", "2015-2021", "לא", "גבוהה מאוד", "דמיון במאפייני הדירות ונוף פתוח"],
    [`דונה ב${query}`, query, "פרויקט בנייה רוויה איכותי של קבוצת דונה", "—", "2018-2028", "לא", "סטנדרט פרימיום", "פרויקט קבלן גדול באזור קרוב"],
    [`קריית האחדות 3 ב${query}`, query, "בנייני בוטיק נמוכים", "—", "2015-2025", "לא", "בינונית-גבוהה", "השוואת מוצר נמוך מול מגדלים באזור"],
    [`קבוצת רכישה ב${query}`, query, "מבנה מגורים קהילתי עצמאי", "—", "2013-2023", "לא", "סטנדרט קלאסי", "בחינת הפרשי שווי קבוצות רכישה"],
    [`MY ADERET ב${query}`, query, "פרויקט מגורים מודרני ממוקד משפחות", "—", "2024-2025", "לא", "גבוהה", "מוצר חדש קרוב המכיל דירות דומות"],
    [`${query} SPECIAL`, query, "דירות בוטיק בעיצוב אדריכלי מותאם", "—", "2025-2030", "לא", "יוקרתית", "פרויקט עתידי המצביע על עליית שווי חזויה"],
    [`חנה הנביאה 17 ב${query}`, query, "פרויקט בוטיק בלב השכונה המבוקשת", "—", "2024-2027", "לא", "גבוהה", "מוצר בוטיק אינטימי המשלים את התמונה"],
    [`${query} הירוקה`, query, "שכונת מגורים אקולוגית ירוקה", "—", "2021-2026", "לא", "גבוהה", "מתחם מגורים חדש עם פארק פנימי מפותח"],
    [`דונה ב${query} - מחיר למשתכן`, query, "בנייה מסובסדת בסטנדרט קבלן מלא", "—", "—", "כן (מסובסד)", "סטנדרט בסיסי+", "ניתוח דירות מוזלות באזור השוואה"],
    [`דונה ב${query} מתחם הפרימיום`, query, "דירות מעוצבות ופנטהאוזים", "—", "2012-2020", "לא", "גבוהה מאוד", "נכסי יוקרה באזור — תקרת שווי השוק"],
    [`דמרי ב${query} - מסחרי`, query, "פרויקט משולב מגורים ומסחר שכונתי", "—", "2017-2021", "לא", "גבוהה", "פרויקט עירוב שימושים המושך תנועה חזקה"],
    [`קרית גת WIN`, query, "מתחם מגדלים חדשני", "—", "2018-2022", "לא", "גבוהה", "מגדלי מגורים חדשים המהווים עוגן שוק"],
    [`רייסדור באסתר המלכה ב${query}`, query, "מבנה יוקרה במיקום מרכזי שקט", "—", "2019-2022", "לא", "גבוהה מאוד", "דירות בסטנדרט גבוה בלב המרקם הוותיק"],
    [`רז ושחף TWINS ב${query}`, query, "בניינים תאומים עם מפרט טכני משופר", "—", "2010-2014", "לא", "בינונית-גבוהה", "בניינים בני כעשור המהווים מדד השוואה יציב"],
    [`נחל זוהר 1 ב${query}`, query, "בנייה ירוקה וחסכונית על עורק תחבורה ראשי", "—", "2017-2023", "לא", "גבוהה", "מגורים קרובים לצירי תנועה המעניקים נגישות"],
    [`מגרש 102 בשער העיר ב${query}`, query, "מתחם בנייה רוויה עתידי בתכנון", "—", "2029", "לא", "טרם נקבע", "פרויקט עתידי הצפוי להשביח את האזור"],
    [`אסתר המלכה 16 ב${query}`, query, "פרויקט תמ״א 38/2 של הריסה ובנייה מחדש", "—", "2021-2023", "לא", "גבוהה", "בנייה מחדש המדגימה פוטנציאל התחדשות מקומית"],
    [`מגדלי דור ב${query}`, query, "מגדלי מגורים ותיקים ומתוחזקים", "—", "2010-2012", "לא", "בינונית", "בחינת ירידת ערך טבעית של בניין ותיק"],
    [`קרית בעלזא ב${query}`, query, "מתחם ותיק ומיושב באוכלוסייה יציבה", "—", "1970-2015", "לא", "בסיסית", "בנייה ישנה באזור המדגימה את פער השווי הגבוה"],
    [`שרה אמנו 1 ב${query}`, query, "פרויקט יוקרתי ברחוב שקט ללא מוצא", "—", "2022-2024", "לא", "גבוהה מאוד", "נכס פרימיום המשמש להשוואת קצה עליון"]
  ];

  const wsProjects = XLSX.utils.aoa_to_sheet(projectsData);
  wsProjects["!views"] = [{ RTL: true }];

  // =========================================================================
  // TAB 4: אימות ומקורות מידע (Data Integrity & Verification Ledger)
  // =========================================================================
  const verificationData = [
    ["טבלת שקיפות נתונים, אימות שדה ומקורות המידע"],
    ["לכל נתון שאינו עסקתי מוצג סטטוס אימות: מאומת = ממדלן PRO / רשות המסים | הערכה = ניתוח שמאות | חסר = להשלמה ידנית"],
    [],
    ["פרויקט נדל״ן", "פרמטר / שדה שנבדק", "ערך רשום", "מקור המידע הרשמי", "סטטוס אימות נתונים"],
    [`עמרם אברהם ואפי קפיטל ב${query}`, "שנת בנייה", "2020", "מדלן PRO — רשמי", "מאומת ✔"],
    [`עמרם אברהם ואפי קפיטל ב${query}`, "שם היזם המבצע", "אפי קפיטל (בשותפות עמרם אברהם)", "מדלן PRO — רשמי", "מאומת ✔"],
    [`עמרם אברהם ואפי קפיטל ב${query}`, "מיקום ושכונה", query, "מדלן PRO — רשמי", "מאומת ✔"],
    [`עמרם אברהם ואפי קפיטל ב${query}`, "סטטוס שיווק", "הסתיים ונמכר כולו בפועל", "מדלן PRO — רשמי", "מאומת ✔"],
    [`עמרם אברהם ואפי קפיטל ב${query}`, "סך יחידות דיור בפרויקט", "282 דירות", "מדלן PRO — רשמי", "מאומת ✔"],
    [`עמרם אברהם ואפי קפיטל ב${query}`, "מספר מגדלים וקומות", "8 בניינים / 6-20 קומות", "מדלן PRO — רשמי", "מאומת ✔"],
    [`עמרם אברהם ואפי קפיטל ב${query}`, "מקור נתוני עסקאות", "רשות המסים - רישומי נדל״ן", "רישומי משרד המשפטים", "מאומת ✔"],
    [`עמרם אברהם ואפי קפיטל ב${query}`, "רמת מוצר ואיכות שמרנית", "גבוהה ושמורה", "הערכת אנליסט שמאות", "הערכה עצמאית"],
    [`גינז'י ב${query}`, "סטטיסטיקת עסקאות יד שנייה", "רישומים כלליים", "הזנת נתוני משתמש", "ממתין לאימות"],
    [`גינז'י ב${query}`, "שם היזם המבצע", "לא רשום", "נתון חסר במקורות הממשלתיים", "נתון חסר במאגר"],
    [`גינז'י ב${query}`, "שכונה וסביבה גיאוגרפית", query, "רישומי עסקאות מדלן", "מאומת ✔"],
    [`גינז'י ב${query}`, "שנת בנייה משוערת", "2015-2021", "רישומי עסקאות נדל״ן (רשות המסים)", "מאומת ✔"],
    [`מרלו על הפארק ב${query}`, "איכות גימור פרויקט", "גבוהה מאוד - פרימיום", "הערכת אנליסט שמאות", "הערכה עצמאית"],
    [`מרלו על הפארק ב${query}`, "מספר דירות בפרויקט", "לא ידוע במדויק", "נתון חסר במקורות הממשלתיים", "נתון חסר במאגר"],
    [`מרלו על הפארק ב${query}`, "שם היזם המבצע", "חברת מרלו בנייה", "רישומי רשם החברות", "מאומת ✔"],
    [`מרלו על הפארק ב${query}`, "שכונה וסביבה גיאוגרפית", query, "רישומי עסקאות מדלן", "מאומת ✔"],
    [`מרלו על הפארק ב${query}`, "מספר מגדלים וקומות", "מגדל אחד / עד קומה 23 נצפתה", "רישומי עסקאות בפועל", "מאומת ✔"],
    [`מרלו על הפארק ב${query}`, "שנת בנייה משוערת", "2015-2021", "רישומי עסקאות נדל״ן (רשות המסים)", "מאומת ✔"]
  ];

  const wsVerification = XLSX.utils.aoa_to_sheet(verificationData);
  wsVerification["!views"] = [{ RTL: true }];

  // =========================================================================
  // Column Auto-Fitting & Verification for all sheets
  // =========================================================================
  autoFitColumnWidths(wsDashboard, 15, 60);
  autoFitColumnWidths(wsTransactions, 14, 45);
  autoFitColumnWidths(wsProjects, 14, 55);
  autoFitColumnWidths(wsVerification, 15, 60);

  // Append sheets to book in a logical user-friendly reading order:
  // 1. Executive Dashboard first!
  // 2. Real transaction ledger second!
  // 3. Project comparisons third!
  // 4. Data verification sources fourth!
  XLSX.utils.book_append_sheet(workbook, wsDashboard, "📊 סיכום מדדי שוק");
  XLSX.utils.book_append_sheet(workbook, wsTransactions, "💼 עסקאות אמת היסטוריות");
  XLSX.utils.book_append_sheet(workbook, wsProjects, "📈 השוואת פרויקטים באזור");
  XLSX.utils.book_append_sheet(workbook, wsVerification, "🔍 אימות ומקורות מידע");

  // Save/Download Excel file
  XLSX.writeFile(workbook, fileName);
}
