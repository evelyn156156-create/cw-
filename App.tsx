import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from './lib/api';
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
    AlertCircle,
    Loader2,
    ExternalLink,
    Clock,
    Tag,
    BarChart3,
    Ban,
    Wifi,
    WifiOff,
    Activity,
    HardDrive
} from 'lucide-react';
import { NewsCard } from './components/NewsCard';
import { StatsCard } from './components/StatsCard';
import { NewsDetailModal } from './components/NewsDetailModal';
import { motion, AnimatePresence } from 'framer-motion';

// ... (Keep existing filters and constants) ...
const COIN_FILTERS = [
  { id: 'btc', label: 'Bitcoin (BTC)', keywords: ['Bitcoin', 'BTC', '比特币'] },
  { id: 'eth', label: 'Ethereum (ETH)', keywords: ['Ethereum', 'ETH', '以太坊', 'Vitalik'] },
  { id: 'sol', label: 'Solana (SOL)', keywords: ['Solana', 'SOL', '索拉纳'] },
  { id: 'bnb', label: 'Binance (BNB)', keywords: ['Binance', 'BNB', '币安', 'CZ'] },
  { id: 'meme', label: 'Meme Coins', keywords: ['Doge', 'Shib', 'Pepe', 'Meme', '模因币'] },
];

