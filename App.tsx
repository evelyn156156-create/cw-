import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from './lib/supabase';
import { pruneOldNews } from './db/database';
import { fetchRSS, testRSSConnection } from './services/rssService';
import { analyzeNewsBatch } from './services/geminiService';
import { NewsItem, SourceConfig, ProcessingStats, AnalysisStatus } from './types';
import { 
    LayoutDashboard, 
    RefreshCw, 
    Database, 
    Settings, 
    PieChart,
    Search,
    Trash2,
    Filter,
    Calendar,
    X,
    Plus,
    Power,
    CheckCircle2,
    Ban,
    Clock,
    AlertCircle,
    Timer,
    Wifi,
    WifiOff,
    Loader2,
    Zap,
    BrainCircuit,
    Square,
    HardDrive,
    Activity
} from 'lucide-react';
import { StatsCard } from './components/StatsCard';
import { NewsCard } from './components/NewsCard';
import { NewsDetailModal } from './components/NewsDetailModal';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// 定义分类过滤器的配置
const COIN_FILTERS = [
  { id: 'btc', label: 'BTC / 比特币', keywords: ['BTC', 'Bitcoin', '比特币', '大饼'] },
  { id: 'eth', label: 'ETH / 以太坊', keywords: ['ETH', 'Ethereum', '以太坊', 'Vitalik'] },
  { id: 'sol', label: 'SOL / Solana', keywords: ['SOL', 'Solana', '索拉纳'] },
  { id: 'bnb', label: 'BNB / BSC', keywords: ['BNB', 'Binance', '币安', 'BSC'] },
  { id: 'stable', label: '稳定币', keywords: ['USDT', 'USDC', 'Stablecoin', '稳定币', 'DAI', 'FDUSD'] },
];

const TOPIC_FILTERS = [
  { id: 'defi', label: 'DeFi', keywords: ['DeFi', 'DEX', 'Swap', 'Lending', '流动性'] },
  { id: 'rwa', label: 'RWA', keywords: ['RWA', 'Real World', '现实世界资产', '国债'] },
  { id: 'staking', label: '质押 / Staking', keywords: ['Staking', 'Restaking', '质押', '再质押', 'LSD', 'EigenLayer'] },
  { id: 'nft', label: 'NFT / GameFi', keywords: ['NFT', 'GameFi', 'Metaverse', '元宇宙', '链游'] },
  { id: 'regulation', label: '监管政策', keywords: ['Regulation', 'SEC', '监管', '合规', '政策', 'ETF', '法案'] },
  { id: 'security', label: '安全 / 黑客', keywords: ['Hack', 'Security', '黑客', '攻击', '漏洞', '被盗', 'Phishing'] },
  { id: 'layer2', label: 'Layer 2', keywords: ['Layer2', 'L2', 'Rollup', 'Arbitrum', 'Optimism', 'Base', 'ZK'] },
];

