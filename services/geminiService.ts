import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

export async function* transformDailyReportStream(
  rawText: string, 
  columns: string[],
  templateHint: string,
  staffList: string[] = []
) {
  // Always get the latest API_KEY right before making the request.
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined" || apiKey.length < 5) {
    throw new Error("请先点击上方按钮关联您的付费项目 API 密钥");
  }

  // Create a new instance right before making an API call to ensure it uses the most up-to-date API key.
  const ai = new GoogleGenAI({ apiKey });
  
  const staffCheckInstruction = staffList.length > 0 
    ? `\n\n【人员名单】：[${staffList.join(", ")}]。请确保这些人在输出中都有对应的行。`
    : "";

  const systemPrompt = `你是一个顶级 TSV 数据解析专家。
目标列：${columns.join(' | ')}
要求：
1. 仅输出 TSV 纯文本。
2. 严禁 Markdown 代码块标签。
3. 确保数据对齐。
${templateHint}${staffCheckInstruction}`;

  try {
    // Using gemini-3-pro-preview for complex reasoning and structured extraction tasks.
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3-pro-preview",
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
      // Accessing .text property directly as per the latest SDK guidelines.
      const text = (chunk as GenerateContentResponse).text;
      if (text) yield text;
    }
  } catch (error: any) {
    console.error("Gemini API Error Detail:", error);
    const errorStr = error.message || "";
    
    // Handle GCP-specific errors such as "Requested entity was not found" or "Quota exceeded".
    if (errorStr.includes("Requested entity was not found")) {
      throw new Error("Requested entity was not found (API 未在项目中启用)");
    } else if (errorStr.includes("429")) {
      throw new Error("QUOTA_EXHAUSTED");
    }
    
    throw new Error(errorStr);
  }
}
