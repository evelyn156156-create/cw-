import { load } from 'cheerio';

export default async function handler(req: any, res: any) {
  // CORS Handling
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Missing URL' });
  }

  try {
    console.log(`Fetching RSS: ${url}`);
    
    // Use a browser-like User-Agent to avoid being blocked
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      },
      // Set a reasonable timeout (Vercel functions have limits)
      signal: AbortSignal.timeout(9000) 
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS: ${response.status} ${response.statusText}`);
    }

    const xmlText = await response.text();
    
    // Use xmlMode for RSS feeds
    const $ = load(xmlText, { xmlMode: true });

    const items: any[] = [];
    const entries = $('item, entry');

    entries.each((_, element) => {
      const el = $(element);
      
      // Title
      const title = el.find('title').text().trim();

      // Link
      let link = el.find('link').text().trim();
      if (!link) {
        link = el.find('link').attr('href') || '';
      }

      // Date
      const pubDate = el.find('pubDate, published, updated, dc\\:date').first().text().trim();

      // Content
      const contentEncoded = el.find('content\\:encoded').text();
      const description = el.find('description').text();
      const content = el.find('content').text();
      
      // Select the longest content candidate
      const fullContent = [contentEncoded, description, content]
        .filter(c => c && c.length > 0)
        .sort((a, b) => b.length - a.length)[0] || '';

      // Categories
      const categories: string[] = [];
      el.find('category').each((_, cat) => {
        const catText = $(cat).text().trim();
        if (catText) categories.push(catText);
      });

      items.push({
        title,
        link,
        pubDate,
        content: fullContent,
        categories
      });
    });

    return res.status(200).json({ items });

  } catch (error: any) {
    console.error('RSS Fetch Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal Server Error',
      details: error.toString()
    });
  }
}
