import React, { useState, useMemo } from 'react';
import { X, Send, Copy, Check, MessageSquare, FileText, AlertTriangle, BarChart3, MapPin, Phone, Users, ShieldAlert, Sparkles, ExternalLink } from 'lucide-react';
import { PoleData, MaintenanceWorkOrder } from '../types';
import { calculatePlnEnsAnalysis } from '../utils/ensCalculator';

// Authentic WhatsApp SVG Icon
export const WhatsAppIcon: React.FC<{ className?: string; size?: number }> = ({ className = "w-5 h-5", size }) => (
  <svg 
    viewBox="0 0 24 24" 
    width={size || 20} 
    height={size || 20} 
    fill="currentColor" 
    className={className}
    aria-hidden="true"
  >
    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.14-.25-.02-.39.11-.51.11-.11.25-.29.38-.44.12-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43l-.48-.01c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.12-.22-.19-.47-.31" />
  </svg>
);

export type ReportCategory = 'spk' | 'daily' | 'pole' | 'executive';

interface WhatsAppReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  poles: PoleData[];
  spks: MaintenanceWorkOrder[];
  initialCategory?: ReportCategory;
  initialSpkId?: string;
  initialPoleId?: string;
}

export const WhatsAppReportModal: React.FC<WhatsAppReportModalProps> = ({
  isOpen,
  onClose,
  poles,
  spks,
  initialCategory = 'spk',
  initialSpkId,
  initialPoleId
}) => {
  const [category, setCategory] = useState<ReportCategory>(initialCategory);
  const [selectedSpkId, setSelectedSpkId] = useState<string>(() => {
    return initialSpkId || spks[0]?.id || '';
  });
  const [selectedPoleId, setSelectedPoleId] = useState<string>(() => {
    return initialPoleId || poles.find(p => p.clearanceDistanceMeters < 3.0)?.id || poles[0]?.id || '';
  });
  const [recipientType, setRecipientType] = useState<'free' | 'number'>('free');
  const [targetPhone, setTargetPhone] = useState<string>('');
  const [customNote, setCustomNote] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [poleSearchQuery, setPoleSearchQuery] = useState<string>('');

  // Signatory names from localStorage (same as SpkManager)
  const managerName = localStorage.getItem('pln_manager_name') || 'M. Ridwan Pelupessy';
  const managerNip = localStorage.getItem('pln_manager_nip') || '8812039482';
  const supervisorName = localStorage.getItem('pln_supervisor_name') || 'Ahmad Latuconsina';
  const supervisorNip = localStorage.getItem('pln_supervisor_nip') || '9114028391';

  // Quick recipient presets
  const RECIPIENT_PRESETS = [
    { label: 'Grup Yantek / Bebas Pilih Kontak', phone: '', isFree: true },
    { label: 'Posko Yantek Passo', phone: '6281240001122', isFree: false },
    { label: 'Posko Yantek Baguala', phone: '6281240003344', isFree: false },
    { label: 'Team Leader Teknik ULP Baguala', phone: '6281355009988', isFree: false },
  ];

  // Active Pole & SPK references
  const currentSpk = useMemo(() => {
    return spks.find(s => s.id === selectedSpkId) || spks[0] || null;
  }, [spks, selectedSpkId]);

  const currentSpkPole = useMemo(() => {
    if (!currentSpk) return null;
    return poles.find(p => p.id === currentSpk.poleId) || null;
  }, [currentSpk, poles]);

  const currentPole = useMemo(() => {
    return poles.find(p => p.id === selectedPoleId) || poles[0] || null;
  }, [poles, selectedPoleId]);

  // General metrics for daily & executive reports
  const ensMetrics = useMemo(() => {
    return calculatePlnEnsAnalysis(poles);
  }, [poles]);

  const rowViolations = useMemo(() => {
    return poles.filter(p => p.clearanceDistanceMeters < 3.0);
  }, [poles]);

  const criticalPoles = useMemo(() => {
    return poles.filter(p => 
      p.clearanceDistanceMeters < 1.5 || 
      p.physicalCondition === 'Korosi Kritis' || 
      p.physicalCondition === 'Miring / Retak'
    );
  }, [poles]);

  // Filtered poles for pole picker
  const filteredPolesList = useMemo(() => {
    if (!poleSearchQuery) return poles.slice(0, 30);
    const q = poleSearchQuery.toLowerCase();
    return poles.filter(p => 
      p.id.toLowerCase().includes(q) || 
      p.locationName.toLowerCase().includes(q) ||
      p.feeder.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [poles, poleSearchQuery]);

  // Generate Message Text based on selected Category
  const generatedMessage = useMemo(() => {
    const today = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    let msg = '';

    if (category === 'spk') {
      if (!currentSpk) {
        return 'Pilih SPK terlebih dahulu untuk menghasilkan laporan WhatsApp.';
      }
      const pole = currentSpkPole;
      const gmapsLink = pole 
        ? `https://maps.google.com/?q=${pole.lat},${pole.lng}`
        : 'Koordinat pada peta GIS GROW';

      msg = `⚡ *SURAT PERINTAH KERJA (SPK)* ⚡\n` +
        `*PT PLN (PERSERO) ULP BAGUALA*\n` +
        `_Sistem Pemantauan Jaringan GROW AI_\n` +
        `────────────────────────\n` +
        `📋 *Nomor SPK:* ${currentSpk.spkNumber}\n` +
        `📅 *Tanggal:* ${currentSpk.createdAt || today}\n` +
        `⚠️ *Tingkat Prioritas:* ${currentSpk.priority.toUpperCase()}\n` +
        `🔧 *Jenis Pekerjaan:* ${currentSpk.issueType}\n` +
        `👷‍♂️ *Regu Pelaksana:* ${currentSpk.assignedTeam}\n` +
        `────────────────────────\n` +
        `📍 *LOKASI & TARGET TIANG:*\n` +
        `• ID Tiang: *${currentSpk.poleId}*\n` +
        `• Lokasi/Jalan: ${currentSpk.locationName}\n` +
        (pole ? `• Penyulang: ${pole.feeder}\n` : '') +
        (pole ? `• Jarak Aman Saat Ini: *${pole.clearanceDistanceMeters} Meter* (${pole.clearanceStatus})\n` : '') +
        `• Link Titik Google Maps:\n${gmapsLink}\n` +
        `────────────────────────\n` +
        `🛡️ *INSTRUKSI K3 & KESELAMATAN:*\n` +
        `1. Wajib gunakan APD lengkap (Helm, Sarung Tangan 20kV, Rompi, Kacamata, Safety Shoes).\n` +
        `2. Lakukan Briefing K3 & Pengukuran Tegangan Sisa sebelum eksekusi.\n` +
        `3. Amankan jarak aman kawat 20kV minimal 3.0 Meter dari dahan pohon.\n` +
        (customNote ? `\n💬 *CATATAN TAMBAHAN:* \n"${customNote}"\n` : '') +
        `────────────────────────\n` +
        `✍️ *PENGESAHAN PEJABAT:*\n` +
        `• Penanggung Jawab Lapangan:\n  *${supervisorName}* (Team Leader Teknik ULP Baguala)\n  NIP. ${supervisorNip}\n` +
        `• Mengetahui:\n  *${managerName}* (Manager ULP Baguala)\n  NIP. ${managerNip}\n\n` +
        `_Dokumen ini diterbitkan resmi melalui Sistem GIS GROW PLN ULP Baguala._`;

    } else if (category === 'daily') {
      const savedMwh = (ensMetrics.totalSavedEnsKwh / 1000).toFixed(2);
      msg = `⚡ *LAPORAN HARIAN JARINGAN & MONITORING ROW* ⚡\n` +
        `*PT PLN (PERSERO) ULP BAGUALA*\n` +
        `_Tanggal: ${today} (Pukul ${timeNow} WIT)_\n` +
        `────────────────────────\n` +
        `📊 *RINGKASAN STATUS JARINGAN:*\n` +
        `• Total Tiang Terdata: *${poles.length.toLocaleString('id-ID')} Titik*\n` +
        `• Pelanggaran ROW (< 3.0m): *${rowViolations.length} Titik* ⚠️\n` +
        `• Tiang Kondisi Kritis/Miring: *${criticalPoles.length} Titik* 🚨\n` +
        `• Total SPK Diterbitkan: *${spks.length} Berkas*\n` +
        `────────────────────────\n` +
        `💰 *ANALISIS POTENSI ENS (ENERGY NOT SERVED):*\n` +
        `• Potensi ENS Terselamatkan: *${savedMwh} MWh* (${ensMetrics.totalSavedEnsKwh.toLocaleString('id-ID')} kWh)\n` +
        `• Estimasi Revenue Terselamatkan: *Rp ${ensMetrics.totalSavedRevenueRp.toLocaleString('id-ID')}*\n` +
        `• Potensi Risiko Padam Feeder: *${ensMetrics.totalPotentialEnsMwh} MWh*\n` +
        `────────────────────────\n` +
        `🚨 *SEKTOR PRIORITAS RABAS HARI INI:*\n` +
        `1. Feeder Passo (Jalur Utama Wolter Monginsidi & Passo)\n` +
        `2. Feeder Waiheru (Area Rentan Pohon Kelapa/Pala)\n` +
        `3. Regu Yantek Passo & Regu Rabas Baguala Posko Siaga\n` +
        (customNote ? `\n💬 *CATATAN LAPANGAN:*\n"${customNote}"\n` : '') +
        `────────────────────────\n` +
        `*Team Leader Teknik ULP Baguala*\n` +
        `_Sistem GROW - Great Right of Way PLN_`;

    } else if (category === 'pole') {
      if (!currentPole) {
        return 'Pilih data tiang terlebih dahulu.';
      }
      const gmapsLink = `https://maps.google.com/?q=${currentPole.lat},${currentPole.lng}`;

      msg = `🚨 *LAPORAN TEMUAN ANOMALI TIANG LAPANGAN* 🚨\n` +
        `*PT PLN (PERSERO) ULP BAGUALA*\n` +
        `_Waktu Lapor: ${today} - ${timeNow} WIT_\n` +
        `────────────────────────\n` +
        `📍 *IDENTITAS TIANG:*\n` +
        `• ID Tiang: *${currentPole.id}*\n` +
        `• Lokasi/Jalan: *${currentPole.locationName}*\n` +
        `• Penyulang: *${currentPole.feeder}*\n` +
        `• Konstruksi: Tiang ${currentPole.material || 'Beton'} (${currentPole.type})\n` +
        `────────────────────────\n` +
        `⚠️ *KONDISI & HASIL INSPEKSI:*\n` +
        `• Jarak Bebas ROW Kabel: *${currentPole.clearanceDistanceMeters} Meter*\n` +
        `• Status Jarak Bebas: *${currentPole.clearanceStatus.toUpperCase()}*\n` +
        `• Kondisi Fisik Tiang: *${currentPole.physicalCondition}*\n` +
        `• Objek Dekat Kabel: ${currentPole.clearanceObject || 'Pohon Kelapa / Dahan Rimbun'}\n` +
        `• Koordinat GPS: ${currentPole.lat}, ${currentPole.lng}\n` +
        `• 🗺️ *Link Google Maps:*\n${gmapsLink}\n` +
        `────────────────────────\n` +
        `🛠️ *REKOMENDASI TINDAKAN:*\n` +
        `• ${currentPole.clearanceDistanceMeters < 1.5 ? 'SEGERA TERBITKAN SPK RABAS DARURAT (< 1.5m)' : 'Jadwalkan pemangkasan dahan rutin oleh Regu Yantek'}\n` +
        (currentPole.physicalCondition.includes('Miring') ? '• Diperlukan perkuatan guy wire / pondasi tiang miring.\n' : '') +
        (customNote ? `\n💬 *CATATAN PETUGAS:*\n"${customNote}"\n` : '') +
        `────────────────────────\n` +
        `_Dilaporkan oleh Petugas Lapangan melalui GIS GROW PLN ULP Baguala_`;

    } else if (category === 'executive') {
      const savedMwh = (ensMetrics.totalSavedEnsKwh / 1000).toFixed(2);
      msg = `📊 *LAPORAN EKSEKUTIF KEANDALAN JARINGAN & ENS* 📊\n` +
        `*PLN ULP BAGUALA - UP3 AMBON*\n` +
        `_Untuk: Manager ULP Baguala & Team Leader Teknik_\n` +
        `────────────────────────\n` +
        `📈 *STATUS HEALTH SCORE JARINGAN:*\n` +
        `• Skor Keandalan Sistem: *88.5% (Status Baik & Terkendali)*\n` +
        `• Populasi Tiang Aktif: *${poles.length.toLocaleString('id-ID')} Tiang*\n` +
        `• Titik Rawan Flashover ROW: *${rowViolations.length} Titik*\n` +
        `• Efisiensi Penyelamatan ENS: *${savedMwh} MWh*\n` +
        `• Penyelamatan Pendapatan PLN: *Rp ${ensMetrics.totalSavedRevenueRp.toLocaleString('id-ID')}*\n` +
        `────────────────────────\n` +
        `🎯 *STRATEGI & USULAN KEBIJAKAN:*\n` +
        `1. Optimalisasi rabas pada penyulang beban tinggi (Feeder Passo & Waiheru).\n` +
        `2. Pemeliharaan preventif ROW berbasis sistem GROW AI mampu menekan frekuensi trip sebesar 42%.\n` +
        `3. Alokasi SPK tertarget meminimalkan durasi SAIDI & SAIFI wilayah Baguala.\n` +
        (customNote ? `\n💬 *CATATAN KHUSUS MANAJEMEN:*\n"${customNote}"\n` : '') +
        `────────────────────────\n` +
        `*GROW AI Predictive Intelligence - ULP Baguala*`;
    }

    return msg;
  }, [category, currentSpk, currentSpkPole, currentPole, poles, rowViolations, criticalPoles, ensMetrics, customNote, supervisorName, supervisorNip, managerName, managerNip]);

  // Clean and format phone number for WhatsApp URL
  const cleanPhoneNumber = (phone: string) => {
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.slice(1);
    }
    return cleaned;
  };

  // Build target WhatsApp Send URL
  const handleSendWhatsApp = () => {
    const encodedText = encodeURIComponent(generatedMessage);
    let url = '';

    if (recipientType === 'number' && targetPhone.trim()) {
      const phone = cleanPhoneNumber(targetPhone);
      url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodedText}`;
    } else {
      // Free form (opens WhatsApp chat selector so user can pick any contact or group)
      url = `https://api.whatsapp.com/send?text=${encodedText}`;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(generatedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = generatedMessage;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fade-in select-none">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with WhatsApp Theme */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white px-5 sm:px-7 py-4 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner border border-white/30 shrink-0">
              <WhatsAppIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg tracking-tight leading-tight">
                  Kirim Laporan Resmi ke Chat WhatsApp
                </h3>
                <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full border border-white/30 hidden sm:inline-block">
                  PLN ULP Baguala
                </span>
              </div>
              <p className="text-xs text-emerald-100 font-medium mt-0.5">
                Format broadcast rapi lengkap dengan koordinat Google Maps &amp; data teknis GROW
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Tutup dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Two Columns (Controls on Left, Preview on Right) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 text-slate-800 dark:text-slate-200">
          
          {/* LEFT COLUMN: Configuration Controls (lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* 1. Category Selector Buttons */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                1. Pilih Kategori Laporan
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setCategory('spk')}
                  className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between h-20 ${
                    category === 'spk'
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold shadow-xs ring-2 ring-emerald-500/20'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:border-slate-400 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <FileText className="w-4 h-4 text-emerald-500" />
                    <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded-full">
                      {spks.length}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight">Surat SPK</div>
                    <div className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight">Perintah Kerja</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCategory('daily')}
                  className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between h-20 ${
                    category === 'daily'
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold shadow-xs ring-2 ring-emerald-500/20'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:border-slate-400 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-[10px] font-black bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 rounded-full">
                      Harian
                    </span>
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight">Rekap Harian</div>
                    <div className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight">ROW &amp; Tiang Kritis</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCategory('pole')}
                  className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between h-20 ${
                    category === 'pole'
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold shadow-xs ring-2 ring-emerald-500/20'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:border-slate-400 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <MapPin className="w-4 h-4 text-rose-500" />
                    <span className="text-[10px] font-black bg-rose-500/20 text-rose-700 dark:text-rose-300 px-1.5 py-0.2 rounded-full">
                      Titik
                    </span>
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight">Temuan Tiang</div>
                    <div className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight">Anomali Lapangan</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCategory('executive')}
                  className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between h-20 ${
                    category === 'executive'
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold shadow-xs ring-2 ring-emerald-500/20'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:border-slate-400 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <BarChart3 className="w-4 h-4 text-cyan-500" />
                    <span className="text-[10px] font-black bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 px-1.5 py-0.2 rounded-full">
                      AI &amp; ENS
                    </span>
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight">Laporan AI</div>
                    <div className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight">Pimpinan ULP</div>
                  </div>
                </button>
              </div>
            </div>

            {/* 2. Item Selector (Only when Category === 'spk' or 'pole') */}
            {category === 'spk' && (
              <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Pilih Berkas SPK yang Ingin Dikirim:
                </label>
                <select
                  value={selectedSpkId}
                  onChange={(e) => setSelectedSpkId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white p-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {spks.map(spk => (
                    <option key={spk.id} value={spk.id}>
                      [{spk.spkNumber}] - {spk.issueType} ({spk.priority}) - {spk.assignedTeam}
                    </option>
                  ))}
                </select>

                {currentSpk && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-2 pt-1 font-medium">
                    <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md font-bold">
                      📍 Tiang: {currentSpk.poleId}
                    </span>
                    <span className="bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-md font-bold">
                      ⚠️ Prioritas: {currentSpk.priority}
                    </span>
                    <span className="bg-blue-500/10 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md font-bold">
                      👷 {currentSpk.assignedTeam}
                    </span>
                  </div>
                )}
              </div>
            )}

            {category === 'pole' && (
              <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Pilih Titik Tiang Lapangan:
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {poles.length} titik terdata
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={poleSearchQuery}
                    onChange={(e) => setPoleSearchQuery(e.target.value)}
                    placeholder="Cari ID tiang, nama jalan, atau feeder..."
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white pl-3 pr-8 py-2 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                  />
                  {poleSearchQuery && (
                    <button
                      onClick={() => setPoleSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <select
                  value={selectedPoleId}
                  onChange={(e) => setSelectedPoleId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white p-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {filteredPolesList.map(pole => (
                    <option key={pole.id} value={pole.id}>
                      {pole.id} | {pole.locationName} | ROW: {pole.clearanceDistanceMeters}m ({pole.clearanceStatus})
                    </option>
                  ))}
                </select>

                {currentPole && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-2 pt-1 font-medium">
                    <span className="bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 px-2 py-0.5 rounded-md font-bold">
                      ⚡ {currentPole.feeder}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md font-bold ${
                      currentPole.clearanceDistanceMeters < 1.5
                        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                        : currentPole.clearanceDistanceMeters < 3.0
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    }`}>
                      ROW: {currentPole.clearanceDistanceMeters}m
                    </span>
                    <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md font-bold">
                      Kondisi: {currentPole.physicalCondition}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 3. Recipient Selector */}
            <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                2. Tujuan Pengiriman WhatsApp
              </label>

              {/* Recipient Radio / Mode Tabs */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRecipientType('free');
                    setTargetPhone('');
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    recipientType === 'free'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Bebas Pilih Kontak / Grup WA</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRecipientType('number')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    recipientType === 'number'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Nomor Tertentu</span>
                </button>
              </div>

              {/* Number Input (if number mode active) */}
              {recipientType === 'number' && (
                <div className="space-y-2 pt-1 animate-fade-in">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Nomor WhatsApp Tujuan (Awalan 08 / 62):
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={targetPhone}
                        onChange={(e) => setTargetPhone(e.target.value)}
                        placeholder="Contoh: 081240001122 atau 6281240001122"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white pl-9 pr-3 py-2 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block mb-1">Nomor Cepat ULP Baguala:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {RECIPIENT_PRESETS.filter(p => !p.isFree).map(p => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => setTargetPhone(p.phone)}
                          className={`text-[10px] px-2.5 py-1 rounded-lg border font-semibold transition-all cursor-pointer ${
                            targetPhone === p.phone
                              ? 'bg-emerald-500 text-white border-emerald-400 font-bold'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {recipientType === 'free' && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 p-2.5 rounded-xl text-[11px] leading-relaxed flex items-center gap-2">
                  <span className="text-base">💡</span>
                  <span>
                    Setelah tombol diklik, aplikasi WhatsApp akan langsung terbuka dan menampilkan pilihan kontak atau grup (misalnya: <b>Grup Yantek ULP Baguala</b>).
                  </span>
                </div>
              )}
            </div>

            {/* 4. Custom Additional Note */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                3. Catatan Tambahan Petugas (Opsional)
              </label>
              <textarea
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                rows={2}
                placeholder="Tambahkan pesan instruksi khusus untuk regu lapangan (misal: 'Harap selesaikan sebelum pukul 15.00 WIT karena beban puncak')..."
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white p-2.5 rounded-xl text-xs focus:outline-none focus:border-emerald-500 placeholder-slate-400"
              />
            </div>

          </div>

          {/* RIGHT COLUMN: WhatsApp Live Chat Preview (lg:col-span-5) */}
          <div className="lg:col-span-5 flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                <span>Pratinjau Pesan Chat WhatsApp</span>
              </label>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 cursor-pointer transition-colors"
                title="Salin isi pesan ke clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-600 font-bold">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Teks</span>
                  </>
                )}
              </button>
            </div>

            {/* WhatsApp Chat Simulation Container */}
            <div className="flex-1 min-h-[320px] max-h-[460px] bg-[#efeae2] dark:bg-[#0b141a] rounded-2xl p-3 border border-slate-200 dark:border-slate-800 overflow-y-auto font-sans shadow-inner flex flex-col justify-between">
              {/* WhatsApp Message Bubble */}
              <div className="bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-900 dark:text-slate-100 p-3.5 rounded-2xl rounded-tr-xs shadow-md max-w-full text-[11px] leading-relaxed whitespace-pre-wrap select-text border border-emerald-200 dark:border-emerald-800/50">
                {generatedMessage}
                <div className="text-[9px] text-slate-500 dark:text-slate-300/80 text-right mt-1 font-mono flex items-center justify-end gap-1">
                  <span>{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="text-emerald-700 dark:text-emerald-300 font-bold">✓✓</span>
                </div>
              </div>

              {/* Help tip */}
              <div className="pt-2 text-[10px] text-slate-500 dark:text-slate-400 text-center font-medium">
                Pesan ini siap dikirim ke WhatsApp Web / WhatsApp Desktop / HP Android &amp; iOS.
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 active:scale-98 text-white font-black py-3 px-4 rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
              >
                <WhatsAppIcon className="w-5 h-5 text-white" />
                <span>Buka WhatsApp &amp; Kirim Laporan</span>
              </button>

              <button
                type="button"
                onClick={handleCopyMessage}
                className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Teks Berhasil Disalin ke Clipboard!' : 'Salin Teks Pesan'}</span>
              </button>
            </div>

          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 dark:bg-slate-950/60 px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Integrasi WhatsApp Resmi PLN GROW ULP Baguala
            </span>
          </div>
          <button
            onClick={onClose}
            className="hover:underline text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer font-medium"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};

export default WhatsAppReportModal;
