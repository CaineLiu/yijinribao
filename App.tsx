import React, { useState, useEffect, useMemo, useRef } from 'react';
import { transformDailyReportStream } from './services/geminiService';
import { TEMPLATES, APP_TITLE, APP_SUBTITLE, COMPANY_NAME, HistoryItem } from './constants';
import Button from './components/Button';

// 声明 window 上的扩展方法
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
    <svg width="64" height="64" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="45" cy="45" r="32" fill="#EAB308" />
      <circle cx="45" cy="45" r="11" fill="white" />
      <circle cx="20" cy="24" r="5" fill="#EAB308" />
      <circle cx="82" cy="78" r="15" fill="#EAB308" />
    </svg>
    <div className="flex flex-col justify-center">
      <span className="text-4xl font-black text-slate-900 tracking-tighter leading-none">亿锦企服</span>
      <span className="text-[11px] font-black text-slate-800 tracking-[0.15em] mt-1.5 flex items-center gap-1">
        YIJINQIFU <span className="text-[9px] border-[1.5px] border-slate-900 px-0.5 leading-none">CO LTD</span>
      </span>
    </div>
  </div>
);

export default function App() {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [isTransforming, setIsTransforming] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState('public');
  const [customColumns, setCustomColumns] = useState('日期, 姓名, 完成单数, 备注');
  const [copySuccess, setCopySuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryTimer, setRetryTimer] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const dataScrollRef = useRef<HTMLDivElement>(null);

  const [staffMap, setStaffMap] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    Object.entries(TEMPLATES).forEach(([key, config]) => {
      initial[key] = (config.defaultStaff || []).join(', ');
    });
    return initial;
  });

  // 倒计时逻辑
  useEffect(() => {
    if (retryTimer > 0) {
      const timer = setTimeout(() => setRetryTimer(retryTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [retryTimer]);

  // 自动跟随滚动：当 outputText 更新时，滚动到底部
  useEffect(() => {
    if (isTransforming && dataScrollRef.current) {
      dataScrollRef.current.scrollTop = dataScrollRef.current.scrollHeight;
    }
  }, [outputText, isTransforming]);

  const handleOpenKeyDialog = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setErrorMessage(null);
      setRetryTimer(0);
    } else {
      alert("当前环境不支持手动选择密钥，请检查网络或刷新页面。");
    }
  };

  const currentColumns = useMemo(() => {
    if (activeTemplate === 'custom') {
      return customColumns.split(/[,，\n]/).map(c => c.trim()).filter(c => c);
    }
    return TEMPLATES[activeTemplate].columns;
  }, [activeTemplate, customColumns]);

  const currentStaffList = useMemo(() => {
    return (staffMap[activeTemplate] || '')
      .split(/[,，\n]/)
      .map(s => s.trim())
      .filter(s => s);
  }, [staffMap, activeTemplate]);

  // 实时解析缺勤（带容错处理，防止流式输出中断裂的标记）
  const missingStaff = useMemo(() => {
    const match = outputText.match(/\[\[MISSING: (.*?)\]\]/);
    if (!match) return null;
    const names = match[1].trim();
    if (names.endsWith(']')) return null; // 如果标记还没传完
    return names === '无' ? [] : names.split(/[,，]/).map(n => n.trim()).filter(n => n);
  }, [outputText]);

  // 实时清洗输出文本：去掉 markdown 标记
  const cleanOutputText = useMemo(() => {
    return outputText
      .replace(/```[a-zA-Z]*\n?/gi, '')
      .replace(/```/g, '')
      .replace(/\[\[MISSING: .*?\]\]/g, '')
      .trim();
  }, [outputText]);

  const parsedRows = useMemo(() => {
    if (!cleanOutputText) return [];
    return cleanOutputText.split('\n').filter(row => row.trim()).map(row => row.split('\t'));
  }, [cleanOutputText]);

  const handleDataScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  useEffect(() => {
    const savedHistory = localStorage.getItem('report_history_v3');
    if (savedHistory) {
      try { setHistory(JSON.parse(savedHistory)); } catch (e) {}
    }
    const savedStaff = localStorage.getItem('staff_config_v1');
    if (savedStaff) {
      try {
        const parsed = JSON.parse(savedStaff);
        setStaffMap(prev => ({ ...prev, ...parsed }));
      } catch (e) {}
    }
    const savedCustomCols = localStorage.getItem('custom_columns_config');
    if (savedCustomCols) setCustomColumns(savedCustomCols);
    document.title = `${COMPANY_NAME} | ${APP_TITLE}`;
  }, []);

  const handleTransform = async () => {
    if (!inputText.trim()) return;
    if (retryTimer > 0) return;

    setIsTransforming(true);
    setErrorMessage(null);
    setOutputText('');
    
    try {
      const template = TEMPLATES[activeTemplate];
      const stream = transformDailyReportStream(
        inputText, 
        currentColumns, 
        template.hint, 
        currentStaffList
      );
      
      let fullResult = '';
      for await (const chunk of stream) {
        fullResult += chunk;
        setOutputText(fullResult); // 实时更新状态
      }
      
      // 完成后做最后的清理
      const finalResult = fullResult.replace(/```[a-z]*\n/gi, '').replace(/```/g, '').trim();
      setOutputText(finalResult);
      
      const newHistory = [{
        date: new Date().toLocaleString(),
        text: finalResult,
        template: template.label
      }, ...history].slice(0, 10);
      setHistory(newHistory);
      localStorage.setItem('report_history_v3', JSON.stringify(newHistory));
    } catch (err: any) {
      const msg = err.message || "";
      setErrorMessage(msg);
      if (msg.includes("频率限制") || msg.includes("忙不过来")) {
        setRetryTimer(60);
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

  const cellWidth = "w-[160px] flex-shrink-0";
  const rowPadding = "px-8";

  return (
    <div className="min-h-screen bg-[#FDFDFD] p-6 md:p-12 flex flex-col items-center">
      <nav className="w-full max-w-7xl flex justify-between items-center mb-16 px-6">
        <CompanyLogo />
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            className="text-xs h-10 px-6 rounded-full border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100"
            onClick={handleOpenKeyDialog}
          >
            🔑 使用独立 API 密钥 (防报错)
          </Button>
          <span className="hidden lg:inline text-xs font-black text-slate-400 uppercase tracking-[0.3em] bg-white px-6 py-2.5 rounded-full border border-slate-100 shadow-sm">Enterprise V4.5</span>
        </div>
      </nav>

      <div className="w-full max-w-7xl">
        <header className="mb-14 text-center">
          <h1 className="text-6xl md:text-8xl font-black text-slate-950 mb-6 tracking-tighter leading-none">{APP_TITLE}</h1>
          <p className="text-slate-400 font-bold text-2xl max-w-2xl mx-auto">{APP_SUBTITLE}</p>
        </header>

        {/* 模板选择 */}
        <div className="flex flex-wrap justify-center gap-4 mb-14">
          {Object.entries(TEMPLATES).map(([key, config]) => (
            <button
              key={key}
              onClick={() => { setActiveTemplate(key); setOutputText(''); setErrorMessage(null); }}
              className={`px-12 py-5 rounded-[30px] text-lg font-black transition-all duration-300 transform active:scale-95 shadow-md border-2 ${
                activeTemplate === key ? 'bg-amber-500 text-white border-amber-500 shadow-amber-200' : 'bg-white text-slate-400 border-slate-100 hover:border-amber-400 hover:text-amber-600'
              }`}
            >
              {config.label}
            </button>
          ))}
        </div>

        {errorMessage && (
          <div className="w-full max-w-5xl mx-auto mb-10 p-8 bg-red-50 border-4 border-red-100 rounded-[40px] flex flex-col md:flex-row items-center gap-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="w-20 h-20 bg-red-500 rounded-3xl flex items-center justify-center text-white text-4xl shadow-lg shadow-red-200 shrink-0">⚠️</div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-xl font-black text-red-900 mb-2">系统受限提示</h3>
              <p className="text-red-700 font-bold text-lg mb-4 leading-relaxed">{errorMessage}</p>
              <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                <Button variant="primary" className="bg-red-600 hover:bg-red-700 text-sm py-3" onClick={handleOpenKeyDialog}>配置个人密钥 (永久解决)</Button>
              </div>
            </div>
            {retryTimer > 0 && (
              <div className="shrink-0 bg-white px-8 py-4 rounded-3xl border-2 border-red-100 flex flex-col items-center">
                 <span className="text-3xl font-black text-red-600">{retryTimer}s</span>
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">冷却中</span>
              </div>
            )}
          </div>
        )}

        <div className="w-full max-w-5xl mx-auto mb-16 grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm">
             <div className="flex justify-between items-center mb-6">
                <label className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-3">
                  <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse"></div>应报人员名单
                </label>
                <button onClick={() => setStaffMap(prev => ({...prev, [activeTemplate]: (TEMPLATES[activeTemplate].defaultStaff || []).join(', ')}))} className="text-xs font-black text-amber-600 hover:underline">加载默认</button>
             </div>
             <textarea rows={2} value={staffMap[activeTemplate]} onChange={(e) => setStaffMap(prev => ({ ...prev, [activeTemplate]: e.target.value }))} className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-amber-50 outline-none text-base font-bold text-slate-700 resize-none transition-all" placeholder="输入名单，逗号分隔..." />
          </div>
          <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm flex flex-col justify-center">
             <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-amber-50 rounded-3xl flex items-center justify-center text-3xl shadow-inner border border-amber-100">📋</div>
                <div>
                  <h4 className="text-xl font-black text-slate-900">{TEMPLATES[activeTemplate].label} 管理模式</h4>
                  <p className="text-base font-bold text-slate-400 mt-1 italic">监控目标: <span className="text-amber-600 font-black text-lg">{currentStaffList.length}</span> 位职员</p>
                </div>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-24">
          <div className="bg-white rounded-[60px] shadow-2xl border border-slate-100 p-12 flex flex-col h-[750px]">
            <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-slate-950 rounded-[28px] flex items-center justify-center text-white font-black italic shadow-2xl text-2xl">IN</div>
                <h2 className="text-5xl font-black text-slate-900 tracking-tighter">源数据采集</h2>
              </div>
              <Button variant="outline" className="text-xs h-10 px-6 rounded-full" onClick={() => {setInputText(''); setErrorMessage(null);}}>清空</Button>
            </div>
            <textarea className="flex-1 w-full p-10 bg-slate-50 border-none rounded-[48px] focus:ring-8 focus:ring-amber-50 outline-none resize-none text-xl text-slate-600 custom-scrollbar font-bold shadow-inner" placeholder="在此粘贴多人日报原文..." value={inputText} onChange={(e) => setInputText(e.target.value)} />
            <div className="mt-12">
              <Button 
                className={`w-full py-8 rounded-[40px] text-2xl font-black shadow-2xl transition-all active:scale-[0.98] ${retryTimer > 0 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-600 text-white'}`} 
                onClick={handleTransform} 
                isLoading={isTransforming}
                disabled={retryTimer > 0}
              >
                {isTransforming ? 'AI 正在极速生成中...' : retryTimer > 0 ? `限制中 (${retryTimer}s)` : '开始结构化转换'}
              </Button>
            </div>
          </div>

          <div className="bg-[#FFFDF3] rounded-[60px] shadow-2xl border-4 border-amber-100 p-12 flex flex-col h-[750px] relative">
            <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-amber-500 rounded-[28px] flex items-center justify-center text-white font-black italic shadow-2xl text-2xl">OUT</div>
                <h2 className="text-5xl font-black text-amber-900 tracking-tighter">结构化解析</h2>
              </div>
              <Button 
                variant={copySuccess ? "secondary" : "outline"} 
                className={`text-sm font-black h-16 px-10 rounded-[28px] border-4 transition-all ${copySuccess ? 'bg-emerald-500 border-emerald-500 shadow-emerald-100' : 'border-amber-200 text-amber-700 hover:bg-amber-100'}`}
                onClick={handleCopy}
                disabled={!cleanOutputText || isTransforming}
              >
                {copySuccess ? '✓ 已复制' : '复制数据'}
              </Button>
            </div>

            {missingStaff !== null && (
              <div className={`mb-8 p-6 rounded-[32px] border-4 flex items-center gap-6 ${missingStaff.length > 0 ? 'bg-red-500/10 border-red-100 text-red-700' : 'bg-emerald-500/10 border-emerald-100 text-emerald-700'}`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg ${missingStaff.length > 0 ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
                  {missingStaff.length > 0 ? '!' : '✓'}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-black uppercase tracking-widest opacity-60 leading-none mb-1">Attendance Check</p>
                  <p className="text-lg font-black">{missingStaff.length > 0 ? `检测到 ${missingStaff.length} 人缺勤：${missingStaff.join(', ')}` : '今日全员报送完毕'}</p>
                </div>
              </div>
            )}

            <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-[48px] border-2 border-amber-200 shadow-inner">
              <div ref={headerScrollRef} className="bg-amber-500 text-white flex h-14 overflow-hidden border-b-2 border-amber-600 flex-shrink-0">
                <div className={`flex items-center whitespace-nowrap ${rowPadding} h-full`}>
                  {currentColumns.map((col, i) => (
                    <div key={i} className={`${cellWidth} px-4 border-r border-amber-400/30 h-full flex items-center font-mono text-sm font-black uppercase truncate`}>
                      {col}
                    </div>
                  ))}
                </div>
              </div>
              <div ref={dataScrollRef} onScroll={handleDataScroll} className="flex-1 overflow-auto custom-scrollbar scroll-smooth">
                <div className="flex flex-col min-w-max pb-20">
                  {parsedRows.map((row, rowIndex) => (
                    <div key={rowIndex} className={`flex border-b border-amber-50 hover:bg-amber-50/50 transition-colors ${rowPadding} animate-in fade-in slide-in-from-left-2 duration-300`}>
                      {row.map((cell, cellIndex) => (
                        <div key={cellIndex} className={`${cellWidth} px-4 py-4 font-mono text-sm text-amber-900 truncate`}>
                          {cell || '0'}
                        </div>
                      ))}
                    </div>
                  ))}
                  
                  {isTransforming && (
                    <div className={`flex items-center ${rowPadding} py-4 opacity-50`}>
                      <div className="w-full flex gap-4">
                        <div className="h-4 bg-amber-100 rounded-full w-24 animate-pulse"></div>
                        <div className="h-4 bg-amber-100 rounded-full w-32 animate-pulse delay-75"></div>
                        <div className="h-4 bg-amber-100 rounded-full w-16 animate-pulse delay-150"></div>
                        <div className="w-2 h-4 bg-amber-400 animate-blink"></div>
                      </div>
                    </div>
                  )}

                  {parsedRows.length === 0 && !isTransforming && (
                    <div className="p-20 text-center text-slate-200 font-bold italic">
                      结构化矩阵将在此实时生成
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {isTransforming && (
               <div className="absolute bottom-16 left-1/2 -translate-x-1/2 px-8 py-3 bg-amber-900 text-white text-xs font-black rounded-full shadow-2xl animate-bounce flex items-center gap-3">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  AI 正在处理流数据...
               </div>
            )}
          </div>
        </div>

        <footer className="mt-auto py-24 text-center border-t-2 border-slate-100 bg-white rounded-t-[100px]">
          <div className="flex flex-col items-center gap-10">
             <CompanyLogo />
             <div className="flex flex-wrap justify-center gap-14 text-sm font-black text-slate-400 uppercase tracking-[0.4em]">
              <span>© 2024 {COMPANY_NAME}</span>
              <span className="text-amber-400">•</span>
              <span>流式办公引擎</span>
              <span className="text-amber-400">•</span>
              <span>V4.5 Live</span>
            </div>
          </div>
        </footer>
      </div>

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .animate-blink { animation: blink 0.8s infinite; }
        .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #fffbeb; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #fde68a; border-radius: 10px; border: 2px solid #fffbeb; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #fbbf24; }
      `}</style>
    </div>
  );
}