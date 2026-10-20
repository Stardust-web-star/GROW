import React, { useState } from 'react';
import { 
  Cloud, 
  CheckCircle2, 
  RefreshCw, 
  Radio, 
  ArrowLeftRight, 
  Globe, 
  X, 
  Copy, 
  Check, 
  Send, 
  Zap,
  ShieldCheck,
  Server
} from 'lucide-react';
import { getCurrentEnvironmentTag, SystemMetaState, touchSystemMeta } from '../lib/firebase';
import firebaseConfigRaw from '../../firebase-applet-config.json';

interface SyncStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemMeta: SystemMetaState | null;
  totalPoles: number;
  totalSpans: number;
  isCloudConnected: boolean;
}

export const SyncStatusModal: React.FC<SyncStatusModalProps> = ({
  isOpen,
  onClose,
  systemMeta,
  totalPoles,
  totalSpans,
  isCloudConnected
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [pingSuccess, setPingSuccess] = useState(false);

  if (!isOpen) return null;

  const currentEnv = getCurrentEnvironmentTag();

  const handleCopy = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSendTestPing = async () => {
    setIsPinging(true);
    setPingSuccess(false);
    try {
      await touchSystemMeta({
        lastAction: `Uji Ping Sinkronisasi Dua Arah dari ${currentEnv}`,
        lastSource: currentEnv,
        lastUpdated: new Date().toISOString()
      });
      setPingSuccess(true);
      setTimeout(() => setPingSuccess(false), 3000);
    } catch (err) {
      console.error('Error sending ping:', err);
    } finally {
      setIsPinging(false);
    }
  };

  const vercelEnvSnippet = `VITE_FIREBASE_PROJECT_ID=${firebaseConfigRaw.projectId}
VITE_FIREBASE_DATABASE_ID=${firebaseConfigRaw.firestoreDatabaseId}
VITE_FIREBASE_API_KEY=${firebaseConfigRaw.apiKey}
VITE_FIREBASE_AUTH_DOMAIN=${firebaseConfigRaw.authDomain}
VITE_FIREBASE_APP_ID=${firebaseConfigRaw.appId}
VITE_FIREBASE_STORAGE_BUCKET=${firebaseConfigRaw.storageBucket}
VITE_FIREBASE_MESSAGING_SENDER_ID=${firebaseConfigRaw.messagingSenderId}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-teal-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-teal-500/20 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
              <ArrowLeftRight className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                Sinkronisasi Dua Arah Real-Time
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                  Cloud Live
                </span>
              </h2>
              <p className="text-xs text-slate-400">Google AI Studio ⇄ Vercel Deployment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Status Banner */}
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/30 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-emerald-300 text-sm">
                Sistem Terhubung ke Cloud Firestore Terpusat
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Setiap perubahan seperti <strong>tarik kabel baru</strong>, <strong>perubahan kondisi atau jarak ROW tiang</strong>, penambahan titik tiang, dan pembuatan SPK akan langsung terupdate <strong>secara dua arah dalam hitungan milidetik</strong> antara Google AI Studio dan aplikasi Vercel.
              </p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-teal-400" />
                Lingkungan Aktif Saat Ini
              </div>
              <div className="text-sm font-black text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                {currentEnv}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-amber-400" />
                Cloud Database ID
              </div>
              <div className="text-xs font-mono font-bold text-amber-300 truncate" title={firebaseConfigRaw.firestoreDatabaseId}>
                {firebaseConfigRaw.firestoreDatabaseId}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-teal-400" />
                Total Objek Tersinkronisasi
              </div>
              <div className="text-sm font-bold text-slate-200">
                <span className="text-amber-400 font-black">{totalPoles.toLocaleString('id-ID')}</span> Tiang / <span className="text-teal-300 font-black">{totalSpans.toLocaleString('id-ID')}</span> Bentangan Kabel
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                Waktu Sinkronisasi Terakhir
              </div>
              <div className="text-xs font-medium text-slate-300">
                {systemMeta?.lastUpdated ? new Date(systemMeta.lastUpdated).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Real-time aktif'}
              </div>
            </div>
          </div>

          {/* Last Activity Card */}
          {systemMeta?.lastAction && (
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-teal-500/20 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-[11px] font-semibold text-teal-400 uppercase tracking-wider">Aktivitas Terakhir Sinkronisasi:</div>
                <div className="text-xs font-bold text-white">{systemMeta.lastAction}</div>
                {systemMeta.lastSource && (
                  <div className="text-[10px] text-slate-400">Sumber: <span className="text-amber-300 font-semibold">{systemMeta.lastSource}</span></div>
                )}
              </div>
            </div>
          )}

          {/* Test Real-Time Ping Button */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <div className="font-bold text-white text-xs">Uji Komunikasi Dua Arah Langsung</div>
              <div className="text-[11px] text-slate-400">Kirim ping dari dashboard ini untuk memverifikasi penerimaan di dashboard lainnya</div>
            </div>
            <button
              onClick={handleSendTestPing}
              disabled={isPinging}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer whitespace-nowrap active:scale-95 disabled:opacity-50"
            >
              {pingSuccess ? (
                <>
                  <Check className="w-4 h-4 text-slate-950" />
                  <span>Terkirim ke Cloud!</span>
                </>
              ) : (
                <>
                  <Send className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
                  <span>Kirim Tes Ping Real-Time</span>
                </>
              )}
            </button>
          </div>

          {/* Vercel Environment Variables Helper */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Variabel Lingkungan untuk Vercel (Opsional / Terbundel Otomatis):
              </span>
              <button
                onClick={() => handleCopy(vercelEnvSnippet, 'env')}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer font-semibold"
              >
                {copiedKey === 'env' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'env' ? 'Tersalin!' : 'Salin Semua ENV'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-teal-300 overflow-x-auto select-all">
              {vercelEnvSnippet}
            </pre>
            <p className="text-[11px] text-slate-400 leading-normal">
              *Catatan: Konfigurasi Cloud ini sudah otomatis tertanam dalam berkas <code>firebase-applet-config.json</code> proyek Anda, sehingga saat Anda deploy ke Vercel, aplikasi langsung terhubung secara otomatis ke Cloud Firestore yang sama tanpa pengaturan manual tambahan.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
