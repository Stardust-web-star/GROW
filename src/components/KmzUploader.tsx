import React, { useState } from 'react';
import { parseKmzOrKmlFile } from '../utils/kmzParser';
import { PoleData, CableSpan } from '../types';
import { Upload, FileCode, CheckCircle2, AlertCircle, ArrowRight, Zap, RefreshCw, Layers, ShieldCheck } from 'lucide-react';

interface KmzUploaderProps {
  onImportSuccess: (poles: PoleData[], spans: CableSpan[], replaceExisting: boolean) => void;
  onLoadSampleKmz: () => void;
  onRestoreMasterData?: () => void;
  masterName?: string;
  totalMasterPoles?: number;
}

export const KmzUploader: React.FC<KmzUploaderProps> = ({
  onImportSuccess,
  onLoadSampleKmz,
  onRestoreMasterData,
  masterName = 'TITIK TIANG BGL.kml',
  totalMasterPoles = 2980
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<{
    fileName: string;
    poles: PoleData[];
    spans: CableSpan[];
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = async (file: File) => {
    setErrorMsg(null);
    setIsParsing(true);
    setParsedData(null);

    try {
      const result = await parseKmzOrKmlFile(file);
      if (result.poles.length === 0) {
        setErrorMsg('Tidak ditemukan titik koordinat (Placemark) tiang di dalam file KMZ/KML ini.');
      } else {
        setParsedData({
          fileName: result.fileName,
          poles: result.poles,
          spans: result.spans
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengekstrak file KMZ. Pastikan file dikirim dari Google Earth Pro.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const applyToMap = (replace: boolean) => {
    if (!parsedData) return;
    onImportSuccess(parsedData.poles, parsedData.spans, replace);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8 text-slate-100">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950/60 p-6 rounded-2xl border border-slate-700/80 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-400 text-xs font-bold px-3 py-1 rounded-full border border-amber-500/30">
            <Layers className="w-3.5 h-3.5" />
            <span>Integrasi GIS Google Earth Pro</span>
          </div>
          <span className="text-xs text-slate-400 font-medium">Format: .KMZ &amp; .KML</span>
        </div>
        
        <h2 className="text-2xl font-black tracking-tight text-white">
          Unggah File Koordinat KMZ / KML
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
          Aplikasi secara otomatis membaca struktur titik tiang, koordinat GPS (latitude/longitude), penyulang, dan jalur kabel dari file <code className="bg-slate-800 text-amber-400 px-1.5 py-0.5 rounded font-mono text-xs">.kmz</code> atau <code className="bg-slate-800 text-amber-400 px-1.5 py-0.5 rounded font-mono text-xs">.kml</code> yang Anda buat pada Google Earth Pro.
        </p>
      </div>

      {/* Dedicated Layout: Master Data & Sinkronisasi Cepat */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <span>Aksi Cepat Data Master &amp; Sinkronisasi</span>
          </h3>
          <span className="text-[11px] text-slate-400">Pilih aksi cepat untuk memperbarui data peta</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Muat Master Data */}
          {onRestoreMasterData && (
            <div className="bg-slate-900/90 border border-emerald-500/30 hover:border-emerald-500/60 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all group">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Master Data Utama
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-black text-white group-hover:text-emerald-400 transition-colors">
                    Muat Master: {masterName}
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Pulihkan dan muat seluruh master tiang resmi PLN ULP Baguala ({totalMasterPoles.toLocaleString()} titik tiang) langsung ke peta GIS.
                  </p>
                </div>
              </div>
              <button
                onClick={onRestoreMasterData}
                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                title={`Kembalikan peta ke master data ${masterName}`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Muat Master: {masterName}</span>
              </button>
            </div>
          )}

          {/* Card 2: Sinkron Ulang Data */}
          <div className="bg-slate-900/90 border border-amber-500/30 hover:border-amber-500/60 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all group">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  <Zap className="w-4 h-4 fill-current" />
                </div>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                  Sinkronisasi GIS
                </span>
              </div>
              <div>
                <h4 className="text-sm font-black text-white group-hover:text-amber-400 transition-colors">
                  Sinkron Ulang Data
                </h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Perbarui dan sinkronkan seluruh koordinat tiang serta bentangan kabel terkini dari server langsung ke peta GIS aktif.
                </p>
              </div>
            </div>
            <button
              onClick={onLoadSampleKmz}
              className="w-full mt-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              title="Sinkronkan ulang data jaringan ke peta"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Sinkron Ulang Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Upload Box Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <span>Unggah File Baru dari Komputer</span>
          </h3>
          <span className="text-[11px] text-slate-400">Tarik langsung atau pilih file dari direktori lokal</span>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
            isDragging
              ? 'border-amber-400 bg-amber-500/10'
              : 'border-slate-700 bg-slate-900/60 hover:border-slate-500'
          }`}
        >
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto text-amber-400 shadow-md">
            <Upload className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-white">Tarik & Lepas File KMZ di Sini</h3>
            <p className="text-xs text-slate-400 mt-1">
              Mendukung format <b>.kmz</b> dan <b>.kml</b> hasil ekspor Google Earth Pro ULP Baguala.
            </p>
          </div>

          <div className="pt-2">
            <label className="cursor-pointer inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl border border-slate-600 shadow-sm transition-all">
              <FileCode className="w-4 h-4 text-amber-400" />
              <span>Pilih File Dari Komputer</span>
              <input
                type="file"
                accept=".kmz,.kml"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>
      </div>

      {/* Parsing Status & Error */}
      {isParsing && (
        <div className="bg-slate-900 border border-amber-500/40 p-6 rounded-xl flex items-center gap-4 text-amber-300">
          <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
          <div>
            <div className="font-bold text-sm">Sedang Mengekstrak File KMZ...</div>
            <div className="text-xs text-slate-400">Membaca doc.kml, mengurai koordinat GPS, dan mengkalkulasi ruang bebas kabel.</div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/40 p-4 rounded-xl flex items-center gap-3 text-rose-300 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Extracted Preview */}
      {parsedData && (
        <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Berhasil Mengurai File KMZ</h3>
                <p className="text-xs text-slate-400">Nama File: {parsedData.fileName}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => applyToMap(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl border border-slate-700 transition-all"
              >
                Gabungkan Dengan Data Lama
              </button>
              <button
                onClick={() => applyToMap(true)}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg transition-all"
                title="Terapkan dan simpan secara permanen sebagai Master Data Utama sistem"
              >
                <ShieldCheck className="w-4 h-4 text-slate-950" />
                <span>Simpan Sebagai Master Data Utama</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
              <span className="text-slate-400 font-medium">Total Tiang Terdeteksi</span>
              <div className="text-2xl font-black text-amber-400">{parsedData.poles.length} Titik</div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
              <span className="text-slate-400 font-medium">Jaringan / Span Kabel</span>
              <div className="text-2xl font-black text-blue-400">{parsedData.spans.length} Bentangan</div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
              <span className="text-slate-400 font-medium">Potensi Bahaya ROW (&lt;3m)</span>
              <div className="text-2xl font-black text-rose-400">
                {parsedData.poles.filter(p => p.clearanceDistanceMeters < 3.0).length} Lokasi
              </div>
            </div>
          </div>

          {/* Table Preview */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs text-slate-300">Pratinjau Samples Tiang KMZ Terurai:</h4>
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">ID Tiang</th>
                    <th className="p-3">Koordinat GPS</th>
                    <th className="p-3">Tipe</th>
                    <th className="p-3">Jarak ROW Kabel</th>
                    <th className="p-3">Status ROW</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {parsedData.poles.slice(0, 5).map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-white">{p.id}</td>
                      <td className="p-3 font-mono text-[11px] text-slate-400">
                        {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                      </td>
                      <td className="p-3">
                        <span className="bg-slate-800 text-amber-400 px-2 py-0.5 rounded font-mono text-[10px] font-bold">
                          {p.type}
                        </span>
                      </td>
                      <td className="p-3 font-bold">{p.clearanceDistanceMeters}m</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.clearanceDistanceMeters < 3.0
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {p.clearanceStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
