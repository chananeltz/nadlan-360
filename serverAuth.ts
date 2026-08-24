/**
 * התחברות ואיפוס סיסמה בצד השרת.
 *
 * למה בשרת ולא בדפדפן: עד עכשיו הסיסמה הייתה כתובה בקוד ה-React, כלומר
 * כל מי שפתח את קוד המקור של האתר יכול היה לקרוא אותה. כאן נשמר רק גיבוב
 * (hash) עם מלח (salt), והסיסמה עצמה לא קיימת בשום מקום — גם לא אצלנו.
 *
 * שכבת האחסון: קובץ קטן לצד הקוד. באירוח בשכבה חינמית (Render) הדיסק
 * מתאפס בהפעלה מחדש, ואז המערכת חוזרת לסיסמה שבמשתני הסביבה — וזה בדיוק
 * מנגנון "איפוס למצב התחלתי" אם שוכחים את הסיסמה החדשה.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import fs from "fs";
import path from "path";

const STATE_FILE = path.join(process.cwd(), "auth-state.json");

const DEFAULT_USER = process.env.AUTH_USER || "chananel";
const DEFAULT_PASSWORD = process.env.AUTH_PASSWORD || "Nadlan#360";

interface AuthState {
  user: string;
  salt: string;
  hash: string;
  updatedAt: string;
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

function buildState(user: string, password: string): AuthState {
  const salt = randomBytes(16).toString("hex");
  return {
    user,
    salt,
    hash: hashPassword(password, salt),
    updatedAt: new Date().toISOString(),
  };
}

let cached: AuthState | null = null;

function loadState(): AuthState {
  if (cached) return cached;
  try {
    if (fs.existsSync(STATE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
      if (parsed?.user && parsed?.salt && parsed?.hash) {
        cached = parsed as AuthState;
        return cached;
      }
    }
  } catch (error) {
    console.warn("[auth] קריאת מצב ההתחברות נכשלה, חוזרים לברירת המחדל:", error);
  }
  cached = buildState(DEFAULT_USER, DEFAULT_PASSWORD);
  return cached;
}

function saveState(state: AuthState): boolean {
  cached = state;
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
    return true;
  } catch (error) {
    // דיסק לקריאה בלבד: הסיסמה תעבוד עד להפעלה מחדש ואז תחזור לברירת המחדל.
    console.warn("[auth] שמירת הסיסמה לדיסק נכשלה (זמנית בלבד):", error);
    return false;
  }
}

/** השוואה עמידה בפני מדידת זמן — מונעת ניחוש סיסמה לפי משך התגובה. */
function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyCredentials(user: string, password: string): boolean {
  const state = loadState();
  if ((user || "").trim() !== state.user) return false;
  return safeEquals(hashPassword(password || "", state.salt), state.hash);
}

export interface ChangeResult {
  ok: boolean;
  error?: string;
  persisted?: boolean;
}

/** מחליף סיסמה. דורש את הסיסמה הנוכחית — אין החלפה בלי להוכיח בעלות. */
export function changePassword(user: string, currentPassword: string, newPassword: string): ChangeResult {
  if (!verifyCredentials(user, currentPassword)) {
    return { ok: false, error: "שם המשתמש או הסיסמה הנוכחית שגויים." };
  }
  const clean = (newPassword || "").trim();
  if (clean.length < 6) {
    return { ok: false, error: "הסיסמה החדשה חייבת להיות באורך 6 תווים לפחות." };
  }
  if (clean === currentPassword) {
    return { ok: false, error: "הסיסמה החדשה זהה לנוכחית." };
  }
  const persisted = saveState(buildState(loadState().user, clean));
  return { ok: true, persisted };
}

/** מחזיר את החשבון למצב ההתחלתי שבמשתני הסביבה — מסלול "שכחתי סיסמה". */
export function resetToDefault(): ChangeResult {
  const persisted = saveState(buildState(DEFAULT_USER, DEFAULT_PASSWORD));
  return { ok: true, persisted };
}

export function currentUser(): string {
  return loadState().user;
}

/** האם הסיסמה עדיין ברירת המחדל — הבסיס לאזהרה בממשק. */
export function isUsingDefaultPassword(): boolean {
  const state = loadState();
  return safeEquals(hashPassword(DEFAULT_PASSWORD, state.salt), state.hash);
}
