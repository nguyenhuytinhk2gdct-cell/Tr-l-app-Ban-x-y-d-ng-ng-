
import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, Trash2, FileText, Loader2, Database, X, ChevronRight, Users, MessageSquare, Filter, BrainCircuit, Sparkles } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { callGeminiStream } from './services/geminiService';
import { Message } from './types';
import ResponseBlock from './components/ResponseBlock';
import { SYSTEM_INSTRUCTION } from './constants';

const KNOWLEDGE_BASE_1 = {
  "id": "KB1",
  "title": "Tổ chức - Xây dựng Đảng",
  "docs": [
    "Kết luận 228-KL/TW (31/12/2025) - Bộ máy & Chính quyền 2 cấp",
    "Báo cáo 613-BC/BTCTW (29/12/2025) - Hoạt động hệ thống chính trị",
    "Quyết định 368-QĐ/TW (08/9/2025) - Chức danh lãnh đạo",
    "Kết luận 195-KL/TW (26/9/2025) - Chính quyền 2 cấp",
    "Quyết định 294-QĐ/TW (26/5/2025) - Điều lệ Đảng",
    "Hướng dẫn 04-HD/TW (31/12/2024) - Quy chế bầu cử",
    "Quyết định 366-QĐ/TW (30/8/2025) - Đánh giá xếp loại"
  ]
};

const KNOWLEDGE_BASE_2 = {
  "id": "KB2",
  "title": "Tuyên giáo - Dân vận",
  "docs": [
    "Chỉ thị 50-CT/TW (23/7/2025) - Sinh hoạt chi bộ",
    "Chỉ thị 51-CT/TW (08/8/2025) - Thẻ Đảng viên",
    "Hướng dẫn 31-HD/VPTW - Danh mục hồ sơ nghiệp vụ"
  ]
};

const KEYWORDS_KB1 = ["tổ chức", "bộ máy", "cán bộ", "bầu cử", "điều lệ", "xếp loại", "đánh giá", "bổ nhiệm", "chức danh", "quy định 294", "quy định 368", "hướng dẫn 04", "kết luận 195", "xây dựng đảng", "228-kl/tw", "613-bc/btctw"];
const KEYWORDS_KB2 = ["sinh hoạt chi bộ", "thẻ đảng viên", "dân vận", "tuyên truyền", "đại hội", "Chỉ thị 50", "Chỉ thị 51", "hồ sơ", "văn thư", "tuyên giáo"];

