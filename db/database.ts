import { supabase } from '../lib/supabase';
import { NewsItem, SourceConfig } from '../types';

// Helper to cleanup old news from Supabase
export const pruneOldNews = async (daysToKeep: number): Promise<number> => {
    if (daysToKeep <= 0) return 0;
    
    // Calculate cutoff timestamp
    const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    const { error, count } = await supabase
        .from('news')
        .delete({ count: 'exact' })
        .lt('publishedAt', cutoff);

    if (error) {
        console.error("Prune error:", error);
        return 0;
    }
    return count || 0;
};

// No seeding needed in code anymore as SQL handles it, 
// but we keep the export to avoid breaking imports during refactor transition if called.
export const seedSources = async () => {
    // No-op: handled by Supabase SQL
};
