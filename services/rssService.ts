import { NewsItem, AnalysisStatus } from '../types';

// Simple DJB2 hash for unique fingerprinting
const generateHash = (str: string): string => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
};

// --- LOCAL ANALYSIS DICTIONARIES ---

const COIN_KEYWORDS: Record<string, string[]> = {
    'BTC': ['Bitcoin', 'BTC', '比特币', 'Satoshi', '大饼'],
    'ETH': ['Ethereum', 'ETH', '以太坊', 'Vitalik', 'Ether'],
    'SOL': ['Solana', 'SOL', '索拉纳'],
    'BNB': ['Binance Coin', 'BNB', 'BSC', 'Binance Smart Chain', '币安'],
    'USDT': ['Tether', 'USDT', '泰达币'],
    'USDC': ['USDC', 'Circle'],
    'FDUSD': ['FDUSD'],
    'DAI': ['DAI', 'MakerDAO'],
    'XRP': ['Ripple', 'XRP', '瑞波'],
    'ADA': ['Cardano', 'ADA', '卡尔达诺'],
    'DOGE': ['Dogecoin', 'DOGE', '狗狗币', 'Elon Musk'],
    'AVAX': ['Avalanche', 'AVAX', '雪崩'],
    'DOT': ['Polkadot', 'DOT', '波卡'],
    'LINK': ['Chainlink', 'LINK'],
    'MATIC': ['Polygon', 'MATIC', '马蹄'],
    'LTC': ['Litecoin', 'LTC', '莱特币'],
    'UNI': ['Uniswap', 'UNI'],
    'ARB': ['Arbitrum', 'ARB'],
    'OP': ['Optimism', 'OP'],
    'SUI': ['Sui', 'SUI'],
    'APT': ['Aptos', 'APT'],
    'ORDI': ['Ordinals', 'ORDI', '铭文', 'BRC20', 'BRC-20'],
    'PEPE': ['PEPE'],
    'WIF': ['WIF', 'dogwifhat'],
};

// Updated to match App.tsx TOPIC_FILTERS exactly
const TOPIC_KEYWORDS: Record<string, string[]> = {
    'Market': ['price', 'market', 'bull', 'bear', 'analysis', 'chart', 'trading', 'volume', '行情', '价格', '牛市', '熊市', '分析', '暴涨', '暴跌', 'ath', 'atl'],
    'Regulation': ['sec', 'regulation', 'law', 'court', 'ban', 'tax', 'policy', 'congress', 'gensler', '监管', '政策', '法律', '起诉', '法院', '禁令', '税', '合规', 'etf'],
    'DeFi': ['defi', 'dex', 'swap', 'lending', 'yield', 'tvl', 'uniswap', 'aave', 'curve', '流动性', '借贷', 'amm'],
    'RWA': ['rwa', 'real world', 'tokenization', 'treasury', 'ondo', 'blackrock', '现实世界资产', '国债', '代币化'],
    'Staking': ['staking', 'restaking', 'eigenlayer', 'lido', 'lsd', 'validator', '质押', '再质押', '节点', 'pos'],
    'NFT': ['nft', 'gamefi', 'metaverse', 'opensea', 'blur', 'digital art', '元宇宙', '链游', '藏品', 'game'],
    'Layer2': ['layer2', 'l2', 'rollup', 'arbitrum', 'optimism', 'base', 'zk-rollup', 'zk', 'starknet', 'polygon', 'blast', 'manta'],
    'Security': ['hack', 'exploit', 'scam', 'phishing', 'stolen', 'attack', 'security', 'alert', '黑客', '攻击', '被盗', '漏洞', '骗局', '私钥'],
    'Exchange': ['exchange', 'binance', 'coinbase', 'okx', 'bybit', 'kraken', 'listing', 'delisting', '交易所', '上币', '下架', 'ieo', 'launchpad'],
    'Tech': ['upgrade', 'fork', 'mainnet', 'testnet', 'developer', 'github', '升级', '分叉', '主网', '技术'],
};

