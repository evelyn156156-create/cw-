import { NewsItem, AnalysisStatus, RewriteTemplate } from "../types";

/**
 * Call the Vercel Serverless Backend to analyze news
 * The backend holds the API Key and runs in a region that can access Google.
 */
export const analyzeNewsBatch = async (items: NewsItem[]): Promise<NewsItem[]> => {
  try {
      // Send data to our own Vercel backend
      const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({ items })
      });

      if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      return data.results;

  } catch (error) {
      console.error("Batch analysis failed:", error);
      // Fail gracefully so UI updates
      return items.map(item => ({ ...item, status: AnalysisStatus.FAILED }));
  }
};

/**
 * Call the Vercel Serverless Backend to rewrite news
 */
export const rewriteNewsForCoinW = async (item: NewsItem, template: RewriteTemplate): Promise<{ title: string, content: string }> => {
    try {
        const response = await fetch('/api/rewrite', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                item,
                template 
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Rewrite failed");
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error("Rewrite failed:", error);
        throw error;
    }
};
