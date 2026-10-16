import React, { useState } from 'react';
import { CableSpan, PoleData } from '../types';
import { X, Zap, ShieldCheck, AlertTriangle, Ruler, Trees, Building2, Cable } from 'lucide-react';
import { calculateHaversineDistanceMeters } from '../utils/kmzParser';

interface NewCableModalProps {
  fromPole: PoleData;
  toPole: PoleData;
  allFeeders: string[];
  onClose: () => void;
  onCreateSpan: (span: CableSpan) => void;
}

export const NewCableModal: React.FC<NewCableModalProps> = ({
  fromPole,
  toPole,
  allFeeders,
  onClose,
  onCreateSpan
}) => {
  const initialDistance = Math.round(
    calculateHaversineDistanceMeters(fromPole.lat, fromPole.lng, toPole.lat, toPole.lng)
  );

  const defaultFeeder = fromPole.feeder || toPole.feeder || 'FEEDER PASSO';
  const defaultConductor = fromPole.type === 'TM' ? 'Kabel AACS 150 mm²' : 'TIC 3x70+1x50 mm²';

  const [feeder, setFeeder] = useState(defaultFeeder);
  const [conductorType, setConductorType] = useState(defaultConductor);
  const [lengthMeters, setLengthMeters] = useState(initialDistance > 0 ? initialDistance : 35);
  const [cableCondition, setCableCondition] = useState('Baik');
  const [treeDistance, setTreeDistance] = useState(3.5);
  const [buildingDistance, setBuildingDistance] = useState(4.0);
  const [notes, setNotes] = useState(`Penarikan kabel baru dari ${fromPole.code} ke ${toPole.code}`);

  const minClearance = Math.min(treeDistance, buildingDistance);
  const isViolation = minClearance < 3.0;

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

    const newSpan: CableSpan = {
      id: `SPAN-MANUAL-${Date.now()}`,
      fromPoleId: fromPole.id,
      toPoleId: toPole.id,
      feeder,
      conductorType,
      lengthMeters: Number(lengthMeters),
      clearanceMeters: Number(minClearance.toFixed(1)),
      treeDistanceMeters: Number(Number(treeDistance).toFixed(1)),
      buildingDistanceMeters: Number(Number(buildingDistance).toFixed(1)),
      cableCondition,
      hasViolation: isViolation,
      violationType,
      notes
    };

    onCreateSpan(newSpan);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl text-slate-100 my-8">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Cable className="w-4 h-4" />
              </div>
              <h3 className="font-black text-lg text-white tracking-tight">
                Tarik & Pasang Kabel Baru
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Menyambungkan <b className="text-amber-400">{fromPole.code}</b> ({fromPole.locationName}) ke{' '}
              <b className="text-amber-400">{toPole.code}</b> ({toPole.locationName})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Distance Banner */}
        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl flex items-center justify-between gap-4 text-xs">
          <div className="space-y-1">
            <div className="text-slate-400">Jarak Terhitung GPS:</div>
            <div className="text-xl font-black text-amber-400 font-mono">
              {initialDistance} meter
            </div>
          </div>
          <div className="text-right space-y-0.5">
            <div className="text-[11px] text-slate-400">Penyulang Target:</div>
            <div className="text-xs font-bold text-white bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
              {feeder}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Feeder & Conductor */}
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
              <label className="text-slate-300 font-semibold">Jenis Konduktor</label>
              <select
                value={conductorType}
                onChange={(e) => setConductorType(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
              >
                <option value="Kabel AACS 150 mm²">Kabel AACS 150 mm²</option>
                <option value="Kabel AACS 70 mm²">Kabel AACS 70 mm²</option>
                <option value="Kabel AAAC 150 mm²">Kabel AAAC 150 mm²</option>
                <option value="Kabel XLPE 3x150 mm²">Kabel XLPE 3x150 mm² 24kV</option>
                <option value="TIC 3x70+1x50 mm²">TIC 3x70+1x50 mm² (TR)</option>
                <option value="TIC 2x16 mm²">TIC 2x16 mm² (SR)</option>
                <option value="MVTIC 3x150 mm²">MVTIC 3x150 mm²</option>
              </select>
            </div>
          </div>

          {/* Panjang Kabel & Kondisi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5 text-blue-400" />
                Panjang Kabel (Spat)
              </label>
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
              <label className="text-slate-300 font-semibold">Kondisi Kabel</label>
              <select
                value={cableCondition}
                onChange={(e) => setCableCondition(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
              >
                <option value="Baik">🟢 Baik (Ideal)</option>
                <option value="Kendor / Andongan Rendah">🟡 Kendor / Andongan Rendah</option>
                <option value="Terkelupas / Isolasi Rusak">🔴 Isolasi Rusak</option>
              </select>
            </div>
          </div>

          {/* Jarak ROW Pohon & Bangunan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Trees className="w-3.5 h-3.5 text-emerald-400" />
                Jarak ROW Pohon
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
            </div>

            <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                Jarak ke Bangunan
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
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl font-semibold transition-all text-xs"
            >
              Batal
            </button>
            <button
              type="submit"
              className="bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 px-5 py-2.5 rounded-xl font-black flex items-center gap-2 shadow-lg transition-all text-xs"
            >
              <Cable className="w-4 h-4 fill-current" />
              <span>Hubungkan Kabel Sekarang</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
