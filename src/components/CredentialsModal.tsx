import { useState, useEffect } from "react";
import { X, ShieldAlert, Key, Mail, Eye, EyeOff } from "lucide-react";
import { ScraperCredentials } from "../types";

interface CredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentials: ScraperCredentials;
  onSave: (creds: ScraperCredentials) => void;
}

export default function CredentialsModal({ isOpen, onClose, credentials, onSave }: CredentialsModalProps) {
  const [creds, setCreds] = useState<ScraperCredentials>({ ...credentials });
  const [showPass, setShowPass] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      setCreds({ ...credentials });
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleShowPass = (key: string) => {
    setShowPass((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(creds);
    onClose();
  };

  return (
    <div id="credentials-modal" className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-all duration-300 overscroll-none">
      <form onSubmit={handleSave} className="bg-gradient-to-br from-theme-panel to-theme-bg backdrop-blur-lg rounded-2xl shadow-[0_0_50px_var(--shadow-color)] max-w-lg w-full overflow-hidden border border-theme-border flex flex-col max-h-[85vh] text-theme-text relative before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_0,rgba(59,130,246,0.06),transparent_50%)] before:pointer-events-none overscroll-contain">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-theme-border bg-theme-panel/50 relative before:absolute before:bottom-0 before:left-0 before:right-0 before:h-[1px] before:bg-gradient-to-r before:from-transparent before:via-theme-accent/20 before:to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-theme-accent/10 text-theme-accent border border-theme-accent/25 rounded-xl shadow-[0_0_10px_rgba(249,115,22,0.15)]">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-theme-text text-lg tracking-tight">חיבור חשבונות אישיים</h3>
              <p className="text-xs text-theme-text-muted mt-0.5">ניהול פרטי התחברות ללוחות ומערכות הנדל״ן</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-theme-input rounded-lg text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-5 scroll-smooth">
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3 text-amber-600 dark:text-amber-300 text-sm shadow-[inset_0_0_12px_rgba(245,158,11,0.02)]">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
            <div>
              <p className="font-bold text-amber-700 dark:text-amber-300">פרטיות ואבטחה מוגברים</p>
              <p className="text-xs mt-1 text-theme-text-muted leading-relaxed">
                פרטי ההתחברות נשמרים בדפדפן המקומי שלך בלבד. הם משמשים את הבוט המקומי להזדהות אוטומטית מול אתרי המקור ואינם נשלחים לאף גורם חיצוני.
              </p>
            </div>
          </div>

          {/* Madlan PRO Credentials */}
          <div className="space-y-3 p-4 border border-theme-border rounded-xl bg-theme-input/40 hover:bg-theme-input/70 hover:border-theme-accent/20 transition-all duration-300">
            <div className="flex items-center gap-2 font-bold text-theme-text text-sm">
              <span className="text-lg">📊</span>
              <span>מדלן PRO (חשבון מקצועי)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-theme-text-muted mb-1 font-bold">אימייל / שם משתמש</label>
                <div className="relative">
                  <Mail className="absolute right-3 top-2.5 w-4.5 h-4.5 text-theme-text-muted/60" />
                  <input
                    type="text"
                    value={creds.madlanEmail || ""}
                    onChange={(e) => setCreds({ ...creds, madlanEmail: e.target.value })}
                    className="w-full pr-10 pl-3 py-2 text-sm border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent/40 focus:border-theme-accent bg-theme-panel text-theme-text placeholder-theme-text-muted/40 outline-none transition-all"
                    placeholder="name@agency.co.il"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-theme-text-muted mb-1 font-bold">סיסמה במדלן</label>
                <div className="relative">
                  <input
                    type={showPass.madlan ? "text" : "password"}
                    value={creds.madlanPass || ""}
                    onChange={(e) => setCreds({ ...creds, madlanPass: e.target.value })}
                    className="w-full px-3 py-2 pl-10 text-sm border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent/40 focus:border-theme-accent bg-theme-panel text-theme-text placeholder-theme-text-muted/40 outline-none transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowPass("madlan")}
                    className="absolute left-3 top-2.5 text-theme-text-muted hover:text-theme-text cursor-pointer"
                  >
                    {showPass.madlan ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Yad2 Credentials */}
          <div className="space-y-3 p-4 border border-theme-border rounded-xl bg-theme-input/40 hover:bg-theme-input/70 hover:border-theme-accent/20 transition-all duration-300">
            <div className="flex items-center gap-2 font-bold text-theme-text text-sm">
              <span className="text-lg">🟠</span>
              <span>יד2 / יד1</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-theme-text-muted mb-1 font-bold">אימייל / שם משתמש</label>
                <div className="relative">
                  <Mail className="absolute right-3 top-2.5 w-4.5 h-4.5 text-theme-text-muted/60" />
                  <input
                    type="text"
                    value={creds.yad2Email || ""}
                    onChange={(e) => setCreds({ ...creds, yad2Email: e.target.value })}
                    className="w-full pr-10 pl-3 py-2 text-sm border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent/40 focus:border-theme-accent bg-theme-panel text-theme-text placeholder-theme-text-muted/40 outline-none transition-all"
                    placeholder="user@yad2.co.il"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-theme-text-muted mb-1 font-bold">סיסמה ביד2</label>
                <div className="relative">
                  <input
                    type={showPass.yad2 ? "text" : "password"}
                    value={creds.yad2Pass || ""}
                    onChange={(e) => setCreds({ ...creds, yad2Pass: e.target.value })}
                    className="w-full px-3 py-2 pl-10 text-sm border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent/40 focus:border-theme-accent bg-theme-panel text-theme-text placeholder-theme-text-muted/40 outline-none transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowPass("yad2")}
                    className="absolute left-3 top-2.5 text-theme-text-muted hover:text-theme-text cursor-pointer"
                  >
                    {showPass.yad2 ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Facebook Credentials */}
          <div className="space-y-3 p-4 border border-theme-border rounded-xl bg-theme-input/40 hover:bg-theme-input/70 hover:border-theme-accent/20 transition-all duration-300">
            <div className="flex items-center gap-2 font-bold text-theme-text text-sm">
              <span className="text-lg">📘</span>
              <span>פייסבוק (Facebook Groups & Marketplace)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-theme-text-muted mb-1 font-bold">אימייל / טלפון</label>
                <div className="relative">
                  <Mail className="absolute right-3 top-2.5 w-4.5 h-4.5 text-theme-text-muted/60" />
                  <input
                    type="text"
                    value={creds.facebookEmail || ""}
                    onChange={(e) => setCreds({ ...creds, facebookEmail: e.target.value })}
                    className="w-full pr-10 pl-3 py-2 text-sm border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent/40 focus:border-theme-accent bg-theme-panel text-theme-text placeholder-theme-text-muted/40 outline-none transition-all"
                    placeholder="050-XXXXXXX"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-theme-text-muted mb-1 font-bold">סיסמה בפייסבוק</label>
                <div className="relative">
                  <input
                    type={showPass.facebook ? "text" : "password"}
                    value={creds.facebookPass || ""}
                    onChange={(e) => setCreds({ ...creds, facebookPass: e.target.value })}
                    className="w-full px-3 py-2 pl-10 text-sm border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent/40 focus:border-theme-accent bg-theme-panel text-theme-text placeholder-theme-text-muted/40 outline-none transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowPass("facebook")}
                    className="absolute left-3 top-2.5 text-theme-text-muted hover:text-theme-text cursor-pointer"
                  >
                    {showPass.facebook ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-theme-border bg-theme-panel/50 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-theme-text-muted hover:text-theme-text hover:bg-theme-input rounded-lg transition-all cursor-pointer"
          >
            ביטול
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-sm font-extrabold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 rounded-lg transition-all shadow-lg shadow-orange-900/20 hover:shadow-orange-500/25 cursor-pointer"
          >
            שמירת פרטים
          </button>
        </div>
      </form>
    </div>
  );
}
