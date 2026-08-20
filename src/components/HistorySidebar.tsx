import { useState } from "react";
import { History, FileText, Trash2, Calendar, MapPin, ChevronRight, Search, X } from "lucide-react";
import { RealEstateReport } from "../types";

interface HistorySidebarProps {
  reports: RealEstateReport[];
  selectedReportId: string | null;
  onSelectReport: (id: string) => void;
  onDeleteReport: (id: string) => void;
}

export default function HistorySidebar({
  reports,
  selectedReportId,
  onSelectReport,
  onDeleteReport,
}: HistorySidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredReports = reports.filter((r) =>
    r.searchQuery.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-theme-panel/80 backdrop-blur-md rounded-xl border border-theme-border overflow-hidden flex flex-col h-[600px] lg:h-full text-theme-text-muted shadow-[0_4px_25px_var(--shadow-color)] transition-all duration-300">
      {/* Header */}
      <div className="p-4 border-b border-theme-border bg-theme-panel/95 flex items-center gap-2.5 transition-all duration-300">
        <div className="p-1.5 bg-theme-accent/10 text-theme-accent border border-theme-accent/20 rounded-lg shadow-[0_0_10px_rgba(249,115,22,0.1)]">
          <History className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-extrabold text-theme-text text-sm">היסטוריית דוחות</h3>
          <p className="text-[10px] text-theme-text-muted">סקרי השוק האחרונים שביצעת</p>
        </div>
      </div>

      {/* Search Input Box */}
      <div className="p-3 border-b border-theme-border/50 bg-theme-input/20">
        <div className="relative flex items-center">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="חיפוש לפי עיר, שכונה או פרויקט..."
            className="w-full pr-8 pl-8 py-1.5 text-xs bg-theme-panel border border-theme-border rounded-lg text-theme-text placeholder:text-theme-text-muted/40 outline-none focus:border-theme-accent/50 text-right transition-all duration-300 shadow-inner"
          />
          <Search className="absolute right-2.5 w-3.5 h-3.5 text-theme-text-muted pointer-events-none" />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute left-2.5 p-0.5 hover:bg-theme-input rounded text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
              title="נקה חיפוש"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-theme-border/50">
        {filteredReports.length === 0 ? (
          <div className="p-8 text-center text-theme-text-muted">
            <FileText className="w-10 h-10 mx-auto opacity-40 mb-2 text-theme-text-muted" />
            <p className="text-xs font-bold text-theme-text">לא נמצאו דוחות</p>
            <p className="text-[10px] mt-1 text-theme-text-muted">
              {searchTerm ? "נסה לשנות את מונח החיפוש" : "בצע סריקה ראשונה להצגת דוח פה"}
            </p>
          </div>
        ) : (
          filteredReports.map((r) => {
            const isSelected = r.id === selectedReportId;
            return (
              <div
                key={r.id}
                className={`p-3.5 flex items-start justify-between gap-2.5 cursor-pointer transition-all duration-300 ${
                  isSelected ? "bg-theme-accent/10 border-r-4 border-theme-accent shadow-[inset_0_0_15px_rgba(249,115,22,0.05)] text-theme-text font-medium" : "hover:bg-theme-input/40"
                }`}
                onClick={() => onSelectReport(r.id)}
              >
                <div className="flex gap-2.5 min-w-0">
                  <div className={`p-2 rounded-lg shrink-0 border transition-colors ${isSelected ? "bg-theme-accent/25 text-theme-accent border-theme-accent/30" : "bg-theme-input text-theme-text-muted border-theme-border"}`}>
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs text-theme-text truncate">{r.searchQuery}</h4>
                    <div className="flex items-center gap-1.5 text-[10px] text-theme-text-muted mt-1">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(r.timestamp).toLocaleDateString("he-IL")}</span>
                      <span>•</span>
                      <span>{r.sources.length} מקורות</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteReport(r.id);
                    }}
                    className="p-1 hover:bg-theme-input hover:text-rose-400 rounded-md text-theme-text-muted transition-colors cursor-pointer"
                    title="מחק דוח"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-theme-text-muted" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
