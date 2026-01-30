import { GoogleGenAI, Type } from "@google/genai";
import { NewsItem, AnalysisStatus, RewriteTemplate } from "../types";

// Initialize AI Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Using gemini-3-flash-preview for speed and cost efficiency
const MODEL_NAME = "gemini-3-flash-preview"; 

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wrapper for generateContent with retry logic for handling Rate Limits (429).
 */
async function generateContentWithRetry(prompt: string, schema?: any, retries = 5, initialDelay = 5000) {
    let currentDelay = initialDelay;
    
    for (let i = 0; i < retries; i++) {
        try {
            return await ai.models.generateContent({
                model: MODEL_NAME,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                }
            });
        } catch (error: any) {
            const isRateLimit = error.message?.includes('429') || 
                                error.status === 429 || 
                                error.toString().includes('RESOURCE_EXHAUSTED') ||
                                error.code === 429 ||
                                error.error?.code === 429 ||
                                error.error?.status === 'RESOURCE_EXHAUSTED';
            
            if (isRateLimit) {
                const waitTime = Math.max(currentDelay, 10000); 
                console.warn(`[Gemini] 配额超限 (429). 暂停 ${waitTime/1000} 秒后重试...`);
                if (i < retries - 1) {
                    await sleep(waitTime);
                    currentDelay *= 1.5; 
                    continue;
                }
            }
            throw error;
        }
    }
    throw new Error("Gemini API 重试次数过多");
}

export const analyzeNewsBatch = async (items: NewsItem[]): Promise<NewsItem[]> => {
  const results: NewsItem[] = [];

  for (const item of items) {
    try {
      // OPTIMIZED PROMPT:
      // We removed requests for Summary, Tickers, Category, and Tags because 
      // those are now handled locally via Regex/RSS parsing.
      // We only ask for things Regex cannot do well: Translation, Risk, Sentiment, Quality.
      
      const prompt = `
      你是一个加密货币情报分析师。
      
      任务：
      1. **isCryptoRelated**: 是否是加密货币/Web3新闻。
      2. **translatedTitle**: 将标题翻译为中文。
      3. **riskLevel**: 评估合规与运营风险 (high/medium/low)。High=监管打击/黑客/跑路。
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

      const response = await generateContentWithRetry(prompt, schema);
      
      let text = response.text || "{}";
      text = text.replace(/```json\n?|```/g, '').trim();
      
      const analysis = JSON.parse(text);

      let status = AnalysisStatus.COMPLETED;
      if (!analysis.isCryptoRelated || analysis.qualityScore < 30) {
        status = AnalysisStatus.SKIPPED;
      }

      results.push({
        ...item,
        status,
        // AI Generated Fields
        title: analysis.translatedTitle || item.title,
        language: analysis.language,
        sentiment: analysis.sentiment,
        qualityScore: analysis.qualityScore,
        isCryptoRelated: analysis.isCryptoRelated,
        riskLevel: analysis.riskLevel || "low",
        entities: analysis.entities || { projects: [], institutions: [] },
        
        // Preserve Local Fields if AI fails or isn't asked, 
        // but merge if necessary (here we just keep local ones for Tickers/Tags/Summary to save tokens)
        // coinTickers, topicCategory, tags, and summary are already populated by rssService
      });
      
      // Delay for Rate Limits
      await sleep(4500); 

    } catch (e) {
      console.error("Gemini analysis failed for item:", item.title, e);
      results.push({
        ...item,
        status: AnalysisStatus.FAILED
      });
      await sleep(2000);
    }
  }

  return results;
};

// --- COINW REWRITE FEATURE ---

export const rewriteNewsForCoinW = async (item: NewsItem, template: RewriteTemplate): Promise<{ title: string, content: string }> => {
    // Rewrite logic remains same as it provides high value
    let systemInstruction = `
    你现在是加密货币交易所 CoinW (币赢) 的资深内容运营专家。
    你的目标是将外部新闻改写为一篇不仅有信息量，还能引导用户在 CoinW 进行交易或使用产品的文章。
    风格要求：专业、客观但有吸引力、逻辑清晰。文风要符合华语区币圈用户的阅读习惯。
    `;

    let userPrompt = `
    请根据以下新闻内容，使用【${getTemplateName(template)}】模板进行改写。

    原文标题: ${item.title}
    原文摘要: ${item.summary}
    原文内容: ${item.content ? item.content.substring(0, 3000) : '无全文'}
    
    --------------------------------------------------
    `;

    // Template Specific Instructions
    if (template === RewriteTemplate.HOT_EVENT) {
        userPrompt += `
        模板要求：【热点事件 + CoinW 视角】
        1. **发生了什么**：简述事件核心要点。
        2. **影响分析**：对市场价格、板块或行业的影响。
        3. **CoinW 行动指南**（重点）：
           - 提醒风险（如：该币种波动大，请控制杠杆）。
           - 引导交易（如：CoinW 已上线该现货/合约，点击交易）。
           - 如涉及理财/活动，引导参与。
        `;
    } else if (template === RewriteTemplate.SECTOR_DEPTH) {
        userPrompt += `
        模板要求：【赛道/板块深度 + CoinW 机会】
        1. **逻辑梳理**：解释该叙事/赛道为什么火（技术/资金/宏观）。
        2. **项目盘点**：列举核心代币。
        3. **CoinW 布局**（重点）：
           - 强调 CoinW 已经上线了哪些相关优质标的。
           - 给出简单的配置建议或观察列表。
           - 引导用户去 CoinW 交易相关板块。
        `;
    } else if (template === RewriteTemplate.PRODUCT_UPDATE) {
        userPrompt += `
        模板要求：【产品功能/活动更新】
        (如果原文不是产品类，请尽量结合CoinW相关产品强行关联，或者返回无法改写的提示)
        1. **核心变化**：更新了什么？（费率/功能/活动）。
        2. **用户受益**：新老用户分别能得到什么好处？举例说明。
        3. **操作路径**：一步步教用户怎么做 (Call to Action)。
        `;
    } else if (template === RewriteTemplate.MEDIA_REPORT) {
        userPrompt += `
        模板要求：【媒体报道/榜单整合】
        1. **媒体观点**：提炼外媒的核心评价或榜单排名。
        2. **CoinW 数据秀**：结合 CoinW 的优势数据（如24h成交量、全球用户数、合规牌照）进行背书。
        3. **总结升华**：强调 CoinW 的品牌实力和安全性。
        `;
    }

    const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: "改写后的吸引人标题" },
            content: { type: Type.STRING, description: "改写后的正文，使用 Markdown 格式" }
        }
    };

    try {
        const response = await generateContentWithRetry(systemInstruction + userPrompt, schema);
        let text = response.text || "{}";
        text = text.replace(/```json\n?|```/g, '').trim();
        return JSON.parse(text);
    } catch (e) {
        console.error("Rewrite failed", e);
        throw e;
    }
}

function getTemplateName(t: RewriteTemplate) {
    switch(t) {
        case RewriteTemplate.HOT_EVENT: return "热点事件 + CoinW 视角";
        case RewriteTemplate.SECTOR_DEPTH: return "赛道深度 + CoinW 机会";
        case RewriteTemplate.PRODUCT_UPDATE: return "产品功能更新";
        case RewriteTemplate.MEDIA_REPORT: return "媒体报道整合";
        default: return "通用模板";
    }
}