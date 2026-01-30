import React, { useEffect, useState } from 'react';
import { NewsItem, RewriteTemplate } from '../types';
import { rewriteNewsForCoinW } from '../services/geminiService';
import { db } from '../db/database';
import { X, Calendar, Globe, Tag, ExternalLink, ThumbsUp, ThumbsDown, Minus, Wand2, ShieldAlert, Check, Copy, RefreshCw, FileText, PenTool } from 'lucide-react';

interface NewsDetailModalProps {
  item: NewsItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const NewsDetailModal: React.FC<NewsDetailModalProps> = ({ item, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'original' | 'rewrite'>('original');
  const [rewriteTemplate, setRewriteTemplate] = useState<RewriteTemplate>(RewriteTemplate.HOT_EVENT);
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewrittenData, setRewrittenData] = useState<{title?: string, content?: string} | null>(null);

  // Load existing rewrite data or reset when item changes
  useEffect(() => {
    if (item) {
        if (item.rewrittenContent) {
            setRewrittenData({ title: item.rewrittenTitle, content: item.rewrittenContent });
            if (item.rewriteTemplate) setRewriteTemplate(item.rewriteTemplate);
        } else {
            setRewrittenData(null);
        }
        setActiveTab('original');
    }
  }, [item]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen || !item) return null;

  const handleRewrite = async () => {
      setIsRewriting(true);
      try {
          const result = await rewriteNewsForCoinW(item, rewriteTemplate);
          setRewrittenData(result);
          // Save to DB
          await db.news.update(item.id!, {
              rewrittenTitle: result.title,
              rewrittenContent: result.content,
              rewriteTemplate: rewriteTemplate
          });
      } catch (e) {
          alert("改写失败，请重试");
      } finally {
          setIsRewriting(false);
      }
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      alert("已复制到剪贴板");
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  };

  const getSentimentColor = (s?: string) => {
    if (s === 'positive') return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    if (s === 'negative') return 'text-red-400 bg-red-400/10 border-red-400/20';
    return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      <div className="relative w-full max-w-5xl bg-crypto-800 border border-crypto-700 rounded-xl shadow-2xl flex flex-col h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-crypto-700 bg-crypto-800/50 rounded-t-xl">
          <div className="flex items-center gap-4">
               {/* Mode Switcher */}
               <div className="flex bg-crypto-900 rounded-lg p-1 border border-crypto-700">
                   <button 
                       onClick={() => setActiveTab('original')}
                       className={`px-4 py-2 rounded-md text-sm font-bold flex items-center transition-all ${activeTab === 'original' ? 'bg-crypto-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                   >
                       <FileText size={16} className="mr-2"/> 原文分析
                   </button>
                   <button 
                       onClick={() => setActiveTab('rewrite')}
                       className={`px-4 py-2 rounded-md text-sm font-bold flex items-center transition-all ${activeTab === 'rewrite' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                   >
                       <PenTool size={16} className="mr-2"/> AI 改写 (CoinW)
                   </button>
               </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-crypto-700 p-2 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-crypto-900/30">
          
          {activeTab === 'original' && (
              <div className="space-y-6">
                 {/* Title & Metadata */}
                 <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        {item.topicCategory && (
                            <span className="bg-blue-900/30 text-blue-300 border border-blue-800 px-2 py-0.5 rounded text-xs font-bold uppercase">
                                {item.topicCategory}
                            </span>
                        )}
                        {item.riskLevel === 'high' && (
                            <span className="bg-red-900/30 text-red-400 border border-red-800 px-2 py-0.5 rounded text-xs font-bold uppercase flex items-center">
                                <ShieldAlert size={12} className="mr-1"/> 高风险
                            </span>
                        )}
                    </div>
                    <h2 className="text-2xl font-bold text-white leading-tight mb-2">{item.title}</h2>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{item.sourceName}</span>
                        <span>{formatDate(item.publishedAt)}</span>
                    </div>
                 </div>

                 {/* Entities Dashboard */}
                 {item.entities && (item.entities.projects?.length || item.entities.institutions?.length || item.entities.events?.length) ? (
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         {item.entities.projects && item.entities.projects.length > 0 && (
                             <div className="bg-crypto-800 p-3 rounded border border-crypto-700">
                                 <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">相关项目</h4>
                                 <div className="flex flex-wrap gap-2">
                                     {item.entities.projects.map((p, i) => <span key={i} className="text-xs bg-crypto-700 px-2 py-1 rounded text-gray-300">{p}</span>)}
                                 </div>
                             </div>
                         )}
                         {item.entities.institutions && item.entities.institutions.length > 0 && (
                             <div className="bg-crypto-800 p-3 rounded border border-crypto-700">
                                 <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">涉及机构</h4>
                                 <div className="flex flex-wrap gap-2">
                                     {item.entities.institutions.map((p, i) => <span key={i} className="text-xs bg-crypto-700 px-2 py-1 rounded text-gray-300">{p}</span>)}
                                 </div>
                             </div>
                         )}
                         {item.entities.events && item.entities.events.length > 0 && (
                             <div className="bg-crypto-800 p-3 rounded border border-crypto-700">
                                 <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">关键事件</h4>
                                 <div className="flex flex-wrap gap-2">
                                     {item.entities.events.map((p, i) => <span key={i} className="text-xs bg-crypto-700 px-2 py-1 rounded text-gray-300">{p}</span>)}
                                 </div>
                             </div>
                         )}
                     </div>
                 ) : null}

                 {/* AI Summary */}
                 <div className="bg-crypto-800/50 p-4 rounded-lg border border-crypto-700/50">
                    <h3 className="text-sm font-bold text-gray-400 uppercase mb-2 flex items-center">
                        AI 智能摘要
                    </h3>
                    <p className="text-gray-200 leading-relaxed text-sm">
                        {item.summary || "暂无摘要分析。"}
                    </p>
                 </div>

                 {/* Full Content */}
                 <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white border-l-4 border-crypto-500 pl-3">详细内容</h3>
                    <div className="prose prose-invert prose-sm max-w-none text-gray-300">
                        {item.content ? (
                            <div dangerouslySetInnerHTML={{ __html: item.content }} />
                        ) : (
                            <p className="italic text-gray-500">原文内容未抓取完整，请查看原链接。</p>
                        )}
                    </div>
                 </div>
              </div>
          )}

          {activeTab === 'rewrite' && (
              <div className="h-full flex flex-col">
                  {/* Toolbar */}
                  <div className="flex flex-wrap gap-4 items-center mb-6 bg-crypto-800 p-4 rounded-lg border border-crypto-700">
                      <div className="flex items-center gap-2">
                          <Wand2 size={18} className="text-indigo-400" />
                          <span className="text-sm font-bold text-gray-300">选择改写模板:</span>
                      </div>
                      <select 
                        value={rewriteTemplate}
                        onChange={(e) => setRewriteTemplate(e.target.value as RewriteTemplate)}
                        className="bg-crypto-900 border border-crypto-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
                      >
                          <option value={RewriteTemplate.HOT_EVENT}>🔥 热点事件 + CoinW 视角</option>
                          <option value={RewriteTemplate.SECTOR_DEPTH}>📊 赛道深度 + CoinW 机会</option>
                          <option value={RewriteTemplate.PRODUCT_UPDATE}>🚀 产品功能/活动更新</option>
                          <option value={RewriteTemplate.MEDIA_REPORT}>📰 媒体报道/榜单整合</option>
                      </select>
                      
                      <button 
                        onClick={handleRewrite}
                        disabled={isRewriting}
                        className="ml-auto flex items-center bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-6 rounded-lg transition-all shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          {isRewriting ? <RefreshCw className="animate-spin mr-2"/> : <Wand2 className="mr-2"/>}
                          {isRewriting ? 'AI 正在创作中...' : '生成改写文案'}
                      </button>
                  </div>

                  {/* Rewrite Result */}
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
                      {/* Left: Original Context */}
                      <div className="bg-crypto-800/30 rounded-lg p-4 border border-crypto-700 overflow-y-auto">
                          <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 sticky top-0 bg-crypto-800/90 py-2 backdrop-blur">原文参考</h4>
                          <h3 className="font-bold text-gray-300 mb-2">{item.title}</h3>
                          <div className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">
                              {item.content ? item.content.replace(/<[^>]*>?/gm, '') : item.summary}
                          </div>
                      </div>

                      {/* Right: Output */}
                      <div className="bg-indigo-900/10 rounded-lg p-4 border border-indigo-500/30 overflow-y-auto relative">
                          <h4 className="text-xs font-bold text-indigo-400 uppercase mb-3 sticky top-0 bg-crypto-900/90 py-2 backdrop-blur flex justify-between items-center">
                              <span>CoinW 营销文案</span>
                              {rewrittenData && (
                                  <button onClick={() => copyToClipboard(`${rewrittenData.title}\n\n${rewrittenData.content}`)} className="text-indigo-300 hover:text-white" title="复制全部">
                                      <Copy size={14}/>
                                  </button>
                              )}
                          </h4>
                          
                          {rewrittenData ? (
                              <div className="prose prose-invert prose-sm max-w-none">
                                  <h2 className="text-white font-bold text-xl mb-4">{rewrittenData.title}</h2>
                                  <div className="text-gray-300 whitespace-pre-wrap leading-relaxed font-sans">
                                      {rewrittenData.content}
                                  </div>
                              </div>
                          ) : (
                              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                  <Wand2 size={48} className="mb-4 opacity-20"/>
                                  <p>选择模板并点击上方按钮开始生成</p>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          )}

        </div>

        {/* Footer Actions (Only for Original Tab) */}
        {activeTab === 'original' && (
            <div className="p-4 border-t border-crypto-700 bg-crypto-800 rounded-b-xl flex justify-end gap-3">
                <a 
                    href={item.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center px-6 py-2.5 rounded-lg bg-crypto-700 hover:bg-crypto-600 text-white font-bold transition-all"
                >
                    查看原文 <ExternalLink size={16} className="ml-2" />
                </a>
            </div>
        )}

      </div>
    </div>
  );
};