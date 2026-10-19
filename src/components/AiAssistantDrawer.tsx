import React, { useState } from 'react';
import { getApiUrl } from '../utils/apiConfig';
import { Bot, X, Send, Sparkles, User, RefreshCw, BookOpen } from 'lucide-react';

interface AiAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({
  isOpen,
  onClose
}) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([
    {
      role: 'assistant',
      text: 'Halo! Saya Asisten AI Teknik Ketenagalistrikan PLN ULP Baguala. Ada yang bisa saya bantu terkait standar Ruang Bebas (ROW 3 Meter), keselamatan K3, atau penanganan tiang?'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (qText?: string) => {
    const question = qText || input;
    if (!question.trim() || loading) return;

    const userMsg = { role: 'user' as const, text: question };
    setMessages(prev => [...prev, userMsg]);
    if (!qText) setInput('');
    setLoading(true);

    try {
      const res = await fetch(getApiUrl('/api/ai/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', text: data.answer }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Maaf, gagal memproses pertanyaan AI. Periksa koneksi internet.' }]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    'Berapa standar jarak bebas kabel 20kV menurut Permen ESDM No 13?',
    'Bagaimana SOP tindakan jika kabel TR menyentuh atap ruko?',
    'Apa saja penyebab utama tiang beton di Passo mengalami miring?'
  ];

  return (
    <>
      <div 
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-slate-900 border-l border-slate-800 z-50 flex flex-col shadow-2xl text-slate-100 animate-in slide-in-from-right duration-300">
      
      {/* Header */}
      <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm text-white flex items-center gap-1.5">
              <span>Asisten GROW AI PLN</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-[10px] text-slate-400">GROW AI Technical Engine</div>
          </div>
        </div>

        <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div className={`p-3.5 rounded-2xl max-w-[85%] leading-relaxed ${
              m.role === 'user'
                ? 'bg-amber-500 text-slate-950 font-medium rounded-br-none'
                : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
            }`}>
              {m.text}
            </div>

            {m.role === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-slate-700 text-white flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-amber-400 text-xs italic">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>GROW AI sedang memikirkan jawaban teknis...</span>
          </div>
        )}
      </div>

      {/* Quick Prompt Chips */}
      <div className="p-3 bg-slate-950/80 border-t border-slate-800/80 text-[11px] space-y-1.5">
        <div className="text-[10px] text-slate-500 font-bold uppercase">Rekomendasi Pertanyaan:</div>
        <div className="flex flex-wrap gap-1.5">
          {quickPrompts.map((qp, i) => (
            <button
              key={i}
              onClick={() => handleSend(qp)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg text-left truncate max-w-full transition-all"
            >
              {qp}
            </button>
          ))}
        </div>
      </div>

      {/* Input Field */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
        <input
          type="text"
          placeholder="Tanyakan standar SPLN, ROW, K3..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1 bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs border border-slate-700 focus:outline-none focus:border-amber-500"
        />
        <button
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 p-2 rounded-xl disabled:opacity-50 font-bold transition-all"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      </div>
    </>
  );
};
