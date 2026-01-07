
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

export async function* transformDailyReportStream(
  rawText: string, 
  columns: string[],
  templateHint: string,
  staffList: string[] = []
) {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined") {
    throw new Error("API 密钥未就绪，请在右上角重选项目并 Reset");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const staffCheck = staffList.length > 0 ? `确保名单内每个人都有数据：${staffList.join(", ")}` : "";

  const prompt = `你是一个高效的数据提取助手。
任务：将日报提取为 TSV 格式。
列名：${columns.join('\t')}
要求：
1. 直接输出 TSV，不要任何 Markdown 标记或解释。
2. 缺失填“-”。
3. 日期：YYYY/MM/DD。
${templateHint}
${staffCheck}

日报原文：
${rawText}`;

  try {
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        temperature: 0, // 设为 0 保证结果最稳定
        thinkingConfig: { thinkingBudget: 0 } // 禁用思考过程，追求最快速度
      }
    });

    for await (const chunk of responseStream) {
      const text = (chunk as GenerateContentResponse).text;
      if (text) yield text;
    }
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    // 捕获常见的权限/计费错误
    if (error.message?.includes("entity was not found") || error.message?.includes("403") || error.message?.includes("429")) {
      throw new Error("项目权限未同步：请点击右上角‘重选项目’，然后点击弹窗右下角的 Reset 按钮。");
    }
    throw new Error(error.message || "请求超时或网络异常，请检查代理设置。");
  }
}
