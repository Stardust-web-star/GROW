import React, { useState } from 'react';
import { Smartphone, Download, Share2, Check, X, ShieldCheck, Zap, HardDrive, Wifi } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import growEmblem from '../assets/images/GROW_Emblem.png';

interface PwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PwaInstallModal: React.FC<PwaInstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'android' | 'ios'>(isIOS ? 'ios' : 'android');
  const [installing, setInstalling] = useState(false);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    setInstalling(true);
    try {
      const success = await install();
      if (success) {
        onClose();
      }
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 sm:p-6 shadow-2xl text-white overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with App Logo */}
        <div className="flex items-center gap-3.5 mb-4">
          <img
            src={growEmblem}
            alt="GROW Emblem"
            className="w-13 h-13 rounded-xl p-1 bg-slate-950/80 border border-emerald-500/40 shadow-md object-contain"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Aplikasi Mobile
              </span>
              {isInstalled && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Terpasang
                </span>
              )}
            </div>
            <h3 className="font-black text-lg text-white tracking-tight mt-0.5">
              Pasang GROW di HP Petugas
            </h3>
            <p className="text-xs text-slate-400">
              Akses cepat tanpa browser untuk inspeksi ROW &amp; Tiang PLN
            </p>
          </div>
        </div>

        {/* Benefit Badges */}
        <div className="grid grid-cols-3 gap-2 mb-4 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-center">
          <div className="flex flex-col items-center">
            <Zap className="w-4 h-4 text-amber-400 mb-1" />
            <span className="text-[10px] font-medium text-slate-300">Layar Penuh</span>
            <span className="text-[9px] text-slate-500">Tanpa URL bar</span>
          </div>
          <div className="flex flex-col items-center">
            <Wifi className="w-4 h-4 text-emerald-400 mb-1" />
            <span className="text-[10px] font-medium text-slate-300">Cache Cepat</span>
            <span className="text-[9px] text-slate-500">Peta termuat</span>
          </div>
          <div className="flex flex-col items-center">
            <HardDrive className="w-4 h-4 text-sky-400 mb-1" />
            <span className="text-[10px] font-medium text-slate-300">Ikon di Layar</span>
            <span className="text-[9px] text-slate-500">1x klik buka</span>
          </div>
        </div>

        {/* Direct One-Click Install Button if browser supports beforeinstallprompt */}
        {isInstallable && (
          <button
            onClick={handleInstallClick}
            disabled={installing}
            className="w-full mb-4 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-98"
          >
            <Download className="w-4 h-4" />
            <span>{installing ? 'Memproses Pemasangan...' : 'Install Sekarang ke Layar Utama'}</span>
          </button>
        )}

        {/* OS Platform Tabs */}
        <div className="flex gap-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800 mb-3">
          <button
            onClick={() => setActiveTab('android')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === 'android'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Android (Chrome)</span>
          </button>
          <button
            onClick={() => setActiveTab('ios')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === 'ios'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>iPhone / iPad (Safari)</span>
          </button>
        </div>

        {/* Step by step guide */}
        <div className="bg-slate-950/50 rounded-xl p-3.5 border border-slate-800 text-xs space-y-2.5">
          {activeTab === 'android' ? (
            <>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px] border border-emerald-500/30">
                  1
                </span>
                <p className="text-slate-300 leading-snug">
                  Buka aplikasi melalui browser <b>Google Chrome</b> di ponsel Android Anda.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px] border border-emerald-500/30">
                  2
                </span>
                <p className="text-slate-300 leading-snug">
                  Tekan ikon menu <b>titik tiga (⋮)</b> di pojok kanan atas browser Chrome.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px] border border-emerald-500/30">
                  3
                </span>
                <p className="text-slate-300 leading-snug">
                  Pilih opsi <b>"Tambahkan ke Layar Utama"</b> atau <b>"Install Aplikasi"</b> (Add to Home Screen).
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center shrink-0 text-[11px] border border-sky-500/30">
                  1
                </span>
                <p className="text-slate-300 leading-snug">
                  Buka tautan aplikasi di <b>Safari</b> di iPhone atau iPad.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center shrink-0 text-[11px] border border-sky-500/30">
                  2
                </span>
                <p className="text-slate-300 leading-snug">
                  Tekan tombol <b>Share / Bagikan</b> (ikon kotak dengan panah atas di bilah bawah).
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center shrink-0 text-[11px] border border-sky-500/30">
                  3
                </span>
                <p className="text-slate-300 leading-snug">
                  Gulir ke bawah dan pilih <b>"Tambah ke Layar Utama"</b> (<i>Add to Home Screen</i>).
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>PWA Standar Resmi PLN ULP Baguala</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
