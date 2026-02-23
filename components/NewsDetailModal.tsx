import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bot, Copy, Check, Calendar, User, Link as LinkIcon, FileText, Sparkles } from 'lucide-react';
import { NewsItem } from '../types';
import { api } from '../lib/api';
import ReactMarkdown from 'react-markdown';

interface NewsDetailModalProps {
  news: NewsItem;
  onClose: () => void;
  onUpdate: () => void; // Callback to refresh list after update
}

export const NewsDetailModal: React.FC<NewsDetailModalProps> = ({ news, onClose, onUpdate }) => {
  const [isRewriting, setIsRewriting] = useState(false);
  const [localNews, setLocalNews] = useState<NewsItem>(news);
  const [copied, setCopied] = useState(false);

  const handleRewrite = async () => {
    setIsRewriting(true);
    try {
      const res = await api.rewriteNews(news.id!);
      if (res.success && res.data) {
        setLocalNews(prev => ({
          ...prev,
          ...res.data
        }));
        onUpdate();
      }
    } catch (error) {
      console.error('Rewrite failed:', error);
      alert('AI 改写失败，请检查 API Key 配置或网络连接');
    } finally {
      setIsRewriting(false);
    }
  };

  const handleCopy = () => {
    const textToCopy = `【${localNews.rewrittenTitle || localNews.title}】\n\n${localNews.summary ? `摘要：${localNews.summary}\n\n` : ''}${localNews.rewrittenContent || localNews.content}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-crypto-800 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-crypto-700 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-crypto-700 flex justify-between items-start bg-crypto-900/50">
            <div className="flex-1 pr-8">
              <h2 className="text-2xl font-bold text-white leading-tight mb-2">
                {localNews.rewrittenTitle || localNews.title}
              </h2>
              <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {new Date(localNews.publishedAt).toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                  <User size={14} />
                  {localNews.sourceName}
                </span>
                <a 
                  href={localNews.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <LinkIcon size={14} />
                  查看原文
                </a>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-crypto-700 rounded-full text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            
            {/* AI Analysis Section */}
            <div className="bg-crypto-900/50 rounded-xl border border-crypto-700 overflow-hidden">
              <div className="p-4 border-b border-crypto-700 bg-gradient-to-r from-indigo-900/20 to-purple-900/20 flex justify-between items-center">
                <div className="flex items-center gap-2 text-indigo-300 font-medium">
                  <Sparkles size={18} />
                  AI 智能改写与分析
                </div>
                <div className="flex gap-2">
                  {(localNews.rewrittenContent || localNews.summary) && (
                    <button 
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-crypto-700 hover:bg-crypto-600 text-gray-200 rounded-lg transition-colors border border-crypto-600"
                    >
                      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      {copied ? '已复制' : '一键复制'}
                    </button>
                  )}
                  <button 
                    onClick={handleRewrite}
                    disabled={isRewriting}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                      isRewriting 
                        ? 'bg-indigo-900/50 border-indigo-800 text-indigo-400 cursor-wait' 
                        : 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-900/20'
                    }`}
                  >
                    <Bot size={14} className={isRewriting ? 'animate-spin' : ''} />
                    {isRewriting ? '正在改写...' : (localNews.rewrittenContent ? '重新改写' : '开始 AI 改写')}
                  </button>
                </div>
              </div>
              
              <div className="p-5">
                {localNews.rewrittenContent || localNews.summary ? (
                  <div className="space-y-4">
                    {localNews.summary && (
                      <div className="bg-indigo-950/30 p-4 rounded-lg border border-indigo-900/50">
                        <div className="text-xs font-bold text-indigo-400 mb-2 uppercase tracking-wider">摘要</div>
                        <p className="text-gray-200 leading-relaxed text-sm">{localNews.summary}</p>
                      </div>
                    )}
                    {localNews.rewrittenContent && (
                      <div className="prose prose-invert prose-sm max-w-none text-gray-300">
                        <ReactMarkdown>{localNews.rewrittenContent}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Bot size={48} className="mx-auto mb-3 opacity-20" />
                    <p>点击上方按钮，让 AI 为您提炼重点并重写文章</p>
                  </div>
                )}
              </div>
            </div>

            {/* Original Content */}
            <div>
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <FileText size={20} className="text-gray-400" />
                原文内容
              </h3>
              <div className="prose prose-invert prose-sm max-w-none text-gray-400 bg-crypto-900/30 p-6 rounded-xl border border-crypto-800">
                 {/* Simple rendering for original content, handling potential HTML or plain text */}
                 <div dangerouslySetInnerHTML={{ __html: localNews.content || '' }} />
              </div>
            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
