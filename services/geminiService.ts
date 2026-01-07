import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

export async function* transformDailyReportStream(
  rawText: string, 
  columns: string[],
  templateHint: string,
  staffList: string[] = []
) {
  // 确保能从环境变量读取
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined" || apiKey.length < 5) {
    throw new Error("RUNTIME_KEY_MISSING");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const staffCheckInstruction = staffList.length > 0 
    ? `\n\n【人员名单】：[${staffList.join(", ")}]。请确保这些人在输出中都有对应的行。`
    : "";

  const systemPrompt = `你是一个精准的 TSV 数据提取引擎。
目标列：${columns.join(' | ')}
格式：
1. 直接输出 TSV 内容，禁止 Markdown 标签。
2. 制表符分隔列。
3. 每个人一行。
4. 处理所有出现的员工。
${templateHint}${staffCheckInstruction}`;

  try {
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: [{
        parts: [{
          text: systemPrompt + `\n\n日报原文：\n${rawText}`
        }]
      }],
      config: {
        temperature: 0.1,
      }
    });

    for await (const chunk of responseStream) {
      const text = (chunk as GenerateContentResponse).text;
      if (text) yield text;
    }
  } catch (error: any) {
    console.error("API Error:", error);
    throw new Error(error.message || "AI 服务响应异常");
  }
}