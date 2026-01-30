import Dexie, { Table } from 'dexie';
import { NewsItem, SourceConfig } from '../types';

// Define the database type for better TypeScript support using intersection type
export type CryptoNewsDB = Dexie & {
  news: Table<NewsItem, number>;
  sources: Table<SourceConfig, string>;
};

// Create the database instance directly
export const db = new Dexie('CryptoIntelDB') as CryptoNewsDB;

// Define the schema
// Note: Dexie allows adding fields (like lastFetchStatus) without changing schema definition 
// if they are not indexed. We only need to list indexed fields here.
db.version(1).stores({
  news: '++id, &uniqueHash, publishedAt, status, sentiment, *tags, riskLevel, topicCategory',
  sources: '++id, &url, enabled'
});

// Master list of High-Quality RSS Feeds
const DEFAULT_SOURCES: Omit<SourceConfig, 'id'>[] = [
  // --- 中文优质源 (CN) ---
  { name: 'ChainFeeds', url: 'https://www.chainfeeds.xyz/rss', enabled: true, type: 'rss' },
  { name: 'BlockBeats', url: 'https://api.theblockbeats.news/v1/open-api/home-xml', enabled: true, type: 'rss' },
  { name: 'PANews', url: 'https://rss.panewslab.com/zh/tvsq/rss', enabled: true, type: 'rss' },

  // --- 英文优质源 (EN) ---
  { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss', enabled: true, type: 'rss' },
  { name: 'CoinTelegraph', url: 'https://cointelegraph.com/rss', enabled: true, type: 'rss' },
  { name: 'CryptoPotato', url: 'https://cryptopotato.com/feed/', enabled: true, type: 'rss' },
  { name: 'CryptoSlate', url: 'https://cryptoslate.com/feed/', enabled: true, type: 'rss' },
  { name: 'CryptoBriefing', url: 'https://cryptobriefing.com/feed/', enabled: true, type: 'rss' },
  { name: 'Blockworks', url: 'https://blockworks.co/feed', enabled: true, type: 'rss' },
  { name: 'Decrypt', url: 'https://decrypt.co/feed', enabled: true, type: 'rss' },
  { name: 'The Block', url: 'https://www.theblock.co/rss.xml', enabled: true, type: 'rss' },
  
  // --- 其他补充 ---
  { name: 'Bankless', url: 'https://www.bankless.com/rss/feed', enabled: true, type: 'rss' },
  { name: 'BeInCrypto', url: 'https://beincrypto.com/feed/', enabled: true, type: 'rss' },
  { name: 'The Daily Hodl', url: 'https://dailyhodl.com/feed/', enabled: true, type: 'rss' },
  { name: 'NewsBTC', url: 'https://www.newsbtc.com/feed/', enabled: true, type: 'rss' },
];

// Seed default sources
export const seedSources = async () => {
  for (const source of DEFAULT_SOURCES) {
    try {
      // Check if this specific URL already exists in the DB
      const exists = await db.sources.where('url').equals(source.url).count();
      
      if (exists === 0) {
        await db.sources.add({
            ...source,
            lastFetchStatus: 'pending' // Initialize status
        } as any);
        console.log(`[DB Seed] Added new source: ${source.name}`);
      }
    } catch (error) {
      console.error(`[DB Seed] Failed to seed ${source.name}:`, error);
    }
  }
};

/**
 * Delete news older than X days.
 * @param daysToKeep Number of days to keep. 0 or -1 means infinite (no delete).
 * @returns Number of items deleted.
 */
export const pruneOldNews = async (daysToKeep: number): Promise<number> => {
    if (daysToKeep <= 0) return 0;
    
    // Calculate cutoff timestamp
    const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    // Perform deletion
    return await db.news.where('publishedAt').below(cutoff).delete();
};