# 修复 "errored" 状态指南

您的服务状态显示为 `errored`，这通常是因为代码中存在语法错误或兼容性问题。

**核心问题：**
您使用的 Express 5.x 版本不再支持 `app.get('*')` 这种写法，导致服务启动时直接报错崩溃。

**解决方案：**
虽然我已经在我的环境中修复了代码，但您的服务器上的 `server.ts` 文件可能还是旧版本。请按照以下步骤，**手动更新**您的 `server.ts` 文件。

## 第一步：更新 server.ts

请在您的服务器终端执行以下命令，这将直接用修复后的代码覆盖旧文件：

```bash
cat << 'EOF' > /root/cw-/server.ts
import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import Parser from 'rss-parser';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    db: 'connected'
  });
});

// Database Setup
const db = new Database('crypto_news.db', { verbose: console.log });
db.pragma('journal_mode = WAL');

// Initialize Schema
db.exec(\`
  CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    enabled INTEGER DEFAULT 1,
    type TEXT DEFAULT 'rss',
    lastFetchStatus TEXT,
    lastErrorMessage TEXT,
    lastCheckTime INTEGER,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uniqueHash TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    originalTitle TEXT,
    url TEXT NOT NULL,
    sourceName TEXT,
    publishedAt INTEGER,
    fetchedAt INTEGER,
    content TEXT,
    status TEXT DEFAULT 'PENDING',
    summary TEXT,
    sentiment TEXT,
    tags TEXT,
    qualityScore REAL,
    language TEXT,
    isCryptoRelated INTEGER,
    coinTickers TEXT,
    topicCategory TEXT,
    riskLevel TEXT,
    entities TEXT,
    rewrittenTitle TEXT,
    rewrittenContent TEXT,
    rewriteTemplate TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );
\`);

// RSS Parser
const parser = new Parser({
  timeout: 5000, // 5 seconds timeout
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  }
});

// --- API Endpoints ---

// Sources
app.get('/api/sources', (req, res) => {
  try {
    const sources = db.prepare('SELECT * FROM sources ORDER BY created_at DESC').all();
    const formatted = sources.map((s: any) => ({
      ...s,
      enabled: !!s.enabled
    }));
    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sources', async (req, res) => {
  const { name, url, enabled = true, type = 'rss' } = req.body;
  const id = crypto.randomUUID();
  
  let initialStatus = 'pending';
  let initialError = null;

  try {
    await parser.parseURL(url);
    initialStatus = 'ok';
  } catch (e: any) {
    console.warn(\`Warning: Could not fetch RSS for \${url} during addition: \${e.message}\`);
    initialStatus = 'error';
    initialError = e.message;
  }

  try {
    const stmt = db.prepare(\`
      INSERT INTO sources (id, name, url, enabled, type, lastFetchStatus, lastErrorMessage, lastCheckTime)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    \`);
    stmt.run(id, name, url, enabled ? 1 : 0, type, initialStatus, initialError, Date.now());
    
    res.json({ success: true, id, status: initialStatus, message: initialError ? 'Source added but initial fetch failed' : 'Source added successfully' });
  } catch (err: any) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: '该 RSS 源已存在' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sources/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM sources WHERE id = ?');
    const info = stmt.run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'Source not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/sources/:id', (req, res) => {
  const { enabled } = req.body;
  try {
    const stmt = db.prepare('UPDATE sources SET enabled = ? WHERE id = ?');
    stmt.run(enabled ? 1 : 0, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sources/test', async (req, res) => {
  const { url, id } = req.body;
  try {
    await parser.parseURL(url);
    
    if (id) {
      db.prepare(\`
        UPDATE sources 
        SET lastFetchStatus = 'ok', lastErrorMessage = NULL, lastCheckTime = ? 
        WHERE id = ?
      \`).run(Date.now(), id);
    }
    
    res.json({ success: true });
  } catch (err: any) {
    if (id) {
      db.prepare(\`
        UPDATE sources 
        SET lastFetchStatus = 'error', lastErrorMessage = ?, lastCheckTime = ? 
        WHERE id = ?
      \`).run(err.message, Date.now(), id);
    }
    res.json({ success: false, message: err.message });
  }
});

// News
app.get('/api/news', (req, res) => {
  try {
    const news = db.prepare('SELECT * FROM news ORDER BY publishedAt DESC LIMIT 100').all();
    const formatted = news.map((n: any) => ({
      ...n,
      tags: n.tags ? JSON.parse(n.tags) : [],
      coinTickers: n.coinTickers ? JSON.parse(n.coinTickers) : [],
      entities: n.entities ? JSON.parse(n.entities) : {},
      isCryptoRelated: !!n.isCryptoRelated
    }));
    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fetch-rss', async (req, res) => {
  try {
    const sources = db.prepare('SELECT * FROM sources WHERE enabled = 1').all() as any[];
    let newItemsCount = 0;
    
    for (const source of sources) {
      try {
        const feed = await parser.parseURL(source.url);
        
        db.prepare(\`
          UPDATE sources 
          SET lastFetchStatus = 'ok', lastErrorMessage = NULL, lastCheckTime = ? 
          WHERE id = ?
        \`).run(Date.now(), source.id);

        const insertStmt = db.prepare(\`
          INSERT OR IGNORE INTO news (
            uniqueHash, title, originalTitle, url, sourceName, publishedAt, fetchedAt, content, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
        \`);

        for (const item of feed.items) {
          if (!item.link || !item.title) continue;
          
          const uniqueHash = Buffer.from(item.link).toString('base64');
          const publishedAt = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();
          
          const info = insertStmt.run(
            uniqueHash,
            item.title,
            item.title,
            item.link,
            source.name,
            publishedAt,
            Date.now(),
            item.content || item.contentSnippet || ''
          );
          
          if (info.changes > 0) newItemsCount++;
        }
      } catch (err: any) {
        console.error(\`Error fetching \${source.name}:\`, err);
        db.prepare(\`
          UPDATE sources 
          SET lastFetchStatus = 'error', lastErrorMessage = ?, lastCheckTime = ? 
          WHERE id = ?
        \`).run(err.message, Date.now(), source.id);
      }
    }
    
    res.json({ success: true, newItems: newItemsCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/analyze', async (req, res) => {
  try {
    const pending = db.prepare("SELECT * FROM news WHERE status = 'PENDING' LIMIT 5").all();
    const updateStmt = db.prepare("UPDATE news SET status = 'COMPLETED' WHERE id = ?");
    for (const item of pending as any[]) {
      updateStmt.run(item.id);
    }
    res.json({ success: true, processed: pending.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/prune', (req, res) => {
  const { days } = req.body;
  if (!days || days <= 0) return res.json({ deleted: 0 });
  
  try {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const info = db.prepare('DELETE FROM news WHERE publishedAt < ?').run(cutoff);
    res.json({ deleted: info.changes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/news/:id', (req, res) => {
  const { rewrittenTitle, rewrittenContent, rewriteTemplate } = req.body;
  try {
    const stmt = db.prepare(\`
      UPDATE news 
      SET rewrittenTitle = ?, rewrittenContent = ?, rewriteTemplate = ?
      WHERE id = ?
    \`);
    const info = stmt.run(rewrittenTitle, rewrittenContent, rewriteTemplate, req.params.id);
    
    if (info.changes === 0) return res.status(404).json({ error: 'News item not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Static Files Serving ---
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// SPA Fallback (Express 5 compatible)
app.get('(.*)', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error sending index.html:', err);
      res.status(500).send('Error loading frontend. Please run "npm run build" on server.');
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`Server running on http://0.0.0.0:\${PORT}\`);
});
EOF
```

## 第二步：重启服务

执行完上面的命令后，运行：

```bash
pm2 restart my-ai-bot
```

现在您的服务应该会变成 `online` 状态。