interface KnowledgeFile {
  name: string;
  mimeType: string;
  data: string;
  category: 'KB1' | 'KB2';
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFile[]>([]);
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ name: string; mimeType: string; data: string } | null>(null);
  const [isPro, setIsPro] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const knowledgeInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const classifyFile = (name: string): 'KB1' | 'KB2' | null => {
    const lowerName = name.toLowerCase();
    const isKB1 = KEYWORDS_KB1.some(kw => lowerName.includes(kw));
    const isKB2 = KEYWORDS_KB2.some(kw => lowerName.includes(kw));
    if (isKB1 && !isKB2) return 'KB1';
    if (isKB2 && !isKB1) return 'KB2';
    return null;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles) return;

    Array.from(uploadedFiles).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        const fileObj = {
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          data: base64
        };
        
        const category = classifyFile(file.name);
        if (category) {
          setKnowledgeFiles(prev => [...prev, { ...fileObj, category }]);
        } else {
          setPendingFile(fileObj);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const finalizeClassification = (category: 'KB1' | 'KB2') => {
    if (pendingFile) {
      setKnowledgeFiles(prev => [...prev, { ...pendingFile, category }]);
      setPendingFile(null);
    }
  };

  const handleSend = async (customText?: string) => {
    const textToSend = customText || input;
    if (!textToSend.trim()) return;
    
    const currentInput = textToSend;
    const userMessage: Message = { role: 'user', text: currentInput };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    setMessages(prev => [...prev, { role: 'model', text: "" }]);

    try {
      await callGeminiStream(
        currentInput, 
        messages, 
        knowledgeFiles,
        isPro,
        (fullText, thinking) => {
          setMessages(prev => {
            const newMessages = [...prev];
            const lastIdx = newMessages.length - 1;
            if (lastIdx >= 0 && newMessages[lastIdx].role === 'model') {
              newMessages[lastIdx] = { ...newMessages[lastIdx], text: fullText, thinking: thinking };
            }
            return newMessages;
          });
          setLoading(false);
        }
      );
    } catch (error) {
      setMessages(prev => {
        const newMessages = [...prev];
        const lastIdx = newMessages.length - 1;
        newMessages[lastIdx] = { 
          role: 'model', 
          text: "**NỘI DUNG THAM MƯU**\nLỗi kết nối hệ thống. Vui lòng thử lại sau.\n\n**CĂN CỨ TRI THỨC**\nHệ thống AI nghiệp vụ Đảng bộ phường Nam Hồng Lĩnh." 
        };
        return newMessages;
      });
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FA] relative overflow-hidden text-slate-800">
      {/* File Classification Modal */}
      {pendingFile && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-[32px] shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-scaleIn">
            <div className="bg-[#B30000] p-8 text-white text-center relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10"><Filter className="w-24 h-24" /></div>
              <h2 className="text-xl font-black uppercase tracking-tight mb-2">Phân loại tệp tri thức</h2>
              <p className="text-xs text-red-100 font-bold opacity-80 uppercase tracking-widest">{pendingFile.name}</p>
            </div>
            <div className="p-8 space-y-4">
              <button onClick={() => finalizeClassification('KB1')} className="w-full p-5 bg-red-50 hover:bg-red-100 border-2 border-red-200 rounded-3xl flex items-center gap-4 transition-all group active:scale-[0.98]">
                <div className="w-10 h-10 bg-[#B30000] text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform"><Database className="w-5 h-5" /></div>
                <div className="text-left"><span className="block font-black text-[#B30000] text-sm uppercase">Tổ chức - Xây dựng Đảng</span></div>
              </button>
              <button onClick={() => finalizeClassification('KB2')} className="w-full p-5 bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 rounded-3xl flex items-center gap-4 transition-all group active:scale-[0.98]">
                <div className="w-10 h-10 bg-blue-900 text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform"><Users className="w-5 h-5" /></div>
                <div className="text-left"><span className="block font-black text-blue-900 text-sm uppercase">Tuyên giáo - Dân vận</span></div>
              </button>
              <button onClick={() => setPendingFile(null)} className="w-full py-2 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors">Hủy bỏ</button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Header - Full Width */}
      <header className="bg-[#B30000] text-white py-4 px-6 md:px-10 shadow-2xl border-b-2 border-[#FFD700] flex items-center justify-between sticky top-0 z-50 w-full">
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex bg-white/10 p-2 rounded-2xl backdrop-blur-md border border-white/20 items-center justify-center">
            <Sparkles className="h-6 w-6 text-[#FFD700]" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-base md:text-xl font-black tracking-tight uppercase leading-none">Nghiệp vụ Xây dựng Đảng</h1>
            <span className="text-[10px] md:text-xs text-[#FFD700] font-black italic opacity-90 uppercase tracking-tighter">Phường Nam Hồng Lĩnh - Chuyên môn Nghiệp vụ Số</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsPro(!isPro)} 
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase transition-all shadow-xl active:scale-95 border-b-4 ${isPro ? 'bg-amber-500 text-white border-amber-800' : 'bg-slate-100/10 text-white/70 border-white/10 hover:bg-white/20'}`}
          >
            <BrainCircuit className="w-4 h-4" />
            <span className="hidden lg:inline">Chế độ Pro</span>
          </button>
          <button 
            onClick={() => setShowKnowledgeBase(true)} 
            className="flex items-center gap-2 bg-[#FFD700] text-[#B30000] px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase hover:brightness-110 transition-all border-b-4 border-red-800/40 shadow-xl active:scale-95"
          >
            <Database className="w-4 h-4" />
            <span className="hidden lg:inline">Kho tri thức</span>
          </button>
        </div>
      </header>

      {/* Right Drawer: Knowledge Base */}
      <div className={`fixed inset-y-0 right-0 w-80 md:w-[480px] bg-white shadow-[-20px_0_50px_rgba(0,0,0,0.1)] z-[100] transform transition-transform duration-500 ease-out border-l border-slate-100 flex flex-col ${showKnowledgeBase ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 bg-[#B30000] text-white flex items-center justify-between">
          <h2 className="font-black uppercase flex items-center gap-3 text-sm tracking-tighter italic">
            <Database className="w-5 h-5 text-[#FFD700]" /> Danh mục văn bản & dữ liệu
          </h2>
          <button onClick={() => setShowKnowledgeBase(false)} className="hover:bg-red-700 p-2.5 rounded-2xl transition-all active:scale-90"><X className="w-6 h-6" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-10 scrollbar-hide">
          {[KNOWLEDGE_BASE_1, KNOWLEDGE_BASE_2].map((kb, i) => (
            <section key={kb.id} className="space-y-5">
              <div className="flex items-center gap-3 border-b-2 border-slate-100 pb-2">
                <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-red-600' : 'bg-blue-600'}`}></div>
                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{kb.title}</h3>
              </div>
              <div className="grid gap-3">
                {kb.docs.map((doc, idx) => (
                  <div key={idx} className="flex items-start gap-4 p-4 bg-slate-50 rounded-[20px] border border-slate-200/50 hover:bg-white hover:shadow-md transition-all group">
                    <div className={`w-1 h-full min-h-[20px] rounded-full transition-all group-hover:w-2 ${i === 0 ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                    <span className="text-[10px] font-bold text-slate-600 leading-tight uppercase">{doc}</span>
                  </div>
                ))}
                {knowledgeFiles.filter(f => f.category === kb.id).map((file, idx) => (
                   <div key={idx} className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-[20px] shadow-sm group animate-fadeIn">
                    <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                    <span className="text-[10px] font-black text-slate-800 uppercase truncate flex-1">{file.name}</span>
                    <button onClick={() => setKnowledgeFiles(prev => prev.filter(f => f !== file))} className="text-red-400 hover:text-red-600 transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
                   </div>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="p-6 border-t border-slate-100 bg-slate-50/50">
          <input type="file" ref={knowledgeInputRef} onChange={handleFileUpload} className="hidden" multiple />
          <button onClick={() => knowledgeInputRef.current?.click()} className="w-full bg-[#B30000] text-white py-4 rounded-3xl font-black uppercase flex items-center justify-center gap-3 hover:bg-red-800 shadow-2xl text-[11px] active:scale-95 transition-all">
            <Upload className="w-5 h-5" /> Cập nhật tri thức nghiệp vụ mới
          </button>
        </div>
      </div>
      
      {showKnowledgeBase && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-[90] transition-opacity duration-500" onClick={() => setShowKnowledgeBase(false)} />
      )}

      {/* Main Content Area - Full Width No Max Width */}
      <main className="flex-1 overflow-y-auto w-full flex flex-col items-center scroll-smooth pb-10">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[90vh] w-full px-6 md:px-10 py-10 animate-fadeIn bg-gradient-to-b from-white to-slate-50">
            <div className="bg-white p-12 md:p-20 rounded-[80px] shadow-[0_50px_150px_rgba(0,0,0,0.06)] border border-slate-100 w-full max-w-7xl relative">
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#FFD700] text-[#B30000] px-10 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest shadow-2xl whitespace-nowrap border-2 border-white z-10">
                Hệ thống tham mưu nghiệp vụ số 2025
              </div>
              
              <div className="flex flex-col lg:flex-row gap-16 items-center">
                <div className="flex-1 text-center lg:text-left space-y-8">
                  <div className="inline-flex p-6 bg-red-50 rounded-[40px] border-2 border-red-100/50">
                    <Sparkles className="w-16 h-16 text-[#B30000] drop-shadow-lg" />
                  </div>
                  <h2 className="text-4xl md:text-7xl font-black text-slate-900 uppercase tracking-tighter leading-[1] transition-all">
                    Nghiệp vụ Xây dựng Đảng <br/> <span className="text-[#B30000]">Phường Nam Hồng Lĩnh</span>
                  </h2>
                  <p className="text-slate-400 text-sm md:text-base leading-relaxed font-bold uppercase tracking-wider italic max-w-2xl">
                    Giải pháp công nghệ hỗ trợ tham mưu chuyên sâu và tra cứu văn bản quy định 2024-2025 bằng trí tuệ nhân tạo thế hệ mới.
                  </p>
                </div>

                <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-5">
                  {[
                    "Hướng dẫn quy trình bầu cử Chi bộ tổ dân phố?",
                    "Tiêu chuẩn đánh giá, xếp loại Đảng viên năm 2025?",
                    "Nội dung sinh hoạt Chi bộ định kỳ theo Chỉ thị 50?",
                    "Các bước quy trình kết nạp Đảng viên mới?"
                  ].map((q, i) => (
                    <button key={i} onClick={() => handleSend(q)} className="p-8 bg-slate-50 hover:bg-white rounded-[40px] border border-slate-100 hover:border-red-200 hover:shadow-[0_20px_40px_rgba(179,0,0,0.08)] transition-all text-left group active:scale-[0.98]">
                      <div className="flex flex-col gap-6 h-full justify-between">
                        <div className="bg-[#B30000] text-white p-3 rounded-2xl shadow-lg w-fit group-hover:rotate-12 transition-transform">
                          <ChevronRight className="w-5 h-5" />
                        </div>
                        <span className="text-xs md:text-sm text-slate-700 font-black uppercase leading-snug group-hover:text-red-800 transition-colors">{q}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {messages.length > 0 && (
          <div className="w-full px-6 md:px-12 lg:px-24 py-10 space-y-12 max-w-[1600px]">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn w-full`}>
                {m.role === 'user' ? (
                  <div className="max-w-[75%] bg-[#B30000] text-white p-8 rounded-[40px] rounded-tr-lg shadow-2xl border-b-8 border-red-950/20 font-bold transition-transform hover:scale-[1.005]">
                    <p className="whitespace-pre-wrap leading-relaxed text-sm md:text-lg">{m.text}</p>
                  </div>
                ) : (
                  <div className="w-full">
                    {m.text ? <ResponseBlock content={m.text} thinking={m.thinking} onFollowUpClick={handleSend} /> : null}
                  </div>
                )}
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start animate-pulse w-full">
                <div className="bg-white p-8 rounded-[48px] shadow-2xl border border-red-50 flex items-center gap-8">
                  <div className="relative">
                    <Loader2 className="w-12 h-12 animate-spin text-[#B30000]" />
                    <div className="absolute inset-0 bg-red-100 rounded-full animate-ping opacity-10 scale-150"></div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[#B30000] font-black text-sm uppercase tracking-tighter italic mb-2">
                      {isPro ? "Hệ thống Gemini 3 Pro đang xử lý nghiệp vụ chuyên sâu..." : "Đang tổng hợp nội dung tham mưu nghiệp vụ..."}
                    </span>
                    <div className="flex items-center gap-3">
                       <div className="h-1.5 w-1.5 bg-red-400 rounded-full animate-bounce"></div>
                       <div className="h-1.5 w-1.5 bg-red-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                       <div className="h-1.5 w-1.5 bg-red-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                       <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic ml-1">Dữ liệu tham mưu 2025</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-20" />
          </div>
        )}
      </main>

      {/* Simple Text Footer - Removed Mic and Attachments */}
      <footer className="bg-white/80 backdrop-blur-xl border-t-2 border-slate-100 p-6 md:px-12 md:py-8 shadow-[0_-30px_100px_rgba(0,0,0,0.05)] z-40 w-full">
        <div className="w-full max-w-[1600px] mx-auto">
          <div className="relative group shadow-[0_20px_50px_rgba(0,0,0,0.08)] rounded-[40px]">
            <textarea 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} 
              placeholder="Nhập câu hỏi nghiệp vụ Xây dựng Đảng tại đây..." 
              className="w-full p-8 pr-24 rounded-[40px] border-2 border-slate-100 focus:ring-8 focus:ring-red-50 focus:border-[#B30000] focus:outline-none resize-none h-24 md:h-28 transition-all font-bold placeholder:text-slate-300 text-base md:text-lg scrollbar-hide bg-white" 
            />
            <div className="absolute right-4 bottom-4 flex gap-4">
              <button 
                onClick={() => handleSend()} 
                disabled={loading || !input.trim()} 
                className="p-5 bg-[#B30000] text-white rounded-3xl hover:brightness-110 transition-all shadow-2xl active:scale-90 disabled:bg-slate-200 disabled:shadow-none"
              >
                <Send className="w-7 h-7" />
              </button>
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-subtle { animation: bounce-subtle 4s infinite ease-in-out; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-scaleIn { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
};

export default App;
