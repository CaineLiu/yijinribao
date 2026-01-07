import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

export async function* transformDailyReportStream(
  rawText: string, 
  columns: string[],
  templateHint: string,
  staffList: string[] = [] // 传入的应报人员名单
) {
  // 实时从环境变量获取最新的 API Key (支持用户动态切换)
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined" || !apiKey.trim()) {
    throw new Error("API 密钥缺失。请点击右上角【🔑 使用独立 API 密钥】配置您的项目密钥。");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const staffCheckInstruction = staffList.length > 0 
    ? `\n\n【特别任务：人员缺勤检测】
你有一份内部应报人员名单：[${staffList.join(", ")}]。
请核对文本中出现了谁的日报。
最后请务必在新的一行，严格按照以下格式输出缺席名单：
[[MISSING: 名字1, 名字2]]
如果全员已报，输出：[[MISSING: 无]]`
    : "";

  const systemPrompt = `任务：将非结构化多人日报转换为飞书多维表格可用的TSV数据（不要表头）。
目标列顺序（严格按此顺序）：
${columns.map((col, i) => `${i + 1}. ${col}`).join('\n')}
执行准则：
1. 【格式】仅输出纯文本，禁止 Markdown 标签。
2. 【提取】识别所有人，每人一行。
3. 【日期】YYYY/MM/DD 格式。
4. 【数值】空缺填 0。
5. 【分隔】使用制表符（Tab）。
6. 【纯净】除了数据和要求的缺勤检测标记，禁止任何解释。
背景规则：${templateHint}${staffCheckInstruction}`;

  try {
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: [{
        parts: [{
          text: systemPrompt + `\n待转换内容：\n${rawText}`
        }]
      }],
      config: {
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    for await (const chunk of responseStream) {
      const text = (chunk as GenerateContentResponse).text;
      if (text) yield text;
    }
  } catch (error: any) {
    console.error("Gemini Error:", error);
    const msg = error.message || "";
    
    // 针对 429 频率限制的定制化中文引导
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("触发频率限制：当前公共 API Key 请求太频繁（免费版每分钟限制 15 次）。请点击右上角配置个人密钥，或等待 60 秒后再试。");
    }
    
    if (msg.includes("API_KEY_INVALID")) {
      throw new Error("API 密钥无效或已过期，请点击右上角重新配置。");
    }
    
    if (msg.includes("Requested entity was not found")) {
      throw new Error("密钥项目未找到，请点击右上角重置。");
    }
    
    throw new Error("AI 引擎暂时无法响应，请稍后再试或检查网络配置。");
  }
}