import { SourceConfig, NewsItem } from '../types';

const API_BASE = '/api';

const handleResponse = async (res: Response, errorMsg: string) => {
  if (!res.ok) {
    let details = '';
    try {
      // Read text once to avoid "body stream already read" error
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        details = data.error || data.message || JSON.stringify(data);
      } catch {
        details = text;
      }
    } catch (e) {
      details = 'Unknown error';
    }
    throw new Error(`${errorMsg} (${res.status}): ${details}`);
  }
  return res.json();
};

export const api = {
  // Sources
  getSources: async (): Promise<SourceConfig[]> => {
    const res = await fetch(`${API_BASE}/sources`);
    return handleResponse(res, 'Failed to fetch sources');
  },

  addSource: async (source: Partial<SourceConfig>) => {
    const res = await fetch(`${API_BASE}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(source),
    });
    return handleResponse(res, 'Failed to add source');
  },

  deleteSource: async (id: string) => {
    const res = await fetch(`${API_BASE}/sources/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(res, 'Failed to delete source');
  },

  toggleSource: async (id: string, enabled: boolean) => {
    const res = await fetch(`${API_BASE}/sources/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    return handleResponse(res, 'Failed to update source');
  },

  testSource: async (url: string, id?: string) => {
    const res = await fetch(`${API_BASE}/sources/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, id }),
    });
    return handleResponse(res, 'Failed to test source');
  },

  // News
  getNews: async (): Promise<NewsItem[]> => {
    const res = await fetch(`${API_BASE}/news`);
    return handleResponse(res, 'Failed to fetch news');
  },

  fetchRSS: async () => {
    const res = await fetch(`${API_BASE}/fetch-rss`, {
      method: 'POST',
    });
    return handleResponse(res, 'Failed to fetch RSS');
  },

  analyzeNews: async () => {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
    });
    return handleResponse(res, 'Failed to analyze news');
  },
  
  pruneNews: async (days: number) => {
    const res = await fetch(`${API_BASE}/prune`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days }),
    });
    return handleResponse(res, 'Failed to prune news');
  },

  rewriteNews: async (id: string | number) => {
    const res = await fetch(`${API_BASE}/rewrite/${id}`, {
      method: 'POST',
    });
    return handleResponse(res, 'Failed to rewrite news');
  },

  updateNews: async (id: string | number, data: any) => {
    const res = await fetch(`${API_BASE}/news/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update news');
  }
};
