import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL_NAME = "gemini-3-flash-preview"; 

function getTemplateName(t: string) {
    switch(t) {
        case 'hot_event': return "热点事件 + CoinW 视角";
        case 'sector_depth': return "赛道深度 + CoinW 机会";
        case 'product_update': return "产品功能更新";
        case 'media_report': return "媒体报道整合";
        default: return "通用模板";
    }
}

export default async function handler(req: any, res: any) {
  // CORS Handling
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

  const { item, template } = req.body;
  if (!item) return res.status(400).json({ error: 'Missing item' });

  try {
    let systemInstruction = `
    你现在是加密货币交易所 CoinW (币赢) 的资深内容运营专家。
    你的目标是将外部新闻改写为一篇不仅有信息量，还能引导用户在 CoinW 进行交易或使用产品的文章。
    `;

    let userPrompt = `
    请根据以下新闻内容，使用【${getTemplateName(template)}】模板进行改写。

    原文标题: ${item.title}
    原文摘要: ${item.summary}
    原文内容: ${item.content ? item.content.substring(0, 3000) : '无全文'}
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING }
        }
    };

    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: systemInstruction + userPrompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
        }
    });

    let text = response.text || "{}";
    text = text.replace(/```json\n?|```/g, '').trim();
    const result = JSON.parse(text);

    return res.status(200).json(result);

  } catch (error: any) {
    console.error('Rewrite Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
