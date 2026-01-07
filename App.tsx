import React, { useState, useEffect, useMemo, useRef } from 'react';
import { transformDailyReportStream } from './services/geminiService';
import { TEMPLATES, APP_TITLE, APP_SUBTITLE, COMPANY_NAME } from './constants';
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
    <svg width="45" height="45" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="45" fill="#EAB308" />
      <path d="M30 50L45 65L70 35" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <div className="flex flex-col">
      <span className="text-xl font-black text-slate-900 leading-none">亿锦企服</span>
      <span className="text-[9px] font-black text-slate-400 mt-1 uppercase tracking-widest">Enterprise Support</span>
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
  const [isEnvKeyLoaded, setIsEnvKeyLoaded] = useState(false);
  
  const dataScrollRef = useRef<HTMLDivElement>(null);

  // 运行时检测环境变量是否成功注入
  useEffect(() => {
    const key = process.env.API_KEY;
    if (key && key !== "undefined" && key.length > 10) {
      setIsEnvKeyLoaded(true);
    } else {
      setIsEnvKeyLoaded(false);
    }
  }, []);

  useEffect(() => {
    if (isTransforming && dataScrollRef.current) {
      dataScrollRef.current.scrollTop = dataScrollRef.current.scrollHeight;
    }
  }, [outputText, isTransforming]);

  const currentColumns = useMemo(() => TEMPLATES[activeTemplate].columns, [activeTemplate]);
  
  const cleanOutputText = useMemo(() => {
    return outputText.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').replace(/\[\[MISSING: .*?\]\]/g, '').trim();
  }, [outputText]);

  const parsedRows = useMemo(() => {
    if (!cleanOutputText) return [];
    return cleanOutputText.split('\n').filter(r => r.trim()).map(r => r.split('\t'));
  }, [cleanOutputText]);

  const handleTransform = async () => {
    if (!inputText.trim()) return;
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
      if (err.message === "RUNTIME_KEY_MISSING") {
        setErrorMessage("检测到环境变量 API_KEY 未生效。如果您刚在 Zeabur 设置完，请尝试重新部署应用。");
      } else {
        setErrorMessage(err.message || "转换过程中出现异常，请重试。");
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center p-4 md:p-8">
      <nav className="w-full max-w-7xl flex justify-between items-center mb-8 px-4">
        <CompanyLogo />
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-colors ${isEnvKeyLoaded ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-red-50 border-red-200 text-red-600'}`}>
            {isEnvKeyLoaded ? '● 生产环境密钥已就绪' : '○ 环境变量未生效'}
          </div>
          <button 
            onClick={() => window.aistudio?.openSelectKey()} 
            className="text-[10px] text-slate-400 hover:text-slate-600 underline underline-offset-4"
          >
            备选方案
          </button>
        </div>
      </nav>

      <div className="w-full max-w-7xl">
        <header className="mb-10 text-center">
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-3 tracking-tight">{APP_TITLE}</h1>
          <p className="text-slate-400 font-medium">极简、高效、智能的日报数据结构化工具</p>
        </header>

        {errorMessage && (
          <div className="max-w-4xl mx-auto mb-8 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <span>⚠️ {errorMessage}</span>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {Object.entries(TEMPLATES).map(([key, config]) => (
            <button
              key={key}
              onClick={() => { setActiveTemplate(key); setOutputText(''); setErrorMessage(null); }}
              className={`px-8 py-3 rounded-2xl text-sm font-black transition-all ${
                activeTemplate === key ? 'bg-amber-500 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {config.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* 输入端 */}
          <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 p-8 flex flex-col h-[600px]">
            <h3 className="text-lg font-black text-slate-800 mb-4">日报内容粘贴</h3>
            <textarea 
              className="flex-1 bg-slate-50 rounded-2xl p-6 outline-none focus:ring-2 focus:ring-amber-200 text-base font-medium text-slate-600 resize-none border-none transition-shadow"
              placeholder="请在此粘贴需要转换的员工日报..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <Button 
              className="mt-6 py-6 rounded-2xl text-xl font-black bg-slate-900 hover:bg-black text-white shadow-xl shadow-slate-100" 
              onClick={handleTransform}
              isLoading={isTransforming}
            >
              {isTransforming ? '处理中...' : '开始转换'}
            </Button>
          </div>

          {/* 输出端 */}
          <div className="bg-[#FFFDF3] rounded-[32px] shadow-sm border border-amber-100 p-8 flex flex-col h-[600px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-amber-900">TSV 表格预览</h3>
              <Button variant={copySuccess ? "secondary" : "outline"} className="h-10 px-6 rounded-xl text-xs font-black" onClick={handleCopy} disabled={!cleanOutputText}>
                {copySuccess ? '✓ 已复制' : '复制数据'}
              </Button>
            </div>
            
            <div className="flex-1 bg-white rounded-2xl border border-amber-100 overflow-hidden flex flex-col shadow-inner">
              <div className="bg-amber-500 text-white flex h-10 overflow-hidden flex-shrink-0">
                <div className="flex items-center px-4 h-full">
                  {currentColumns.map((col, i) => (
                    <div key={i} className="w-24 flex-shrink-0 px-2 text-[9px] font-black uppercase truncate border-r border-amber-400/30">
                      {col}
                    </div>
                  ))}
                </div>
              </div>
              <div ref={dataScrollRef} className="flex-1 overflow-auto custom-scrollbar p-4">
                <div className="flex flex-col min-w-max">
                  {parsedRows.map((row, i) => (
                    <div key={i} className="flex border-b border-amber-50 py-3 hover:bg-amber-50/50">
                      {row.map((cell, j) => (
                        <div key={j} className="w-24 flex-shrink-0 px-2 text-xs font-mono text-amber-900 truncate">
                          {cell}
                        </div>
                      ))}
                    </div>
                  ))}
                  {isTransforming && (
                    <div className="py-6 flex gap-3 opacity-20">
                       <div className="h-3 w-16 bg-amber-400 rounded-full animate-pulse"></div>
                       <div className="h-3 w-20 bg-amber-300 rounded-full animate-pulse delay-75"></div>
                    </div>
                  )}
                  {!isTransforming && parsedRows.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-200 py-24">
                       <p className="font-bold text-sm">等待数据解析</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-auto py-8 text-[10px] text-slate-300 font-bold uppercase tracking-widest text-center">
        {COMPANY_NAME} 系统技术部 • 提供技术支持
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #fde68a; border-radius: 10px; }
      `}</style>
    </div>
  );
}