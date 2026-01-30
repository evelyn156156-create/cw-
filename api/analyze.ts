import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini with the Key from Vercel Environment Variables
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL_NAME = "gemini-3-flash-preview"; 

export default async function handler(req: any, res: any) {
  // CORS Handling for Vercel
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { items } = req.body;
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Invalid items array' });
  }

  const results = [];

  for (const item of items) {
    try {
      const prompt = `
      你是一个加密货币情报分析师。
      
      任务：
      1. **isCryptoRelated**: 是否是加密货币/Web3新闻。
      2. **translatedTitle**: 将标题翻译为中文。
      3. **riskLevel**: 评估合规与运营风险 (high/medium/low)。
      4. **sentiment**: 情感分析 (positive/negative/neutral)。
      5. **qualityScore**: 0-100分。
      6. **entities**: 提取关键实体(仅提取项目名和机构名)。

      文章标题: "${item.title}"
      文章片段: "${item.content ? item.content.substring(0, 500).replace(/\n/g, ' ').replace(/<[^>]*>?/gm, '') : ''}"
      来源: "${item.sourceName}"
      `;

      const schema = {
        type: Type.OBJECT,
        properties: {
            isCryptoRelated: { type: Type.BOOLEAN },
            qualityScore: { type: Type.INTEGER },
            translatedTitle: { type: Type.STRING },
            language: { type: Type.STRING },
            sentiment: { type: Type.STRING, enum: ["positive", "negative", "neutral"] },
            riskLevel: { type: Type.STRING, enum: ["low", "medium", "high"] },
            entities: {
                type: Type.OBJECT,
                properties: {
                    projects: { type: Type.ARRAY, items: { type: Type.STRING } },
                    institutions: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
            }
        }
      };

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
        }
      });
      
      let text = response.text || "{}";
      text = text.replace(/```json\n?|```/g, '').trim();
      const analysis = JSON.parse(text);

      let status = 'COMPLETED';
      if (!analysis.isCryptoRelated || analysis.qualityScore < 30) {
        status = 'SKIPPED';
      }

      results.push({
        ...item,
        status,
        title: analysis.translatedTitle || item.title,
        language: analysis.language,
        sentiment: analysis.sentiment,
        qualityScore: analysis.qualityScore,
        isCryptoRelated: analysis.isCryptoRelated,
        riskLevel: analysis.riskLevel || "low",
        entities: analysis.entities || { projects: [], institutions: [] },
      });

    } catch (e: any) {
      console.error(`Analysis error for ${item.title}:`, e);
      if (e.toString().includes('429')) {
          return res.status(429).json({ error: 'Gemini Rate Limit Exceeded' });
      }
      results.push({ ...item, status: 'FAILED' });
    }
  }

  return res.status(200).json({ results });
}
