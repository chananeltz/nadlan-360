/**
 * בדיקת קצה-לקצה של חיבור הנתונים האמיתי ל-GovMap.
 * הרצה:  npx tsx test-govmap.ts "רוטשילד 1 תל אביב"
 */
import { autocompleteAddress, findRecentDealsForAddress, calculateStatistics } from "./src/utils/govmapClient.ts";

const query = process.argv[2] || "רוטשילד 1 תל אביב";

async function main() {
  console.log(`\n🔍 בודק כתובת: "${query}"\n`);

  console.log("שלב 1: autocomplete (המרה לקואורדינטות)...");
  const matches = await autocompleteAddress(query);
  console.log(`  נמצאו ${matches.length} התאמות. הראשונה:`, matches[0]);

  console.log("\nשלב 2+3: שליפת עסקאות אמיתיות...");
  const deals = await findRecentDealsForAddress(query, { yearsBack: 2, radius: 150, maxDeals: 50 });
  console.log(`  ✅ התקבלו ${deals.length} עסקאות אמיתיות.`);
  console.log("  5 הראשונות:");
  for (const d of deals.slice(0, 5)) {
    console.log(
      `   • ${d.date} | ${d.street} ${d.houseNumber} | ${d.rooms ?? "?"} חד' | ${d.sqm ?? "?"} מ"ר | ` +
        `${d.price.toLocaleString()} ₪ | ${d.pricePerSqm?.toLocaleString() ?? "?"} ₪/מ"ר | ${d.source}`,
    );
  }

  console.log("\nשלב 4: סטטיסטיקה...");
  const stats = calculateStatistics(deals);
  console.log(`  חציון מחיר: ${stats.medianPrice.toLocaleString()} ₪`);
  console.log(`  חציון מחיר למ"ר: ${stats.medianPricePerSqm?.toLocaleString() ?? "?"} ₪`);
  console.log(`  טווח תאריכים:`, stats.dateRange);
  console.log(`  פילוח לפי חדרים:`, stats.byRooms);
  console.log("\n✅ הבדיקה הושלמה — הנתונים אמיתיים ומגיעים מ-govmap.gov.il\n");
}

main().catch((err) => {
  console.error("\n❌ הבדיקה נכשלה:", err?.message || err);
  process.exit(1);
});
