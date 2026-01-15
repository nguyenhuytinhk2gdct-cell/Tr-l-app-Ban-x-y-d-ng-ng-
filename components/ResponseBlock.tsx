
import React, { useState, useEffect, useRef } from 'react';
import { Info, Copy, Check, BookOpen, Quote, MessageSquare, ChevronRight, Volume2, Loader2, BrainCircuit } from 'lucide-react';
import { generateTTS, decodeBase64, decodeAudioData } from '../services/geminiService';

interface ResponseBlockProps {
  content: string;
  thinking?: string;
  onFollowUpClick?: (question: string) => void;
}

const ResponseBlock: React.FC<ResponseBlockProps> = ({ content, thinking, onFollowUpClick }) => {
  const [copied, setCopied] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [prefetchedAudio, setPrefetchedAudio] = useState<string | null>(null);
  const prefetchLock = useRef(false);

  // Phân tách nội dung theo cấu trúc headers mới
  const sections = content.split(/\*\*(NỘI DUNG THAM MƯU|CĂN CỨ TRI THỨC|CÂU HỎI GỢI Ý)\*\*/i);
  
  let mainContent = "";
  let sourceContent = "";
  let suggestionsRaw = "";

  for (let i = 1; i < sections.length; i += 2) {
    const header = sections[i].toUpperCase();
    const body = sections[i+1]?.trim();
    
    if (header.includes("NỘI DUNG")) mainContent = body;
    else if (header.includes("CĂN CỨ")) sourceContent = body;
    else if (header.includes("CÂU HỎI")) suggestionsRaw = body;
  }

  const textToSpeak = mainContent || content.trim();

  // Cải thiện tốc độ: Tải trước âm thanh ngay khi nội dung hiển thị xong
  useEffect(() => {
    if (textToSpeak && textToSpeak.length > 10 && !prefetchedAudio && !prefetchLock.current) {
      prefetchLock.current = true;
      const prefetch = async () => {
        try {
          const audioData = await generateTTS(textToSpeak);
          if (audioData) setPrefetchedAudio(audioData);
        } catch (err) {
          console.error("Prefetch TTS Error:", err);
          prefetchLock.current = false;
        }
      };
      prefetch();
    }
  }, [textToSpeak, prefetchedAudio]);

  const suggestions = suggestionsRaw 
    ? suggestionsRaw.split('\n')
        .map(s => s.replace(/^[-*•\d.\s]+/, '').trim())
        .filter(s => s.length > 5)
        .slice(0, 3)
    : [];

  const handleCopy = async () => {
    const shareText = `NGHIỆP VỤ BAN XÂY DỰNG ĐẢNG 2025:\n\n${content}`;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Lỗi khi sao chép:", err);
    }
  };

  const handlePlayTTS = async () => {
    if (playing) return;
    setPlaying(true);
    
    let audioData = prefetchedAudio;
    if (!audioData) {
      // Nếu chưa kịp prefetch, thực hiện ngay lập tức
      audioData = await generateTTS(textToSpeak);
    }

    if (audioData) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const buffer = await decodeAudioData(decodeBase64(audioData), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => setPlaying(false);
      source.start();
    } else {
      setPlaying(false);
    }
  };

  return (
    <div className="space-y-5 w-full animate-fadeIn pb-2">
      {/* Header Actions */}
      <div className="flex justify-between items-center px-1">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic flex items-center gap-1">
          <Info className="w-3 h-3" /> Phiếu tham mưu nghiệp vụ điện tử
        </span>
        <div className="flex gap-2">
          <button 
            onClick={handlePlayTTS}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-sm hover:shadow-md transition-all active:scale-90 border ${playing ? 'bg-red-50 border-red-200 text-[#B30000]' : 'bg-white border-blue-100 text-blue-700 hover:bg-blue-50'}`}
          >
            {playing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span className="text-[10px] font-black uppercase">{playing ? 'Đang phát' : 'Nghe'}</span>
          </button>
          <button 
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-100 rounded-full shadow-sm hover:shadow-md hover:bg-red-50 transition-all active:scale-90 text-[#B30000]"
          >
            {copied ? (
              <><Check className="w-3.5 h-3.5 text-green-600" /><span className="text-[10px] font-black uppercase text-green-600">Đã sao chép</span></>
            ) : (
              <><Copy className="w-3.5 h-3.5" /><span className="text-[10px] font-black uppercase">Sao chép</span></>
            )}
          </button>
        </div>
      </div>

      {/* Thinking Process (Pro Mode Only) */}
      {thinking && (
        <div className="bg-amber-50/30 border border-amber-100 rounded-2xl p-4 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <BrainCircuit className="w-4 h-4 text-amber-600" />
            <h4 className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Tiến trình suy luận (Pro)</h4>
          </div>
          <div className="text-gray-500 text-[11px] italic leading-relaxed whitespace-pre-wrap">
            {thinking}
          </div>
        </div>
      )}

      {/* Main Content Block */}
      <div className="bg-white border-l-4 border-[#B30000] shadow-xl rounded-r-3xl overflow-hidden transition-all border-y border-r border-gray-100">
        <div className="bg-red-50/50 px-4 py-3 border-b border-red-100 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#B30000]" />
          <h3 className="font-black text-[#B30000] uppercase tracking-tighter text-xs md:text-sm">
            Nội dung nghiệp vụ Ban Xây dựng Đảng
          </h3>
        </div>
        <div className="p-5 text-gray-800 leading-relaxed whitespace-pre-wrap text-sm sm:text-base font-medium">
          {mainContent || "Hệ thống đang tổng hợp nội dung..."}
        </div>
      </div>

      {/* Sources Block */}
      {sourceContent && (
        <div className="bg-white/60 backdrop-blur-sm border border-gray-200 rounded-[24px] p-4 transition-all shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Quote className="w-4 h-4 text-blue-700" />
            <h4 className="text-[11px] font-black text-blue-900 uppercase tracking-widest">Căn cứ quy định mới nhất</h4>
          </div>
          <div className="text-gray-600 text-xs md:text-sm italic leading-snug whitespace-pre-wrap pl-3 border-l-2 border-blue-200 ml-1">
            {sourceContent}
          </div>
        </div>
      )}

      {/* Interactive Suggestion Chips */}
      {suggestions.length > 0 && (
        <div className="pt-2 space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="h-px bg-gray-200 flex-1"></div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 px-2">
              <MessageSquare className="w-3 h-3 text-[#B30000]" /> Gợi ý nghiệp vụ liên quan
            </p>
            <div className="h-px bg-gray-200 flex-1"></div>
          </div>
          <div className="flex flex-col gap-2.5">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => onFollowUpClick?.(s)}
                className="flex items-center justify-between gap-3 text-left p-4 bg-white hover:bg-red-50 border border-gray-100 hover:border-red-200 rounded-2xl transition-all group active:scale-[0.97] shadow-sm hover:shadow-md"
              >
                <span className="text-xs md:text-sm text-gray-700 font-bold leading-tight group-hover:text-[#B30000]">
                  {s}
                </span>
                <div className="bg-red-50 text-[#B30000] p-1 rounded-lg group-hover:bg-[#B30000] group-hover:text-white transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResponseBlock;
