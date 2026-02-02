import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

// Initialize Supabase with Service Role Key (if available) for backend rights, 
// or fall back to standard keys. 
// Note: For Cron jobs, it's best to use SUPABASE_SERVICE_ROLE_KEY in Vercel Env Vars to bypass RLS.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Missing Supabase Credentials");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Simple hash function for unique ID (DJB2)
const generateHash = (str: string): string => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
};

// Helper: Strip HTML tags
const stripHtml = (html: string): string => {
   if (!html) return "";
   return html.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim();
};

async function fetchRSS(url: string, sourceName: string) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; CryptoIntelBot/1.0;)'
            }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        
        const $ = cheerio.load(text, { xmlMode: true });
        const items: any[] = [];
        
        // Handle RSS 2.0 <item> and Atom <entry>
        const nodes = $('item, entry');

        nodes.each((_, element) => {
            const el = $(element);
            const title = el.find('title').text().trim();
            // Handle various link formats
            let link = el.find('link').text();
            if (!link) link = el.find('link').attr('href') || '';
            
            // Handle dates
            const pubDateStr = el.find('pubDate').text() || el.find('published').text() || el.find('updated').text() || el.find('dc\\:date').text();
            let publishedAt = Date.now();
            if (pubDateStr) {
                const parsed = new Date(pubDateStr).getTime();
                if (!isNaN(parsed)) publishedAt = parsed;
            }

            // Content
            const contentEncoded = el.find('content\\:encoded').text();
            const description = el.find('description').text();
            const contentTag = el.find('content').text();
            
            // Priority: content:encoded > description > content
            let content = contentEncoded || description || contentTag || "";
            
            // Summary logic
            let summary = stripHtml(description || contentEncoded || contentTag || "").substring(0, 200);
            if (summary.length > 190) summary += "...";

            // Extract categories
            const tags: string[] = [];
            el.find('category').each((_, cat) => {
                tags.push($(cat).text().trim());
            });

            if (title && link) {
                const uniqueHash = generateHash(link + title);
                items.push({
                    uniqueHash,
                    title,
                    originalTitle: title,
                    url: link.trim(),
                    sourceName,
                    publishedAt,
                    fetchedAt: Date.now(),
                    content,
                    summary,
                    tags,
                    status: 'PENDING', // Ready for AI analysis
                    riskLevel: 'low',
                    sentiment: 'neutral'
                });
            }
        });

        return items;

    } catch (error) {
        console.error(`Error fetching ${sourceName}:`, error);
        throw error;
    }
}

export default async function handler(req: any, res: any) {
    // Basic authorization for Cron (Optional: verify secret header if manually invoking)
    // For Vercel Cron, it sends a specific header, but we can keep it open or check auth.
    
    console.log("⏰ Starting Scheduled Fetch Job...");

    try {
        // 1. Get enabled sources
        const { data: sources, error } = await supabase
            .from('sources')
            .select('*')
            .eq('enabled', true);

        if (error) throw error;
        if (!sources || sources.length === 0) {
            return res.status(200).json({ message: "No enabled sources." });
        }

        let totalInserted = 0;
        const report = [];

        // 2. Fetch all sources
        for (const source of sources) {
            try {
                const items = await fetchRSS(source.url, source.name);
                
                if (items.length > 0) {
                    // 3. Upsert to Supabase
                    const { error: upsertError } = await supabase
                        .from('news')
                        .upsert(items, { onConflict: 'uniqueHash', ignoreDuplicates: true });
                    
                    if (upsertError) {
                        console.error(`Upsert failed for ${source.name}`, upsertError);
                    } else {
                        // Update source health
                        await supabase.from('sources').update({
                            lastFetchStatus: 'ok',
                            lastCheckTime: Date.now(),
                            lastErrorMessage: null
                        }).eq('id', source.id);
                        
                        totalInserted += items.length; // Approximation (ignoreDuplicates makes it hard to know exact new count)
                    }
                }
                report.push({ name: source.name, fetched: items.length, status: 'ok' });
            } catch (e: any) {
                // Update source error
                 await supabase.from('sources').update({
                    lastFetchStatus: 'error',
                    lastCheckTime: Date.now(),
                    lastErrorMessage: e.message
                }).eq('id', source.id);
                report.push({ name: source.name, status: 'error', error: e.message });
            }
        }

        console.log(`✅ Job finished. Processed ${report.length} sources.`);
        return res.status(200).json({ 
            success: true, 
            totalProcessed: totalInserted,
            details: report 
        });

    } catch (err: any) {
        console.error("Cron Job Failed:", err);
        return res.status(500).json({ error: err.message });
    }
}