import { useState, useEffect, useRef } from "react";
import { Terminal, Shield, RefreshCw, CheckCircle, AlertTriangle, Play, HelpCircle } from "lucide-react";
import { SourceId, ScraperLog, ScraperCredentials } from "../types";

interface InteractiveConsoleProps {
  searchQuery: string;
  selectedSources: SourceId[];
  useManualIntervention: boolean;
  onScrapingComplete: () => void;
  onAddLog: (log: ScraperLog) => void;
  logs: ScraperLog[];
  isScraping: boolean;
  credentials?: ScraperCredentials;
}

export default function InteractiveConsole({
  searchQuery,
  selectedSources,
  useManualIntervention,
  onScrapingComplete,
  onAddLog,
  logs,
  isScraping,
  credentials,
}: InteractiveConsoleProps) {
  const [progress, setProgress] = useState(0);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaSolved, setCaptchaSolved] = useState(false);
  const [sliderVal, setSliderVal] = useState(10);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the terminal logs
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Run the scraping sequence simulator
  useEffect(() => {
    if (!isScraping) {
      setProgress(0);
      setShowCaptcha(false);
      setCaptchaSolved(false);
      setCaptchaError(null);
      return;
    }

    let currentStep = 0;
    let timeoutId: any;
    const steps = [
      { msg: "🚀 מתחיל מנוע סריקה חכם מבוסס Puppeteer Stealth...", delay: 800, type: "info" as const },
      { msg: "🔑 טוען עוגיות אבטחה וסביבת דפדפן נקייה לעקיפת חסימות...", delay: 1000, type: "info" as const },
      
      // CBS Step
      {
        id: "cbs",
        msg: "📈 [הלמ״ס] מתחבר למאגר הנתונים המוניציפלי הממשלתי... מעבד חתכים סוציו-אקונומיים...",
        success: "📈 [הלמ״ס] נתונים נמשכו בהצלחה! מדד חברתי: 6/10, מאזן הגירה חיובי פנימי של +1.8%.",
        delay: 1500,
      },
      
      // Gov / Tax Step
      {
        id: "gov",
        msg: "🏛️ [רשות המיסים] שואב עסקאות רשומות באזור חיפוש עבור דירות 3, 4 ו-5 חדרים...",
        success: "🏛️ [רשות המיסים] 124 עסקאות נמצאו ונותחו! מחיר ממוצע: 24,500 ש״ח למ״ר.",
        delay: 1800,
      },
      
      // RMI Step
      {
        id: "rmi",
        msg: "🏗️ [רשות מקרקעי ישראל] סורק תוצאות מכרזי קרקעות וזכיות קבלנים בשנה האחרונה...",
        success: "🏗️ [רשות מקרקעי ישראל] מכרז מגרש 402 נסגר. שווי קרקע ליח\"ד משוער: 520,000 ש״ח.",
        delay: 1400,
      },
      
      // Madlan Step
      {
        id: "madlan",
        msg: credentials?.madlanEmail
          ? `📊 [מדלן PRO] מזדהה באמצעות חשבון מקצועי מחובר: ${credentials.madlanEmail}...`
          : "📊 [מדלן PRO] מתחבר באמצעות פרטי המשתמש... קורא מטא-נתונים של פרויקטים סמוכים...",
        success: credentials?.madlanEmail
          ? `✓ [מדלן PRO] חיבור מורשה מאומת עבור ${credentials.madlanEmail}! נתונים נשאבו במהירות מלאה.`
          : "📊 [מדלן PRO] המטא נסרק בהצלחה! יזמים דומיננטיים: אלקטרה, אשדר. תשואת שכירות: 2.9%.",
        delay: 1600,
      },

      // Captcha Gate if Yad2 is selected & intervention is active
      {
        id: "yad2_captcha",
        msg: "🟠 [יד2] מבצע ניווט למסך חיפושי השכונות... מזהה הגנת Cloudflare WAF...",
        delay: 1200,
        triggerCaptcha: true,
      },
      
      // Yad2 / Yad1 Step
      {
        id: "yad2",
        msg: credentials?.yad2Email
          ? `🟠 [יד2] מזדהה כמשתמש מנוי: ${credentials.yad2Email}... שואב היצע נוכחי...`
          : "🟠 [יד2] שואב היצע נוכחי של נכסים למכירה... קורא מחירי שיווק מבוקשים...",
        success: credentials?.yad2Email
          ? `✓ [יד2] חיבור מנוי פעיל עבור ${credentials.yad2Email}! נסרקו 42 מודעות פעילות ללא מגבלות קצב.`
          : "🟠 [יד2] נסרקו 42 מודעות פעילות. טווח מבוקש ממוצע: 2.5-2.8 מיליון ש״ח.",
        delay: 1500,
      },
      
      // Facebook Step
      {
        id: "facebook",
        msg: credentials?.facebookEmail
          ? `📘 [פייסבוק] מתחבר לקבוצות ול-Marketplace דרך פרופיל: ${credentials.facebookEmail}...`
          : "📘 [פייסבוק] סורק קבוצות נדל״ן מקומיות ו-Marketplace באזור...",
        success: credentials?.facebookEmail
          ? `✓ [פייסבוק] אימות מוצלח לפרופיל ${credentials.facebookEmail}. סריקת פיד הניוזלטרים הסתיימה.`
          : "📘 [פייסבוק] זוהה שיח ער. פוסטים שכיחים: 'דירות למכירה ללא תיווך באגמים'.",
        delay: 1300,
      },
      
      // AI Wrap-up
      { msg: "🧠 מאחד את כל בליל המקורות השונים למבנה נתונים אחיד (Omni-Channel)...", delay: 1000, type: "info" as const },
      { msg: "✨ שולח נתונים משולבים לעיבוד והדמיית שמאי בבינת Gemini 3.5 עם Google Search Grounding...", delay: 1200, type: "info" as const },
    ];

    const runNextStep = () => {
      if (currentStep >= steps.length) {
        setProgress(100);
        onScrapingComplete();
        return;
      }

      const step = steps[currentStep];

      // Update progress bar
      setProgress(Math.floor((currentStep / steps.length) * 100));

      // Check if this step belongs to a source that was NOT selected
      if (step.id && step.id !== "yad2_captcha" && !selectedSources.includes(step.id as SourceId)) {
        currentStep++;
        runNextStep();
        return;
      }

      // Check if we need to skip the Captcha step
      if (step.id === "yad2_captcha" && (!selectedSources.includes("yad2") || !useManualIntervention)) {
        currentStep++;
        runNextStep();
        return;
      }

      // Handle Captcha triggering
      if (step.id === "yad2_captcha" && step.triggerCaptcha && useManualIntervention && !captchaSolved) {
        onAddLog({
          id: Math.random().toString(),
          message: "⚠️ [Cloudflare/יד2] זוהתה חסימת Captcha מורכבת! מעביר למצב התערבות אנושית...",
          timestamp: new Date().toLocaleTimeString(),
          type: "warning",
        });
        setShowCaptcha(true);
        return; // Pause execution until solved
      }

      // Log the action starting
      onAddLog({
        id: Math.random().toString(),
        message: step.msg || "",
        timestamp: new Date().toLocaleTimeString(),
        type: step.id === "yad2_captcha" ? "warning" : "info",
      });

      // After delay, log success if exists
      timeoutId = setTimeout(() => {
        if ("success" in step && step.success) {
          onAddLog({
            id: Math.random().toString(),
            message: step.success,
            timestamp: new Date().toLocaleTimeString(),
            type: "success",
          });
        }
        currentStep++;
        runNextStep();
      }, step.delay);
    };

    runNextStep();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isScraping, captchaSolved]);

  // Handle Captcha Solving Action
  const handleCaptchaSolve = () => {
    if (sliderVal >= 82 && sliderVal <= 98) {
      setCaptchaError(null);
      setShowCaptcha(false);
      setCaptchaSolved(true);
      onAddLog({
        id: Math.random().toString(),
        message: "✅ אימות קאפצ׳ה בוצע בהצלחה על ידי המשתמש! הבוט ממשיך בשאיבה...",
        timestamp: new Date().toLocaleTimeString(),
        type: "success",
      });
    } else {
      setCaptchaError("התאמה שגויה, נא למקם את פאזל ההתאמה בדיוק בטווח היעד!");
    }
  };

  if (!isScraping) return null;

  return (
    <div className="space-y-6">
      {/* Active scraping details card */}
      <div className="bg-theme-panel/80 backdrop-blur-md text-theme-text rounded-full p-6 shadow-[0_4px_25px_var(--shadow-color)] border border-theme-accent/20 flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-300">
        <div>
          <div className="flex items-center gap-2 text-orange-450 dark:text-blue-400 font-bold">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm tracking-wide">שואב ומעבד נתונים כעת...</span>
          </div>
          <h4 className="font-extrabold text-xl mt-1.5 text-theme-text tracking-tight">חיפוש באזור: {searchQuery}</h4>
          <p className="text-xs text-theme-text-muted mt-1">
            מקורות פעילים: {selectedSources.map(s => s.toUpperCase()).join(", ")}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full md:w-64 shrink-0">
          <div className="flex justify-between text-xs text-theme-text-muted mb-1.5 font-mono">
            <span className="font-bold">התקדמות כללית</span>
            <span className="font-bold text-theme-accent">{progress}%</span>
          </div>
          <div className="w-full h-3 bg-theme-input border border-theme-border rounded-full overflow-hidden p-[2px]">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(249,115,22,0.6)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Interactive Captcha popup widget */}
      {showCaptcha && (
        <div className="bg-[#130f0a]/95 border border-blue-500/40 rounded-full p-6 shadow-[0_0_25px_rgba(249,115,22,0.25)] flex flex-col items-center max-w-md mx-auto text-center space-y-4">
          <div className="w-12 h-12 bg-amber-950/40 border border-amber-500/30 rounded-full flex items-center justify-center text-amber-500 shadow-[0_0_15px_rgba(249,115,22,0.15)] animate-pulse">
            <Shield className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h4 className="font-extrabold text-blue-400 text-base">נדרש אימות אנושי (CAPTCHA Bypass)</h4>
            <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
              בוט ה-Stealth מזהה מנגנון הגנה של Cloudflare. נא גרור את המחוון למטה כדי להתאים את פאזל הבטיחות (יש למקם על הסימון הכחול בצד שמאל):
            </p>
          </div>

          <div className="w-full relative py-4 px-6 bg-[#060608] border border-zinc-800 rounded-full shadow-inner">
            {/* Slide Puzzle Track */}
            <div className="h-10 bg-zinc-950 border border-zinc-900 rounded-full relative overflow-hidden flex items-center">
              <div
                className="absolute w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-md ios-shadow shadow-blue-500/40 flex items-center justify-center text-white font-bold cursor-pointer active:scale-95 transition-transform active:scale-95 transition-transform transition-all duration-300 duration-75 hover:scale-105"
                style={{ right: `${sliderVal}%` }}
              >
                🧩
              </div>
              <div className="absolute right-[90%] w-10 h-10 border-2 border-dashed border-blue-400/50 rounded-md bg-blue-950/40" />
              <div className="w-full text-center text-[10px] text-zinc-500 select-none">
                גרור את המחוון להתאמת הפאזל
              </div>
            </div>

            {/* Slider control */}
            <input
              type="range"
              min="0"
              max="100"
              value={sliderVal}
              onChange={(e) => setSliderVal(Number(e.target.value))}
              className="w-full mt-4 h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer active:scale-95 transition-transform active:scale-95 transition-transform accent-orange-500"
            />
            <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
              <span>התחלה</span>
              <span>יעד התאמה</span>
            </div>
          </div>

          {captchaError && (
            <p className="text-xs text-rose-400 font-bold bg-rose-950/20 py-1.5 px-3 rounded-full border border-rose-900/40 w-full">
              {captchaError}
            </p>
          )}

          <button
            onClick={handleCaptchaSolve}
            className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-orange-400 hover:to-amber-400 text-black font-extrabold text-sm rounded-full transition-all duration-300 ios-shadow shadow-blue-950/20 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-transform active:scale-95 transition-transform"
          >
            <Play className="w-4 h-4" />
            בצע אימות אנושי והמשך סריקה
          </button>
        </div>
      )}

      {/* Simulated Terminal Window */}
      <div className="bg-[#040406] rounded-full ios-shadow overflow-hidden border border-zinc-800/90 flex flex-col h-96 shadow-black/80">
        {/* Terminal Header */}
        <div className="bg-[#0b0b0f] px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-zinc-400" />
            <span className="font-mono text-xs font-semibold text-zinc-300">מסוף שאיבה ואיסוף נתוני קצה (מנוע Stealth)</span>
          </div>
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
        </div>

        {/* Terminal Body */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-2.5 text-zinc-200 scroll-smooth">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`flex items-start gap-2 border-r-2 pr-2 leading-relaxed ${
                log.type === "success"
                  ? "border-emerald-500 text-emerald-400 bg-emerald-500/5 py-0.5 rounded-l"
                  : log.type === "warning"
                  ? "border-amber-500 text-amber-400 bg-amber-500/5 py-0.5 rounded-l"
                  : log.type === "error"
                  ? "border-rose-500 text-rose-400 bg-rose-500/5 py-0.5 rounded-l"
                  : "border-blue-500/30 text-zinc-350 bg-zinc-900/10"
              }`}
            >
              <span className="text-zinc-500 select-none shrink-0">{log.timestamp}</span>
              <span className="whitespace-pre-line">{log.message}</span>
            </div>
          ))}
          <div ref={consoleEndRef} />
        </div>

        {/* Terminal Footer */}
        <div className="bg-[#060608] px-4 py-2 border-t border-zinc-800/60 text-[10px] text-zinc-500 flex justify-between">
          <span>פעיל</span>
          <span>שואב נתונים במצב שקט</span>
        </div>
      </div>
    </div>
  );
}