// Helper: Strip HTML tags
const stripHtml = (html: string): string => {
   if (!html) return "";
   return html.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim();
};

// Helper: Local Text Analysis
const performLocalAnalysis = (text: string): { tickers: string[], category: string, tags: string[] } => {
    const lowerText = text.toLowerCase();
    const tickers = new Set<string>();
    const foundTags = new Set<string>();
    
    // 1. Detect Coins
    Object.entries(COIN_KEYWORDS).forEach(([ticker, keywords]) => {
        if (keywords.some(k => lowerText.includes(k.toLowerCase()))) {
            tickers.add(ticker);
            foundTags.add(ticker); // Also add ticker as a tag
        }
    });

    // 2. Detect Topic
    let bestTopic = "Other";
    let maxMatches = 0;

    // Prioritize specific topics over generic ones (like Market)
    const priorityTopics = ['Security', 'Regulation', 'RWA', 'Layer2', 'Staking', 'DeFi', 'NFT'];
    
    // First pass: Check priority topics
    for (const topic of priorityTopics) {
        if (TOPIC_KEYWORDS[topic]) {
            const matches = TOPIC_KEYWORDS[topic].reduce((count, k) => count + (lowerText.includes(k.toLowerCase()) ? 1 : 0), 0);
            if (matches > 0) {
                 bestTopic = topic;
                 maxMatches = matches;
                 break; // Found a high priority topic, stop
            }
        }
    }

    // Second pass: If no priority topic found, check others
    if (maxMatches === 0) {
        Object.entries(TOPIC_KEYWORDS).forEach(([topic, keywords]) => {
            if (priorityTopics.includes(topic)) return; // Skip already checked
            const matches = keywords.reduce((count, k) => count + (lowerText.includes(k.toLowerCase()) ? 1 : 0), 0);
            if (matches > maxMatches) {
                maxMatches = matches;
                bestTopic = topic;
            }
        });
    }
    
    // Add topic as a tag
    if (bestTopic !== 'Other') {
        foundTags.add(bestTopic);
    }

    return {
        tickers: Array.from(tickers),
        category: bestTopic,
        tags: Array.from(foundTags)
    };
};

// Defined Proxy Strategies
const PROXIES = [
    {
        name: 'AllOrigins',
        getUrl: (target: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`,
        extract: async (res: Response) => {
            const data = await res.json();
            return data.contents;
        }
    },
    {
        name: 'CodeTabs',
        getUrl: (target: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`,
        extract: (res: Response) => res.text()
    },
    {
        name: 'CORSProxy',
        getUrl: (target: string) => `https://corsproxy.io/?${encodeURIComponent(target)}`,
        extract: (res: Response) => res.text()
    },
    {
        name: 'ThingProxy',
        getUrl: (target: string) => `https://thingproxy.freeboard.io/fetch/${target}`,
        extract: (res: Response) => res.text()
    }
];

const fetchWithFallback = async (targetUrl: string): Promise<string> => {
    const separator = targetUrl.includes('?') ? '&' : '?';
    const urlWithCache = `${targetUrl}${separator}t=${new Date().getTime()}`;
    let lastError: any = null;

    for (const proxy of PROXIES) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); 
            const response = await fetch(proxy.getUrl(urlWithCache), { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const content = await proxy.extract(response);
            if (!content || content.length < 50) throw new Error("Empty response");
            return content;
        } catch (error: any) {
            lastError = error;
        }
    }
    throw new Error(`All proxies failed. Last error: ${lastError?.message || 'Unknown'}`);
};