const TOPIC_FILTERS = [
  { id: 'defi', label: 'DeFi', keywords: ['DeFi', 'DEX', 'Swap', 'Lending', 'Liquidity', '流动性'] },
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
  const [isFetchingRSS, setIsFetchingRSS] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // UI State
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [activeCoinFilter, setActiveCoinFilter] = useState<string | null>(null);
  const [activeTopicFilter, setActiveTopicFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [filterStatus, setFilterStatus] = useState<string>('all'); // all, PENDING, COMPLETED
  
  // Settings State
  const [newSource, setNewSource] = useState({ name: '', url: '' });
  const [testingSourceId, setTestingSourceId] = useState<string | null>(null);
  const [retentionDays, setRetentionDays] = useState(30);

  const logEndRef = useRef<HTMLDivElement>(null);

  // Helper: Add Log
  const addLog = useCallback((msg: string) => {
      const time = new Date().toLocaleTimeString();
      setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  // --- Data Loading ---
  const loadSources = useCallback(async () => {
      try {
          const data = await api.getSources();
          setSources(data || []);
      } catch (error) {
          console.error('Error loading sources:', error);
          addLog(`❌ 加载信源失败: ${error instanceof Error ? error.message : String(error)}`);
      }
  }, [addLog]);

  const loadNews = useCallback(async () => {
      setIsLoadingData(true);
      try {
          const data = await api.getNews();
          setNewsItems(data || []);
          
          // Calculate pending
          const pending = data.filter((i: NewsItem) => i.status === AnalysisStatus.PENDING).length;
          setPendingCount(pending);
      } catch (error) {
          console.error('Error loading news:', error);
          addLog(`❌ 加载新闻失败: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
          setIsLoadingData(false);
      }
  }, [addLog]);

  // Initial Load
  useEffect(() => {
      loadSources();
      loadNews();
  }, [loadSources, loadNews]);

  // --- Actions ---

  const handleFetchRSS = async () => {
      if (sources.length === 0) {
          alert("请先添加 RSS 信源！");
          setActiveTab('sources');
          return;
      }

      setIsFetchingRSS(true);
      addLog("🚀 开始采集 RSS 数据...");
      
      try {
          const result = await api.fetchRSS();
          addLog(`✅ 采集完成: 新增 ${result.newItems} 条新闻`);
          await loadNews();
          await loadSources(); // Refresh status
      } catch (error) {
          console.error(error);
          addLog(`❌ 采集失败: ${String(error)}`);
      } finally {
          setIsFetchingRSS(false);
      }
  };

  const handleAnalyze = async () => {
      setIsAnalyzing(true);
      addLog("🤖 开始 AI 分析...");
      try {
          const result = await api.analyzeNews();
          addLog(`✅ 分析完成: 处理了 ${result.processed} 条新闻`);
          await loadNews();
      } catch (error) {
          console.error(error);
          addLog(`❌ 分析失败: ${String(error)}`);
      } finally {
          setIsAnalyzing(false);
      }
  };

  const handleAddSource = async () => {
      if (!newSource.name || !newSource.url) {
          alert("请填写名称和 URL");
          return;
      }
      
      addLog(`正在添加信源: ${newSource.name}...`);
      try {
          const res = await api.addSource(newSource);
          if (res.status === 'error') {
              addLog(`⚠️ 添加成功但连接失败: ${newSource.name} (请稍后测试连接)`);
          } else {
              addLog(`✅ 添加成功: ${newSource.name}`);
          }
          setNewSource({ name: '', url: '' });
          loadSources();
      } catch (error: any) {
          console.error(error);
          addLog(`❌ 添加失败: ${error.message}`);
      }
  };

  const handleDeleteSource = async (id: string) => {
      if (!window.confirm("确定删除该信源吗？")) return;
      try {
          await api.deleteSource(id);
          addLog("🗑️ 信源已删除");
          loadSources();
      } catch (error) {
          console.error(error);
          addLog("❌ 删除失败");
      }
  };

  const handleToggleSource = async (source: SourceConfig) => {
      try {
          await api.toggleSource(source.id, !source.enabled);
          loadSources();
      } catch (error) {
          console.error(error);
          addLog("❌ 更新状态失败");
      }
  };

  const handleTestSource = async (source: SourceConfig) => {
      setTestingSourceId(source.id);
      addLog(`测试连接: ${source.name}...`);
      try {
          const result = await api.testSource(source.url, source.id);
          addLog(`${source.name} 连接测试: ${result.success ? '成功 ✅' : '失败 ❌'}`);
          loadSources();
      } catch (e) {
          console.error(e);
          addLog(`❌ 测试出错`);
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
      console.log("handleResetSources called");
      addLog("正在检查默认信源状态...");
      
      const missingSources = DEFAULT_SOURCES.filter(src => !sources.some(s => s.url === src.url));
      
      if (missingSources.length === 0) {
          addLog("✅ 所有默认信源已存在，无需添加。");
          alert("所有默认信源已存在，无需添加。");
          return;
      }

      addLog(`发现 ${missingSources.length} 个缺失的信源，开始自动添加...`);

      let addedCount = 0;
      let failCount = 0;

      for (const src of missingSources) {
          try {
              const res = await api.addSource(src);
              addedCount++;
              if (res.status === 'error') {
                  addLog(`⚠️ ${src.name} 添加成功但连接失败`);
              } else {
                  addLog(`✅ ${src.name} 添加成功`);
              }
          } catch (e: any) {
              console.error(`Exception adding ${src.name}`, e);
              addLog(`❌ 添加 ${src.name} 失败: ${e.message}`);
              failCount++;
          }
      }
      
      addLog(`操作结束: 成功添加 ${addedCount} 个，失败 ${failCount} 个。`);
      await loadSources();
  };

  const handlePruneNow = async () => {
      if (retentionDays <= 0) return;
      if (!window.confirm(`确定要删除 ${retentionDays} 天以前的所有旧新闻吗？此操作不可恢复。`)) return;

      addLog(`正在清理 ${retentionDays} 天前的旧数据...`);
      try {
          const result = await api.pruneNews(retentionDays);
          addLog(`✅ 清理完成: 删除了 ${result.deleted} 条记录`);
          loadNews();
      } catch (error) {
          console.error(error);
          addLog("❌ 清理失败");
      }
  };

  const clearDatabase = async () => {
      if (!window.confirm("⚠️ 警告：这将清空所有新闻数据！确定吗？")) return;
      try {
        await api.pruneNews(0.001); // Delete almost everything
        addLog("✅ 数据库已清空");
        loadNews();
      } catch (e) {
        addLog("❌ 清空失败");
      }
  };

  // Advanced Filtering Logic
  const filteredNews = useMemo(() => {
    if (!newsItems) return [];
    return newsItems.filter(item => {
        if (filterStatus !== 'all' && item.status !== filterStatus) return false;
        if (filterSource !== 'all' && item.sourceName !== filterSource) return false;
        
        // Date Range
        if (dateRange.start) {
            const start = new Date(dateRange.start).getTime();
            if (item.publishedAt < start) return false;
        }
        if (dateRange.end) {
            const end = new Date(dateRange.end).getTime() + 86400000; // End of day
            if (item.publishedAt > end) return false;
        }

        // Coin Filter
        if (activeCoinFilter) {
            const filter = COIN_FILTERS.find(f => f.id === activeCoinFilter);
            if (filter) {
                const text = (item.title + item.summary + JSON.stringify(item.tags)).toLowerCase();
                const hasKeyword = filter.keywords.some(k => text.includes(k.toLowerCase()));
                if (!hasKeyword) return false;
            }
        }

        // Topic Filter
        if (activeTopicFilter) {
            const filter = TOPIC_FILTERS.find(f => f.id === activeTopicFilter);
            if (filter) {
                const text = (item.title + item.summary + JSON.stringify(item.tags)).toLowerCase();
                const hasKeyword = filter.keywords.some(k => text.includes(k.toLowerCase()));
                if (!hasKeyword) return false;
            }
        }

        // Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const match = item.title.toLowerCase().includes(q) || 
                          (item.summary && item.summary.toLowerCase().includes(q));
            if (!match) return false;
        }

        return true;
    });
  }, [newsItems, activeCoinFilter, activeTopicFilter, searchQuery, filterSource, dateRange, filterStatus]);

  // Stats
  const stats = useMemo(() => {
      return {
          total: newsItems.length,
          today: newsItems.filter(i => i.publishedAt > Date.now() - 86400000).length,
          sources: sources.filter(s => s.enabled).length,
          pending: pendingCount
      };
  }, [newsItems, sources, pendingCount]);

  return (
    <div className="min-h-screen bg-crypto-900 text-gray-100 font-sans selection:bg-crypto-500 selection:text-white">
        {/* Header */}
        <header className="bg-crypto-800 border-b border-crypto-700 sticky top-0 z-50 backdrop-blur-md bg-opacity-90">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-emerald-400 to-cyan-500 p-2 rounded-lg shadow-lg shadow-emerald-500/20">
                        <Activity size={24} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                            CryptoIntel AI
                        </h1>
                        <p className="text-[10px] text-gray-500 font-mono tracking-wider">INTELLIGENCE TERMINAL</p>
                    </div>
                </div>
                
                <nav className="flex items-center gap-1 bg-crypto-900/50 p-1 rounded-xl border border-crypto-700/50">
                    <button 
                        onClick={() => setActiveTab('dashboard')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-crypto-700 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-crypto-800'}`}
                    >
                        <LayoutDashboard size={16} /> 情报看板
                    </button>
                    <button 
                        onClick={() => setActiveTab('sources')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'sources' ? 'bg-crypto-700 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-crypto-800'}`}
                    >
                        <Database size={16} /> 信源与设置
                    </button>
                </nav>
            </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <StatsCard title="总收录新闻" value={stats.total} icon={<Database size={18} className="text-blue-400"/>} />
                <StatsCard title="今日新增" value={stats.today} icon={<Clock size={18} className="text-emerald-400"/>} />
                <StatsCard title="活跃信源" value={stats.sources} icon={<Wifi size={18} className="text-purple-400"/>} />
                <StatsCard title="待分析" value={stats.pending} icon={<Loader2 size={18} className="text-yellow-400"/>} />
            </div>

            {/* Main Content Area */}
            {activeTab === 'dashboard' && (
                <div className="space-y-6">
                    {/* Control Bar */}
                    <div className="bg-crypto-800 border border-crypto-700 rounded-lg p-4 flex flex-wrap gap-4 items-center justify-between shadow-xl">
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={handleFetchRSS}
                                disabled={isFetchingRSS}
                                className={`px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all flex items-center shadow-lg shadow-emerald-900/20 ${isFetchingRSS ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <RefreshCw size={18} className={`mr-2 ${isFetchingRSS ? 'animate-spin' : ''}`} />
                                {isFetchingRSS ? '正在采集...' : '开始采集 (RSS)'}
                            </button>
                            
                            <button 
                                onClick={handleAnalyze}
                                disabled={isAnalyzing || pendingCount === 0}
                                className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-all flex items-center shadow-lg shadow-indigo-900/20 ${isAnalyzing || pendingCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <PieChart size={18} className={`mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
                                {isAnalyzing ? '正在分析...' : 'AI 深度分析'}
                            </button>
                        </div>

                        <div className="flex items-center gap-2 flex-1 justify-end">
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
                                <input 
                                    type="text" 
                                    placeholder="搜索新闻标题或内容..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-crypto-900 border border-crypto-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-crypto-500 outline-none transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-2">
                        {COIN_FILTERS.map(filter => (
                            <button
                                key={filter.id}
                                onClick={() => setActiveCoinFilter(activeCoinFilter === filter.id ? null : filter.id)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${activeCoinFilter === filter.id ? 'bg-crypto-700 border-crypto-500 text-white' : 'bg-crypto-800 border-crypto-700 text-gray-400 hover:border-crypto-600'}`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>

                    {/* News Grid */}
                    {isLoadingData ? (
                        <div className="flex justify-center py-20">
                            <Loader2 size={40} className="text-crypto-500 animate-spin" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {filteredNews.map(item => (
                                <NewsCard 
                                    key={item.id || item.uniqueHash} 
                                    item={item} 
                                    onClick={(item) => setSelectedNews(item)}
                                    onDetailClick={(item) => setSelectedNews(item)}
                                    onAnalyze={() => {}} 
                                    onTagClick={(tag) => setSearchQuery(tag)}
                                />
                            ))}
                        </div>
                    )}
                    
                    {filteredNews.length === 0 && !isLoadingData && (
                        <div className="text-center py-20 text-gray-500">
                            没有找到相关新闻
                        </div>
                    )}
                </div>
            )}

            {/* News Detail Modal */}
            {selectedNews && (
                <NewsDetailModal 
                    news={selectedNews} 
                    onClose={() => setSelectedNews(null)} 
                    onUpdate={loadNews}
                />
            )}

            {activeTab === 'sources' && (
                <div className="space-y-6">
                    {/* Add Source */}
                    <div className="bg-crypto-800 border border-crypto-700 rounded-lg p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                            <Plus size={20} className="mr-2 text-crypto-400" /> 添加新订阅源
                        </h3>
                        <div className="flex gap-4">
                            <input 
                                type="text" 
                                placeholder="名称" 
                                value={newSource.name}
                                onChange={e => setNewSource({...newSource, name: e.target.value})}
                                className="bg-crypto-900 border border-crypto-700 rounded px-4 py-2 text-white flex-1"
                            />
                            <input 
                                type="text" 
                                placeholder="RSS URL" 
                                value={newSource.url}
                                onChange={e => setNewSource({...newSource, url: e.target.value})}
                                className="bg-crypto-900 border border-crypto-700 rounded px-4 py-2 text-white flex-[2]"
                            />
                            <button 
                                onClick={handleAddSource}
                                className="bg-crypto-600 hover:bg-crypto-500 text-white px-6 py-2 rounded font-bold"
                            >
                                添加
                            </button>
                        </div>
                    </div>

                    {/* Recommended Sources */}
                    <div className="bg-crypto-800 border border-crypto-700 rounded-lg p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white flex items-center">
                                <Database size={20} className="mr-2 text-emerald-400" /> 推荐优质信源库
                            </h3>
                            <button 
                                onClick={handleResetSources}
                                className="px-4 py-2 bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-900 rounded-lg text-xs font-bold transition-colors flex items-center"
                            >
                                <Plus size={14} className="mr-1"/> 一键添加所有未添加项
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {DEFAULT_SOURCES.map((defSource, idx) => {
                                const existing = sources.find(s => s.url === defSource.url);
                                const isAdded = !!existing;
                                
                                return (
                                    <div key={idx} className={`p-3 rounded-lg border flex justify-between items-center ${isAdded ? 'bg-crypto-900/50 border-crypto-700' : 'bg-crypto-800 border-crypto-600 hover:border-crypto-500'}`}>
                                        <div className="overflow-hidden mr-2">
                                            <div className="font-bold text-sm text-white truncate" title={defSource.name}>{defSource.name}</div>
                                            <div className="text-xs text-gray-500 truncate" title={defSource.url}>{defSource.url}</div>
                                        </div>
                                        
                                        {isAdded ? (
                                            <div className="flex flex-col items-end flex-shrink-0">
                                                <span className="text-[10px] bg-crypto-700 text-gray-300 px-1.5 py-0.5 rounded mb-1">已添加</span>
                                                {existing?.lastFetchStatus === 'ok' && <span className="text-[10px] text-emerald-400 flex items-center"><Wifi size={8} className="mr-1"/>正常</span>}
                                                {existing?.lastFetchStatus === 'error' && <span className="text-[10px] text-red-400 flex items-center"><WifiOff size={8} className="mr-1"/>异常</span>}
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setNewSource({ name: defSource.name, url: defSource.url });
                                                    // Ideally call add directly but state update is async, so user has to click add above or we refactor.
                                                    // Let's just call api directly here for better UX
                                                    api.addSource(defSource).then(() => {
                                                        addLog(`✅ ${defSource.name} 添加成功`);
                                                        loadSources();
                                                    }).catch(e => {
                                                        addLog(`❌ 添加失败: ${e.message}`);
                                                    });
                                                }}
                                                className="p-1.5 bg-crypto-700 hover:bg-crypto-600 text-white rounded transition-colors"
                                                title="添加此源"
                                            >
                                                <Plus size={16} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Source List */}
                    <div className="bg-crypto-800 border border-crypto-700 rounded-lg overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-crypto-700/50 text-gray-400 text-xs uppercase">
                                <tr>
                                    <th className="px-6 py-4">来源名称</th>
                                    <th className="px-6 py-4">RSS 地址</th>
                                    <th className="px-6 py-4">状态</th>
                                    <th className="px-6 py-4 text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-crypto-700">
                                {sources.map(source => (
                                    <tr key={source.id} className="hover:bg-crypto-700/30">
                                        <td className="px-6 py-4 font-medium text-white">{source.name}</td>
                                        <td className="px-6 py-4 text-gray-400 text-sm truncate max-w-xs">{source.url}</td>
                                        <td className="px-6 py-4">
                                            {source.lastFetchStatus === 'ok' ? (
                                                <span className="text-emerald-400 text-xs flex items-center"><Wifi size={12} className="mr-1"/> 正常</span>
                                            ) : (
                                                <span className="text-red-400 text-xs flex items-center" title={source.lastErrorMessage}><WifiOff size={12} className="mr-1"/> 异常</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                                            <button onClick={() => handleTestSource(source)} className="p-2 text-blue-400 hover:bg-blue-400/10 rounded"><Activity size={16}/></button>
                                            <button onClick={() => handleToggleSource(source)} className={`p-2 rounded ${source.enabled ? 'text-yellow-400' : 'text-gray-400'}`}><Power size={16}/></button>
                                            <button onClick={() => handleDeleteSource(source.id)} className="p-2 text-red-400 hover:bg-red-400/10 rounded"><Trash2 size={16}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </main>

        {/* Logs Console */}
        <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur border-t border-crypto-700 h-32 overflow-y-auto p-4 font-mono text-xs text-gray-400 z-40">
            {logs.map((log, i) => (
                <div key={i}>{log}</div>
            ))}
            <div ref={logEndRef} />
        </div>
    </div>
  );
};

export default App;
