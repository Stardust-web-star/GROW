import React, { useState } from 'react';
import { ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import { SystemMetaState } from '../lib/firebase';
import { SyncStatusModal } from './SyncStatusModal';

interface SyncStatusBadgeProps {
  systemMeta: SystemMetaState | null;
  totalPoles: number;
  totalSpans: number;
  isCloudConnected: boolean;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
  systemMeta,
  totalPoles,
  totalSpans,
  isCloudConnected
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-teal-500/40 hover:border-teal-400 text-slate-200 hover:text-white text-xs font-bold transition-all cursor-pointer shadow-inner btn-tactile group shrink-0"
        title="Klik untuk melihat status sinkronisasi dua arah real-time antara Google AI Studio & Vercel"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <ArrowLeftRight className="w-3.5 h-3.5 text-teal-400 group-hover:text-amber-400 transition-colors" />
        <span className="hidden xl:inline text-teal-200">Sync:</span>
        <span className="text-[11px] font-black text-amber-300">Vercel ⇄ AI Studio</span>
      </button>

      <SyncStatusModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        systemMeta={systemMeta}
        totalPoles={totalPoles}
        totalSpans={totalSpans}
        isCloudConnected={isCloudConnected}
      />
    </>
  );
};
