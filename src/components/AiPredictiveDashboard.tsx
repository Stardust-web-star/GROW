import React, { useState, useEffect } from 'react';
import { PoleData, AiAnalysisResult, MaintenanceWorkOrder } from '../types';
import { Bot, Sparkles, RefreshCw, AlertTriangle, ShieldCheck, CheckCircle2, ArrowRight, Zap, FileText } from 'lucide-react';

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

  const fetchAiAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/analyze', {
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
    <div className="max-w-7xl mx-auto p-6 space-y-8 text-slate-100">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900 p-6 rounded-2xl border border-amber-500/30 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-400 text-xs font-bold px-3 py-1 rounded-full border border-amber-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            GROW AI Predictive Engine · Analisis Prediktif Jaringan
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Dashboard Prediktif Pemeliharaan Jaringan PLN ULP Baguala
          </h2>
          <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
            Sistem GROW AI secara otomatis menganalisis posisi koordinat tiang, usia instalasi, dan pelanggaran jarak aman kabel (&lt;3.0m) untuk menghasilkan proyeksi kegagalan jaringan dan rekomendasi Surat Perintah Kerja (SPK).
          </p>
        </div>

        <button
          onClick={fetchAiAnalysis}
          disabled={loading}
          className="shrink-0 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold px-5 py-3 rounded-xl text-xs flex items-center gap-2 shadow-lg transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Menganalisis Data...' : 'Jalankan Analisis GROW AI'}</span>
        </button>
      </div>

      {loading && (
        <div className="p-12 text-center bg-slate-900 rounded-2xl border border-slate-800 space-y-4">
          <Bot className="w-12 h-12 text-amber-400 animate-bounce mx-auto" />
          <div className="font-bold text-lg text-white">Model GROW AI Sedang Memproses Jaringan ULP Baguala...</div>
          <div className="text-xs text-slate-400 max-w-md mx-auto">
            Menghitung indeks risiko tumbangnya tiang, gangguan kilatan busur pohon, dan menyusun SPK darurat untuk tim teknis.
          </div>
        </div>
      )}

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/40 p-4 rounded-xl text-rose-300 text-xs">
          ⚠️ {error}
        </div>
      )}

      {analysis && !loading && (
        <div className="space-y-8">
          
          {/* Health Score & Key Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Health Score Gauge */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col items-center justify-center text-center space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Indeks Kesehatan Jaringan ULP Baguala
              </span>
              <div className="relative flex items-center justify-center">
                <div className={`text-6xl font-black ${
                  analysis.gridHealthScore >= 80 ? 'text-emerald-400' : analysis.gridHealthScore >= 60 ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {analysis.gridHealthScore}%
                </div>
              </div>
              <p className="text-xs text-slate-400">
                {analysis.gridHealthScore >= 80 ? 'Kondisi Jaringan Sangat Prima' : 'Perlu Tindakan Pemeliharaan Periodik'}
              </p>
            </div>

            {/* AI Executive Summary */}
            <div className="lg:col-span-2 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  <Bot className="w-5 h-5 text-amber-400" />
                  <span>Ringkasan Eksekutif GROW AI</span>
                </div>
                {analysis.generatedSpkDrafts.length > 0 && (
                  <button
                    onClick={() => onAutoGenerateSpks(analysis.generatedSpkDrafts)}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-md transition-all"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Terbitkan {analysis.generatedSpkDrafts.length} SPK Auto</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {analysis.summary}
              </p>
            </div>

          </div>

          {/* Action Plan */}
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <span>Rencana Tindakan Pencegahan (Preventive Action Plan)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {analysis.preventiveActionPlan.map((plan) => (
                <div key={plan.step} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="bg-amber-500/20 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-500/30">
                      Langkah {plan.step}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">Target {plan.targetDays} Hari</span>
                  </div>
                  <h4 className="font-bold text-sm text-white">{plan.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{plan.description}</p>
                  <div className="pt-2 text-[11px] text-amber-300 font-medium">
                    Penanggung Jawab: {plan.assignedUnit}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Auto SPK Drafts Table */}
          {analysis.generatedSpkDrafts.length > 0 && (
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  <span>Draf Surat Perintah Kerja (SPK) Otomatis AI</span>
                </h3>
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3">ID Tiang</th>
                      <th className="p-3">Lokasi</th>
                      <th className="p-3">Jenis Pekerjaan</th>
                      <th className="p-3">Prioritas</th>
                      <th className="p-3">Rekomendasi Teknik AI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {analysis.generatedSpkDrafts.map((spk, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-white font-mono">{spk.poleId}</td>
                        <td className="p-3">{spk.locationName}</td>
                        <td className="p-3 font-semibold text-amber-400">{spk.issueType}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            spk.priority === 'Kritis' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {spk.priority}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 text-[11px]">{spk.aiRecommendation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
