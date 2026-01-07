
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { transformDailyReportStream } from './services/geminiService';
import { TEMPLATES, COMPANY_NAME } from './constants';
import Button from './components/Button';

export default function App() {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [isTransforming, setIsTransforming] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState('public');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  
  const dataScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isTransforming && dataScrollRef.current) {
      dataScrollRef.current.scrollTop = dataScrollRef.current.scrollHeight;
    }
  }, [outputText, isTransforming]);

  const currentColumns = useMemo(() => TEMPLATES[activeTemplate].columns, [activeTemplate]);
  const cleanOutputText = useMemo(() => outputText.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim(), [outputText]);
  const parsedRows = useMemo(() => cleanOutputText ? cleanOutputText.split('\n').filter(r => r.trim()).map(r => r.split('\t')) : [], [cleanOutputText]);

  const handleTransform = async () => {
    if (!inputText.trim()) return;
    
    setIsTransforming(true);
    setErrorMessage(null);
    setOutputText('');

    // 设置一个 15 秒的强制超时保护
    const timeoutId = setTimeout(() => {
      if (isTransforming && !outputText) {
        setErrorMessage("响应过慢：请检查代理是否开启‘全局模式’，或点击右上角 Reset 刷新。");
        setIsTransforming(false);
      }
    }, 15000);
    
    try {
      const template = TEMPLATES[activeTemplate];
      const stream = transformDailyReportStream(inputText, currentColumns, template.hint, template.defaultStaff);
      for await (const chunk of stream) {
        setOutputText(prev => prev + chunk);
      }
      clearTimeout(timeoutId);
    } catch (err: any) {
      setErrorMessage(err.message);
      clearTimeout(timeoutId);
    } finally {
      setIsTransforming(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(cleanOutputText).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Noto_Sans_SC']">
      <header className="w-full bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-bold">R</div>
          <h1 className="text-slate-800 font-bold tracking-tight">{COMPANY_NAME} 智能日报</h1>
        </div>
        <div className="flex gap-2">
          {Object.entries(TEMPLATES).map(([key, config]) => (
            <button
              key={key}
              onClick={() => { setActiveTemplate(key); setOutputText(''); setErrorMessage(null); }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${activeTemplate === key ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              {config.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-100px)]">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">输入原始日报</span>
            <button onClick={() => {setInputText(''); setOutputText(''); setErrorMessage(null);}} className="text-[10px] font-bold text-slate-400 hover:text-rose-500">清空重来</button>
          </div>
          <textarea 
            className="flex-1 p-6 outline-none resize-none text-slate-700 font-medium placeholder:text-slate-300 bg-transparent text-sm"
            placeholder="请在此粘贴员工日报..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <div className="p-4 border-t border-slate-100 bg-white">
            {errorMessage && (
              <div className="mb-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-[11px] font-bold leading-relaxed">
                ⚠️ {errorMessage}
              </div>
            )}
            <Button 
              className="w-full py-4 bg-indigo-600 text-white text-lg font-black rounded-2xl shadow-lg active:scale-95"
              onClick={handleTransform}
              isLoading={isTransforming}
            >
              {isTransforming ? "正在提取中..." : "开始 AI 提取"}
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">提取结果预览</span>
            <button 
              onClick={handleCopy}
              disabled={!cleanOutputText}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${copySuccess ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white disabled:opacity-20'}`}
            >
              {copySuccess ? '✓ 已复制' : '复制表格数据'}
            </button>
          </div>
          
          <div className="flex-1 bg-slate-900 overflow-hidden flex flex-col">
            <div className="bg-slate-800 text-slate-400 flex border-b border-slate-700 overflow-x-auto no-scrollbar">
              <div className="flex min-w-max">
                {currentColumns.map((col, i) => (
                  <div key={i} className="w-28 py-3 text-[10px] font-bold text-center border-r border-slate-700/50">
                    {col}
                  </div>
                ))}
              </div>
            </div>

            <div ref={dataScrollRef} className="flex-1 overflow-auto custom-scrollbar">
              <div className="min-w-max">
                {parsedRows.map((row, i) => (
                  <div key={i} className="flex border-b border-slate-800/50 hover:bg-white/5 transition-colors">
                    {row.map((cell, j) => (
                      <div key={j} className="w-28 py-4 px-2 text-[11px] text-slate-300 text-center truncate">
                        {cell || "-"}
                      </div>
                    ))}
                  </div>
                ))}
                
                {!isTransforming && parsedRows.length === 0 && (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-700">
                    <div className="w-12 h-12 border-2 border-slate-800 rounded-2xl flex items-center justify-center text-xl mb-4">＋</div>
                    <p className="text-[10px] font-bold tracking-widest uppercase opacity-40">等待提取数据</p>
                  </div>
                )}

                {isTransforming && !outputText && (
                   <div className="py-20 flex flex-col items-center justify-center gap-3">
                     <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                     <p className="text-[10px] font-bold text-indigo-400/60 uppercase animate-pulse">正在极速提取中...</p>
                   </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <footer className="py-4 text-center text-[10px] text-slate-300 font-bold tracking-widest uppercase">
        {COMPANY_NAME} · 极速模式已开启
      </footer>
    </div>
  );
}