// Default Sources List
const DEFAULT_SOURCES = [
    // --- 中文/华语优质信源 (Chinese Sources) ---
    { name: 'ChainFeeds (链捕手)', url: 'https://rss.chainfeeds.xyz/rss' },
    { name: 'BlockBeats (律动)', url: 'https://api.theblockbeats.news/v1/open-api/home-xml' },
    { name: 'PANews', url: 'https://rss.panewslab.com/zh/tvsq/rss' },
    { name: 'Foresight News', url: 'https://foresightnews.pro/rss' },
    { name: 'Odaily (星球日报)', url: 'https://www.odaily.news/rss' },

    // --- 英文/国际权威信源 (English/Global Sources) ---
    { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
    { name: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
    { name: 'The Block', url: 'https://www.theblock.co/rss.xml' },
    { name: 'Decrypt', url: 'https://decrypt.co/feed' },
    { name: 'Blockworks', url: 'https://blockworks.co/feed' },
    { name: 'CryptoSlate', url: 'https://cryptoslate.com/feed/' },
    { name: 'Bankless', url: 'https://www.bankless.com/rss/feed' },
    { name: 'The Daily Hodl', url: 'https://dailyhodl.com/feed/' },
    { name: 'U.Today', url: 'https://u.today/rss' },
    { name: 'Bitcoin Magazine', url: 'https://bitcoinmagazine.com/.rss/full/' }
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'sources' | 'data'>('dashboard');
  
  // Data State
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [sources, setSources] = useState<SourceConfig[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  // Loading States
  const [isLoadingData, setIsLoadingData] = useState(false);

  // State Separation: Fetching vs Analyzing
  const [isFetching, setIsFetching] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ remaining: 0, total: 0 });
  
  // Ref to control analysis loop
  const abortAnalysisRef = useRef(false);

  const [logs, setLogs] = useState<string[]>([]);
  
  // Pipeline Settings
  const [fetchWindow, setFetchWindow] = useState<'24h' | '3d' | 'all'>('3d');
  
  // Retention Policy State
  const [retentionDays, setRetentionDays] = useState<number>(() => {
      return parseInt(localStorage.getItem('retentionDays') || '30');
  });

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('');
  const [dateRange, setDateRange] = useState<{start: string, end: string}>({ start: '', end: '' });
  const [showFilters, setShowFilters] = useState(false);
  
  // New Category Filters State
  const [activeCoinFilter, setActiveCoinFilter] = useState<string | null>(null);
  const [activeTopicFilter, setActiveTopicFilter] = useState<string | null>(null);

  // New Source Form State
  const [newSource, setNewSource] = useState({ name: '', url: '' });
  const [testingSourceId, setTestingSourceId] = useState<string | null>(null);

  // Modal State
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  // Initialize from local storage
  const [lastRunTime, setLastRunTime] = useState<string | null>(localStorage.getItem('lastRunTime'));

  // --- Supabase Data Loaders ---
  const loadSources = async () => {
      const { data } = await supabase.from('sources').select('*').order('id');
      if (data) setSources(data as SourceConfig[]);
  };

  const loadNews = async () => {
      setIsLoadingData(true);
      // Fetch recent 2000 items to keep UI fast
      const { data } = await supabase
          .from('news')
          .select('*')
          .order('publishedAt', { ascending: false })
          .limit(2000);
      
      if (data) {
          setNewsItems(data as NewsItem[]);
          setPendingCount(data.filter((i: any) => i.status === AnalysisStatus.PENDING).length);
      }
      setIsLoadingData(false);
  };

  useEffect(() => {
      loadSources();
      loadNews();

      // Simple Realtime Subscription for News Updates
      const channel = supabase.channel('table-db-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'news' },
          (payload) => {
             // Basic refresh on any change. For huge scale, optimise this to update specific rows.
             // For now, debounced refresh or just simple refresh is okay for a team tool.
             loadNews();
          }
        )
        .subscribe();
      
      return () => { supabase.removeChannel(channel); };
  }, []);
  
  // Auto-cleanup on app start
  useEffect(() => {
    const performCleanup = async () => {
        if (retentionDays > 0) {
            const deleted = await pruneOldNews(retentionDays);
            if (deleted > 0) {
                addLog(`🧹 系统维护: 自动清理了 ${deleted} 篇超过 ${retentionDays} 天的历史新闻`);
                loadNews(); // Refresh
            }
        }
    };
    performCleanup();
  }, [retentionDays]);

  // Save retention setting when changed
  useEffect(() => {
      localStorage.setItem('retentionDays', retentionDays.toString());
  }, [retentionDays]);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 99)]);
  };

  const clearDatabase = async () => {
      if(window.confirm("⚠️ 高危操作：确定要清空所有抓取的新闻数据吗？\n\n信源配置将保留。")) {
          await supabase.from('news').delete().neq('id', 0); // Delete all
          localStorage.removeItem('lastRunTime'); 
          setLastRunTime(null);
          loadNews();
          addLog("数据库已完全清空。");
      }
  };

  const handlePruneNow = async () => {
      if (retentionDays <= 0) return;
      if (window.confirm(`确定要立即删除 ${retentionDays} 天前的所有旧新闻吗？`)) {
          const count = await pruneOldNews(retentionDays);
          addLog(`手动清理完成: 已删除 ${count} 篇旧新闻。`);
          loadNews();
      }
  };

  // --- ENGINE 1: Fast Fetcher (Input) ---
  const handleFastFetch = async () => {
    if (isFetching) return;
    setIsFetching(true);
    addLog("🚀 启动云端采集引擎...");

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    let cutoffTime = 0; 

    if (fetchWindow === '24h') {
        cutoffTime = now - oneDay;
    } else if (fetchWindow === '3d') {
        cutoffTime = now - (3 * oneDay);
    }

    try {
      const activeSources = sources.filter(s => s.enabled);
      
      if (activeSources.length === 0) {
          addLog("⚠️ 未检测到有效信源。可能原因：");
          addLog("1. Vercel 环境变量 (VITE_SUPABASE_URL) 未配置");
          addLog("2. Supabase 数据库中没有 sources 数据 (请运行 SQL)");
          addLog("3. 所有信源已被禁用");
          return;
      }

      let totalNewItems = 0;

      // Parallel Fetch requests
      const fetchPromises = activeSources.map(async (source) => {
          try {
              const fetched = await fetchRSS(source.url, source.name);
              
              if (fetched.length > 0) {
                  await supabase.from('sources').update({ 
                      lastFetchStatus: 'ok', 
                      lastCheckTime: Date.now(), 
                      lastErrorMessage: null 
                  }).eq('id', source.id);
              }

              const newItems: NewsItem[] = [];
              for (const item of fetched) {
                  if (!item.uniqueHash) continue;
                  const itemTime = item.publishedAt || Date.now();

                  if (cutoffTime > 0 && itemTime < cutoffTime) continue;

                  // Supabase Upsert handles "Check existence" automatically via unique constraint on uniqueHash
                  newItems.push({
                      ...(item as NewsItem),
                      status: AnalysisStatus.PENDING,
                      fetchedAt: Date.now()
                  });
              }

              if (newItems.length > 0) {
                  const { error } = await supabase.from('news').upsert(newItems, { onConflict: 'uniqueHash', ignoreDuplicates: true });
                  
                  if (!error) {
                      // Note: Upsert with ignoreDuplicates doesn't tell us exactly how many *new* rows were inserted vs ignored.
                      // We approximate for logs.
                      addLog(` -> ${source.name}: 抓取 ${newItems.length} 条 (含重复)`);
                      totalNewItems += newItems.length; // Approximate
                  } else {
                      console.error("Supabase upsert error", error);
                      addLog(`❌ ${source.name}: 数据库写入失败。请检查 Vercel 环境变量配置 (VITE_SUPABASE_URL)。`);
                  }
              }
          } catch (e) {
              console.error(`Fetch error for ${source.name}`, e);
              addLog(` -> ${source.name}: 抓取失败 (${String(e)})`);
              await supabase.from('sources').update({
                  lastFetchStatus: 'error',
                  lastErrorMessage: String(e),
                  lastCheckTime: Date.now()
              }).eq('id', source.id);
          }
      });

      await Promise.all(fetchPromises);

      addLog(`✅ 采集完成！`);
      
      const finishedTime = Date.now().toString();
      localStorage.setItem('lastRunTime', finishedTime);
      setLastRunTime(finishedTime);
      loadNews(); // Refresh data
      loadSources(); // Refresh status

    } catch (error) {
      addLog(`❌ 采集错误: ${error}`);
    } finally {
      setIsFetching(false);
    }
  };

  // --- ENGINE 2: Background Analyzer (Output) ---
  const stopBatchAnalysis = () => {
      if (isAnalyzing) {
          abortAnalysisRef.current = true;
          addLog("⚠️ 正在请求停止分析... (当前批次完成后停止)");
      }
  };

  const runBatchAnalysis = async () => {
      // Toggle logic handled by UI
      if (isAnalyzing) {
          stopBatchAnalysis();
          return;
      }
      
      // Fetch fresh pending count from DB
      const { count } = await supabase.from('news').select('*', { count: 'exact', head: true }).eq('status', AnalysisStatus.PENDING);
      const totalPending = count || 0;

      if (totalPending === 0) {
          addLog("没有待分析的文章。请先点击“开始采集”。");
          return;
      }

      setIsAnalyzing(true);
      abortAnalysisRef.current = false;
      setAnalysisProgress({ remaining: totalPending, total: totalPending });
      
      addLog(`🧠 启动 AI 批量分析 (队列: ${totalPending} 篇)`);

      const BATCH_SIZE = 3; 
      
      try {
          while (true) {
              if (abortAnalysisRef.current) {
                   addLog("🛑 分析任务已停止。");
                   break;
              }

              // 1. Get next batch of Pending items from Supabase
              const { data: batch } = await supabase
                  .from('news')
                  .select('*')
                  .eq('status', AnalysisStatus.PENDING)
                  .order('publishedAt', { ascending: false })
                  .limit(BATCH_SIZE);

              if (!batch || batch.length === 0) {
                  break; // Queue empty
              }

              // 2. Analyze
              const analyzedBatch = await analyzeNewsBatch(batch as NewsItem[]);

              // 3. Save updates to Supabase
              for (const item of analyzedBatch) {
                   await supabase.from('news').update(item).eq('id', item.id);
              }

              // 4. Update Progress
              const { count: currentPending } = await supabase.from('news').select('*', { count: 'exact', head: true }).eq('status', AnalysisStatus.PENDING);
              setAnalysisProgress(prev => ({ ...prev, remaining: currentPending || 0 }));
              
              // Refresh local list occasionally so UI updates
              loadNews();

              // 5. Rate Limit / UI Yield
              await new Promise(r => setTimeout(r, 1000));
          }
          if (!abortAnalysisRef.current) {
              addLog("✅ 所有待处理文章分析完毕。");
          }
      } catch (e) {
          console.error("Analysis loop error", e);
          addLog("❌ 分析进程中断。");
      } finally {
          setIsAnalyzing(false);
          abortAnalysisRef.current = false;
          loadNews();
      }
  };

  const handleSingleAnalysis = async (item: NewsItem) => {
      addLog(`🧠 单篇分析: ${item.title.substring(0, 15)}...`);
      try {
          // 1. Set status to PROCESSING
          setNewsItems(prev => prev.map(n => n.id === item.id ? { ...n, status: AnalysisStatus.PROCESSING } : n));
          
          // 2. Analyze
          const results = await analyzeNewsBatch([item]);
          
          // 3. Save result
          if (results && results.length > 0) {
              await supabase.from('news').update(results[0]).eq('id', item.id);
              addLog(`✅ 分析完成`);
              loadNews();
          }
      } catch (e) {
          // Revert or set to failed
          await supabase.from('news').update({ status: AnalysisStatus.FAILED }).eq('id', item.id);
          addLog(`❌ 分析失败`);
          loadNews();
      }
  };

  // --- Smart Filtering & Tag Interaction ---
  const handleTagSelection = (tag: string, type: 'coin' | 'topic') => {
      const matchedCoinFilter = COIN_FILTERS.find(f => 
          f.keywords.some(k => tag.toLowerCase() === k.toLowerCase() || tag.toLowerCase().includes(k.toLowerCase()))
      );

      if (matchedCoinFilter) {
          setActiveCoinFilter(matchedCoinFilter.id);
          setActiveTab('data');
          return;
      }

      const matchedTopicFilter = TOPIC_FILTERS.find(f => 
          f.keywords.some(k => tag.toLowerCase() === k.toLowerCase() || tag.toLowerCase().includes(k.toLowerCase()))
      );

      if (matchedTopicFilter) {
          setActiveTopicFilter(matchedTopicFilter.id);
          setActiveTab('data');
          return;
      }

      setSearchTerm(tag);
      setActiveTab('data');
  };

  // --- Other Handlers (Add, Delete, etc.) ---
  const handleAddSource = async () => {
      if (!newSource.name.trim() || !newSource.url.trim()) {
          alert("请输入信源名称和 RSS 地址");
          return;
      }
      try {
          addLog(`正在测试连接: ${newSource.url}...`);
          const testResult = await testRSSConnection(newSource.url);
          
          if (!testResult.success) {
              if(!window.confirm(`连接测试失败: ${testResult.message}\n是否仍然强制添加？`)) {
                  return;
              }
          }

          const { error } = await supabase.from('sources').insert({
              name: newSource.name,
              url: newSource.url,
              enabled: true,
              type: 'rss',
              lastFetchStatus: testResult.success ? 'ok' : 'error',
              lastErrorMessage: testResult.success ? null : testResult.message,
              lastCheckTime: Date.now()
          });

          if (error) throw error;
          
          setNewSource({ name: '', url: '' });
          addLog(testResult.success ? `已添加新信源 (连接成功)` : `已强制添加信源 (连接失败)`);
          loadSources();
      } catch (error) {
          console.error(error);
          alert("添加失败，可能该 URL 已存在。");
      }
  };

  const handleToggleSource = async (source: SourceConfig) => {
      try {
          await supabase.from('sources').update({ enabled: !source.enabled }).eq('id', source.id);
          addLog(`${source.enabled ? '禁用' : '启用'}信源: ${source.name}`);
          loadSources();
      } catch (error) {
          console.error("Failed to toggle source", error);
      }
  };

  const handleDeleteSource = async (id: string) => {
      if (window.confirm("确定要删除这个信源吗？")) {
          try {
            await supabase.from('sources').delete().eq('id', id);
            addLog("信源已删除");
            loadSources();
          } catch (error) {
              console.error("Failed to delete", error);
          }
      }
  };

  const handleTestSource = async (source: SourceConfig) => {
      setTestingSourceId(source.id);
      addLog(`测试连接: ${source.name}...`);
      try {
          const result = await testRSSConnection(source.url);
          await supabase.from('sources').update({
              lastFetchStatus: result.success ? 'ok' : 'error',
              lastErrorMessage: result.success ? null : result.message,
              lastCheckTime: Date.now()
          }).eq('id', source.id);
          
          addLog(`${source.name} 连接测试: ${result.success ? '成功 ✅' : '失败 ❌'}`);
          loadSources();
      } catch (e) {
          console.error(e);
      } finally {
          setTestingSourceId(null);
      }
  };

  const handleTestAllSources = async () => {
      if (!sources) return;
      if (!window.confirm(`确定要测试所有 ${sources.length} 个信源吗？这可能需要几分钟。`)) return;
      
      addLog("开始批量测试连接...");
      for (const source of sources) {
          await handleTestSource(source);
      }
      addLog("批量测试完成。");
  };

  const handleRetryFailedSources = async () => {
      const failedSources = sources.filter(s => s.lastFetchStatus === 'error');
      if (failedSources.length === 0) {
          alert("当前没有标记为失败的信源。");
          return;
      }
      
      addLog(`开始重试 ${failedSources.length} 个失败信源...`);
      for (const source of failedSources) {
          await handleTestSource(source);
      }
      addLog("重试完成。");
  };

  const handleResetSources = async () => {
      if (!window.confirm("这将添加默认的加密货币新闻源。如果源已存在，将跳过。\n\n确定要继续吗？")) return;
      
      addLog("正在初始化默认信源...");
      let addedCount = 0;

      for (const src of DEFAULT_SOURCES) {
          // Check if exists by URL to avoid duplicates
          const exists = sources.some(s => s.url === src.url);
          if (!exists) {
              try {
                  // Test connection before adding
                  addLog(`正在验证信源: ${src.name}...`);
                  const testResult = await testRSSConnection(src.url);
                  
                  await supabase.from('sources').insert({
                      name: src.name,
                      url: src.url,
                      enabled: true,
                      type: 'rss',
                      lastFetchStatus: testResult.success ? 'ok' : 'error',
                      lastErrorMessage: testResult.success ? null : testResult.message,
                      lastCheckTime: Date.now()
                  });
                  addedCount++;
                  if (!testResult.success) {
                      addLog(`⚠️ ${src.name} 添加成功但连接失败: ${testResult.message}`);
                  }
              } catch (e) {
                  console.error(`Failed to add ${src.name}`, e);
                  addLog(`❌ 添加 ${src.name} 失败: ${String(e)}`);
              }
          }
      }
      
      addLog(`✅ 初始化完成: 新增 ${addedCount} 个信源。`);
      loadSources();
  };

  // Advanced Filtering Logic
  const filteredNews = useMemo(() => {
    if (!newsItems) return [];
    return newsItems.filter(item => {
        if (filterStatus !== 'all' && item.status !== filterStatus) return false;
        
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            const matchText = 
                item.title.toLowerCase().includes(lowerTerm) || 
                (item.summary && item.summary.toLowerCase().includes(lowerTerm));
            if (!matchText) return false;
        }

        if (filterSource !== 'all' && item.sourceName !== filterSource) return false;
        
        if (filterTag && !item.tags?.some(t => t.toLowerCase().includes(filterTag.toLowerCase()))) return false;
        
        const itemDate = new Date(item.publishedAt);
        itemDate.setHours(0,0,0,0);
        if (dateRange.start) {
            const startDate = new Date(dateRange.start);
            if (itemDate < startDate) return false;
        }
        if (dateRange.end) {
            const endDate = new Date(dateRange.end);
            if (itemDate > endDate) return false;
        }

        if (activeCoinFilter) {
            const config = COIN_FILTERS.find(c => c.id === activeCoinFilter);
            if (config) {
                const hasCoin = 
                    item.coinTickers?.some(ticker => config.keywords.some(k => ticker.toLowerCase() === k.toLowerCase())) ||
                    item.tags?.some(tag => config.keywords.some(k => tag.toLowerCase().includes(k.toLowerCase())));
                if (!hasCoin) return false;
            }
        }

        if (activeTopicFilter) {
            const config = TOPIC_FILTERS.find(c => c.id === activeTopicFilter);
            if (config) {
                const hasTopic = 
                    (item.topicCategory && config.keywords.some(k => item.topicCategory!.toLowerCase().includes(k.toLowerCase()))) ||
                    item.tags?.some(tag => config.keywords.some(k => tag.toLowerCase().includes(k.toLowerCase())));
                if (!hasTopic) return false;
            }
        }
        
        return true;
    });
  }, [newsItems, searchTerm, filterSource, filterStatus, filterTag, dateRange, activeCoinFilter, activeTopicFilter]);

  // Derived Stats
  const sentimentData = useMemo(() => {
    if (!newsItems) return [];
    const completedItems = newsItems.filter(n => n.status === AnalysisStatus.COMPLETED);
    const counts = { positive: 0, negative: 0, neutral: 0 };
    completedItems.forEach(n => {
        if(n.sentiment && counts[n.sentiment as keyof typeof counts] !== undefined) {
            counts[n.sentiment as keyof typeof counts]++;
        }
    });
    return [
        { name: '利好', value: counts.positive, color: '#10b981' },
        { name: '中性', value: counts.neutral, color: '#9ca3af' },
        { name: '利空', value: counts.negative, color: '#ef4444' },
    ];
  }, [newsItems]);

  const formatLastRun = (ts: string | null) => {
      if (!ts) return "从未运行";
      return new Date(parseInt(ts)).toLocaleString('zh-CN');
  }

  const resetFilters = () => {
      setSearchTerm('');
      setFilterSource('all');
      setFilterStatus('all');
      setFilterTag('');
      setDateRange({ start: '', end: '' });
      setActiveCoinFilter(null);
      setActiveTopicFilter(null);
  };

  return (
    <div className="min-h-screen bg-crypto-900 text-gray-200 font-sans flex flex-col md:flex-row">
      <NewsDetailModal 
        item={selectedNews} 
        isOpen={!!selectedNews} 
        onClose={() => setSelectedNews(null)} 
      />

      <aside className="w-full md:w-64 bg-crypto-800 border-r border-crypto-700 flex flex-col fixed md:relative z-10 h-16 md:h-auto">
        <div className="p-6 hidden md:block">
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-crypto-500 to-crypto-400">
                CryptoIntel
            </h1>
            <p className="text-xs text-gray-500 mt-1">云端协作版 (Supabase)</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 flex md:block overflow-x-auto md:overflow-visible">
            <button onClick={() => setActiveTab('dashboard')} className={`flex items-center space-x-3 w-full px-4 py-3 rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-crypto-500 text-white' : 'text-gray-400 hover:bg-crypto-700'}`}>
                <LayoutDashboard size={20} /><span>仪表盘</span>
            </button>
            <button onClick={() => setActiveTab('data')} className={`flex items-center space-x-3 w-full px-4 py-3 rounded-lg transition-all ${activeTab === 'data' ? 'bg-crypto-500 text-white' : 'text-gray-400 hover:bg-crypto-700'}`}>
                <Database size={20} /><span>数据中心</span>
            </button>
            <button onClick={() => setActiveTab('sources')} className={`flex items-center space-x-3 w-full px-4 py-3 rounded-lg transition-all ${activeTab === 'sources' ? 'bg-crypto-500 text-white' : 'text-gray-400 hover:bg-crypto-700'}`}>
                <Settings size={20} /><span>系统与信源</span>
            </button>
        </nav>

        {/* AI Background Process Indicator (Sidebar Footer) */}
        {isAnalyzing && (
            <div className="p-4 border-t border-crypto-700 bg-indigo-900/10">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center text-xs font-bold text-indigo-400">
                        <BrainCircuit size={14} className="mr-2 animate-pulse" />
                        AI 分析中...
                    </div>
                    <span className="text-xs text-indigo-300">{analysisProgress.remaining} 待处理</span>
                </div>
                <div className="w-full bg-crypto-700 rounded-full h-1.5">
                    <div 
                        className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.max(5, ((1 - (analysisProgress.remaining / Math.max(analysisProgress.total, 1))) * 100))}%` }}
                    ></div>
                </div>
                <button 
                    onClick={stopBatchAnalysis}
                    className="mt-2 w-full flex items-center justify-center px-2 py-1 rounded text-xs font-bold text-red-400 border border-red-900/50 hover:bg-red-900/20"
                >
                    <Square size={10} className="mr-1 fill-current"/> 停止任务
                </button>
            </div>
        )}

        <div className="p-4 border-t border-crypto-700 hidden md:block">
            <div className="bg-crypto-900 rounded-lg p-3 text-xs font-mono text-gray-500 h-40 overflow-y-auto">
                <div className="mb-2 text-crypto-400 font-bold flex items-center">
                    <Activity size={12} className="mr-1"/> 系统日志
                </div>
                {logs.map((log, i) => (
                    <div key={i} className="mb-1">{log}</div>
                ))}
            </div>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 mt-16 md:mt-0 overflow-y-auto h-screen">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
                <h2 className="text-2xl font-bold text-white">
                    {activeTab === 'dashboard' && '市场情报看板'}
                    {activeTab === 'data' && '新闻数据库'}
                    {activeTab === 'sources' && '系统设置与信源'}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                    <Clock size={14} className="text-gray-500"/>
                    <p className="text-gray-400 text-sm">
                        上次完成时间: <span className="text-crypto-400 font-bold">{formatLastRun(lastRunTime)}</span>
                    </p>
                </div>
            </div>
            
            <div className="flex flex-wrap gap-3 items-center">
                 {/* Time Window Selector */}
                 <div className="flex items-center bg-crypto-800 border border-crypto-700 rounded-lg px-2 py-1 mr-2">
                     <Timer size={16} className="text-gray-400 mr-2" />
                     <select 
                        value={fetchWindow}
                        onChange={(e) => setFetchWindow(e.target.value as '24h' | '3d' | 'all')}
                        className="bg-transparent text-sm text-white outline-none cursor-pointer"
                        disabled={isFetching}
                     >
                         <option value="24h">过去 24 小时</option>
                         <option value="3d">过去 3 天</option>
                         <option value="all">无限制 (All Time)</option>
                     </select>
                 </div>

                {/* 1. FETCH BUTTON */}
                <button 
                    onClick={() => handleFastFetch()}
                    disabled={isFetching}
                    className={`flex items-center space-x-2 px-4 py-3 rounded-lg font-bold border border-crypto-600 transition-all ${isFetching ? 'bg-crypto-700 cursor-not-allowed text-gray-400' : 'bg-crypto-800 hover:bg-crypto-700 text-white'}`}
                >
                    <RefreshCw className={isFetching ? "animate-spin" : ""} size={20}/>
                    <span>{isFetching ? '正在采集...' : '开始采集 (RSS)'}</span>
                </button>

                {/* 1.5. INIT BUTTON (If no sources) */}
                {sources.length === 0 && (
                    <button 
                        onClick={handleResetSources}
                        className="flex items-center space-x-2 px-4 py-3 rounded-lg font-bold border border-emerald-600 bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50 transition-all"
                    >
                        <Database size={20}/>
                        <span>初始化信源</span>
                    </button>
                )}

                {/* 2. ANALYZE BUTTON (Primary) */}
                <button 
                    onClick={() => runBatchAnalysis()}
                    disabled={(pendingCount === 0 && !isAnalyzing)}
                    className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-bold shadow-lg transition-all min-w-[160px] justify-center ${isAnalyzing ? 'bg-red-600 hover:bg-red-500 text-white border border-red-500' : (pendingCount === 0 ? 'bg-crypto-700 cursor-not-allowed text-gray-400 border border-crypto-600' : 'bg-gradient-to-r from-crypto-500 to-indigo-600 hover:to-indigo-500 text-white')}`}
                    title={isAnalyzing ? "停止分析任务" : (pendingCount === 0 ? "暂无待分析文章" : `分析 ${pendingCount} 篇待处理文章`)}
                >
                    {isAnalyzing ? <Square size={20} className="fill-current" /> : <Zap size={20} />}
                    <span>{isAnalyzing ? '停止分析' : `批量 AI 分析 (${pendingCount})`}</span>
                </button>
            </div>
        </div>

        {activeTab === 'dashboard' && (
            <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatsCard title="总收录文章" value={newsItems.length} icon={Database} />
                    <StatsCard 
                        title="待处理分析" 
                        value={pendingCount} 
                        icon={BrainCircuit} 
                        color={pendingCount > 0 ? "text-indigo-400 animate-pulse" : "text-gray-400"} 
                        trend={pendingCount > 0 ? "请点击右上角开始处理" : "所有任务已完成"}
                    />
                    <StatsCard title="过滤垃圾" value={newsItems?.filter(n => n.status === AnalysisStatus.SKIPPED).length || 0} icon={Settings} color="text-yellow-400" />
                    <StatsCard title="活跃源" value={sources?.filter(s=>s.enabled).length || 0} icon={LayoutDashboard} color="text-blue-400" />
                </div>
                
                {/* Dashboard Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-crypto-800 border border-crypto-700 rounded-lg p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                            <PieChart size={18} className="mr-2 text-crypto-400"/> 市场情绪分布
                        </h3>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={sentimentData}>
                                    <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip 
                                        cursor={{fill: '#1f2937'}}
                                        contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff' }}
                                    />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                        {sentimentData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="lg:col-span-2 bg-crypto-800 border border-crypto-700 rounded-lg p-6 flex flex-col">
                         <h3 className="text-lg font-bold text-white mb-4">最新情报速递</h3>
                         <div className="overflow-y-auto pr-2 space-y-3 flex-1 max-h-[500px]">
                            {newsItems?.slice(0, 5).map(item => (
                                <div 
                                    key={item.id} 
                                    onClick={() => setSelectedNews(item)}
                                    className="p-3 bg-crypto-900/50 rounded border border-crypto-700/50 flex justify-between items-center cursor-pointer hover:bg-crypto-700/50 transition-colors"
                                >
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-semibold text-sm text-gray-200 line-clamp-1">{item.title}</h4>
                                            {item.riskLevel === 'high' && (
                                                <span className="text-[10px] bg-red-900/50 text-red-400 px-1 rounded border border-red-800">高风险</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500">{new Date(item.publishedAt).toLocaleDateString()} • {item.sourceName}</p>
                                    </div>
                                    <div className={`text-xs px-2 py-1 rounded border ${item.sentiment === 'positive' ? 'text-emerald-400 border-emerald-900 bg-emerald-900/20' : 'text-gray-400 border-gray-700'}`}>
                                        {item.status !== AnalysisStatus.COMPLETED ? (
                                            <span className="text-xs text-gray-500 flex items-center">
                                                {item.status === AnalysisStatus.PENDING ? (
                                                    <><Loader2 size={10} className="animate-spin mr-1"/>待分析</>
                                                ) : '已过滤'}
                                            </span>
                                        ) : (
                                            item.sentiment === 'positive' ? '利好' : item.sentiment === 'negative' ? '利空' : '中性'
                                        )}
                                    </div>
                                </div>
                            ))}
                            {isLoadingData && <div className="text-center py-4 text-gray-500"><Loader2 className="animate-spin inline mr-2"/> 加载中...</div>}
                            {(!newsItems || newsItems.length === 0) && !isLoadingData && (
                                <div className="text-center text-gray-500 py-10">暂无数据。请点击右上角“开始采集”。</div>
                            )}
                         </div>
                    </div>
                </div>
            </div>
        )}

        {/* Data Tab */}
        {activeTab === 'data' && (
            <div className="space-y-4">
                <div className="bg-crypto-800/50 border border-crypto-700 rounded-lg p-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                         <span className="text-xs font-bold text-crypto-400 uppercase w-16">币种分类</span>
                         <div className="flex flex-wrap gap-2">
                             {COIN_FILTERS.map(f => (
                                 <button
                                    key={f.id}
                                    onClick={() => setActiveCoinFilter(activeCoinFilter === f.id ? null : f.id)}
                                    className={`px-3 py-1 rounded-full text-xs border transition-all ${activeCoinFilter === f.id ? 'bg-crypto-500 text-white border-crypto-500' : 'bg-crypto-900 text-gray-400 border-crypto-700 hover:border-crypto-500'}`}
                                 >
                                     {f.label}
                                 </button>
                             ))}
                         </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-crypto-700/50">
                         <span className="text-xs font-bold text-crypto-400 uppercase w-16">赛道主题</span>
                         <div className="flex flex-wrap gap-2">
                             {TOPIC_FILTERS.map(f => (
                                 <button
                                    key={f.id}
                                    onClick={() => setActiveTopicFilter(activeTopicFilter === f.id ? null : f.id)}
                                    className={`px-3 py-1 rounded-full text-xs border transition-all ${activeTopicFilter === f.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-crypto-900 text-gray-400 border-crypto-700 hover:border-indigo-500'}`}
                                 >
                                     {f.label}
                                 </button>
                             ))}
                         </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={20} />
                        <input 
                            type="text" 
                            placeholder="搜索标题、摘要内容..." 
                            className="w-full bg-crypto-800 border border-crypto-700 text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:border-crypto-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button 
                        onClick={() => setShowFilters(!showFilters)}
                        className={`px-4 rounded-lg border border-crypto-700 flex items-center gap-2 ${showFilters ? 'bg-crypto-500 text-white' : 'bg-crypto-800 text-gray-400 hover:text-white'}`}
                    >
                        <Filter size={20} /> <span className="hidden md:inline">更多筛选</span>
                    </button>
                    {(filterSource !== 'all' || filterStatus !== 'all' || filterTag || dateRange.start || dateRange.end || activeCoinFilter || activeTopicFilter || searchTerm) && (
                         <button 
                            onClick={resetFilters}
                            className="px-4 rounded-lg border border-red-900/50 bg-red-900/20 text-red-400 hover:bg-red-900/40 flex items-center gap-2"
                        >
                            <X size={20} /> <span className="hidden md:inline">重置</span>
                        </button>
                    )}
                </div>

                {showFilters && (
                    <div className="bg-crypto-800 border border-crypto-700 rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block uppercase font-bold flex items-center gap-1">
                                <AlertCircle size={12}/> 数据状态
                            </label>
                            <select 
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full bg-crypto-900 border border-crypto-700 rounded px-3 py-2 text-sm text-white focus:border-crypto-500 outline-none"
                            >
                                <option value="all">全部 (含分析中/跳过/失败)</option>
                                <option value={AnalysisStatus.COMPLETED}>✅ 分析完成</option>
                                <option value={AnalysisStatus.PENDING}>⏳ 分析中 (Pending)</option>
                                <option value={AnalysisStatus.SKIPPED}>⚠️ 已跳过 (低质量)</option>
                                <option value={AnalysisStatus.FAILED}>❌ 分析失败</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-xs text-gray-500 mb-1 block uppercase font-bold">来源媒体</label>
                            <select 
                                value={filterSource}
                                onChange={(e) => setFilterSource(e.target.value)}
                                className="w-full bg-crypto-900 border border-crypto-700 rounded px-3 py-2 text-sm text-white focus:border-crypto-500 outline-none"
                            >
                                <option value="all">全部来源</option>
                                {sources?.map(s => (
                                    <option key={s.id} value={s.name}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs text-gray-500 mb-1 block uppercase font-bold flex items-center gap-1">
                                <Calendar size={12}/> 发布日期范围
                            </label>
                            <div className="flex gap-2">
                                <input 
                                    type="date"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange(prev => ({...prev, start: e.target.value}))}
                                    className="w-1/2 bg-crypto-900 border border-crypto-700 rounded px-2 py-2 text-sm text-white focus:border-crypto-500 outline-none"
                                />
                                <span className="text-gray-500 self-center">-</span>
                                <input 
                                    type="date"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange(prev => ({...prev, end: e.target.value}))}
                                    className="w-1/2 bg-crypto-900 border border-crypto-700 rounded px-2 py-2 text-sm text-white focus:border-crypto-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="text-xs text-gray-500 flex justify-between">
                    <span>显示 {filteredNews.length} 条结果</span>
                    {(activeCoinFilter || activeTopicFilter) && (
                        <span className="text-crypto-400">
                             已启用分类过滤: 
                             {activeCoinFilter && ` [${COIN_FILTERS.find(c => c.id === activeCoinFilter)?.label}]`}
                             {activeTopicFilter && ` [${TOPIC_FILTERS.find(c => c.id === activeTopicFilter)?.label}]`}
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredNews?.map(item => (
                        <NewsCard 
                            key={item.id} 
                            item={item} 
                            onClick={(item) => setSelectedNews(item)}
                            onAnalyze={handleSingleAnalysis}
                            onTagClick={handleTagSelection}
                        />
                    ))}
                </div>
                {filteredNews?.length === 0 && (
                     <div className="text-center text-gray-500 py-20 bg-crypto-800/50 rounded-lg border border-dashed border-crypto-700">
                        未找到相关新闻。
                        <br/>
                        <span className="text-sm mt-2 block">
                            提示: 请点击上方的“开始采集 (RSS)”按钮。
                        </span>
                    </div>
                )}
            </div>
        )}

        {/* Sources & Settings Tab */}
        {activeTab === 'sources' && (
             <div className="space-y-6">
                 
                 {/* System Configuration Card */}
                 <div className="bg-crypto-800 border border-crypto-700 rounded-lg p-6">
                     <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                         <HardDrive size={20} className="mr-2 text-crypto-400" /> 数据保留策略 (系统设置)
                     </h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                         <div>
                             <label className="block text-sm font-medium text-gray-400 mb-2">历史新闻保留时长</label>
                             <div className="flex items-center gap-4">
                                 <select 
                                     value={retentionDays}
                                     onChange={(e) => setRetentionDays(parseInt(e.target.value))}
                                     className="bg-crypto-900 border border-crypto-700 text-white text-sm rounded-lg focus:ring-crypto-500 focus:border-crypto-500 block w-full p-2.5"
                                 >
                                     <option value="-1">永久保存 (不自动删除)</option>
                                     <option value="7">只保留最近 7 天</option>
                                     <option value="30">只保留最近 30 天 (推荐)</option>
                                     <option value="90">只保留最近 90 天</option>
                                     <option value="180">只保留最近半年</option>
                                 </select>
                                 <button 
                                     onClick={handlePruneNow}
                                     className="whitespace-nowrap px-4 py-2 bg-crypto-700 hover:bg-crypto-600 text-white text-sm font-medium rounded-lg transition-colors border border-crypto-600"
                                     title="立即执行清理"
                                 >
                                     立即清理
                                 </button>
                             </div>
                             <p className="mt-2 text-xs text-gray-500">
                                 系统将在每次启动时自动删除超过期限的旧新闻，保持运行流畅。
                             </p>
                         </div>
                         
                         <div className="bg-red-900/10 border border-red-900/30 rounded-lg p-4 flex items-start">
                             <AlertCircle className="text-red-500 mr-3 mt-0.5 flex-shrink-0" size={20} />
                             <div>
                                 <h4 className="text-sm font-bold text-red-400 mb-1">重置数据库</h4>
                                 <p className="text-xs text-gray-400 mb-3">如果遇到严重的数据错误或想重新开始，可以清空所有已抓取的新闻。</p>
                                 <button 
                                     onClick={clearDatabase}
                                     className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800 rounded text-xs font-bold transition-colors"
                                 >
                                     <Trash2 size={12} className="inline mr-1"/> 清空所有数据
                                 </button>
                             </div>
                         </div>
                     </div>
                 </div>

                 <div className="flex gap-4">
                    <div className="flex-1 bg-crypto-800 border border-crypto-700 rounded-lg p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                            <Plus size={20} className="mr-2 text-crypto-400" /> 添加新订阅源
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            <div className="md:col-span-3">
                                <input 
                                    type="text"
                                    placeholder="名称 (例如: ChainFeeds)"
                                    value={newSource.name}
                                    onChange={(e) => setNewSource(prev => ({...prev, name: e.target.value}))}
                                    className="w-full bg-crypto-900 border border-crypto-700 rounded px-4 py-3 text-white focus:border-crypto-500 outline-none"
                                />
                            </div>
                            <div className="md:col-span-7">
                                <input 
                                    type="text"
                                    placeholder="RSS Feed URL (例如: https://.../rss)"
                                    value={newSource.url}
                                    onChange={(e) => setNewSource(prev => ({...prev, url: e.target.value}))}
                                    className="w-full bg-crypto-900 border border-crypto-700 rounded px-4 py-3 text-white focus:border-crypto-500 outline-none"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <button 
                                    onClick={handleAddSource}
                                    className="w-full h-full bg-crypto-500 hover:bg-crypto-400 text-white font-bold rounded flex items-center justify-center transition-colors"
                                >
                                    添加
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleTestAllSources}
                        className="bg-crypto-800 border border-crypto-700 hover:bg-crypto-700 text-gray-300 rounded-lg px-6 flex flex-col items-center justify-center transition-all"
                        title="测试所有连接"
                    >
                        <Wifi size={24} className="mb-1 text-crypto-400"/>
                        <span className="text-xs font-bold">批量体检</span>
                    </button>

                    <button 
                        onClick={handleRetryFailedSources}
                        className="bg-crypto-800 border border-crypto-700 hover:bg-crypto-700 text-gray-300 rounded-lg px-6 flex flex-col items-center justify-center transition-all"
                        title="仅重试失败的连接"
                    >
                        <RefreshCw size={24} className="mb-1 text-yellow-400"/>
                        <span className="text-xs font-bold">重试失败</span>
                    </button>
                    
                    <button 
                        onClick={handleResetSources}
                        className="bg-crypto-800 border border-crypto-700 hover:bg-crypto-700 text-gray-300 rounded-lg px-6 flex flex-col items-center justify-center transition-all"
                        title="一键添加默认源"
                    >
                        <Database size={24} className="mb-1 text-emerald-400"/>
                        <span className="text-xs font-bold">初始化信源</span>
                    </button>
                 </div>

                 <div className="bg-crypto-800 border border-crypto-700 rounded-lg overflow-hidden">
                    {sources.length === 0 ? (
                        <div className="p-10 text-center flex flex-col items-center justify-center">
                            <div className="bg-crypto-700/50 p-4 rounded-full mb-4">
                                <Database size={48} className="text-crypto-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">暂无信源</h3>
                            <p className="text-gray-400 max-w-md mb-6">
                                数据库中还没有配置任何新闻源。您可以手动添加，或者使用我们预设的优质加密货币新闻源列表进行初始化。
                            </p>
                            <button 
                                onClick={handleResetSources}
                                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all flex items-center shadow-lg shadow-emerald-900/20"
                            >
                                <Database size={20} className="mr-2"/>
                                一键导入默认信源 ({DEFAULT_SOURCES.length}个)
                            </button>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-crypto-700/50 text-gray-400 text-xs uppercase">
                                <tr>
                                    <th className="px-6 py-4">来源名称</th>
                                    <th className="px-6 py-4">RSS 地址</th>
                                    <th className="px-6 py-4">运行状态</th>
                                    <th className="px-6 py-4">健康度 (最近检测)</th>
                                    <th className="px-6 py-4 text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-crypto-700">
                                {sources?.map(source => (
                                    <tr key={source.id} className="hover:bg-crypto-700/30">
                                        <td className="px-6 py-4 font-medium text-white">
                                            {source.name}
                                        </td>
                                        <td className="px-6 py-4 text-gray-400 text-sm">
                                            <div className="truncate max-w-xs" title={source.url}>{source.url}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {source.enabled ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-900/30 text-emerald-400 border border-emerald-900">
                                                    <CheckCircle2 size={12} className="mr-1" /> 运行中
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-400 border border-gray-600">
                                                    <Ban size={12} className="mr-1" /> 已禁用
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {testingSourceId === source.id ? (
                                                 <span className="inline-flex items-center text-xs text-crypto-400 animate-pulse">
                                                     <Loader2 size={12} className="mr-1 animate-spin"/> 测试中...
                                                 </span>
                                            ) : source.lastFetchStatus === 'ok' ? (
                                                <div className="flex flex-col items-start">
                                                     <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-emerald-400 bg-emerald-900/10 border border-emerald-900/20" title="连接正常">
                                                         <Wifi size={12} className="mr-1" /> 正常
                                                     </span>
                                                     {source.lastCheckTime && (
                                                         <span className="text-[10px] text-gray-500 mt-1">
                                                             {new Date(source.lastCheckTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                         </span>
                                                     )}
                                                </div>
                                            ) : source.lastFetchStatus === 'error' ? (
                                                <div className="flex flex-col items-start">
                                                     <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-red-400 bg-red-900/10 border border-red-900/20 mb-1">
                                                         <WifiOff size={12} className="mr-1" /> 连接失败
                                                     </span>
                                                     {source.lastErrorMessage && (
                                                         <span className="text-[10px] text-red-300/70 max-w-[150px] truncate" title={source.lastErrorMessage}>
                                                             {source.lastErrorMessage}
                                                         </span>
                                                     )}
                                                     {source.lastCheckTime && (
                                                         <span className="text-[10px] text-gray-500 mt-1">
                                                             {new Date(source.lastCheckTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                         </span>
                                                     )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-500 text-xs italic">未检测</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                                            <button 
                                                onClick={() => handleTestSource(source)}
                                                className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                                                title="测试连接"
                                            >
                                                <Activity size={18} />
                                            </button>
                                            <button 
                                                onClick={() => handleToggleSource(source)}
                                                className={`p-2 rounded-lg transition-colors ${source.enabled ? 'text-yellow-400 hover:bg-yellow-400/10' : 'text-emerald-400 hover:bg-emerald-400/10'}`}
                                                title={source.enabled ? "禁用" : "启用"}
                                            >
                                                <Power size={18} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteSource(source.id)}
                                                className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                                title="删除"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                 </div>
            </div>
        )}

      </main>
    </div>
  );
};

export default App;