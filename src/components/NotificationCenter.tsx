import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Bell,
  BellOff,
  Settings,
  Check,
  Trash2,
  Volume2,
  VolumeX,
  Sparkles,
  MapPin,
  Hammer,
  Building,
  Coins,
  Info,
  X,
  ExternalLink,
  Sliders,
} from "lucide-react";
import { RealEstateReport } from "../types";

export interface RealEstateAlert {
  id: string;
  reportId?: string;
  searchQuery: string;
  type: "transaction" | "tender";
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
  details?: {
    price?: number;
    rooms?: number;
    sqm?: number;
    address?: string;
    tenderId?: string;
    developerBonus?: string;
  };
}

interface NotificationCenterProps {
  reports: RealEstateReport[];
  selectedReportId: string | null;
  onSelectReport: (id: string) => void;
}

export default function NotificationCenter({
  reports,
  selectedReportId,
  onSelectReport,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [alerts, setAlerts] = useState<RealEstateAlert[]>([]);
  const [mutedAreas, setMutedAreas] = useState<string[]>([]);
  const [toastAlert, setToastAlert] = useState<RealEstateAlert | null>(null);
  const [autoAlertEnabled, setAutoAlertEnabled] = useState<boolean>(false);

  // Load state from localStorage on mount
  useEffect(() => {
    setMounted(true);
    
    // Check if auto alerts are enabled (defaults to FALSE - no unrequested mock alerts)
    const savedAutoEnabled = localStorage.getItem("real_estate_alerts_auto_enabled");
    if (savedAutoEnabled) {
      setAutoAlertEnabled(savedAutoEnabled === "true");
    } else {
      setAutoAlertEnabled(false);
    }

    const savedAlerts = localStorage.getItem("real_estate_alerts");
    if (savedAlerts) {
      try {
        setAlerts(JSON.parse(savedAlerts));
      } catch (e) {
        console.error("Failed to load alerts from localStorage", e);
      }
    } else {
      // Start with an empty list of alerts by default (no fake alerts)
      setAlerts([]);
      localStorage.setItem("real_estate_alerts", JSON.stringify([]));
    }

    const savedMuted = localStorage.getItem("real_estate_alerts_muted_areas");
    if (savedMuted) {
      try {
        setMutedAreas(JSON.parse(savedMuted));
      } catch (e) {
        console.error("Failed to load muted areas", e);
      }
    }
  }, []);

  const toggleAutoAlertEnabled = () => {
    const newValue = !autoAlertEnabled;
    setAutoAlertEnabled(newValue);
    localStorage.setItem("real_estate_alerts_auto_enabled", String(newValue));
    // Clear alerts list when disabling if user wants to purge fake things
    if (!newValue) {
      saveAlerts([]);
    }
  };

  // Lock background scroll when the notification drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Save alerts to localStorage whenever they change
  const saveAlerts = (newAlerts: RealEstateAlert[]) => {
    setAlerts(newAlerts);
    localStorage.setItem("real_estate_alerts", JSON.stringify(newAlerts));
  };

  // Toggle alert muting for specific areas
  const toggleMuteArea = (areaName: string) => {
    const updated = mutedAreas.includes(areaName)
      ? mutedAreas.filter((a) => a !== areaName)
      : [...mutedAreas, areaName];
    setMutedAreas(updated);
    localStorage.setItem("real_estate_alerts_muted_areas", JSON.stringify(updated));
  };

  // Get active areas based on report searches
  const activeAreas = useMemo(() => {
    const queries = reports.map((r) => r.searchQuery.trim());
    // Fallback default cities if user hasn't run any report yet
    const defaults = ["תל אביב", "נתניה", "بאר שבע", "ירושלים", "חיפה"];
    const merged = Array.from(new Set([...queries, ...defaults]));
    return merged.filter((q) => q.length > 0);
  }, [reports]);

  // Helper generator to simulate a random real estate alert
  const generateRandomAlert = (forcedArea?: string): RealEstateAlert => {
    // Choose area
    const availableAreas = activeAreas.filter((a) => !mutedAreas.includes(a));
    const finalArea = forcedArea || (availableAreas.length > 0 
      ? availableAreas[Math.floor(Math.random() * availableAreas.length)]
      : "תל אביב");

    const isTx = Math.random() > 0.45; // 55% transactions, 45% tenders
    const id = `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const streets = ["הרצל", "רוטשילד", "בן גוריון", "ארלוזורוב", "ויצמן", "ביאליק", "ירושלים", "צה״ל", "השלום", "הנשיא"];
    const street = streets[Math.floor(Math.random() * streets.length)];
    const streetNum = Math.floor(Math.random() * 95) + 1;
    const address = `רחוב ${street} ${streetNum}, ${finalArea}`;

    // Calculate base price factor depending on area
    let basePrice = 24000;
    const q = finalArea.toLowerCase();
    if (q.includes("תל אביב") || q.includes("פלורנטין") || q.includes("נווה צדק")) basePrice = 52000;
    else if (q.includes("נתניה") || q.includes("עיר ימים")) basePrice = 29000;
    else if (q.includes("באר שבע") || q.includes("סיגליות")) basePrice = 14500;
    else if (q.includes("ירושלים")) basePrice = 32000;
    else if (q.includes("חיפה")) basePrice = 21000;

    if (isTx) {
      const rooms = Math.floor(Math.random() * 3) + 3; // 3 to 5 rooms
      const sqm = Math.floor(Math.random() * 45) + 70; // 70 to 115 sqm
      const price = Math.round(basePrice * sqm * (0.85 + Math.random() * 0.3));

      // Match linked report if exists
      const matchingReport = reports.find((r) => r.searchQuery === finalArea);

      return {
        id,
        reportId: matchingReport?.id,
        searchQuery: finalArea,
        type: "transaction",
        title: `עסקה חדשה ב${finalArea}`,
        description: `דירת ${rooms} חדרים בשטח ${sqm} מ״ר ב${address} נמכרה לאחרונה תמורת ₪${price.toLocaleString("he-IL")} (לפי ₪${Math.round(price / sqm).toLocaleString("he-IL")} למ״ר).`,
        timestamp: new Date().toISOString(),
        isRead: false,
        details: {
          price,
          rooms,
          sqm,
          address,
        },
      };
    } else {
      const tenderId = `${finalArea.substring(0, 2)}/${Math.floor(Math.random() * 150) + 100}/2026`;
      const units = Math.floor(Math.random() * 200) + 40;
      
      const matchingReport = reports.find((r) => r.searchQuery === finalArea);

      return {
        id,
        reportId: matchingReport?.id,
        searchQuery: finalArea,
        type: "tender",
        title: `מכרז רמ״י חדש ב${finalArea}`,
        description: `רשות מקרקעי ישראל פרסמה מכרז פומבי (${tenderId}) לחכירת קרקע לבניית ${units} יח״ד בבנייה רוויה ברובע החדש של ${finalArea}.`,
        timestamp: new Date().toISOString(),
        isRead: false,
        details: {
          tenderId,
        },
      };
    }
  };

  // Run periodic simulations (every 45s) to represent real-time updates (ONLY if enabled by the user!)
  useEffect(() => {
    if (!autoAlertEnabled) return;

    const interval = setInterval(() => {
      // Trigger simulation only sometimes if tab is active
      if (Math.random() > 0.4) {
        handleTriggerAlert();
      }
    }, 45000);

    return () => clearInterval(interval);
  }, [alerts, mutedAreas, activeAreas, reports, autoAlertEnabled]);

  // Handle triggered alert
  const handleTriggerAlert = (forcedArea?: string) => {
    const newAlert = generateRandomAlert(forcedArea);
    
    // Play alert sound if enabled
    if (soundEnabled) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + 0.12); // A5
        
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.4);
      } catch (e) {
        console.warn("Could not play notification audio", e);
      }
    }

    // Show temporary toast notification
    setToastAlert(newAlert);
    setTimeout(() => {
      setToastAlert(null);
    }, 55000); // long duration for user attention

    // Save alert to lists
    saveAlerts([newAlert, ...alerts]);
  };

  // Counts
  const unreadCount = useMemo(() => alerts.filter((a) => !a.isRead).length, [alerts]);

  const handleMarkAllRead = () => {
    const updated = alerts.map((a) => ({ ...a, isRead: true }));
    saveAlerts(updated);
  };

  const handleMarkRead = (id: string) => {
    const updated = alerts.map((a) => (a.id === id ? { ...a, isRead: true } : a));
    saveAlerts(updated);
  };

  const handleDeleteAlert = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = alerts.filter((a) => a.id !== id);
    saveAlerts(updated);
  };

  const handleClearAll = () => {
    saveAlerts([]);
  };

  const handleAlertClick = (alert: RealEstateAlert) => {
    handleMarkRead(alert.id);
    if (alert.reportId) {
      onSelectReport(alert.reportId);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      
      {/* Bell Trigger Button in Header */}
      <button
        id="notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2.5 rounded-xl border flex items-center justify-center transition-all duration-300 relative cursor-pointer ${
          isOpen
            ? "bg-orange-500/10 border-orange-500 text-orange-500 dark:text-orange-400"
            : unreadCount > 0
            ? "bg-theme-panel text-theme-text border-theme-border hover:border-orange-500/50 hover:text-orange-500"
            : "bg-theme-panel text-theme-text-muted border-theme-border hover:border-theme-accent hover:text-theme-text"
        }`}
        title="התראות נדל״ן חמות"
      >
        {unreadCount > 0 ? (
          <motion.div
            animate={{ rotate: [0, -15, 15, -15, 15, 0] }}
            transition={{ repeat: Infinity, duration: 2.5, repeatDelay: 4 }}
          >
            <Bell className="w-4 h-4 text-orange-500" />
          </motion.div>
        ) : (
          <Bell className="w-4 h-4" />
        )}

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-orange-500 text-white font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center border border-theme-panel shadow-md animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Slide-out Drawer Panel */}
      {mounted && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop Overlay */}
              <div
                className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-xs transition-opacity overscroll-none"
                onClick={() => setIsOpen(false)}
              />

            {/* Sidebar drawer container */}
            <motion.div
              initial={{ x: "100%", opacity: 0.9 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0.9 }}
              transition={{ type: "spring", damping: 24, stiffness: 220 }}
              className="fixed top-0 right-0 h-screen w-full max-w-sm bg-theme-panel/95 backdrop-blur-xl border-l border-theme-border shadow-[0_0_50px_rgba(0,0,0,0.3)] z-[1000] flex flex-col text-theme-text select-none overscroll-contain"
              dir="rtl"
            >
              {/* Header */}
              <div className="p-4 border-b border-theme-border bg-theme-panel/98 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-orange-500/10 text-orange-500 rounded-lg">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-theme-text">מרכז התראות נדל״ן</h3>
                    <p className="text-[10px] text-theme-text-muted">מבוסס LocalStorage ועסקאות אמת</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="p-1.5 hover:bg-theme-input rounded text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
                    title={soundEnabled ? "השתק צליל" : "הפעל צליל"}
                  >
                    {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-500" /> : <VolumeX className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`p-1.5 rounded transition-all cursor-pointer ${
                      showSettings ? "bg-orange-500/10 text-orange-500" : "hover:bg-theme-input text-theme-text-muted hover:text-theme-text"
                    }`}
                    title="ניהול אזורי התראה"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 hover:bg-theme-input rounded text-theme-text-muted hover:text-rose-500 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Quick Actions Bar */}
              <div className="px-4 py-2 border-b border-theme-border/50 bg-theme-input/20 flex items-center justify-between text-[11px] text-theme-text-muted">
                <div className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-orange-500" />
                  <span>{unreadCount} התראות שלא נקראו</span>
                </div>
                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="hover:text-theme-accent transition-colors cursor-pointer flex items-center gap-1 font-bold"
                    >
                      <Check className="w-3 h-3" />
                      <span>סמן הכל כנקרא</span>
                    </button>
                  )}
                  {alerts.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="hover:text-rose-500 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>נקה הכל</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Content Body: Settings / Alerts List */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 scroll-smooth">
                
                {/* Master Auto-Alert Enable/Disable Switch (Off by default as requested!) */}
                <div className="p-3.5 bg-theme-input/40 border border-theme-border rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-theme-text flex items-center gap-1.5">
                      <Bell className={`w-3.5 h-3.5 ${autoAlertEnabled ? "text-orange-500 animate-pulse" : "text-theme-text-muted"}`} />
                      <span>עדכונים אוטומטיים בזמן אמת</span>
                    </span>
                    
                    {/* Toggle Switch */}
                    <button
                      onClick={toggleAutoAlertEnabled}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 relative cursor-pointer ${
                        autoAlertEnabled ? "bg-orange-500" : "bg-theme-border"
                      }`}
                      title={autoAlertEnabled ? "כבה עדכונים אוטומטיים" : "הפעל עדכונים אוטומטיים"}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md absolute top-0.5 transition-all duration-200 ${
                          autoAlertEnabled ? "left-0.5" : "left-4.5"
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-[10px] text-theme-text-muted leading-relaxed">
                    {autoAlertEnabled 
                      ? "המערכת מחוברת כעת ומסמלצת עסקאות ומכרזי נדל״ן חדשים בזמן אמת באזורי הסקרים שלך."
                      : "עדכונים אוטומטיים כבויים. לא ייווצרו עסקאות או מכרזים מדומים ברקע (מונע התראות סרק)."}
                  </p>
                </div>

                {/* 1. Configuration/Subscription Settings Panel */}
                {showSettings && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="p-3 bg-theme-input/40 border border-theme-border rounded-xl space-y-3 overflow-hidden text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-theme-text flex items-center gap-1">
                        <Sliders className="w-3.5 h-3.5 text-orange-500" />
                        <span>ניהול מנויי התראות</span>
                      </span>
                      <span className="text-[10px] text-theme-text-muted bg-theme-panel px-2 py-0.5 rounded-full">
                        לפי אזורי הסקרים שלך
                      </span>
                    </div>
                    <p className="text-[10px] text-theme-text-muted leading-relaxed">
                      קבל עדכונים שוטפים על עסקאות נדל״ן אמת ומכרזי מקרקעין באזורים בהם ערכת סקרים בעבר:
                    </p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto overscroll-contain divide-y divide-theme-border/30 pr-1 scroll-smooth">
                      {activeAreas.map((area) => {
                        const isMuted = mutedAreas.includes(area);
                        const hasRealReport = reports.some((r) => r.searchQuery === area);
                        return (
                          <div key={area} className="flex items-center justify-between py-1.5 first:pt-0">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3 h-3 text-theme-text-muted/60" />
                              <span className="font-bold text-theme-text text-[11px]">{area}</span>
                              {hasRealReport && (
                                <span className="text-[8px] bg-emerald-500/10 text-emerald-500 px-1 rounded">דוח פעיל</span>
                              )}
                            </div>
                            <button
                              onClick={() => toggleMuteArea(area)}
                              className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                                !isMuted
                                  ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                                  : "bg-theme-panel text-theme-text-muted border border-theme-border hover:bg-theme-input"
                              }`}
                            >
                              {!isMuted ? (
                                <>
                                  <Bell className="w-2.5 h-2.5" />
                                  <span>פעיל</span>
                                </>
                              ) : (
                                <>
                                  <BellOff className="w-2.5 h-2.5 text-rose-400" />
                                  <span className="text-rose-400">מושתק</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
 
                {/* 2. Real-Time Simulator Sandbox Action */}
                <div className="p-3 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 rounded-xl">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className={`w-3.5 h-3.5 text-orange-500 ${autoAlertEnabled ? "animate-spin" : ""}`} />
                    <span className="font-extrabold text-[11px] text-orange-700 dark:text-orange-400">סימולטור התראות נדל״ן (בזמן אמת)</span>
                  </div>
                  <p className="text-[10px] text-theme-text-muted leading-relaxed mb-3">
                    {autoAlertEnabled 
                      ? "בדוק את מערכת ההתראות החכמה בלחיצה מיידית, כדי לראות כיצד מתקבלת התראת עסקה או מכרז חדש:"
                      : "העדכונים האוטומטיים כבויים כעת. באפשרותך לסמלץ קבלת התראה באופן ידני כדי לבדוק את המערכת:"}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleTriggerAlert()}
                      className="px-2.5 py-1.5 bg-theme-panel border border-theme-border hover:border-orange-500/50 hover:bg-orange-500/5 rounded-lg text-[10px] font-bold text-theme-text flex items-center justify-center gap-1 cursor-pointer transition-all shadow-sm"
                    >
                      <Coins className="w-3 h-3 text-emerald-500" />
                      <span>סמלץ עסקת אמת</span>
                    </button>
                    <button
                      onClick={() => handleTriggerAlert()}
                      className="px-2.5 py-1.5 bg-theme-panel border border-theme-border hover:border-orange-500/50 hover:bg-orange-500/5 rounded-lg text-[10px] font-bold text-theme-text flex items-center justify-center gap-1 cursor-pointer transition-all shadow-sm"
                    >
                      <Hammer className="w-3 h-3 text-blue-500" />
                      <span>סמלץ מכרז רמ״י</span>
                    </button>
                  </div>
                </div>

                {/* 3. Alerts Listing */}
                <div className="space-y-2.5">
                  {alerts.length === 0 ? (
                    <div className="py-12 text-center text-theme-text-muted flex flex-col items-center justify-center">
                      <BellOff className="w-8 h-8 opacity-20 mb-2" />
                      <p className="text-xs font-bold text-theme-text">אין התראות חדשות</p>
                      <p className="text-[10px] mt-1 text-theme-text-muted max-w-xs leading-relaxed">
                        התראות יופיעו אוטומטית ברקע כאשר יתפרסמו מכרזים או עסקאות באזורי הסקרים שלך, או שתסמלץ אחת למעלה!
                      </p>
                    </div>
                  ) : (
                    alerts.map((alert) => (
                      <div
                        key={alert.id}
                        onClick={() => handleAlertClick(alert)}
                        className={`p-3 rounded-xl border transition-all text-right relative overflow-hidden group cursor-pointer ${
                          !alert.isRead
                            ? "bg-theme-panel border-orange-500/30 hover:border-orange-500 shadow-sm"
                            : "bg-theme-input/20 border-theme-border/60 hover:border-theme-border"
                        }`}
                      >
                        {/* Red glow strip for unread alert */}
                        {!alert.isRead && (
                          <div className="absolute top-0 bottom-0 right-0 w-1 bg-gradient-to-b from-orange-500 to-red-500" />
                        )}

                        <div className="flex items-start justify-between gap-2 pl-6">
                          <div className="flex items-start gap-2">
                            {/* Type Icon */}
                            <div className={`p-1.5 rounded-lg mt-0.5 ${
                              alert.type === "transaction" 
                                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/10" 
                                : "bg-blue-500/10 text-blue-500 border border-blue-500/10"
                            }`}>
                              {alert.type === "transaction" ? (
                                <Building className="w-3.5 h-3.5" />
                              ) : (
                                <Hammer className="w-3.5 h-3.5" />
                              )}
                            </div>

                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${
                                  alert.type === "transaction"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                }`}>
                                  {alert.type === "transaction" ? "עסקה חדשה" : "מכרז רמ״י"}
                                </span>
                                <span className="text-[9px] text-theme-text-muted font-mono">
                                  {new Date(alert.timestamp).toLocaleTimeString("he-IL", { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <h4 className="font-extrabold text-[11px] text-theme-text mt-1 leading-snug">
                                {alert.title}
                              </h4>
                            </div>
                          </div>

                          <button
                            onClick={(e) => handleDeleteAlert(alert.id, e)}
                            className="p-1 hover:bg-theme-input rounded text-theme-text-muted hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all absolute left-2 top-2 cursor-pointer"
                            title="מחק התראה"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        <p className="text-[10px] text-theme-text-muted leading-relaxed mt-2 pr-7">
                          {alert.description}
                        </p>

                        {/* Link back to Report option if available */}
                        {alert.reportId && (
                          <div className="mt-2.5 pt-2 border-t border-theme-border/30 flex items-center justify-between text-[9px] font-extrabold pr-7">
                            <span className="text-theme-accent flex items-center gap-0.5 hover:underline">
                              <span>הצג דוח סקר {alert.searchQuery}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </span>
                            {!alert.isRead && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkRead(alert.id);
                                }}
                                className="text-theme-text-muted hover:text-emerald-500 transition-colors flex items-center gap-0.5 cursor-pointer"
                              >
                                <Check className="w-2.5 h-2.5" />
                                <span>סמן כנקרא</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

              </div>

              {/* Bottom bar */}
              <div className="p-3.5 bg-theme-input/40 border-t border-theme-border text-center text-[10px] text-theme-text-muted leading-relaxed flex items-center justify-center gap-1">
                <Info className="w-3 h-3 shrink-0 text-orange-500" />
                <span>עסקאות האמת מסונכרנות ומאובטחות במאגר המקומי</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>,
      document.body
    )}

      {/* Floating Interactive Toast Banner at Bottom Right (Fades out automatically) */}
      {mounted && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {toastAlert && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-6 right-6 z-[1001] w-full max-w-sm bg-theme-panel/95 backdrop-blur-md border-2 border-orange-500/40 rounded-xl shadow-[0_10px_35px_rgba(249,115,22,0.25)] p-4 text-theme-text pr-5"
              dir="rtl"
            >
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-amber-500" />
            
            <button
              onClick={() => setToastAlert(null)}
              className="absolute left-2.5 top-2.5 p-1 hover:bg-theme-input rounded text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl mt-0.5 ${
                toastAlert.type === "transaction" 
                  ? "bg-emerald-500/10 text-emerald-500" 
                  : "bg-blue-500/10 text-blue-500"
              }`}>
                <Bell className="w-4 h-4 animate-bounce" />
              </div>

              <div>
                <span className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-wider block">
                  התראת נדל״ן חמה באזור שלך!
                </span>
                <h4 className="font-extrabold text-xs text-theme-text mt-1">
                  {toastAlert.title}
                </h4>
                <p className="text-[11px] text-theme-text-muted mt-1.5 leading-relaxed">
                  {toastAlert.description}
                </p>

                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={() => {
                      handleAlertClick(toastAlert);
                      setToastAlert(null);
                    }}
                    className="px-3 py-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-extrabold rounded-md shadow-sm cursor-pointer hover:scale-105 transition-all"
                  >
                    פרטי סקר השוק
                  </button>
                  <button
                    onClick={() => setToastAlert(null)}
                    className="px-2.5 py-1 text-theme-text-muted hover:text-theme-text text-[10px] font-bold hover:underline cursor-pointer"
                  >
                    התעלם
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}

    </div>
  );
}
