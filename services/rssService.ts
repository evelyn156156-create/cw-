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

export const testRSSConnection = async (url: string): Promise<{ success: boolean; message: string }> => {
    try {
        const response = await fetch('/api/fetch-rss', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const items = data.items || [];

        return items.length > 0 
            ? { success: true, message: `Found ${items.length} items.` }
            : { success: false, message: "Feed empty (0 items)." };
    } catch (e: any) {
        return { success: false, message: e.message || "Connection failed" };
    }
};

export const fetchRSS = async (url: string, sourceName: string): Promise<Partial<NewsItem>[]> => {
  try {
    const response = await fetch('/api/fetch-rss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const items = data.items || [];
    
    return items.map((item: any) => {
      try {
          const title = item.title || "No Title";
          const link = item.link || "";
          
          // Date Parsing
          let publishedAt = Date.now();
          if (item.pubDate) {
              const parsed = new Date(item.pubDate).getTime();
              if (!isNaN(parsed)) publishedAt = parsed;
          }

          // Content Extraction
          const fullHtml = item.content || "";

          // --- LOCAL INTELLIGENCE (Saving AI Tokens) ---
          
          // 1. Extract Summary directly from Description
          let summary = stripHtml(fullHtml).substring(0, 200);
          if (summary.length > 190) summary += "...";

          // 2. Extract Categories from RSS tags
          const rssCategories: string[] = item.categories || [];

          // 3. Regex Analysis for Coins & Topics
          const analysisText = `${title} ${summary} ${rssCategories.join(' ')}`;
          const localAnalysis = performLocalAnalysis(analysisText);

          // Merge RSS categories into tags
          const finalTags = Array.from(new Set([...localAnalysis.tags, ...rssCategories]));
          
          // Determine final topic
          const topicCategory = localAnalysis.category;

          const uniqueHash = generateHash(link + title);

          return {
            title: title,
            originalTitle: title,
            url: link.trim(),
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
    }).filter((item: any) => item !== null && item.url) as Partial<NewsItem>[];

  } catch (error) {
    console.warn(`[RSS] Failed ${sourceName}:`, error);
    return [];
  }
};