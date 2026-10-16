import React, { useState } from 'react';
import { PoleData, InspectionRecord, PhysicalCondition } from '../types';
import { X, CheckCircle, ShieldAlert, Camera, Ruler } from 'lucide-react';

interface AddInspectionModalProps {
  pole: PoleData;
  onClose: () => void;
  onSubmitInspection: (poleId: string, inspection: InspectionRecord) => void;
}

export const AddInspectionModal: React.FC<AddInspectionModalProps> = ({
  pole,
  onClose,
  onSubmitInspection
}) => {
  const [inspector, setInspector] = useState('Petugas Yantek Baguala');
  const [condition, setCondition] = useState<PhysicalCondition>(pole.physicalCondition);
  const [clearanceDistance, setClearanceDistance] = useState<number>(pole.clearanceDistanceMeters);
  const [clearanceObject, setClearanceObject] = useState<string>(pole.clearanceObject);
  const [actionTaken, setActionTaken] = useState('Inspeksi Fisik & Pengukuran Jarak Kabel');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: InspectionRecord = {
      id: `INS-${Date.now()}`,
      poleId: pole.id,
      date: new Date().toISOString().split('T')[0],
      inspector,
      condition,
      cableClearanceMeters: clearanceDistance,
      clearanceObject,
      actionTaken,
      notes
    };

    onSubmitInspection(pole.id, newRecord);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-slate-100">
        
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-base text-white">Input Hasil Inspeksi Lapangan</h3>
            <p className="text-xs text-amber-400 font-mono">{pole.id} ({pole.code})</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Nama Petugas Inspeksi</label>
            <input
              type="text"
              value={inspector}
              onChange={(e) => setInspector(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Kondisi Fisik Tiang</label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as PhysicalCondition)}
              className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl focus:outline-none"
            >
              <option value="Baik">Baik (Kokoh & Aman)</option>
              <option value="Perlu Perbaikan">Perlu Perbaikan Minor</option>
              <option value="Miring / Retak">Miring / Pondasi Retak</option>
              <option value="Korosi Kritis">Korosi Kritis / Bahaya Patah</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Jarak Kabel ke Objek (m)</label>
              <input
                type="number"
                step="0.1"
                value={clearanceDistance}
                onChange={(e) => setClearanceDistance(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl focus:outline-none font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Jenis Objek Terdekat</label>
              <input
                type="text"
                value={clearanceObject}
                onChange={(e) => setClearanceObject(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl focus:outline-none"
                placeholder="Pohon Kelapa, Ruko, dll"
              />
            </div>
          </div>

          {clearanceDistance < 3.0 && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-rose-300 text-[11px] font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>PERINGATAN: Jarak {clearanceDistance}m melanggar batas keselamatan ROW 3 Meter!</span>
            </div>
          )}

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Tindakan Langsung</label>
            <input
              type="text"
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Catatan Lapangan</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl focus:outline-none"
              placeholder="Catatan khusus kondisi traversa, isolator, dsb..."
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-slate-300 font-semibold rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-md"
            >
              Simpan Hasil Inspeksi
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
