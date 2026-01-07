import React, { useState, useEffect, useMemo, useRef } from 'react';
import { transformDailyReportStream } from './services/geminiService';
import { TEMPLATES, COMPANY_NAME } from './constants';
import Button from './components/Button';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const CompanyLogo = () => (
  <div className="flex items-center gap-4">
    <div className="bg-amber-500 p-2 rounded-xl shadow-lg shadow-amber-200">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
    <div className="flex flex-col">
      <span className="text-xl font-black text-slate-900 leading-none tracking-tight">亿锦企服</span>
      <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest opacity-70">Enterprise Support</span>
    </div>
  </div>
);

export default function App() {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [isTransforming, setIsTransforming] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState('public');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  
  const dataScrollRef = useRef<HTMLDivElement>(null);

  // 稳健的 Key 检测逻辑
  const isEnvKeyLoaded = useMemo(() => {
    const key = process.env.API_KEY;
    // 排除字符串形式的 "undefined" 或 "null"
    return typeof key === 'string' && key.length > 10 && key !== 'undefined';
  }, []);

  useEffect(() => {
    if (isTransforming && dataScrollRef.current) {
      dataScrollRef.current.scrollTop = dataScrollRef.current.scrollHeight;
    }
  }, [outputText, isTransforming]);

  const currentColumns = useMemo(() => TEMPLATES[activeTemplate].columns, [activeTemplate]);
  
  const cleanOutputText = useMemo(() => {
    return outputText.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
  }, [outputText]);

  const parsedRows = useMemo(() => {
    if (!cleanOutputText) return [];
    return cleanOutputText.split('\n').filter(r => r.trim()).map(r => r.split('\t'));
  }, [cleanOutputText]);

  const handleTransform = async () => {
    if (!inputText.trim()) {
      setErrorMessage("请先输入日报内容");
      return;
    }
    
    setIsTransforming(true);
    setErrorMessage(null);
    setOutputText('');
    
    try {
      const template = TEMPLATES[activeTemplate];
      const stream = transformDailyReportStream(inputText, currentColumns, template.hint, template.defaultStaff);
      
      let full = '';
      for await (const chunk of stream) {
        full += chunk;
        setOutputText(full);
      }
    } catch (err: any) {
      console.error(err);
      if (err.message === "RUNTIME_KEY_MISSING") {
        setErrorMessage("关键步骤：检测到变量未注入。请在 Zeabur 侧点击“重新部署 (Redeploy)”而非“重启”。只有重新部署才会将变量写入代码。");
      } else {
        setErrorMessage(err.message || "AI 响应异常，请检查网络或 Key 额度");
      }
    } finally {
      setIsTransforming(false);
    }
  };

  const handleCopy = () => {
    if (!cleanOutputText) return;
    navigator.clipboard.writeText(cleanOutputText).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const handleOpenKeyModal = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      window.location.reload(); 
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center p-4 md:p-8 selection:bg-amber-100">
      <nav className="w-full max-w-7xl flex justify-between items-center mb-12 px-4">
        <CompanyLogo />
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold border transition-all ${isEnvKeyLoaded ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-500'}`}>
            <span className={`w-2 h-2 rounded-full ${isEnvKeyLoaded ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`}></span>
            {isEnvKeyLoaded ? '系统密钥：已注入' : '系统密钥：待部署'}
          </div>
          <button 
            onClick={handleOpenKeyModal} 
            className="text-[11px] font-bold text-slate-400 hover:text-amber-600 transition-colors border-b border-dashed border-slate-300 hover:border-amber-600 pb-0.5"
          >
            备选方案
          </button>
        </div>
      </nav>

      <div className="w-full max-w-7xl">
        <header className="mb-12 text-center">
          <h1 className="text-5xl md:text-6xl font-black text-slate-900 mb-4 tracking-tighter italic">智能日报助手</h1>
          <p className="text-slate-400 font-medium tracking-wide">AI 驱动 · 自动化数据提取引擎</p>
        </header>

        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {Object.entries(TEMPLATES).map(([key, config]) => (
            <button
              key={key}
              onClick={() => { setActiveTemplate(key); setOutputText(''); setErrorMessage(null); }}
              className={`px-8 py-3 rounded-2xl text-sm font-black transition-all transform active:scale-95 border-2 ${
                activeTemplate === key 
                ? 'bg-amber-500 border-amber-500 text-white shadow-xl shadow-amber-200' 
                : 'bg-white border-transparent text-slate-400 hover:border-slate-100 hover:bg-slate-50'
              }`}
            >
              {config.label}
            </button>
          ))}
        </div>

        {errorMessage && (
          <div className="max-w-4xl mx-auto mb-8 p-6 bg-rose-50 border-2 border-rose-100 rounded-3xl text-rose-600 text-sm leading-relaxed font-bold flex items-start gap-4 animate-in slide-in-from-top-4">
            <span className="text-2xl mt-[-2px]">🚨</span>
            <div>
              <p className="mb-1">配置未生效提示：</p>
              <p className="font-medium opacity-80">{errorMessage}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="bg-white rounded-[48px] shadow-sm border border-slate-100 p-8 flex flex-col h-[680px] transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-6 px-2">
              <h3 className="text-xl font-black text-slate-900">日报内容粘贴</h3>
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Input Source</span>
            </div>
            <textarea 
              className="flex-1 bg-slate-50/50 rounded-[32px] p-8 outline-none focus:ring-4 focus:ring-amber-50 text-base font-medium text-slate-600 resize-none border border-transparent focus:border-amber-100 transition-all placeholder:text-slate-300"
              placeholder="在此粘贴日报原文..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <Button 
              className="mt-8 py-8 rounded-[32px] text-2xl font-black bg-slate-950 hover:bg-black text-white shadow-2xl shadow-slate-200" 
              onClick={handleTransform}
              isLoading={isTransforming}
            >
              {isTransforming ? '正在极速解析...' : '开始转换数据'}
            </Button>
          </div>

          <div className="bg-white rounded-[48px] shadow-sm border border-slate-100 p-8 flex flex-col h-[680px] transition-all hover:shadow-md">
            <div className="flex justify-between items-center mb-6 px-2">
              <h3 className="text-xl font-black text-slate-900">TSV 表格数据</h3>
              <Button variant={copySuccess ? "secondary" : "outline"} className="h-10 px-6 rounded-xl text-xs font-black transition-all" onClick={handleCopy} disabled={!cleanOutputText}>
                {copySuccess ? '✓ 已成功复制' : '复制预览数据'}
              </Button>
            </div>
            
            <div className="flex-1 bg-slate-50/30 rounded-[32px] border border-slate-100 overflow-hidden flex flex-col shadow-inner">
              <div className="bg-amber-500 text-white flex h-14 flex-shrink-0 items-center">
                <div className="flex px-6 w-full">
                  {currentColumns.map((col, i) => (
                    <div key={i} className="w-32 flex-shrink-0 px-2 text-[10px] font-black uppercase tracking-tighter truncate border-r border-amber-400/30 last:border-none">
                      {col}
                    </div>
                  ))}
                </div>
              </div>
              <div ref={dataScrollRef} className="flex-1 overflow-auto custom-scrollbar p-6">
                <div className="flex flex-col min-w-max">
                  {parsedRows.map((row, i) => (
                    <div key={i} className="flex border-b border-slate-100 py-4 hover:bg-amber-50/30 transition-colors group">
                      {row.map((cell, j) => (
                        <div key={j} className="w-32 flex-shrink-0 px-2 text-xs font-bold text-slate-600 truncate group-hover:text-amber-700">
                          {cell || "-"}
                        </div>
                      ))}
                    </div>
                  ))}
                  {isTransforming && (
                    <div className="py-12 flex flex-col items-center justify-center gap-4 opacity-40">
                       <div className="flex gap-2">
                         <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce"></div>
                         <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                         <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                       </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-auto py-12 flex flex-col items-center gap-3">
        <div className="text-[10px] text-slate-300 font-black uppercase tracking-[0.3em]">
          {COMPANY_NAME} 系统技术部 · 数字化转型办公室
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[9px] text-slate-400 font-bold bg-white px-4 py-1.5 rounded-full border border-slate-100 shadow-sm">
            V2.3.0 - 环境注入增强版
          </div>
          <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
          <div className="text-[9px] text-slate-300 font-medium">Powered by Gemini 3 Flash</div>
        </div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </div>
  );
}