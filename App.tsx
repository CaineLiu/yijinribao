
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

  // 自动滚动到输出底部
  useEffect(() => {
    if (isTransforming && dataScrollRef.current) {
      dataScrollRef.current.scrollTop = dataScrollRef.current.scrollHeight;
    }
  }, [outputText, isTransforming]);

  const currentColumns = useMemo(() => TEMPLATES[activeTemplate].columns, [activeTemplate]);
  
  // 清理输出文本，移除 Markdown 标记
  const cleanOutputText = useMemo(() => {
    return outputText
      .replace(/```[a-z]*\n?/gi, '')
      .replace(/```/g, '')
      .trim();
  }, [outputText]);

  // 解析 TSV 数据为表格行
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
      const stream = transformDailyReportStream(
        inputText, 
        currentColumns, 
        template.hint, 
        template.defaultStaff
      );
      
      for await (const chunk of stream) {
        setOutputText(prev => prev + chunk);
      }
    } catch (err: any) {
      console.error("Transform Error:", err);
      setErrorMessage(err.message || "提取失败，请检查网络或稍后重试。");
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* 顶部导航 */}
      <header className="bg-white border-b px-6 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold shadow-sm">R</div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">{COMPANY_NAME} 智能提取</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            {Object.entries(TEMPLATES).map(([key, config]) => (
              <button
                key={key}
                onClick={() => { setActiveTemplate(key); setOutputText(''); setErrorMessage(null); }}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTemplate === key ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:bg-white/50'}`}
              >
                {config.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-100px)]">
        {/* 输入区 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="p-3 border-b bg-slate-50/50 flex justify-between items-center px-5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">原始内容</span>
            <button onClick={() => {setInputText(''); setOutputText(''); setErrorMessage(null);}} className="text-[10px] text-slate-400 hover:text-blue-600">清空</button>
          </div>
          <textarea 
            className="flex-1 p-6 outline-none resize-none text-slate-700 text-sm leading-relaxed placeholder:text-slate-300"
            placeholder="请在此粘贴日报内容..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <div className="p-5 border-t bg-white">
            {errorMessage && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl">
                <p className="text-[11px] text-rose-600 font-bold leading-tight">⚠️ {errorMessage}</p>
              </div>
            )}
            <Button 
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-black active:scale-[0.98] transition-all"
              onClick={handleTransform}
              isLoading={isTransforming}
            >
              {isTransforming ? "正在提取..." : "一键开始提取"}
            </Button>
          </div>
        </div>

        {/* 输出区 */}
        <div className="bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-800">
          <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center px-5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">提取结果</span>
            <button 
              onClick={handleCopy}
              disabled={!cleanOutputText}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${copySuccess ? 'bg-emerald-500 text-white' : 'bg-white text-slate-900 disabled:opacity-10'}`}
            >
              {copySuccess ? '复制成功' : '复制数据'}
            </button>
          </div>
          
          <div ref={dataScrollRef} className="flex-1 overflow-auto custom-scrollbar bg-slate-900">
            {parsedRows.length > 0 ? (
              <table className="w-full border-collapse text-[11px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-800">
                    {currentColumns.map((col, i) => (
                      <th key={i} className="px-4 py-3 border-b border-r border-slate-700 text-left text-slate-400 font-black min-w-[110px] uppercase tracking-tighter whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {parsedRows.map((row, i) => (
                    <tr key={i} className="hover:bg-blue-500/10 transition-colors">
                      {row.map((cell, j) => (
                        <td key={j} className="px-4 py-3 border-r border-slate-800 text-slate-300 font-medium whitespace-nowrap">{cell || "-"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-700 gap-4">
                <div className="w-16 h-16 border-4 border-slate-800 border-dashed rounded-3xl flex items-center justify-center text-2xl font-black opacity-20">?</div>
                <div className="text-center">
                  <p className="text-[10px] font-black tracking-[0.2em] uppercase opacity-40">等待数据输入</p>
                  {isTransforming && (
                    <div className="flex items-center justify-center gap-1 mt-2">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <footer className="py-2.5 text-center text-[10px] text-slate-300 font-black border-t bg-white uppercase tracking-[0.3em]">
        {COMPANY_NAME} · 极速提取模式
      </footer>
    </div>
  );
}
