import React, { useState, useEffect, useMemo } from 'react';
import { PoleData, AiAnalysisResult, MaintenanceWorkOrder } from '../types';
import { getApiUrl } from '../utils/apiConfig';
import { calculatePlnEnsAnalysis, PLN_STANDARD_CONSTANTS } from '../utils/ensCalculator';
import {
  Bot,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Zap,
  FileText,
  Activity,
  DollarSign,
  TrendingDown,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Sliders,
  Info,
  Clock,
  Layers,
  Calculator,
  MapPin,
  Search
} from 'lucide-react';

interface AiPredictiveDashboardProps {
  poles: PoleData[];
  onAutoGenerateSpks: (spkDrafts: Partial<MaintenanceWorkOrder>[]) => void;
}

export const AiPredictiveDashboard: React.FC<AiPredictiveDashboardProps> = ({
  poles,
  onAutoGenerateSpks
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<AiAnalysisResult | null>(() => {
    try {
      const cached = sessionStorage.getItem('pln_ai_analysis_cache');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return null;
  });
  const [error, setError] = useState<string | null>(null);

  // ENS Interactive Parameters State
  const [outageHours, setOutageHours] = useState<number>(PLN_STANDARD_CONSTANTS.DEFAULT_OUTAGE_HOURS);
  const [tariffPerKwh, setTariffPerKwh] = useState<number>(PLN_STANDARD_CONSTANTS.TARIFF_PER_KWH);
  const [showFormulaDetails, setShowFormulaDetails] = useState<boolean>(false);
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<'all' | 'Kritis' | 'Tinggi' | 'Sedang'>('all');
  const [feederSearch, setFeederSearch] = useState<string>('');

  // Live calculation of PLN ENS based on poles and user parameters
  const currentEns = useMemo(() => {
    return calculatePlnEnsAnalysis(poles, outageHours, tariffPerKwh);
  }, [poles, outageHours, tariffPerKwh]);

  // Filtered feeders list
  const filteredFeeders = useMemo(() => {
    return currentEns.feederBreakdown.filter(f => {
      const matchesRisk = selectedRiskFilter === 'all' || f.riskLevel === selectedRiskFilter;
      const matchesSearch = !feederSearch.trim() || f.feederName.toLowerCase().includes(feederSearch.toLowerCase().trim());
      return matchesRisk && matchesSearch;
    });
  }, [currentEns, selectedRiskFilter, feederSearch]);

  const fetchAiAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl('/api/ai/analyze'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poles })
      });
      if (!res.ok) throw new Error('Gagal memuat analisis AI');
      const data = await res.json();
      setAnalysis(data);
      try {
        sessionStorage.setItem('pln_ai_analysis_cache', JSON.stringify(data));
      } catch (e) {}
    } catch (err: any) {
      setError(err.message || 'Gagal menghubungi server GROW AI');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!analysis) {
      fetchAiAnalysis();
    }
  }, [poles.length]);

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6 sm:space-y-8 text-slate-900 dark:text-slate-100 pb-28 md:pb-8 transition-colors duration-200">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-50 via-sky-50 to-white dark:from-amber-950/80 dark:via-slate-900 dark:to-slate-900 p-4 sm:p-6 rounded-2xl border border-amber-300 dark:border-amber-500/30 shadow-sm dark:shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 transition-colors">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[11px] sm:text-xs font-bold px-3 py-1 rounded-full border border-amber-500/30">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            GROW AI Predictive Engine · Analisis Prediktif &amp; ENS
          </div>
          <h2 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-snug">
            Dashboard Prediktif Pemeliharaan Jaringan &amp; Analisa ENS PLN ULP Baguala
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            Sistem GROW AI secara otomatis menganalisis posisi koordinat tiang, usia instalasi, pelanggaran jarak bebas kabel (ROW &lt; 3.0m), serta kalkulasi dampak <b>Energy Not Served (ENS)</b> dan potensi kerugian pendapatan PLN sesuai regulasi resmi.
          </p>
        </div>

        <button
          onClick={fetchAiAnalysis}
          disabled={loading}
          className="shrink-0 bg-amber-400 hover:bg-amber-300 active:scale-95 disabled:opacity-50 text-slate-950 font-bold px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all w-full md:w-auto cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Menganalisis Data...' : 'Jalankan Analisis GROW AI'}</span>
        </button>
      </div>

      {loading && (
        <div className="p-8 sm:p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm dark:shadow-xl transition-colors">
          <Bot className="w-10 h-10 sm:w-12 sm:h-12 text-amber-500 dark:text-amber-400 animate-bounce mx-auto" />
          <div className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">Model GROW AI Sedang Memproses Jaringan ULP Baguala...</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Menghitung indeks risiko tumbangnya tiang, gangguan kilatan busur pohon, kalkulasi ENS (kWh) per penyulang, dan menyusun SPK darurat untuk tim teknis.
          </div>
        </div>
      )}

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/40 p-4 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {analysis && !loading && (
        <div className="space-y-6 sm:space-y-8">
          
          {/* Health Score & Key Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            
            {/* Health Score Gauge */}
            <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl flex flex-col items-center justify-center text-center space-y-3 transition-colors">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Indeks Kesehatan Jaringan ULP Baguala
              </span>
              <div className="relative flex items-center justify-center">
                <div className={`text-5xl sm:text-6xl font-black ${
                  analysis.gridHealthScore >= 80 ? 'text-emerald-600 dark:text-emerald-400' : analysis.gridHealthScore >= 60 ? 'text-amber-500 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {analysis.gridHealthScore}%
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {analysis.gridHealthScore >= 80 ? 'Kondisi Jaringan Sangat Prima' : 'Perlu Tindakan Pemeliharaan Periodik'}
              </p>
            </div>

            {/* AI Executive Summary */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl space-y-3 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                  <Bot className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0" />
                  <span>Ringkasan Eksekutif GROW AI</span>
                </div>
                {analysis.generatedSpkDrafts.length > 0 && (
                  <button
                    onClick={() => onAutoGenerateSpks(analysis.generatedSpkDrafts)}
                    className="bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer w-full sm:w-auto"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Terbitkan {analysis.generatedSpkDrafts.length} SPK Auto</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {analysis.summary}
              </p>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* SECTION: ANALISA POTENSI ENS (ENERGY NOT SERVED) STANDAR PLN             */}
          {/* ========================================================================= */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl space-y-5 transition-colors">
            
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                      <span>Analisa Potensi ENS (Energy Not Served) Jaringan Distribusi</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Perhitungan energi listrik tidak tersalurkan akibat potensi gangguan vegetasi &amp; pelanggaran ROW
                    </p>
                  </div>
                </div>
              </div>

              {/* PLN Standard Reference Badge */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                  <BookOpen className="w-3 h-3 text-cyan-500 dark:text-cyan-400" />
                  <span>SPLN 68-1B : 1986 &amp; Kepdir PLN 0687.K/DIR/2019</span>
                </span>
                <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg">
                  Permen ESDM: Rp 1.444,70 / kWh
                </span>
              </div>
            </div>

            {/* Interactive Simulation Controls (Durasi & Tarif) */}
            <div className="bg-slate-50 dark:bg-slate-950/80 p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <Sliders className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  <span>Simulasi Parameter Operasi PLN ULP Baguala:</span>
                </div>
                
                {/* Outage Duration Quick Selectors */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Durasi Padam (t):</span>
                  </span>
                  {[1.0, 1.5, 2.0, 3.0, 4.0].map((h) => (
                    <button
                      key={h}
                      onClick={() => setOutageHours(h)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        outageHours === h
                          ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                          : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {h} Jam {h === 2.0 ? '(Standar)' : ''}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 4 Hero KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
              
              {/* Card 1: Total Potensi ENS */}
              {/* Card 1: Total Potensi ENS */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-rose-300 dark:border-rose-500/30 shadow-xs dark:shadow-md space-y-2 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span>Total Potensi ENS</span>
                  </span>
                  <span className="text-[9px] font-mono font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded">
                    SUTM 20 kV
                  </span>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">
                    {currentEns.totalPotentialEnsKwh.toLocaleString('id-ID')}{' '}
                    <span className="text-xs font-sans text-rose-600 dark:text-rose-400 font-bold">kWh</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                    ({currentEns.totalPotentialEnsMwh.toLocaleString('id-ID')} MWh)
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight pt-1 border-t border-slate-200 dark:border-slate-800/80">
                  Estimasi energi padam jika terjadi trip akibat pelanggaran ROW &lt; 3m.
                </p>
              </div>

              {/* Card 2: Proyeksi Kerugian Pendapatan */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-amber-300 dark:border-amber-500/30 shadow-xs dark:shadow-md space-y-2 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Kerugian Penjualan</span>
                  </span>
                  <span className="text-[9px] font-mono font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">
                    Lost Sales
                  </span>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
                    Rp {currentEns.totalPotentialLossRp.toLocaleString('id-ID')}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Basis Tarif Rp 1.444,70 / kWh
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight pt-1 border-t border-slate-200 dark:border-slate-800/80">
                  Nilai pendapatan listrik PLN yang hilang selama durasi pemadaman {outageHours} jam.
                </p>
              </div>

              {/* Card 3: ENS Terselamatkan (Mitigasi ROW) */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-emerald-300 dark:border-emerald-500/30 shadow-xs dark:shadow-md space-y-2 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>ENS Diselamatkan</span>
                  </span>
                  <span className="text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                    Mitigasi 85%
                  </span>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {currentEns.totalSavedEnsKwh.toLocaleString('id-ID')}{' '}
                    <span className="text-xs font-sans text-emerald-700 dark:text-emerald-300 font-bold">kWh</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                    ({(currentEns.totalSavedEnsKwh / 1000).toFixed(2)} MWh)
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight pt-1 border-t border-slate-200 dark:border-slate-800/80">
                  Energi listrik yang berhasil diamankan bila SPK rabas pohon selesai tepat waktu.
                </p>
              </div>

              {/* Card 4: Penyelamatan Finansial */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-cyan-300 dark:border-cyan-500/30 shadow-xs dark:shadow-md space-y-2 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-cyan-700 dark:text-cyan-300 uppercase tracking-wider flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    <span>Pendapatan Diamankan</span>
                  </span>
                  <span className="text-[9px] font-mono font-bold bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 px-1.5 py-0.5 rounded">
                    Saved Revenue
                  </span>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-cyan-600 dark:text-cyan-300">
                    Rp {currentEns.totalSavedRevenueRp.toLocaleString('id-ID')}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Efisiensi Pemeliharaan ULP
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight pt-1 border-t border-slate-200 dark:border-slate-800/80">
                  Potensi pendapatan penjualan yang terselamatkan bagi PLN ULP Baguala.
                </p>
              </div>

            </div>

            {/* Collapsible: Dasar Acuan Regulasi & Rumus Matematis ENS PLN */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors">
              <button
                type="button"
                onClick={() => setShowFormulaDetails(!showFormulaDetails)}
                className="w-full p-3.5 text-left flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  <span>Dasar Acuan Regulasi &amp; Rumus Perhitungan ENS Resmi PLN</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    (Klik untuk {showFormulaDetails ? 'menyembunyikan' : 'melihat detail'})
                  </span>
                </div>
                {showFormulaDetails ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {showFormulaDetails && (
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-xs space-y-4 bg-white dark:bg-slate-950/90 text-slate-700 dark:text-slate-300 transition-colors">
                  
                  {/* Standar Regulasi */}
                  <div className="space-y-1.5">
                    <div className="font-bold text-amber-600 dark:text-amber-400 uppercase text-[11px] flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>1. Sumber Acuan &amp; Standar Regulasi PLN:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400 text-[11px] pl-1">
                      <li>
                        <strong className="text-slate-900 dark:text-white">SPLN No. 68-1B : 1986</strong> — <i>Tingkat Keandalan Sistem Distribusi Tenaga Listrik</i> (Definisi indikator SAIDI, SAIFI, CAIDI, dan ENS).
                      </li>
                      <li>
                        <strong className="text-slate-900 dark:text-white">Keputusan Direksi PT PLN (Persero) No. 0687.K/DIR/2019</strong> — <i>Pedoman Penilaian Kinerja Operasi Distribusi Tenaga Listrik</i> mengenai tata cara perhitungan Energi Listrik Tidak Tersalurkan (ENS) akibat pemadaman gangguan maupun pemeliharaan.
                      </li>
                      <li>
                        <strong className="text-slate-900 dark:text-white">Peraturan Menteri ESDM No. 18 Tahun 2019 &amp; No. 27 Tahun 2017</strong> — <i>Tingkat Mutu Pelayanan (TMP) dan Penyaluran Tenaga Listrik</i> (Dasar tarif rata-rata penjualan Rp 1.444,70 / kWh).
                      </li>
                      <li>
                        <strong className="text-slate-900 dark:text-white">Permen ESDM No. 13 Tahun 2021 / SNI Ketenagalistrikan</strong> — Batas ruang bebas minimum Right of Way (ROW) Saluran Udara Tegangan Menengah (SUTM 20 kV) minimal 3.0 Meter.
                      </li>
                    </ul>
                  </div>

                  {/* Rumus Matematis */}
                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                    <div className="font-bold text-cyan-600 dark:text-cyan-400 uppercase text-[11px] flex items-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5" />
                      <span>2. Rumus Matematis Perhitungan ENS Distribusi 20 kV:</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1 transition-colors">
                        <div className="font-mono text-xs font-bold text-amber-600 dark:text-amber-300">
                          P = √3 × V_LL × I × cos φ
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          <b>Daya Aktif Padam (kW):</b> Tegangan antar fasa V_LL = 20 kV, I = arus rata-rata beban penyulang (A), cos φ = 0.85 (faktor daya standar PLN).
                        </p>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1 transition-colors">
                        <div className="font-mono text-xs font-bold text-rose-600 dark:text-rose-300">
                          ENS = P (kW) × t (jam)
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          <b>Energy Not Served (kWh):</b> Daya padam dikalikan dengan durasi padam t (jam) dari saat pemutus trip hingga manuver/rabas selesai.
                        </p>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1 transition-colors">
                        <div className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-300">
                          Kerugian = ENS × Tarif
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          <b>Proyeksi Kerugian Finansial (Rp):</b> ENS dalam kWh dikalikan Tarif Tenaga Listrik rata-rata (Rp 1.444,70/kWh).
                        </p>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Feeder Breakdown Table & Cards */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                    Rincian Potensi ENS Per Penyulang (Feeder) ULP Baguala
                  </span>
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-mono font-bold border border-slate-200 dark:border-transparent">
                    {filteredFeeders.length} Penyulang
                  </span>
                </div>

                {/* Filter and Search */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Search input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={feederSearch}
                      onChange={(e) => setFeederSearch(e.target.value)}
                      placeholder="Cari penyulang..."
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 w-36 sm:w-44 transition-colors"
                    />
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1">
                    {(['all', 'Kritis', 'Tinggi', 'Sedang'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => setSelectedRiskFilter(lvl)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                          selectedRiskFilter === lvl
                            ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                            : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        {lvl === 'all' ? 'Semua' : lvl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Desktop Table View (Hidden on mobile) */}
              <div className="hidden md:block overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 transition-colors">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-100 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Nama Penyulang (Feeder)</th>
                      <th className="p-3">Tegangan &amp; Beban</th>
                      <th className="p-3 text-center">Titik Rawan ROW</th>
                      <th className="p-3 text-center">Tiang Kritis</th>
                      <th className="p-3 text-right">Potensi ENS</th>
                      <th className="p-3 text-right">Potensi Kerugian (Rp)</th>
                      <th className="p-3 text-right">ENS Diselamatkan</th>
                      <th className="p-3 text-center">Risiko</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-[11px]">
                    {filteredFeeders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-slate-500">
                          Tidak ada penyulang yang sesuai kriteria pencarian.
                        </td>
                      </tr>
                    ) : (
                      filteredFeeders.map((feeder) => (
                        <tr key={feeder.feederName} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            <span>{feeder.feederName}</span>
                          </td>
                          <td className="p-3 font-mono">
                            <span className="text-cyan-600 dark:text-cyan-300 font-bold">{feeder.voltageKv} kV</span>
                            <span className="text-slate-400 dark:text-slate-500 mx-1">·</span>
                            <span className="text-slate-600 dark:text-slate-400">{feeder.averageCurrentA} A ({feeder.powerKw} kW)</span>
                          </td>
                          <td className="p-3 text-center font-bold font-mono">
                            <span className={feeder.rowViolationsCount > 20 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}>
                              {feeder.rowViolationsCount}
                            </span>
                          </td>
                          <td className="p-3 text-center font-bold font-mono text-slate-700 dark:text-slate-300">
                            {feeder.criticalPolesCount}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {feeder.potentialEnsKwh.toLocaleString('id-ID')}{' '}
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">kWh</span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                            Rp {feeder.potentialLossRp.toLocaleString('id-ID')}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {feeder.savedEnsKwh.toLocaleString('id-ID')}{' '}
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">kWh</span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${
                              feeder.riskLevel === 'Kritis'
                                ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40'
                                : feeder.riskLevel === 'Tinggi'
                                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                                : 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/40'
                            }`}>
                              {feeder.riskLevel}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View (Visible on smartphone screens) */}
              <div className="md:hidden space-y-2.5">
                {filteredFeeders.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                    Tidak ada penyulang yang sesuai kriteria pencarian.
                  </div>
                ) : (
                  filteredFeeders.map((feeder) => (
                    <div
                      key={feeder.feederName}
                      className="bg-white dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-xs transition-colors"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2">
                        <div className="font-black text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          <span>{feeder.feederName}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          feeder.riskLevel === 'Kritis'
                            ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40'
                            : feeder.riskLevel === 'Tinggi'
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                            : 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/40'
                        }`}>
                          {feeder.riskLevel}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Tegangan &amp; Beban:</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">{feeder.voltageKv} kV · {feeder.averageCurrentA} A</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Pelanggaran ROW:</span>
                          <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{feeder.rowViolationsCount} Titik</span>
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800/80 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 dark:text-slate-400 text-[10px]">Potensi ENS ({outageHours} jam):</span>
                          <span className="font-mono font-black text-rose-700 dark:text-rose-300">{feeder.potentialEnsKwh.toLocaleString('id-ID')} kWh</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 dark:text-slate-400 text-[10px]">Potensi Kerugian:</span>
                          <span className="font-mono font-black text-amber-600 dark:text-amber-400">Rp {feeder.potentialLossRp.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-1 mt-1">
                          <span className="text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold">ENS Diselamatkan:</span>
                          <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">{feeder.savedEnsKwh.toLocaleString('id-ID')} kWh</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>

          </div>

          {/* Action Plan */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl space-y-4 transition-colors">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500 dark:text-amber-400" />
              <span>Rencana Tindakan Pencegahan (Preventive Action Plan)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
              {analysis.preventiveActionPlan.map((plan) => (
                <div key={plan.step} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-500/30">
                      Langkah {plan.step}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Target {plan.targetDays} Hari</span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">{plan.title}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{plan.description}</p>
                  <div className="pt-2 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                    Penanggung Jawab: {plan.assignedUnit}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Auto SPK Drafts Table */}
          {analysis.generatedSpkDrafts.length > 0 && (
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl space-y-4 transition-colors">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                  <span>Draf Surat Perintah Kerja (SPK) Otomatis AI</span>
                </h3>
              </div>

              {/* Desktop view */}
              <div className="hidden md:block overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 transition-colors">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">ID Tiang</th>
                      <th className="p-3">Lokasi</th>
                      <th className="p-3">Jenis Pekerjaan</th>
                      <th className="p-3">Prioritas</th>
                      <th className="p-3">Rekomendasi Teknik AI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {analysis.generatedSpkDrafts.map((spk, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-bold text-slate-900 dark:text-white font-mono">{spk.poleId}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-300">{spk.locationName}</td>
                        <td className="p-3 font-semibold text-amber-600 dark:text-amber-400">{spk.issueType}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            spk.priority === 'Kritis' ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300' : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                          }`}>
                            {spk.priority}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 dark:text-slate-400 text-[11px]">{spk.aiRecommendation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards view */}
              <div className="md:hidden space-y-2.5">
                {analysis.generatedSpkDrafts.map((spk, idx) => (
                  <div key={idx} className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-amber-600 dark:text-amber-400">{spk.poleId}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        spk.priority === 'Kritis' ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300' : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                      }`}>
                        {spk.priority}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">{spk.issueType}</div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">{spk.locationName}</div>
                    <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-800/80">
                      {spk.aiRecommendation}
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
};
