import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

export async function* transformDailyReportStream(
  rawText: string, 
  columns: string[],
  templateHint: string,
  staffList: string[] = [] // 传入的应报人员名单
) {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined") {
    throw new Error("检测到未配置 API_KEY。请在 Zeabur 环境变量中添加 API_KEY 变量。");
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
    throw new Error(error.message || "AI 引擎响应异常，请检查网络或密钥权限。");
  }
}