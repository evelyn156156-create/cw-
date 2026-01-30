export interface SourceConfig {
  id: string;
  name: string;
  url: string; // RSS Feed URL
  enabled: boolean;
  type: 'rss' | 'api';
  // New fields for health check
  lastFetchStatus?: 'ok' | 'error' | 'pending';
  lastErrorMessage?: string;
  lastCheckTime?: number;
}

export enum AnalysisStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED', // Low quality
}

export enum RewriteTemplate {
  HOT_EVENT = 'hot_event', // 热点事件 + CoinW 视角
  SECTOR_DEPTH = 'sector_depth', // 赛道深度 + CoinW 机会
  PRODUCT_UPDATE = 'product_update', // 产品更新
  MEDIA_REPORT = 'media_report', // 媒体报道整合
}

export interface NewsItem {
  id?: number; // Auto-increment for Dexie
  uniqueHash: string; // url + title hash
  title: string;
  originalTitle: string;
  url: string;
  sourceName: string;
  publishedAt: number; // Timestamp
  fetchedAt: number;
  
  // Content from RSS
  content?: string; // HTML or text content from RSS feed
  
  // AI Analyzed Fields
  status: AnalysisStatus;
  summary?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  tags?: string[]; // General tags
  qualityScore?: number; // 0-100
  language?: string;
  isCryptoRelated?: boolean;

  // --- NEW: Advanced Entity & Risk Analysis ---
  coinTickers?: string[]; // e.g., ["BTC", "ETH", "COINW"]
  topicCategory?: string; // e.g., "Market", "Regulation", "Meme"
  riskLevel?: 'low' | 'medium' | 'high'; // For compliance
  entities?: {
      projects?: string[];
      institutions?: string[];
      events?: string[];
  };

  // --- NEW: AI Rewritten Content ---
  rewrittenTitle?: string;
  rewrittenContent?: string;
  rewriteTemplate?: RewriteTemplate;
}

export interface ProcessingStats {
  total: number;
  processed: number;
  skipped: number;
  errors: number;
}