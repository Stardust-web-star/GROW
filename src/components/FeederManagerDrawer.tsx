import React, { useState } from 'react';
import { PoleData } from '../types';
import { Search, Eye, EyeOff, Trash2, Edit3, Target, Upload, Download, X, Layers, CheckSquare, Square, Palette, Plus } from 'lucide-react';

interface FeederManagerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  poles: PoleData[];
  feederColors: Record<string, string>;
  feederVisibility: Record<string, boolean>;
  onUpdateFeederColor: (feederName: string, newColor: string) => void;
  onToggleFeederVisibility: (feederName: string) => void;
  onToggleAllFeeders: (visible: boolean) => void;
  onFocusFeederOnMap: (feederName: string) => void;
  onDeleteFeeder: (feederName: string) => void;
  onOpenKmzUploader: () => void;
}

export const FeederManagerDrawer: React.FC<FeederManagerDrawerProps> = ({
  isOpen,
  onClose,
  poles,
  feederColors,
  feederVisibility,
  onUpdateFeederColor,
  onToggleFeederVisibility,
  onToggleAllFeeders,
  onFocusFeederOnMap,
  onDeleteFeeder,
  onOpenKmzUploader
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingFeeder, setEditingFeeder] = useState<string | null>(null);
  const [tempColor, setTempColor] = useState('#22C55E');
  const [feederToDelete, setFeederToDelete] = useState<string | null>(null);

  if (!isOpen) return null;

  // Get list of all unique feeders
  const allFeeders = Array.from(new Set(poles.map(p => p.feeder)));

  // Filter feeders based on search query
  const filteredFeeders = allFeeders.filter(f =>
    f.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isAllVisible = allFeeders.every(f => feederVisibility[f] !== false);

  const handleExportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(poles, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `Data_GIS_PLN_Baguala_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-950/95 backdrop-blur-xl border-l border-slate-800 text-white shadow-2xl flex flex-col font-sans animate-in slide-in-from-right duration-300">
      
      {/* Header matching user's reference screenshot */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-sm uppercase tracking-wide text-white">
                PETA POHON & FEEDER PLN ULP BAGUALA
              </h2>
              <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full">
                {allFeeders.length} Feeder
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Manajemen Pengelompokan Penyulang & Warna Kabel</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Top Action Bar matching reference screenshot */}
      <div className="p-3 bg-slate-900/60 border-b border-slate-800 space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onOpenKmzUploader}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-3 rounded-xl text-xs transition-all shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>+ Import KMZ Pohon</span>
          </button>

          <button
            onClick={handleExportData}
            className="flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-2 px-3 rounded-xl text-xs transition-all shadow-md"
          >
            <Download className="w-4 h-4" />
            <span>Download Data</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="*Cari Penyulang..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center justify-between pt-1 text-xs text-slate-400 border-t border-slate-800/80">
          <button
            onClick={() => onToggleAllFeeders(!isAllVisible)}
            className="flex items-center gap-1.5 hover:text-white transition-all font-semibold"
          >
            {isAllVisible ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4 text-slate-500" />}
            <span>DAFTAR ({filteredFeeders.length})</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onToggleAllFeeders(false)}
              className="flex items-center gap-1 hover:text-amber-400 transition-all text-[11px]"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Sembunyikan</span>
            </button>
            <button
              onClick={() => onToggleAllFeeders(true)}
              className="flex items-center gap-1 hover:text-emerald-400 transition-all text-[11px]"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Tampilkan Semua</span>
            </button>
          </div>
        </div>
      </div>

      {/* Feeder List matching reference screenshot */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredFeeders.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            Tidak ada penyulang ditemukan dengan kata kunci "{searchQuery}"
          </div>
        ) : (
          filteredFeeders.map(feederName => {
            const feederPoles = poles.filter(p => p.feeder === feederName);
            const isVisible = feederVisibility[feederName] !== false;
            const currentColor = feederColors[feederName] || '#22C55E';

            return (
              <div
                key={feederName}
                className={`p-3 rounded-xl border transition-all ${
                  isVisible
                    ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700 shadow-sm'
                    : 'bg-slate-950/40 border-slate-900/80 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  
                  {/* Left: Checkbox + Eye + Color Swatch + Title */}
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => onToggleFeederVisibility(feederName)}
                      className="w-4 h-4 accent-amber-500 cursor-pointer rounded"
                    />

                    <button
                      onClick={() => onToggleFeederVisibility(feederName)}
                      className={`p-1 rounded-lg transition-all ${
                        isVisible ? 'text-emerald-400 hover:bg-emerald-500/20' : 'text-slate-500 hover:bg-slate-800'
                      }`}
                      title={isVisible ? 'Sembunyikan Feeder ini' : 'Tampilkan Feeder ini'}
                    >
                      {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>

                    {/* Interactive Color Picker Swatch */}
                    <div className="relative group">
                      <input
                        type="color"
                        value={currentColor}
                        onChange={(e) => onUpdateFeederColor(feederName, e.target.value)}
                        className="w-5 h-5 rounded-full border-2 border-white shadow-md cursor-pointer appearance-none bg-transparent p-0"
                        title="Klik untuk mengubah warna kabel & penanda penyulang ini"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-extrabold text-xs text-white truncate uppercase tracking-wide">
                        {feederName}
                      </h3>
                      <p className="text-[10px] text-slate-400 truncate">
                        {feederPoles.length} titik tiang · {feederPoles.filter(p => p.clearanceDistanceMeters < 3.0).length} ROW &lt; 3m
                      </p>
                    </div>
                  </div>

                  {/* Right Actions: Focus / Edit / Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onFocusFeederOnMap(feederName)}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-amber-400 hover:bg-slate-700 transition-all cursor-pointer"
                      title="Fokus Peta ke Penyulang ini"
                    >
                      <Target className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setFeederToDelete(feederName)}
                      className="p-1.5 rounded-lg bg-slate-800 text-rose-400 hover:text-rose-200 hover:bg-rose-900/50 transition-all cursor-pointer"
                      title="Hapus Penyulang ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

      {/* In-drawer Delete Feeder Confirmation Modal */}
      {feederToDelete && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-rose-500/50 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 bg-rose-500/20 rounded-xl">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white">Hapus Penyulang?</h4>
                <p className="text-[11px] text-slate-400">Konfirmasi penghapusan penyulang & tiangnya</p>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-400">Penyulang: </span>
              <b className="text-amber-400 uppercase">{feederToDelete}</b>
              <div className="text-[11px] text-slate-400 mt-1">
                Semua tiang dan kabel pada jalur ini akan dihapus dari sistem GIS.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setFeederToDelete(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteFeeder(feederToDelete);
                  setFeederToDelete(null);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-all cursor-pointer shadow-md"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Footer Info */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 text-[10px] text-slate-400 text-center leading-relaxed">
        ⚡ <b>Kabel Terhubung Antar Tiang Terdekat</b>: Setiap kabel listrik terhubung presisi antar tiang terdekat dalam penyulang yang sama.
      </div>

      </div>
    </>
  );
};
