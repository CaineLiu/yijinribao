export interface TemplateConfig {
  label: string;
  hint: string;
  columns: string[];
  summaryPrompt?: string;
  defaultStaff?: string[]; // 默认人员名单
}

export interface HistoryItem {
  date: string;
  text: string;
  template: string;
}

// === 企业品牌配置 ===
export const COMPANY_NAME = "亿锦企服"; 
export const APP_TITLE = "智能日报助手";
export const APP_SUBTITLE = "企业级日报结构化提取引擎";

export const TEMPLATES: Record<string, TemplateConfig> = {
  public: {
    label: "公域流量",
    hint: "提取账号状态、剪辑发布及客资。日期统一为 YYYY/MM/DD。",
    columns: [
      "日期", 
      "运营人", 
      "IP", 
      "今日此IP封号数", 
      "今日此IP可用账号数", 
      "今日此IP剪辑数", 
      "今日审核数", 
      "今日此IP视频发布数", 
      "今日总文案数", 
      "今日客资数"
    ],
    defaultStaff: ["仲金", "焮怡", "张星", "宇鑫", "正宏", "溯溯", "柯廷"],
    summaryPrompt: "汇报：今日在 [IP] 账号表现如何，完成了多少剪辑和发布。"
  },
  ip: {
    label: "IP 部门",
    hint: "重点提取各 IP 账号的产出数据。格式：日期、具体IP名称、产出数量、运营负责人。日期格式 YYYY/MM/DD。",
    columns: [
      "日期",
      "IP",
      "数量",
      "运营"
    ],
    defaultStaff: ["花花", "小冉", "羊羊", "发发", "飞哥", "老郭"],
    summaryPrompt: "总结今日 IP 部门各账号产出。"
  },
  private: {
    label: "私域运营",
    hint: "根据客资转化路径提取。'今日总客资'列将尝试从文本汇总提取。",
    columns: [
      "日期", 
      "私域", 
      "今日新分配客资", 
      "今日新微信客资", 
      "今日总客资", 
      "以往未接通客资", 
      "今日未接通客资", 
      "今日无效客资", 
      "今日加微信客资", 
      "今日签约客户", 
      "客户今日上门/已操作客户", 
      "今日放款客户"
    ],
    defaultStaff: ["小凌", "婷婷", "燕燕", "小雪", "刘雅", "媛媛", "姜姜"],
    summaryPrompt: "私域转化复盘，包含新分配客资数、到店、签约情况。"
  },
  custom: {
    label: "✨ 自定义",
    hint: "手动指定列名，AI 将根据你的定义灵活提取数据。",
    columns: [],
    defaultStaff: [],
    summaryPrompt: ""
  }
};