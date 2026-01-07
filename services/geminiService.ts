import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

export async function* transformDailyReportStream(
  rawText: string, 
  columns: string[],
  templateHint: string,
  staffList: string[] = []
) {
  // 优先从环境变量获取，如果没有则视为未配置
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined" || apiKey === "" || apiKey.length < 10) {
    throw new Error("RUNTIME_KEY_MISSING");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const staffCheckInstruction = staffList.length > 0 
    ? `\n\n【人员名单】：[${staffList.join(", ")}]。请确保名单中的每个人在结果中都有记录（无数据的标记为0或空）。`
    : "";

  const systemPrompt = `你是一个专业的数据处理助手。请将以下日报内容转换为结构化的 TSV 数据（不含表头）。
列顺序必须严格遵守：${columns.join(' | ')}
格式规范：
1. 仅输出纯文本，严禁包含 Markdown 代码块标签。
2. 使用制表符(Tab)进行列分隔。
3. 每个人占一行。
${templateHint}${staffCheckInstruction}`;

  try {
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-flash-latest", // 切换到兼容性最好的 Flash 模型
      contents: [{
        parts: [{
          text: systemPrompt + `\n\n待处理日报原文：\n${rawText}`
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
    console.error("Gemini API Error:", error);
    
    // 抛出更具体的原始错误，方便定位
    const errorBody = error.toString();
    if (errorBody.includes("429") || errorBody.includes("Quota")) {
      throw new Error("API 请求频率受限 (429)，请稍后再试。");
    } else if (errorBody.includes("403") || errorBody.includes("401")) {
      throw new Error("API 密钥验证失败 (401/403)，请检查环境变量是否生效。");
    } else {
      throw new Error(`AI 服务异常: ${error.message || '未知错误'}`);
    }
  }
}