/**
 * מייצר אייקוני PWA (PNG) מתוך SVG, דרך Playwright.
 * שתי גרסאות: "any" (רקע מעוגל, סמל גדול) ו-"maskable" (רקע מלא, סמל מוקטן
 * בתוך אזור הבטוח, כדי שלא ייחתך כשאנדרואיד מחיל מסכת עיגול/סקווירקל).
 *
 * הרצה: node scripts/gen-icons.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

const INDIGO = "#4f46e5";

// סמל הבניין (lucide Building2) — קווי, במערכת קואורדינטות 24x24.
const glyph = `
  <g fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
    <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
    <path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>
  </g>`;

/** בונה מחרוזת SVG בגודל נתון. maskable → רקע מלא + סמל מוקטן. */
function svg(size, maskable) {
  const bg = maskable
    ? `<rect width="24" height="24" fill="${INDIGO}"/>`
    : `<rect width="24" height="24" rx="5.2" fill="${INDIGO}"/>`;
  // maskable: סמל ב-60% מרכזי (אזור בטוח). any: 78%.
  const scale = maskable ? 0.6 : 0.78;
  const t = (24 - 24 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
    ${bg}
    <g transform="translate(${t} ${t}) scale(${scale})">${glyph}</g>
  </svg>`;
}

// שומרים גם SVG חד (למקורות שתומכים בו).
writeFileSync(join(__dirname, "..", "public", "icon.svg"), svg(512, false));

const targets = [
  { name: "icon-192.png", size: 192, maskable: false },
  { name: "icon-512.png", size: 512, maskable: false },
  { name: "icon-maskable-192.png", size: 192, maskable: true },
  { name: "icon-maskable-512.png", size: 512, maskable: true },
  { name: "apple-touch-icon.png", size: 180, maskable: false },
];

const { chromium } = await import("playwright");

async function launch() {
  // מנסים דפדפן מובנה; אם לא הותקן — נופלים ל-Chrome/Edge של המערכת.
  for (const opts of [{}, { channel: "chrome" }, { channel: "msedge" }]) {
    try {
      return await chromium.launch(opts);
    } catch {}
  }
  throw new Error("לא נמצא דפדפן ל-Playwright. הרץ: npx playwright install chromium");
}

const browser = await launch();
const page = await browser.newPage();
for (const t of targets) {
  const markup = svg(t.size, t.maskable);
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0}</style>${markup}`,
    { waitUntil: "networkidle" },
  );
  const buf = await page.screenshot({
    clip: { x: 0, y: 0, width: t.size, height: t.size },
    omitBackground: false,
  });
  writeFileSync(join(outDir, t.name), buf);
  console.log(`✓ ${t.name} (${t.size}px${t.maskable ? ", maskable" : ""})`);
}
await browser.close();
console.log("האייקונים נוצרו ב-public/icons/");
