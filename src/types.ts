export type SourceId = "cbs" | "gov" | "rmi" | "madlan" | "yad2" | "facebook";

export interface SourceConfig {
  id: SourceId;
  name: string;
  icon: string;
  description: string;
  color: string;
  category: "ממשלתי" | "לוחות" | "רשתות" | "אנליזה";
}

export interface ScraperLog {
  id: string;
  message: string;
  timestamp: string;
  type: "info" | "success" | "warning" | "error" | "bot";
}

export interface ScraperCredentials {
  madlanEmail?: string;
  madlanPass?: string;
  yad2Email?: string;
  yad2Pass?: string;
  facebookEmail?: string;
  facebookPass?: string;
}

export interface RealEstateReport {
  id: string;
  searchQuery: string;
  timestamp: string;
  report: string;
  sources: SourceId[];
  excelFileName?: string;
  excelRows?: any[];
  searchGrounding?: any;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}
