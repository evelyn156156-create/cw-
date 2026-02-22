import { SourceConfig, NewsItem } from '../types';

const API_BASE = '/api';

export const api = {
  // Sources
  getSources: async (): Promise<SourceConfig[]> => {
    const res = await fetch(`${API_BASE}/sources`);
    if (!res.ok) throw new Error('Failed to fetch sources');
    return res.json();
  },

  addSource: async (source: Partial<SourceConfig>) => {
    const res = await fetch(`${API_BASE}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(source),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add source');
    return data;
  },

  deleteSource: async (id: string) => {
    const res = await fetch(`${API_BASE}/sources/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete source');
    return res.json();
  },

  toggleSource: async (id: string, enabled: boolean) => {
    const res = await fetch(`${API_BASE}/sources/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) throw new Error('Failed to update source');
    return res.json();
  },

  testSource: async (url: string, id?: string) => {
    const res = await fetch(`${API_BASE}/sources/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, id }),
    });
    return res.json();
  },

  // News
  getNews: async (): Promise<NewsItem[]> => {
    const res = await fetch(`${API_BASE}/news`);
    if (!res.ok) throw new Error('Failed to fetch news');
    return res.json();
  },

  fetchRSS: async () => {
    const res = await fetch(`${API_BASE}/fetch-rss`, {
      method: 'POST',
    });
    return res.json();
  },

  analyzeNews: async () => {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
    });
    return res.json();
  },
  
  pruneNews: async (days: number) => {
    const res = await fetch(`${API_BASE}/prune`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days }),
    });
    return res.json();
  },

  updateNews: async (id: string | number, data: any) => {
    const res = await fetch(`${API_BASE}/news/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update news');
    return res.json();
  }
};
