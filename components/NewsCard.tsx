import React from 'react';
import { NewsItem, AnalysisStatus } from '../types';
import { ExternalLink, Tag, Calendar, ThumbsUp, ThumbsDown, Minus, AlertCircle, Ban, Loader2, Wand2, ShieldAlert, Zap, Clock, CheckCircle, PenTool } from 'lucide-react';

interface NewsCardProps {
  item: NewsItem;
  onClick?: (item: NewsItem) => void;
  onAnalyze?: (item: NewsItem) => void;
  onTagClick?: (tag: string, type: 'coin' | 'topic') => void;
}

export const NewsCard: React.FC<NewsCardProps> = ({ item, onClick, onAnalyze, onTagClick }) => {
  const formatDate = (ts: number) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(new Date(ts));
  };

  const getSentimentColor = (s?: string) => {
    if (s === 'positive') return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10';
    if (s === 'negative') return 'text-red-400 border-red-400/30 bg-red-400/10';
    return 'text-gray-400 border-gray-400/30 bg-gray-400/10';
  };

  const SentimentIcon = () => {
    if (item.sentiment === 'positive') return <ThumbsUp size={14} className="mr-1" />;
    if (item.sentiment === 'negative') return <ThumbsDown size={14} className="mr-1" />;
    return <Minus size={14} className="mr-1" />;
  };

  // Determine card style based on status
  const isPending = item.status === AnalysisStatus.PENDING;
  const isProcessing = item.status === AnalysisStatus.PROCESSING;
  const isCompleted = item.status === AnalysisStatus.COMPLETED;
  const isSkipped = item.status === AnalysisStatus.SKIPPED;
  const isFailed = item.status === AnalysisStatus.FAILED;
  
  const opacityClass = isSkipped || isFailed ? 'opacity-60 grayscale-[0.5]' : '';
  const borderClass = isFailed ? 'border-red-900/50' : isSkipped ? 'border-crypto-700/50' : 'border-crypto-700 hover:border-crypto-500';
  const pendingClass = isPending ? 'border-dashed border-crypto-600' : '';
  const isHighRisk = item.riskLevel === 'high';
  
  const hasRewrite = !!item.rewrittenTitle;

  const handleTagClickInternal = (e: React.MouseEvent, tag: string, type: 'coin' | 'topic') => {
      e.stopPropagation();
      if (onTagClick) onTagClick(tag, type);
  };

  return (
    <div 
        className={`bg-crypto-800 border rounded-lg p-5 transition-all group flex flex-col h-full relative ${opacityClass} ${borderClass} ${pendingClass} hover:bg-crypto-700/30`}
    >
      {/* Clickable Area Overlay (except buttons) */}
      <div className="absolute inset-0 cursor-pointer z-0" onClick={() => onClick && onClick(item)}></div>

      <div className="flex justify-between items-start mb-3 relative z-10 pointer-events-none">
        <div className="flex flex-wrap gap-2 items-center pointer-events-auto">
            <span className="text-xs font-bold text-crypto-400 bg-crypto-700/50 px-2 py-1 rounded">
                {item.sourceName}
            </span>
            
            {/* Analysis Status Badges */}
            {isPending && (
                <span className="text-xs px-2 py-1 rounded bg-indigo-900/20 text-indigo-400 flex items-center border border-indigo-900/30">
                    <Clock size={10} className="mr-1" /> 待分析
                </span>
            )}

            {hasRewrite && (
                <span className="text-xs px-2 py-1 rounded bg-purple-900/40 text-purple-400 flex items-center border border-purple-700 font-bold shadow-lg shadow-purple-500/20">
                    <Wand2 size={10} className="mr-1" /> 已改写
                </span>
            )}
            
            {/* Risk Badge (High Priority) */}
            {isHighRisk && !isPending && (
                <span className="text-xs px-2 py-1 rounded bg-red-900/40 text-red-500 flex items-center border border-red-600 animate-pulse font-bold">
                    <ShieldAlert size={10} className="mr-1" /> 高风险
                </span>
            )}

            {/* Topic Category - Interactive */}
            {item.topicCategory && !isPending && item.topicCategory !== 'Other' && (
                 <button 
                    onClick={(e) => handleTagClickInternal(e, item.topicCategory!, 'topic')}
                    className="text-xs px-2 py-1 rounded bg-crypto-700 text-gray-300 border border-crypto-600 hover:bg-crypto-600 hover:text-white hover:border-crypto-500 transition-colors"
                 >
                    {item.topicCategory === 'Market' ? '📈 行情' : 
                     item.topicCategory === 'Regulation' ? '⚖️ 监管' :
                     item.topicCategory === 'Security' ? '🛡️ 安全' : 
                     item.topicCategory === 'Layer2' ? '⚡️ Layer2' : 
                     item.topicCategory}
                 </button>
            )}
        </div>
        
        <span className="text-gray-500 text-xs flex items-center whitespace-nowrap ml-2">
            <Calendar size={12} className="mr-1" />
            {formatDate(item.publishedAt)}
        </span>
      </div>

      <div className="block mb-2 relative z-10 pointer-events-none">
        <h3 className="text-lg font-semibold text-white group-hover:text-crypto-400 transition-colors line-clamp-2">
            {item.title}
        </h3>
      </div>
      
      {/* Summary Area */}
      {item.summary && !isSkipped && !isFailed && !isPending && !isProcessing && (
          <p className="text-gray-400 text-sm mb-4 line-clamp-3 flex-grow relative z-10 pointer-events-none">
              {item.summary}
          </p>
      )}
      {(isSkipped || isFailed || isPending || isProcessing) && (
           <p className="text-gray-600 text-xs mb-4 line-clamp-3 flex-grow italic relative z-10 pointer-events-none">
               {isProcessing ? "正在进行 AI 深度分析..." : (item.content ? item.content.replace(/<[^>]*>?/gm, '').substring(0, 100) + '...' : '(暂无摘要，请点击分析)')}
           </p>
      )}

      {/* Tags & Tickers Area */}
      <div className="flex flex-wrap gap-2 mb-4 mt-auto relative z-10 pointer-events-none pointer-events-auto">
        {item.coinTickers?.map((ticker, idx) => (
             <button 
                key={`coin-${idx}`} 
                onClick={(e) => handleTagClickInternal(e, ticker, 'coin')}
                className="flex items-center text-xs font-bold text-indigo-300 bg-indigo-900/30 px-2 py-1 rounded border border-indigo-700/50 hover:bg-indigo-900/50 hover:text-white hover:border-indigo-500 transition-colors"
            >
                ${ticker}
            </button>
        ))}
        {/* Only show tags that aren't tickers or the main topic category to avoid duplicates */}
        {item.tags?.filter(t => !item.coinTickers?.includes(t) && t !== item.topicCategory).slice(0, 3).map((tag, idx) => (
            <button 
                key={idx} 
                onClick={(e) => handleTagClickInternal(e, tag, 'topic')}
                className="flex items-center text-xs text-gray-400 bg-crypto-700/30 px-2 py-1 rounded-full border border-crypto-700 hover:bg-crypto-700 hover:text-gray-200 transition-colors"
            >
                <Tag size={10} className="mr-1" /> {tag}
            </button>
        ))}
      </div>

      {/* Footer Actions */}
      <div className="flex justify-between items-center pt-4 border-t border-crypto-700 relative z-20">
        {!isFailed && !isSkipped && !isPending && !isProcessing ? (
             <div className={`flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getSentimentColor(item.sentiment)}`}>
                <SentimentIcon />
                {item.sentiment?.toUpperCase() || 'NEUTRAL'}
            </div>
        ) : (
             <div></div> // Spacer
        )}
       
        <div className="flex items-center gap-2">
            {isPending && onAnalyze && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onAnalyze(item); }}
                    className="flex items-center px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors shadow-lg shadow-indigo-500/20"
                >
                    <Zap size={12} className="mr-1" /> AI 分析
                </button>
            )}

            {isProcessing && (
                <button 
                    disabled
                    className="flex items-center px-3 py-1.5 rounded bg-indigo-900/50 text-indigo-200 text-xs font-bold cursor-wait border border-indigo-800"
                >
                    <Loader2 size={12} className="mr-1 animate-spin" /> 分析中...
                </button>
            )}

            {isCompleted && !isPending && (
                <span className="flex items-center text-emerald-500 text-xs font-bold px-2 py-1">
                     <CheckCircle size={14} className="mr-1" /> 已分析
                </span>
            )}
            
            <button 
                onClick={(e) => { e.stopPropagation(); onClick && onClick(item); }}
                className="text-xs font-bold text-gray-400 hover:text-white flex items-center px-2 py-1 rounded hover:bg-crypto-700 transition-colors"
            >
                详情 <ExternalLink size={14} className="ml-1" />
            </button>
        </div>
      </div>
    </div>
  );
};