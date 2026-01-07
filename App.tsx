
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

export default function App() {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [isTransforming, setIsTransforming] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState('public');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [retryTimer, setRetryTimer] = useState(0);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [isKeySelected, setIsKeySelected] = useState(true);
  
  const dataScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setIsKeySelected(hasKey);
        if (!hasKey) setShowDiagnostic(true);
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    if (isTransforming && dataScrollRef.current) {
      dataScrollRef.current.scrollTop = dataScrollRef.current.scrollHeight;
    }
  }, [outputText, isTransforming]);

  useEffect(() => {
    let interval: any;
    if (retryTimer > 0) {
      interval = setInterval(() => setRetryTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [retryTimer]);

  const currentColumns = useMemo(() => TEMPLATES[activeTemplate].columns, [activeTemplate]);
  const cleanOutputText = useMemo(() => outputText.replace(/```[a-z]*\n?/gi, '').replace(/```[a-z]*/gi, '').replace(/```/g, '').trim(), [outputText]);
  const parsedRows = useMemo(() => cleanOutputText ? cleanOutputText.split('\n').filter(r => r.trim()).map(r => r.split('\t')) : [], [cleanOutputText]);

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setShowDiagnostic(false);
      setErrorMessage(null);
      setIsKeySelected(true);
    }
  };

  const handleTransform = async () => {
    if (!inputText.trim()) return setErrorMessage("请先输入日报内容");
    if (retryTimer > 0) return;

    setIsTransforming(true);
    setErrorMessage(null);
    setOutputText('');
    
    try {
      const template = TEMPLATES[activeTemplate];
      const stream = transformDailyReportStream(inputText, currentColumns, template.hint, template.defaultStaff);
      for await (const chunk of stream) {
        setOutputText(prev => prev + chunk);
      }
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("Requested entity was not found") || msg.includes("429") || msg.includes("QUOTA")) {
        setErrorMessage("项目未就绪：请确保项目已关联结算账号");
        setShowDiagnostic(true);
      } else {
        setErrorMessage(msg);
      }
      setRetryTimer(3);
    } finally {
      setIsTransforming(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center font-['Noto_Sans_SC']">
      {!isKeySelected && (
        <div className="w-full bg-slate-900 text-white py-2.5 px-4 flex justify-center items-center gap-4 z-50 sticky top-0 border-b border-indigo-500/30">
          <span className="text-xs font-black tracking-widest opacity-80 uppercase">AI 引擎离线 · 正在同步付费状态</span>
          <button onClick={handleOpenKeySelector} className="bg-indigo-600 text-white px-5 py-1 rounded-full text-[10px] font-black shadow-lg hover:bg-indigo-500 transition-all">激活付款项目</button>
        </div>
      )}

      <div className="w-full max-w-7xl px-4 md:px-8 py-8 flex flex-col items-center">
        <nav className="w-full flex justify-between items-center mb-8 px-6 py-4 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" />
              </svg>
            </div>
            <span className="font-black text-slate-800 tracking-tight">{COMPANY_NAME} 智能日报系统</span>
          </div>
          <button onClick={handleOpenKeySelector} className="px-4 py-1.5 rounded-full text-[11px] font-black transition-all border border-slate-100 bg-slate-50 text-slate-400 hover:text-indigo-600">重选项目</button>
        </nav>

        {showDiagnostic && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl">
            <div className="bg-white w-full max-w-5xl border border-white/20 rounded-[40px] overflow-hidden shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-500">
              <div className="bg-slate-900 px-10 py-8 text-white">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-black text-3xl mb-2 text-emerald-400">大功告成！您已经关联成功了</h3>
                    <p className="text-slate-400 text-sm">我从您的截图中看到了：<span className="text-white font-bold underline">结算账号一栏显示了“我的结算账号”</span>。这说明项目已经正式激活！</p>
                  </div>
                  <button onClick={() => setShowDiagnostic(false)} className="bg-white/5 hover:bg-white/10 w-10 h-10 rounded-full flex items-center justify-center transition-colors">✕</button>
                </div>
              </div>
              
              <div className="p-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <section className="bg-emerald-50 p-6 rounded-[32px] border-2 border-emerald-100 flex gap-4">
                      <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">✓</div>
                      <div>
                        <h4 className="font-black text-emerald-900 mb-1">为什么刚才提示“没有可用账号”？</h4>
                        <p className="text-xs text-emerald-700 leading-relaxed">
                          那是因为项目<b>已经关联好</b>了。Google 不允许您再次关联同一个账号，所以才弹出那个提示。您看截图背景，项目 ID 后面已经跟着您的结算账号了。
                        </p>
                      </div>
                    </section>

                    <section className="bg-slate-50 p-6 rounded-[32px] border border-slate-200">
                      <h4 className="flex items-center gap-3 font-black text-slate-800 mb-4">
                        <span className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm">终</span>
                        如何让 AI 引擎识别到？
                      </h4>
                      <div className="space-y-4">
                        <div className="bg-white p-5 rounded-2xl border border-indigo-100">
                           <p className="text-sm text-slate-700 font-bold mb-2 flex items-center gap-2">
                             <span className="bg-indigo-600 text-white w-5 h-5 rounded flex items-center justify-center text-[10px]">1</span>
                             强制刷新同步
                           </p>
                           <p className="text-xs text-slate-500 leading-relaxed">
                             点击下方的“刷新项目列表”按钮。在弹出的白色对话框中，寻找右下角的 <strong className="text-indigo-600">“Reset”</strong> 按钮并点击它，这会强制系统重新去抓取您的付费状态。
                           </p>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-indigo-100">
                           <p className="text-sm text-slate-700 font-bold mb-2 flex items-center gap-2">
                             <span className="bg-indigo-600 text-white w-5 h-5 rounded flex items-center justify-center text-[10px]">2</span>
                             稍等 1 分钟
                           </p>
                           <p className="text-xs text-slate-500 leading-relaxed">
                             状态同步通常有 60 秒左右的延迟。如果 Reset 后还是没看到项目，请刷新整个网页重试。
                           </p>
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className="flex flex-col gap-6">
                    <div className="bg-indigo-600 rounded-[40px] p-10 text-white flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden group">
                      <div className="w-20 h-20 bg-white text-indigo-600 rounded-3xl flex items-center justify-center text-4xl mb-6 shadow-2xl animate-bounce">🚀</div>
                      <h5 className="font-black text-2xl mb-4 relative z-10">现在，去点击 Reset</h5>
                      <p className="text-sm text-indigo-100 mb-8 leading-relaxed relative z-10">
                        点击下方按钮调起选择框，然后点击选择框里的 <b>Reset</b>。只要项目出现在列表中，选中它点 <b>Done</b> 即可！
                      </p>
                      <button 
                        onClick={handleOpenKeySelector}
                        className="w-full py-6 bg-slate-900 text-white rounded-2xl font-black text-xl shadow-xl hover:bg-black hover:scale-[1.05] active:scale-95 transition-all relative z-10"
                      >
                        刷新项目列表
                      </button>
                    </div>

                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200">
                       <p className="text-[10px] text-slate-400 font-bold leading-normal text-center uppercase tracking-widest">
                         ✅ 配置已 100% 完成 · 等待同步生效
                       </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start w-full">
          <div className="bg-white rounded-[40px] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 h-[700px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                {Object.entries(TEMPLATES).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => { setActiveTemplate(key); setOutputText(''); setErrorMessage(null); }}
                    className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all ${activeTemplate === key ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 bg-slate-50'}`}
                  >
                    {config.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea 
              className="flex-1 bg-slate-50 rounded-[28px] p-8 outline-none text-slate-700 resize-none font-medium text-lg border-2 border-transparent focus:border-indigo-100 transition-all placeholder:text-slate-200"
              placeholder="在此粘贴日报内容..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            {errorMessage && (
              <div className="mt-4 p-4 bg-rose-50 text-rose-600 rounded-2xl text-xs font-bold text-center border border-rose-100 flex flex-col gap-2 animate-shake">
                <span>{errorMessage}</span>
                <button onClick={() => setShowDiagnostic(true)} className="underline text-[10px] font-black">查看同步指引</button>
              </div>
            )}
            <Button 
              className="mt-6 py-6 rounded-3xl text-xl font-black bg-slate-900 shadow-2xl" 
              onClick={handleTransform}
              isLoading={isTransforming}
              disabled={retryTimer > 0}
            >
              {retryTimer > 0 ? `同步状态中 (${retryTimer}s)` : '开始 AI 提取'}
            </Button>
          </div>

          <div className="bg-white rounded-[40px] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 h-[700px] flex flex-col">
            <div className="flex justify-between items-center mb-6 px-2">
              <h3 className="text-lg font-black text-slate-800">提取预览</h3>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(cleanOutputText).then(() => {
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 2000);
                  });
                }}
                disabled={!cleanOutputText}
                className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${copySuccess ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:opacity-80'}`}
              >
                {copySuccess ? '✓ 已复制' : '复制数据'}
              </button>
            </div>
            
            <div className="flex-1 bg-slate-900 rounded-[32px] overflow-hidden flex flex-col border border-slate-800 shadow-inner">
              <div className="bg-slate-800/80 text-slate-500 h-12 flex items-center px-6 overflow-x-auto border-b border-slate-700">
                <div className="flex min-w-max">
                  {currentColumns.map((col, i) => (
                    <div key={i} className="w-32 flex-shrink-0 text-[10px] font-black uppercase tracking-widest text-center border-r border-slate-700/50 last:border-none">
                      {col}
                    </div>
                  ))}
                </div>
              </div>
              <div ref={dataScrollRef} className="flex-1 overflow-auto p-6 custom-scrollbar">
                <div className="min-w-max">
                  {parsedRows.map((row, i) => (
                    <div key={i} className="flex border-b border-slate-800/30 py-4 hover:bg-indigo-900/10 transition-colors">
                      {row.map((cell, j) => (
                        <div key={j} className="w-32 flex-shrink-0 px-3 text-[12px] font-bold text-slate-400 truncate text-center">
                          {cell || "-"}
                        </div>
                      ))}
                    </div>
                  ))}
                  {isTransforming && (
                    <div className="py-20 flex flex-col items-center justify-center gap-4">
                      <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                      <span className="text-[10px] font-black text-indigo-400 tracking-widest uppercase animate-pulse">AI 正在努力解析...</span>
                    </div>
                  )}
                  {!isTransforming && parsedRows.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-700 opacity-20 py-20">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2v20m10-10H2" />
                      </svg>
                      <span className="mt-4 text-[10px] font-black tracking-[0.3em] uppercase">准备就绪</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <footer className="mt-16 pb-12 opacity-30 text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">{COMPANY_NAME} · VERSION 3.2.6</footer>
    </div>
  );
}
