import React, { useState, useEffect } from 'react';
import { CableSpan, PoleData } from '../types';
import { X, Save, Trash2, Zap, AlertTriangle, ShieldCheck, Ruler, Trees, Building2, HelpCircle } from 'lucide-react';
import { calculateHaversineDistanceMeters } from '../utils/kmzParser';

interface EditCableModalProps {
  span: CableSpan;
  fromPole?: PoleData;
  toPole?: PoleData;
  allFeeders: string[];
  onClose: () => void;
  onSave: (updatedSpan: CableSpan) => void;
  onDelete: (spanId: string, fromPoleId?: string, toPoleId?: string) => void;
}

export const EditCableModal: React.FC<EditCableModalProps> = ({
  span,
  fromPole,
  toPole,
  allFeeders,
  onClose,
  onSave,
  onDelete
}) => {
  const defaultFeeder = span.feeder || fromPole?.feeder || toPole?.feeder || 'FEEDER PASSO';
  const [feeder, setFeeder] = useState(defaultFeeder);
  const [conductorType, setConductorType] = useState(span.conductorType || 'Kabel AACS 150 mm²');
  const [lengthMeters, setLengthMeters] = useState(span.lengthMeters || 40);
  const [cableCondition, setCableCondition] = useState(span.cableCondition || 'Baik');
  const [treeDistance, setTreeDistance] = useState(span.treeDistanceMeters ?? span.clearanceMeters ?? 3.5);
  const [buildingDistance, setBuildingDistance] = useState(span.buildingDistanceMeters ?? 4.0);
  const [notes, setNotes] = useState(span.notes || '');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Calculate live min clearance
  const minClearance = Math.min(treeDistance, buildingDistance);
  const isViolation = minClearance < 3.0;
  const isCritical = minClearance < 1.5;

  const handleConfirmDelete = () => {
    onDelete(span.id, span.fromPoleId, span.toPoleId);
    onClose();
  };

  const handleRecalculateGpsDistance = () => {
    if (fromPole && toPole) {
      const calculated = Math.round(
        calculateHaversineDistanceMeters(fromPole.lat, fromPole.lng, toPole.lat, toPole.lng)
      );
      setLengthMeters(calculated);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let violationType: string | undefined = undefined;
    if (treeDistance < 3.0 && buildingDistance < 3.0) {
      violationType = 'Pohon & Bangunan (<3m)';
    } else if (treeDistance < 3.0) {
      violationType = 'Pohon (<3m)';
    } else if (buildingDistance < 3.0) {
      violationType = 'Bangunan (<3m)';
    }

    const updated: CableSpan = {
      ...span,
      feeder,
      conductorType,
      lengthMeters: Number(lengthMeters),
      clearanceMeters: Number(minClearance.toFixed(1)),
      treeDistanceMeters: Number(Number(treeDistance).toFixed(1)),
      buildingDistanceMeters: Number(Number(buildingDistance).toFixed(1)),
      cableCondition,
      hasViolation: isViolation,
      violationType,
      notes,
      photoUrl: span.photoUrl
    };

    onSave(updated);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-xl w-full p-6 space-y-6 shadow-2xl text-slate-100 my-8">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <h3 className="font-black text-lg text-white tracking-tight">
                Informasi & Edit Kabel Distribusi
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Menghubungkan <span className="text-amber-400 font-mono font-bold">{fromPole?.code || span.fromPoleId}</span> ↔{' '}
              <span className="text-amber-400 font-mono font-bold">{toPole?.code || span.toPoleId}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Safety Status Banner */}
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 text-xs ${
          isCritical
            ? 'bg-rose-950/50 border-rose-500/50 text-rose-200'
            : isViolation
            ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
            : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
        }`}>
          <div className="flex items-center gap-3">
            {isCritical ? (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            ) : isViolation ? (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            )}
            <div>
              <div className="font-bold">
                {isCritical
                  ? 'Bahaya Kritis (< 1.5m)'
                  : isViolation
                  ? 'Pelanggaran ROW JTM (< 3.0m)'
                  : 'Aman JTM (≥ 3.0m)'}
              </div>
              <div className="text-[11px] opacity-80">
                Jarak ROW Terendah: <b>{minClearance.toFixed(1)} meter</b> (Standar SPLN: min 3.0m)
              </div>
            </div>
          </div>

          <div className="font-mono text-sm font-black px-2.5 py-1 rounded bg-slate-900/80 border border-slate-700/60">
            Spat: {lengthMeters}m
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Penyulang & Jenis Kabel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Penyulang (Feeder)
              </label>
              <select
                value={feeder}
                onChange={(e) => setFeeder(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
              >
                {allFeeders.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
                {!allFeeders.includes(feeder) && (
                  <option value={feeder}>{feeder}</option>
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Jenis Kabel / Konduktor</label>
              <select
                value={conductorType}
                onChange={(e) => setConductorType(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
              >
                <option value="Kabel AACS 150 mm²">Kabel AACS 150 mm² (Kabel Berisolasi TM)</option>
                <option value="Kabel AACS 70 mm²">Kabel AACS 70 mm²</option>
                <option value="Kabel AAAC 150 mm²">Kabel AAAC 150 mm² (Kawat Terbuka)</option>
                <option value="Kabel XLPE 3x150 mm²">Kabel XLPE 3x150 mm² 24kV</option>
                <option value="TIC 3x70+1x50 mm²">TIC 3x70+1x50 mm² (Twisted TR)</option>
                <option value="TIC 2x16 mm²">TIC 2x16 mm² (Twisted Sambungan Rumah)</option>
                <option value="MVTIC 3x150 mm²">MVTIC 3x150 mm² (Kabel Tanah Udara)</option>
              </select>
            </div>
          </div>

          {/* Panjang Kabel & Kondisi Kabel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-blue-400" />
                  Panjang Kabel (Spat)
                </label>
                {fromPole && toPole && (
                  <button
                    type="button"
                    onClick={handleRecalculateGpsDistance}
                    className="text-[10px] text-amber-400 hover:underline flex items-center gap-1"
                  >
                    Hitung GPS
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={lengthMeters}
                  onChange={(e) => setLengthMeters(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white pr-12 focus:outline-none focus:border-amber-400"
                  required
                />
                <span className="absolute right-3 top-2.5 text-slate-400 text-xs">meter</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Kondisi Fisik Kabel</label>
              <select
                value={cableCondition}
                onChange={(e) => setCableCondition(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
              >
                <option value="Baik">🟢 Baik (Tegangan & Andongan Ideal)</option>
                <option value="Kendor / Andongan Rendah">🟡 Kendor / Andongan Terlalu Rendah</option>
                <option value="Terkelupas / Isolasi Rusak">🔴 Terkelupas / Isolasi Rusak</option>
                <option value="Sambungan Rentan">🟡 Sambungan (Jointing) Rentan</option>
                <option value="Korosi Kritis">🔴 Korosi Kritis</option>
              </select>
            </div>
          </div>

          {/* Jarak Pohon & Jarak Bangunan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <label className="text-slate-300 font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Trees className="w-3.5 h-3.5 text-emerald-400" />
                  Jarak ke Pohon (ROW)
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  treeDistance < 1.5 ? 'bg-rose-500/20 text-rose-400' :
                  treeDistance < 3.0 ? 'bg-amber-500/20 text-amber-400' :
                  'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {treeDistance < 3.0 ? 'Rabas Pohon' : 'Aman'}
                </span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="50"
                  value={treeDistance}
                  onChange={(e) => setTreeDistance(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white pr-12 focus:outline-none focus:border-amber-400"
                  required
                />
                <span className="absolute right-3 top-2 text-slate-400 text-xs">meter</span>
              </div>
              <p className="text-[10px] text-slate-500">Standar aman pohon terhadap fasa: ≥ 3.0m</p>
            </div>

            <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <label className="text-slate-300 font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  Jarak ke Bangunan
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  buildingDistance < 1.5 ? 'bg-rose-500/20 text-rose-400' :
                  buildingDistance < 3.0 ? 'bg-amber-500/20 text-amber-400' :
                  'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {buildingDistance < 3.0 ? 'Dekat Bangunan' : 'Aman'}
                </span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="50"
                  value={buildingDistance}
                  onChange={(e) => setBuildingDistance(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white pr-12 focus:outline-none focus:border-amber-400"
                  required
                />
                <span className="absolute right-3 top-2 text-slate-400 text-xs">meter</span>
              </div>
              <p className="text-[10px] text-slate-500">Jarak aman atap seng / kanopi: ≥ 2.5m - 3.0m</p>
            </div>
          </div>

          {/* Catatan Teknis */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold">Catatan Lapangan & Rekomendasi</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Dahan pohon mangga condong ke kabel fasa R. Perlu pemangkasan rabas."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            {isConfirmingDelete ? (
              <div className="flex flex-wrap items-center gap-2 p-2 bg-rose-950/90 border border-rose-500 rounded-xl animate-in fade-in duration-200">
                <span className="text-xs text-rose-200 font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  Hapus bentangan kabel ini?
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg text-xs font-black shadow transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Hapus Sekarang</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all text-xs cursor-pointer shadow-md hover:shadow-rose-900/40"
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus Kabel</span>
              </button>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl font-semibold transition-all text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-2.5 rounded-xl font-black flex items-center gap-2 shadow-lg transition-all text-xs cursor-pointer"
              >
                <Save className="w-4 h-4 fill-current" />
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
