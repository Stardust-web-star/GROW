import React, { useState, useMemo, useEffect } from 'react';
import { PoleData, CableSpan } from '../types';
import { AlertTriangle, ShieldAlert, CheckCircle2, Ruler, Send, FileText, ExternalLink, Search, Filter, Trash2, Zap, BookOpen, Cable, Edit3, MapPin, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import { checkIsRowViolation, getMinRowRequirement } from '../utils/kmzParser';
import { EditCableModal } from './EditCableModal';

interface CableClearanceManagerProps {
  poles: PoleData[];
  spans: CableSpan[];
  onOpenMapAtPole: (pole: PoleData) => void;
  onCreateSpkForPole: (pole: PoleData) => void;
  onUpdateClearanceDistance: (poleId: string, newDistance: number) => void;
  onDeletePole?: (poleId: string) => void;
  onUpdateSpan?: (span: CableSpan) => void;
  onDeleteSpan?: (spanId: string, fromPoleId?: string, toPoleId?: string) => void;
}

export const CableClearanceManager: React.FC<CableClearanceManagerProps> = ({
  poles,
  spans,
  onOpenMapAtPole,
  onCreateSpkForPole,
  onUpdateClearanceDistance,
  onDeletePole,
  onUpdateSpan,
  onDeleteSpan
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'poles' | 'cables'>('poles');
  const [filterSeverity, setFilterSeverity] = useState<'ALL' | 'CRITICAL' | 'VIOLATION' | 'SAFE'>('ALL');
  const [cableFeederFilter, setCableFeederFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPoleId, setEditingPoleId] = useState<string | null>(null);
  const [editDistanceValue, setEditDistanceValue] = useState<number>(3.0);
  const [selectedSpanForEdit, setSelectedSpanForEdit] = useState<CableSpan | null>(null);
  const [spanToDelete, setSpanToDelete] = useState<CableSpan | null>(null);
  const [poleToDelete, setPoleToDelete] = useState<PoleData | null>(null);

  // Pagination for ultra-smooth 60fps rendering without DOM thrashing
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  const allFeeders = useMemo(() => Array.from(new Set(poles.map(p => p.feeder))), [poles]);
  const poleMap = useMemo(() => {
    const map = new Map<string, PoleData>();
    poles.forEach(p => {
      map.set(p.id, p);
      if (p.code) map.set(p.code, p);
    });
    return map;
  }, [poles]);

  const violationsCount = useMemo(() => poles.filter(p => checkIsRowViolation(p.clearanceDistanceMeters, p.type)).length, [poles]);
  const criticalCount = useMemo(() => {
    return poles.filter(p => {
      const minReq = getMinRowRequirement(p.type);
      return p.clearanceDistanceMeters < (minReq / 2);
    }).length;
  }, [poles]);

  const cableViolationsCount = useMemo(() => spans.filter(s => s.hasViolation || (s.clearanceMeters ?? 99) < 3.0 || (s.treeDistanceMeters ?? 99) < 3.0).length, [spans]);

  const filteredPoles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return poles.filter(pole => {
      const matchesSearch = !q ||
        pole.id.toLowerCase().includes(q) ||
        pole.code.toLowerCase().includes(q) ||
        pole.locationName.toLowerCase().includes(q) ||
        pole.feeder.toLowerCase().includes(q);

      const isViol = checkIsRowViolation(pole.clearanceDistanceMeters, pole.type);
      const minReq = getMinRowRequirement(pole.type);
      const isCrit = pole.clearanceDistanceMeters < (minReq / 2);

      let matchesSeverity = true;
      if (filterSeverity === 'CRITICAL') matchesSeverity = isCrit;
      else if (filterSeverity === 'VIOLATION') matchesSeverity = isViol && !isCrit;
      else if (filterSeverity === 'SAFE') matchesSeverity = !isViol;

      return matchesSearch && matchesSeverity;
    });
  }, [poles, searchQuery, filterSeverity]);

  const filteredSpans = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return spans.filter(span => {
      const fromPole = poleMap.get(span.fromPoleId);
      const toPole = poleMap.get(span.toPoleId);
      const feederName = span.feeder || fromPole?.feeder || toPole?.feeder || '';

      const matchesSearch = !q ||
        span.id.toLowerCase().includes(q) ||
        span.fromPoleId.toLowerCase().includes(q) ||
        span.toPoleId.toLowerCase().includes(q) ||
        (fromPole && fromPole.code.toLowerCase().includes(q)) ||
        (toPole && toPole.code.toLowerCase().includes(q)) ||
        feederName.toLowerCase().includes(q) ||
        span.conductorType.toLowerCase().includes(q);

      const matchesFeeder = cableFeederFilter === 'ALL' || feederName === cableFeederFilter;

      const minClear = span.treeDistanceMeters !== undefined
        ? Math.min(span.treeDistanceMeters, span.buildingDistanceMeters ?? 99, span.clearanceMeters ?? 99)
        : span.clearanceMeters ?? 3.5;
      const isViol = span.hasViolation || minClear < 3.0;
      const isCrit = minClear < 1.5;

      let matchesSeverity = true;
      if (filterSeverity === 'CRITICAL') matchesSeverity = isCrit;
      else if (filterSeverity === 'VIOLATION') matchesSeverity = isViol && !isCrit;
      else if (filterSeverity === 'SAFE') matchesSeverity = !isViol;

      return matchesSearch && matchesFeeder && matchesSeverity;
    });
  }, [spans, poleMap, searchQuery, cableFeederFilter, filterSeverity]);

  // Reset page when switching subtabs or filters
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterSeverity, cableFeederFilter, activeSubTab]);

  const currentTotal = activeSubTab === 'poles' ? filteredPoles.length : filteredSpans.length;
  const totalPages = Math.max(1, Math.ceil(currentTotal / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const displayedPoles = useMemo(() => {
    if (pageSize >= 9999) return filteredPoles;
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredPoles.slice(start, start + pageSize);
  }, [filteredPoles, safeCurrentPage, pageSize]);

  const displayedSpans = useMemo(() => {
    if (pageSize >= 9999) return filteredSpans;
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredSpans.slice(start, start + pageSize);
  }, [filteredSpans, safeCurrentPage, pageSize]);

  const handleSaveEdit = (poleId: string) => {
    onUpdateClearanceDistance(poleId, editDistanceValue);
    setEditingPoleId(null);
  };

  const handleDeleteSpanItem = (span: CableSpan) => {
    setSpanToDelete(span);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 text-slate-100">
      
      {/* Permen ESDM Standard Reference Table Card */}
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Tabel Acuan Batas Jarak Aman Minimum (ROW) Permen ESDM / PLN</h3>
              <p className="text-xs text-slate-400">Data acuan standar keselamatan ruang bebas jaringan ketenagalistrikan</p>
            </div>
          </div>
          <span className="bg-amber-500/20 text-amber-300 text-xs font-bold px-3 py-1 rounded-full border border-amber-500/30">
            Acuan Standar Resmi
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3">Jenis Jaringan Listrik</th>
                <th className="p-3">Tegangan</th>
                <th className="p-3">Batas Jarak Aman Minimum (ROW)</th>
                <th className="p-3">Ketentuan Khusus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              <tr className="bg-slate-900/60 hover:bg-slate-800/40">
                <td className="p-3.5 font-bold text-white">
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-mono text-[11px] mr-2">JTR</span>
                  Jaringan Tegangan Rendah (JTR)
                </td>
                <td className="p-3.5 font-mono text-amber-300 font-bold">220 V – 380 V</td>
                <td className="p-3.5 font-black text-emerald-400 text-sm">Minimal 1 Meter</td>
                <td className="p-3.5 text-slate-300 leading-relaxed">
                  Jarak aman kabel udara dari atap/dinding bangunan atau dahan pohon. Jarak aman lintasan jalan raya 5-6 meter.
                </td>
              </tr>

              <tr className="bg-slate-900/60 hover:bg-slate-800/40">
                <td className="p-3.5 font-bold text-white">
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono text-[11px] mr-2">JTM</span>
                  Jaringan Tegangan Menengah (JTM / SUTM)
                </td>
                <td className="p-3.5 font-mono text-amber-300 font-bold">20 kV (20.000 V)</td>
                <td className="p-3.5 font-black text-amber-400 text-sm">Minimal 3 Meter</td>
                <td className="p-3.5 text-slate-300 leading-relaxed">
                  Berlaku untuk jarak horizontal maupun vertikal terhadap bangunan, pepohonan, baliho, antene, dan aktivitas pekerja konstruksi.
                </td>
              </tr>

              <tr className="bg-slate-900/60 hover:bg-slate-800/40">
                <td className="p-3.5 font-bold text-white">
                  <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded font-mono text-[11px] mr-2">SUTT</span>
                  Saluran Udara Tegangan Tinggi (SUTT / SUTET)
                </td>
                <td className="p-3.5 font-mono text-amber-300 font-bold">150 kV – 500 kV</td>
                <td className="p-3.5 font-black text-rose-400 text-sm">Minimal 5 s.d 9+ Meter</td>
                <td className="p-3.5 text-slate-300 leading-relaxed">
                  Tergantung pada jenis menara/tower dan level tegangan (diatur ketat di dalam lampiran <i>Permen ESDM</i>).
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Automatic Alert Banner if ROW Violations detected */}
      {violationsCount > 0 && (
        <div className="bg-rose-500/15 border-2 border-rose-500/60 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl text-rose-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg animate-pulse">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <div className="font-black text-base text-white flex items-center gap-2">
                <span>NOTIFIKASI OTOMATIS: PERINGATAN KESELAMATAN RUANG BEBAS (ROW)</span>
                <span className="bg-rose-600 text-white text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {violationsCount} Titik Terdeteksi
                </span>
              </div>
              <p className="text-xs text-rose-300 mt-1">
                Berdasarkan Acuan Permen ESDM: TR (220V-380V) min 1m, TM (20kV) min 3m, SUTT min 5m. Terdapat {criticalCount} lokasi dalam kondisi KRITIS.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <span className="text-slate-400 font-medium">Acuan Standar ROW</span>
          <div className="text-xl font-black text-amber-400">TR 1m · TM 3m · SUTT 5m</div>
          <span className="text-[11px] text-slate-500">Permen ESDM / SPLN</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <span className="text-slate-400 font-medium">Total Pelanggaran ROW</span>
          <div className="text-2xl font-black text-rose-400">{violationsCount} Lokasi</div>
          <span className="text-[11px] text-rose-400 font-semibold">Memerlukan Rabas Pohon</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <span className="text-slate-400 font-medium">Bahaya Kritis</span>
          <div className="text-2xl font-black text-rose-500">{criticalCount} Lokasi</div>
          <span className="text-[11px] text-rose-300 font-semibold">Prioritas Darurat 24 Jam</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <span className="text-slate-400 font-medium">Jarak Kabel Aman</span>
          <div className="text-2xl font-black text-emerald-400">
            {poles.length - violationsCount} Lokasi
          </div>
          <span className="text-[11px] text-emerald-400 font-semibold">Sesuai Standar</span>
        </div>
      </div>

      {/* Sub-navigation Switcher: Titik Tiang vs Bentangan Kabel - Crisp High Contrast */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-2.5 rounded-2xl border border-slate-700 shadow-md">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('poles')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
              activeSubTab === 'poles'
                ? 'bg-amber-400 text-slate-950 font-black shadow-sm border border-amber-300'
                : 'text-slate-100 hover:text-white font-semibold hover:bg-slate-800 border border-transparent'
            }`}
          >
            <MapPin className={`w-4 h-4 shrink-0 ${activeSubTab === 'poles' ? 'text-slate-950' : 'text-amber-400'}`} />
            <span>1. Data Titik Tiang & ROW ({poles.length})</span>
            {violationsCount > 0 && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                activeSubTab === 'poles' ? 'bg-slate-950 text-amber-300' : 'bg-rose-600 text-white shadow-xs'
              }`}>
                {violationsCount} ROW
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('cables')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
              activeSubTab === 'cables'
                ? 'bg-amber-400 text-slate-950 font-black shadow-sm border border-amber-300'
                : 'text-slate-100 hover:text-white font-semibold hover:bg-slate-800 border border-transparent'
            }`}
          >
            <Cable className={`w-4 h-4 shrink-0 ${activeSubTab === 'cables' ? 'text-slate-950' : 'text-amber-400'}`} />
            <span>2. Data Bentangan Kabel JTM/JTR ({spans.length})</span>
            {cableViolationsCount > 0 && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                activeSubTab === 'cables' ? 'bg-slate-950 text-amber-300' : 'bg-rose-600 text-white shadow-xs'
              }`}>
                {cableViolationsCount} ROW
              </span>
            )}
          </button>
        </div>

        <div className="text-xs font-semibold text-slate-300 px-3">
          {activeSubTab === 'poles'
            ? `Menampilkan ${filteredPoles.length} tiang listrik PLN Baguala`
            : `Menampilkan ${filteredSpans.length} bentangan kabel distribusi`}
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-700/90 flex flex-wrap items-center justify-between gap-4 text-xs shadow-md">
        
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={activeSubTab === 'poles' ? "Cari ID tiang, penyulang, lokasi..." : "Cari ID kabel, tiang, konduktor, penyulang..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 text-white pl-9 pr-3 py-2 rounded-xl border border-slate-600 text-xs font-medium placeholder-slate-400 focus:outline-none focus:border-amber-400 shadow-xs"
            />
          </div>

          {activeSubTab === 'cables' && (
            <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-600 shadow-xs">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <select
                value={cableFeederFilter}
                onChange={(e) => setCableFeederFilter(e.target.value)}
                className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900 text-white font-bold">Semua Penyulang ({allFeeders.length})</option>
                {allFeeders.map(f => (
                  <option key={f} value={f} className="bg-slate-900 text-white font-medium">{f}</option>
                ))}
              </select>
            </div>
          )}

          {/* Severity Tabs - Sharp & High Contrast */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-700 gap-1">
            <button
              onClick={() => setFilterSeverity('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                filterSeverity === 'ALL' ? 'bg-amber-400 text-slate-950 shadow-xs' : 'text-slate-200 hover:text-white'
              }`}
            >
              Semua ({activeSubTab === 'poles' ? poles.length : spans.length})
            </button>
            <button
              onClick={() => setFilterSeverity('CRITICAL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                filterSeverity === 'CRITICAL' ? 'bg-rose-600 text-white shadow-xs font-black' : 'text-slate-200 hover:text-white'
              }`}
            >
              Kritis
            </button>
            <button
              onClick={() => setFilterSeverity('VIOLATION')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                filterSeverity === 'VIOLATION' ? 'bg-amber-400 text-slate-950 shadow-xs font-black' : 'text-slate-200 hover:text-white'
              }`}
            >
              Melanggar ROW
            </button>
            <button
              onClick={() => setFilterSeverity('SAFE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                filterSeverity === 'SAFE' ? 'bg-emerald-500 text-slate-950 shadow-xs font-black' : 'text-slate-200 hover:text-white'
              }`}
            >
              Aman
            </button>
          </div>
        </div>

      </div>

      {/* Main Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        {activeSubTab === 'poles' ? (
          <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-4">ID & Kode Tiang</th>
                <th className="p-4">Jenis & Tegangan</th>
                <th className="p-4">Lokasi / Penyulang</th>
                <th className="p-4">Jarak Saat Ini / Min ROW</th>
                <th className="p-4">Objek Terdekat</th>
                <th className="p-4">Status ROW Permen ESDM</th>
                <th className="p-4 text-center">Tindakan Lapangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {displayedPoles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Tidak ada data tiang listrik yang sesuai filter.
                  </td>
                </tr>
              ) : (
                displayedPoles.map((pole) => {
                const isViolation = checkIsRowViolation(pole.clearanceDistanceMeters, pole.type);
                const minReq = getMinRowRequirement(pole.type);
                const isCritical = pole.clearanceDistanceMeters < (minReq / 2);

                return (
                  <tr key={pole.id} className="hover:bg-slate-800/40 transition-colors">
                    
                    {/* ID & Code */}
                    <td className="p-4 font-bold">
                      <div className="text-white text-sm font-mono">{pole.id}</div>
                      <div className="text-amber-400 font-mono text-[11px]">{pole.code}</div>
                    </td>

                    {/* Voltage & Type */}
                    <td className="p-4 font-bold">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                        pole.type === 'TR'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : pole.type === 'TT'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {pole.type === 'TR' ? 'JTR (220-380V)' : pole.type === 'TT' ? 'SUTT (150kV+)' : 'JTM (20kV)'}
                      </span>
                    </td>

                    {/* Location */}
                    <td className="p-4">
                      <div className="font-semibold text-slate-200">{pole.locationName}</div>
                      <div className="text-[11px] text-slate-400">{pole.feeder}</div>
                    </td>

                    {/* Distance & Editor */}
                    <td className="p-4">
                      {editingPoleId === pole.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            value={editDistanceValue}
                            onChange={(e) => setEditDistanceValue(parseFloat(e.target.value) || 0)}
                            className="w-20 bg-slate-950 border border-amber-500 text-white px-2 py-1 rounded text-xs"
                          />
                          <button
                            onClick={() => handleSaveEdit(pole.id)}
                            className="bg-amber-500 text-slate-950 font-bold px-2 py-1 rounded text-[10px]"
                          >
                            Simpan
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`text-base font-black ${
                            isCritical ? 'text-rose-400' : isViolation ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {pole.clearanceDistanceMeters}m
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            (Min {minReq}m)
                          </span>
                          <button
                            onClick={() => {
                              setEditingPoleId(pole.id);
                              setEditDistanceValue(pole.clearanceDistanceMeters);
                            }}
                            className="text-[10px] text-slate-500 hover:text-slate-300 underline"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Object */}
                    <td className="p-4 font-medium text-slate-300">
                      {pole.clearanceObject}
                    </td>

                    {/* Status Badge */}
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${
                        isCritical
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                          : isViolation
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      }`}>
                        {isViolation ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span>{pole.clearanceStatus}</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => onOpenMapAtPole(pole)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-2 rounded-xl border border-slate-700 transition-all"
                          title="Lihat di Peta GIS"
                        >
                          <ExternalLink className="w-4 h-4 text-amber-400" />
                        </button>

                        <button
                          onClick={() => onCreateSpkForPole(pole)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                            isViolation
                              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md'
                              : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Buat SPK Rabas</span>
                        </button>

                        <button
                          onClick={() => setPoleToDelete(pole)}
                          className="bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white p-2 rounded-xl border border-rose-500/30 transition-all cursor-pointer"
                          title="Hapus Tiang dari Sistem GIS"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
        ) : (
          /* Table 2: Bentangan Kabel */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-4">ID Kabel & Penyulang</th>
                  <th className="p-4">Menghubungkan Tiang</th>
                  <th className="p-4">Jenis Kabel Konduktor</th>
                  <th className="p-4">Panjang (Spat)</th>
                  <th className="p-4">Jarak Pohon & Bangunan</th>
                  <th className="p-4">Kondisi Kabel</th>
                  <th className="p-4">Status ROW</th>
                  <th className="p-4 text-center">Tindakan Kabel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {displayedSpans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      Tidak ada bentangan kabel yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  displayedSpans.map((span) => {
                    const fromPole = poleMap.get(span.fromPoleId);
                    const toPole = poleMap.get(span.toPoleId);
                    const fromCode = fromPole?.code || span.fromPoleId;
                    const toCode = toPole?.code || span.toPoleId;
                    const effectiveFeeder = span.feeder || fromPole?.feeder || toPole?.feeder || '-';

                    const treeDist = span.treeDistanceMeters ?? span.clearanceMeters ?? 3.5;
                    const bldgDist = span.buildingDistanceMeters ?? 4.0;
                    const minClear = Math.min(treeDist, bldgDist);
                    const isViol = span.hasViolation || minClear < 3.0;
                    const isCrit = minClear < 1.5;

                    return (
                      <tr key={span.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-4">
                          <div className="font-mono font-bold text-white text-xs">{span.id}</div>
                          <span className="inline-block mt-1 bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-500/30">
                            {effectiveFeeder}
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="flex items-center gap-1.5 font-bold text-white">
                            <span className="text-amber-400 font-mono">{fromCode}</span>
                            <span className="text-slate-500">↔</span>
                            <span className="text-amber-400 font-mono">{toCode}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {fromPole?.locationName || toPole?.locationName || 'Jalur Distribusi ULP Baguala'}
                          </div>
                        </td>

                        <td className="p-4">
                          <span className="font-semibold text-slate-200 bg-slate-800/90 px-2 py-1 rounded border border-slate-700 text-[11px]">
                            {span.conductorType}
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="font-mono font-bold text-sm text-sky-400">
                            {span.lengthMeters} m
                          </div>
                          <span className="text-[10px] text-slate-500">Spat Jaringan</span>
                        </td>

                        <td className="p-4">
                          <div className="space-y-0.5">
                            <div className="text-[11px]">
                              🌳 Pohon: <b className={treeDist < 3.0 ? 'text-rose-400' : 'text-emerald-400'}>{treeDist}m</b>
                            </div>
                            <div className="text-[11px]">
                              🏢 Bangunan: <b className={bldgDist < 3.0 ? 'text-amber-400' : 'text-emerald-400'}>{bldgDist}m</b>
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            span.cableCondition === 'Baik' || !span.cableCondition
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}>
                            {span.cableCondition || 'Baik'}
                          </span>
                        </td>

                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            isCrit
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                              : isViol
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          }`}>
                            {isViol ? <AlertTriangle className="w-3 h-3 text-rose-400" /> : <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                            <span>{isCrit ? 'Kritis (<1.5m)' : isViol ? 'ROW <3.0m' : 'Aman (≥3.0m)'}</span>
                          </span>
                        </td>

                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedSpanForEdit(span)}
                              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs transition-all shadow-sm cursor-pointer"
                              title="Ubah Informasi Kabel"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Ubah Info</span>
                            </button>

                            <button
                              onClick={() => handleDeleteSpanItem(span)}
                              className="bg-rose-600 hover:bg-rose-500 text-white font-bold p-2 rounded-xl flex items-center justify-center transition-all shadow-sm cursor-pointer"
                              title="Hapus Kabel Ini dari Sistem GIS"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Sleek Pagination Bar */}
        {currentTotal > 0 && (
          <div className="bg-slate-950/90 px-4 py-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-slate-400 flex items-center gap-2">
              <span>
                Menampilkan <b className="text-white">{((safeCurrentPage - 1) * pageSize) + 1}</b> - <b className="text-white">{Math.min(safeCurrentPage * pageSize, currentTotal)}</b> dari <b className="text-amber-400">{currentTotal.toLocaleString('id-ID')}</b> data
              </span>
              <span className="text-slate-600">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Per halaman:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2 py-0.5 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={99999}>Semua</option>
                </select>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safeCurrentPage <= 1}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Sebelumnya</span>
                </button>

                <div className="px-2 py-1 text-slate-300 font-semibold">
                  Halaman <span className="text-white font-bold">{safeCurrentPage}</span> / <span className="text-slate-400">{totalPages}</span>
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span>Selanjutnya</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Cable Information Modal */}
      {selectedSpanForEdit && (
        <EditCableModal
          span={selectedSpanForEdit}
          fromPole={poleMap.get(selectedSpanForEdit.fromPoleId)}
          toPole={poleMap.get(selectedSpanForEdit.toPoleId)}
          allFeeders={allFeeders}
          onClose={() => setSelectedSpanForEdit(null)}
          onSave={(updated) => {
            if (onUpdateSpan) onUpdateSpan(updated);
            setSelectedSpanForEdit(null);
          }}
          onDelete={(spanId, fromPoleId, toPoleId) => {
            if (onDeleteSpan) onDeleteSpan(spanId, fromPoleId, toPoleId);
            setSelectedSpanForEdit(null);
          }}
        />
      )}

      {/* Delete Span Confirmation Modal */}
      {spanToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-rose-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 bg-rose-500/20 rounded-xl border border-rose-500/30">
                <Trash2 className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white">Hapus Bentangan Kabel?</h3>
                <p className="text-xs text-slate-400">Tindakan ini akan menghapus kabel dari jaringan GIS PLN Baguala</p>
              </div>
            </div>

            <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">ID Bentangan:</span>
                <span className="font-mono font-bold text-amber-400">{spanToDelete.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Titik Tiang:</span>
                <span className="font-bold text-white">
                  {poleMap.get(spanToDelete.fromPoleId)?.code || spanToDelete.fromPoleId} ↔ {poleMap.get(spanToDelete.toPoleId)?.code || spanToDelete.toPoleId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Penyulang:</span>
                <span className="font-bold text-sky-400">{spanToDelete.feeder || poleMap.get(spanToDelete.fromPoleId)?.feeder || 'FEEDER PASSO'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Panjang Spat:</span>
                <span className="font-mono font-bold text-emerald-400">{spanToDelete.lengthMeters} meter</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSpanToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteSpan) {
                    onDeleteSpan(spanToDelete.id, spanToDelete.fromPoleId, spanToDelete.toPoleId);
                  }
                  setSpanToDelete(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-all flex items-center gap-1.5 shadow-lg shadow-rose-900/40 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Pole Confirmation Modal */}
      {poleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-rose-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 bg-rose-500/20 rounded-xl border border-rose-500/30">
                <Trash2 className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white">Hapus Titik Tiang?</h3>
                <p className="text-xs text-slate-400">Tiang dan kabel yang tersambung akan dihapus dari peta GIS</p>
              </div>
            </div>

            <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">ID / Kode Tiang:</span>
                <span className="font-mono font-bold text-amber-400">{poleToDelete.id} ({poleToDelete.code})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Lokasi:</span>
                <span className="font-bold text-white">{poleToDelete.locationName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Penyulang:</span>
                <span className="font-bold text-sky-400">{poleToDelete.feeder} · {poleToDelete.type}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPoleToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeletePole) {
                    onDeletePole(poleToDelete.id);
                  }
                  setPoleToDelete(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-all flex items-center gap-1.5 shadow-lg shadow-rose-900/40 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Tiang Ini</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
