import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, Globe, Radio, Layers, Zap, Info, X, ExternalLink, ArrowRightLeft, ShieldCheck } from 'lucide-react';
import { SyncEvent, getCurrentClientSource, getClientLabel } from '../lib/realtimeSync';

interface SyncStatusWidgetProps {
  isCloudConnected: boolean;
  activeEvents: SyncEvent[];
  lastSyncTime: Date | null;
  syncedSpansCount: number;
  syncedPolesCount: number;
  onManualRefresh: () => void;
  isRefreshing?: boolean;
}

export const SyncStatusWidget: React.FC<SyncStatusWidgetProps> = ({
  isCloudConnected,
  activeEvents,
  lastSyncTime,
  syncedSpansCount,
  syncedPolesCount,
  onManualRefresh,
  isRefreshing = false
}) => {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const currentSource = getCurrentClientSource();
  const currentPlatformLabel = currentSource === 'vercel' ? 'Vercel Deployment' : 'Google AI Studio';
  const partnerPlatformLabel = currentSource === 'vercel' ? 'Google AI Studio' : 'Vercel Deployment';

  const formatTimeAgo = (date: Date | null) => {
    if (!date) return 'Baru saja terhubung';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 5) return 'Baru saja (Real-time)';
    if (seconds < 60) return `${seconds} detik lalu`;
    const mins = Math.floor(seconds / 60);
    return `${mins} menit lalu`;
  };

  return (
    <>
      {/* Sleek Floating or Header Status Bar */}
      <div className="bg-slate-900/90 backdrop-blur-md border-b border-teal-500/20 px-3 sm:px-6 py-1.5 flex items-center justify-between text-xs text-slate-300 gap-2 overflow-x-auto shadow-inner select-none">
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex items-center justify-center">
            <span className={`w-2.5 h-2.5 rounded-full ${isCloudConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {isCloudConnected && (
              <span className="absolute w-4 h-4 rounded-full bg-emerald-400/40 animate-ping" />
            )}
          </div>
          
          <div className="flex items-center gap-1.5 font-medium">
            <span className="text-white font-bold flex items-center gap-1">
              <ArrowRightLeft className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span>Sinkronisasi Dua Arah:</span>
            </span>
            <span className="text-emerald-400 font-semibold hidden sm:inline">
              Google AI Studio ⇄ Vercel
            </span>
            <span className="text-slate-400 text-[11px] hidden md:inline">
              (Live Cloud Real-Time)
            </span>
          </div>

          <span className="text-slate-600 hidden sm:inline">•</span>

          {/* Current Source Badge */}
          <div className="hidden lg:flex items-center gap-1 text-[11px] bg-slate-800/90 px-2 py-0.5 rounded border border-slate-700/60 text-slate-300">
            <span className="text-slate-400">Node:</span>
            <span className={`font-bold ${currentSource === 'vercel' ? 'text-amber-300' : 'text-teal-300'}`}>
              {currentPlatformLabel}
            </span>
          </div>
        </div>

        {/* Action, Stats & Details Button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden xl:flex items-center gap-2 text-[11px] text-slate-400">
            <span>Kabel Cloud: <strong className="text-teal-300">{syncedSpansCount}</strong></span>
            <span>•</span>
            <span>Update Tiang: <strong className="text-amber-300">{syncedPolesCount}</strong></span>
            <span>•</span>
            <span className="text-slate-400">{formatTimeAgo(lastSyncTime)}</span>
          </div>

          <button
            onClick={onManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 text-[11px] font-semibold border border-teal-500/30 transition-all cursor-pointer disabled:opacity-50"
            title="Tarik pembaruan data terbaru secara manual"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sinkronkan</span>
          </button>

          <button
            onClick={() => setShowDetailModal(true)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 text-[11px] font-semibold border border-teal-500/30 transition-all cursor-pointer"
          >
            <Info className="w-3 h-3" />
            <span>Detail Status</span>
          </button>
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-teal-500/30 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-5 py-4 bg-slate-950 border-b border-teal-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-400">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Status Sinkronisasi Dua Arah</h3>
                  <p className="text-xs text-teal-300/80">Google AI Studio ⇄ Vercel Dashboard</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 overflow-y-auto text-sm text-slate-300">
              {/* Architecture Explanation Card */}
              <div className="p-4 rounded-xl bg-teal-950/30 border border-teal-500/30 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Koneksi Real-Time Cloud Aktif</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  Sistem GIS PLN ULP Baguala sekarang menggunakan sinkronisasi database cloud real-time. Setiap kali Anda melakukan:
                </p>
                <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside pl-1">
                  <li><strong>Tarik kabel baru</strong> (drag & drop antar tiang)</li>
                  <li><strong>Ubah kondisi kabel</strong> (andongan kendor, isolasi rusak, jenis kabel)</li>
                  <li><strong>Ubah kondisi tiang</strong> (miring/retak, korosi kritis, jarak ROW)</li>
                  <li><strong>Input inspeksi lapangan atau SPK</strong></li>
                </ul>
                <p className="text-xs text-teal-200 font-medium pt-1">
                  Maka data di dashboard Vercel maupun dashboard Google AI Studio akan <strong>otomatis langsung terupdate seketika</strong> tanpa perlu reload halaman!
                </p>
              </div>

              {/* Status Comparison Table */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-[11px] font-medium text-slate-400 mb-1">Node Aplikasi Saat Ini</div>
                  <div className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    {currentPlatformLabel}
                  </div>
                  <div className="text-[10px] text-teal-400/80 mt-1">Status: Terhubung & Aktif</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-[11px] font-medium text-slate-400 mb-1">Partner Sinkronisasi</div>
                  <div className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    {partnerPlatformLabel}
                  </div>
                  <div className="text-[10px] text-teal-400/80 mt-1">Status: Terhubung Otomatis</div>
                </div>
              </div>

              {/* Recent Realtime Sync Feed */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Aktivitas Sinkronisasi Terkini</h4>
                  <span className="text-[10px] text-slate-400">Live listener</span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {activeEvents.length === 0 ? (
                    <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800/80 text-center text-xs text-slate-400">
                      Menunggu aktivitas baru... Lakukan interaksi tarik kabel atau update kondisi tiang untuk melihat sinkronisasi langsung di sini.
                    </div>
                  ) : (
                    activeEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start gap-2">
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${evt.source === 'vercel' ? 'bg-amber-400' : 'bg-teal-400'}`} />
                          <div>
                            <div className="font-semibold text-white">{evt.summary}</div>
                            <div className="text-[10px] text-slate-400">
                              Asal: <strong className={evt.source === 'vercel' ? 'text-amber-300' : 'text-teal-300'}>{getClientLabel(evt.source)}</strong>
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {new Date(evt.timestamp).toLocaleTimeString('id-ID')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-slate-950 border-t border-teal-500/20 flex items-center justify-between">
              <button
                onClick={onManualRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-xs font-bold cursor-pointer transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Paksa Muat Ulang Sinkronisasi</span>
              </button>

              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