export const testRSSConnection = async (url: string): Promise<{ success: boolean; message: string }> => {
    try {
        const xmlString = await fetchWithFallback(url);
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");
        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) return { success: false, message: "Invalid XML" };

        let items = Array.from(xmlDoc.querySelectorAll("item"));
        if (items.length === 0) items = Array.from(xmlDoc.querySelectorAll("entry"));

        return items.length > 0 
            ? { success: true, message: `Found ${items.length} items.` }
            : { success: false, message: "Feed empty (0 items)." };
    } catch (e: any) {
        return { success: false, message: e.message || "Connection failed" };
    }
};

export const fetchRSS = async (url: string, sourceName: string): Promise<Partial<NewsItem>[]> => {
  try {
    const xmlString = await fetchWithFallback(url);
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    
    let items = Array.from(xmlDoc.querySelectorAll("item"));
    if (items.length === 0) items = Array.from(xmlDoc.querySelectorAll("entry"));
    
    return items.map(item => {
      try {
          const title = item.querySelector("title")?.textContent?.trim() || "No Title";
          let link = item.querySelector("link")?.textContent;
          if (!link) link = item.querySelector("link")?.getAttribute("href") || "";
          
          // Date Parsing
          const pubDateStr = item.querySelector("pubDate")?.textContent || 
                             item.querySelector("published")?.textContent || 
                             item.querySelector("updated")?.textContent || 
                             item.querySelector("dc\\:date")?.textContent;
          let publishedAt = Date.now();
          if (pubDateStr) {
              const parsed = new Date(pubDateStr).getTime();
              if (!isNaN(parsed)) publishedAt = parsed;
          }

          // Content Extraction
          const contentEncoded = item.getElementsByTagName("content:encoded")[0]?.textContent;
          const description = item.querySelector("description")?.textContent;
          const contentTag = item.querySelector("content")?.textContent;
          
          let fullHtml = "";
          const candidates = [contentEncoded, description, contentTag].filter(c => c && c.length > 0);
          if (candidates.length > 0) {
              fullHtml = candidates.sort((a, b) => (b?.length || 0) - (a?.length || 0))[0] || "";
          }

          // --- LOCAL INTELLIGENCE (Saving AI Tokens) ---
          
          // 1. Extract Summary directly from Description
          // Use description specifically for summary if available, otherwise truncate content
          const rawDescription = description || contentEncoded || contentTag || "";
          let summary = stripHtml(rawDescription).substring(0, 200);
          if (summary.length > 190) summary += "...";

          // 2. Extract Categories from RSS tags
          const rssCategories: string[] = [];
          item.querySelectorAll("category").forEach(cat => {
              if (cat.textContent) rssCategories.push(cat.textContent.trim());
          });

          // 3. Regex Analysis for Coins & Topics
          const analysisText = `${title} ${summary} ${rssCategories.join(' ')}`;
          const localAnalysis = performLocalAnalysis(analysisText);

          // Merge RSS categories into tags
          const finalTags = Array.from(new Set([...localAnalysis.tags, ...rssCategories]));
          
          // Determine final topic: Use Regex detected topic, fallback to "Other"
          // If regex detected "Other" but RSS has categories, try to infer, but usually Regex is safer for our specific buckets.
          const topicCategory = localAnalysis.category;

          const uniqueHash = generateHash(link + title);

          return {
            title: title,
            originalTitle: title,
            url: link?.trim() || "",
            sourceName,
            publishedAt: publishedAt,
            fetchedAt: Date.now(),
            uniqueHash,
            content: fullHtml, // Store full HTML for display
            status: AnalysisStatus.PENDING,
            // Pre-filled fields (saving AI work)
            summary: summary,
            tags: finalTags,
            coinTickers: localAnalysis.tickers,
            topicCategory: topicCategory,
            // Fields needing AI:
            riskLevel: 'low', // Default, AI will update
            sentiment: 'neutral', // Default
          };
      } catch (innerError) {
          console.warn("Skipping malformed item", innerError);
          return null;
      }
    }).filter(item => item !== null) as Partial<NewsItem>[];

  } catch (error) {
    console.warn(`[RSS] Failed ${sourceName}:`, error);
    return [];
  }
};