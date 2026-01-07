
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

/**
 * Transforms raw daily report text into structured TSV format using Gemini 3.
 */
export async function* transformDailyReportStream(
  rawText: string, 
  columns: string[],
  templateHint: string,
  staffList: string[] = []
) {
  // 直接使用 process.env.API_KEY
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const staffCheck = staffList.length > 0 ? `确保名单内每个人都有数据：${staffList.join(", ")}` : "";

  const prompt = `任务：将以下日报提取为表格（TSV格式）。
列名：${columns.join('\t')}
要求：
1. 仅输出数据，不要 Markdown，不要解释。
2. 缺失项填“-”。
3. 日期格式：YYYY/MM/DD。
${templateHint}
${staffCheck}

原文：
${rawText}`;

  try {
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 0 } // 设为 0 以获得最快响应
      }
    });

    for await (const chunk of responseStream) {
      const text = (chunk as GenerateContentResponse).text;
      if (text) yield text;
    }
  } catch (error: any) {
    console.error("Gemini API Request Failed:", error);
    // 向上传递错误消息
    throw new Error(error.message || "AI 响应失败");
  }
}
