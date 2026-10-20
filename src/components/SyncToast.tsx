import React, { useEffect, useState } from 'react';
import { ArrowRightLeft, CheckCircle2, Zap, X } from 'lucide-react';
import { SyncEvent, getCurrentClientSource, getClientLabel } from '../lib/realtimeSync';

interface SyncToastProps {
  event: SyncEvent | null;
  onClose: () => void;
}

export const SyncToast: React.FC<SyncToastProps> = ({ event, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (event) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onClose, 300);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [event, onClose]);

  if (!event || !visible) return null;

  const currentSource = getCurrentClientSource();
  const isFromPeer = event.source !== currentSource;
  const peerName = getClientLabel(event.source);

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full animate-bounce-short">
      <div className="bg-slate-900/95 backdrop-blur-md border border-teal-500/40 rounded-xl p-3.5 shadow-2xl flex items-start gap-3 text-xs text-slate-100">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          isFromPeer ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
        }`}>
          <ArrowRightLeft className="w-4 h-4 animate-pulse" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="font-bold text-white flex items-center gap-1.5">
              <span>Sinkronisasi Dua Arah</span>
              {isFromPeer && (
                <span className="bg-amber-400/20 text-amber-300 text-[9px] px-1.5 py-0.2 rounded font-black border border-amber-400/30">
                  DARI {event.source.toUpperCase()}
                </span>
              )}
            </span>
            <button
              onClick={() => {
                setVisible(false);
                setTimeout(onClose, 300);
              }}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-slate-300 line-clamp-2 leading-relaxed">
            {event.summary}
          </p>
          <div className="mt-1 text-[10px] text-teal-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Peta dan data telah diperbarui secara otomatis</span>
          </div>
        </div>
      </div>
    </div>
  );
};
