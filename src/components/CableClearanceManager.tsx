import React, { useState, useMemo, useEffect } from 'react';
import { PoleData, CableSpan } from '../types';
import { AlertTriangle, ShieldAlert, CheckCircle2, Ruler, Send, FileText, ExternalLink, Search, Filter, Trash2, Zap, BookOpen, Cable, Edit3, MapPin, Layers, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
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
  const [isEsdmExpanded, setIsEsdmExpanded] = useState<boolean>(true);

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
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 text-slate-900 dark:text-slate-100 pb-24 md:pb-8 transition-colors duration-200">
      
      {/* Permen ESDM Standard Reference Card - Mobile & Desktop Responsive */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-amber-500/40 rounded-2xl p-4 sm:p-6 shadow-sm dark:shadow-2xl space-y-3.5 sm:space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/20 text-amber-500 dark:text-amber-400 flex items-center justify-center font-bold shrink-0 mt-0.5 sm:mt-0">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base leading-snug">Standar Batas Jarak Aman Minimum (ROW)</h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">Permen ESDM No. 27/2018 & SPLN Ketenagalistrikan</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-amber-500/30 whitespace-nowrap">
              Acuan Standar Resmi
            </span>
            <button
              type="button"
              onClick={() => setIsEsdmExpanded(prev => !prev)}
              className="md:hidden flex items-center gap-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
            >
              <span>{isEsdmExpanded ? 'Tutup' : 'Lihat'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isEsdmExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile View: High-Readability Cards (md:hidden) */}
        {isEsdmExpanded && (
          <div className="md:hidden space-y-2.5">
            {/* JTR */}
            <div className="bg-slate-50 dark:bg-slate-950/70 border border-emerald-500/30 rounded-xl p-3 space-y-1.5 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded font-mono font-bold text-[10px]">
                    JTR
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white text-xs">Tegangan Rendah</span>
                </div>
                <span className="font-mono text-amber-600 dark:text-amber-300 text-[11px] font-bold">220 V – 380 V</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200 dark:border-slate-800/80">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">Batas Jarak Bebas (ROW):</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-xs">Minimal 1.0 Meter</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Jarak aman kabel udara dari atap/dinding bangunan atau dahan pohon. Lintasan jalan raya 5-6 meter.
              </p>
            </div>

            {/* JTM */}
            <div className="bg-slate-50 dark:bg-slate-950/70 border border-amber-500/40 rounded-xl p-3 space-y-1.5 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded font-mono font-bold text-[10px]">
                    JTM
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white text-xs">Tegangan Menengah (SUTM)</span>
                </div>
                <span className="font-mono text-amber-600 dark:text-amber-300 text-[11px] font-bold">20 kV (20.000 V)</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200 dark:border-slate-800/80">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">Batas Jarak Bebas (ROW):</span>
                <span className="font-black text-amber-600 dark:text-amber-400 text-xs">Minimal 3.0 Meter</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Berlaku vertikal & horizontal terhadap bangunan, pepohonan, baliho, antene, dan aktivitas fisik.
              </p>
            </div>

            {/* SUTT */}
            <div className="bg-slate-50 dark:bg-slate-950/70 border border-rose-500/30 rounded-xl p-3 space-y-1.5 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded font-mono font-bold text-[10px]">
                    SUTT
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white text-xs">Tegangan Tinggi (SUTET)</span>
                </div>
                <span className="font-mono text-amber-600 dark:text-amber-300 text-[11px] font-bold">150 kV – 500 kV</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200 dark:border-slate-800/80">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">Batas Jarak Bebas (ROW):</span>
                <span className="font-black text-rose-600 dark:text-rose-400 text-xs">Minimal 5 s.d 9+ Meter</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Tergantung jenis tower/menara dan level tegangan transmisi sesuai regulasi lampiran Permen ESDM.
              </p>
            </div>
          </div>
        )}

        {/* Desktop View: Full Standard Table (hidden md:block) */}
        <div className="hidden md:block overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl transition-colors">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3">Jenis Jaringan Listrik</th>
                <th className="p-3">Tegangan</th>
                <th className="p-3">Batas Jarak Aman Minimum (ROW)</th>
                <th className="p-3">Ketentuan Khusus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              <tr className="bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                  <span className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-mono text-[11px] mr-2">JTR</span>
                  Jaringan Tegangan Rendah (JTR)
                </td>
                <td className="p-3.5 font-mono text-amber-600 dark:text-amber-300 font-bold">220 V – 380 V</td>
                <td className="p-3.5 font-black text-emerald-600 dark:text-emerald-400 text-sm">Minimal 1 Meter</td>
                <td className="p-3.5 text-slate-600 dark:text-slate-300 leading-relaxed">
                  Jarak aman kabel udara dari atap/dinding bangunan atau dahan pohon. Jarak aman lintasan jalan raya 5-6 meter.
                </td>
              </tr>

              <tr className="bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                  <span className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono text-[11px] mr-2">JTM</span>
                  Jaringan Tegangan Menengah (JTM / SUTM)
                </td>
                <td className="p-3.5 font-mono text-amber-600 dark:text-amber-300 font-bold">20 kV (20.000 V)</td>
                <td className="p-3.5 font-black text-amber-600 dark:text-amber-400 text-sm">Minimal 3 Meter</td>
                <td className="p-3.5 text-slate-600 dark:text-slate-300 leading-relaxed">
                  Berlaku untuk jarak horizontal maupun vertikal terhadap bangunan, pepohonan, baliho, antene, dan aktivitas pekerja konstruksi.
                </td>
              </tr>

              <tr className="bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                  <span className="bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded font-mono text-[11px] mr-2">SUTT</span>
                  Saluran Udara Tegangan Tinggi (SUTT / SUTET)
                </td>
                <td className="p-3.5 font-mono text-amber-600 dark:text-amber-300 font-bold">150 kV – 500 kV</td>
                <td className="p-3.5 font-black text-rose-600 dark:text-rose-400 text-sm">Minimal 5 s.d 9+ Meter</td>
                <td className="p-3.5 text-slate-600 dark:text-slate-300 leading-relaxed">
                  Tergantung pada jenis menara/tower dan level tegangan (diatur ketat di dalam lampiran <i>Permen ESDM</i>).
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Automatic Alert Banner if ROW Violations detected */}
      {violationsCount > 0 && (
        <div className="bg-rose-500/15 border-2 border-rose-500/60 p-3.5 sm:p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 shadow-xl text-rose-200">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-rose-500 text-white rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-lg animate-pulse">
              <ShieldAlert className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div>
              <div className="font-black text-xs sm:text-base text-white flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span>PERINGATAN KESELAMATAN RUANG BEBAS (ROW)</span>
                <span className="bg-rose-600 text-white text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold">
                  {violationsCount} Titik
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-rose-300 mt-0.5 sm:mt-1">
                TR min 1m, TM min 3m, SUTT min 5m. Terdapat <b className="text-white underline">{criticalCount} lokasi KRITIS</b> (&lt;1.5m).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Overview Cards - Mobile 2x2 Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 text-xs">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-xl space-y-1 shadow-xs dark:shadow-md transition-all duration-200 hover:-translate-y-0.5">
          <span className="text-slate-500 dark:text-slate-400 font-semibold text-[11px]">Standar ROW</span>
          <div className="text-base sm:text-xl font-black text-amber-500 dark:text-amber-400">TR 1m · TM 3m</div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Permen ESDM Resmi</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-xl space-y-1 shadow-xs dark:shadow-md transition-all duration-200 hover:-translate-y-0.5">
          <span className="text-slate-500 dark:text-slate-400 font-semibold text-[11px]">Pelanggaran ROW</span>
          <div className="text-lg sm:text-2xl font-black text-rose-600 dark:text-rose-400">{violationsCount} Lokasi</div>
          <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold block">Perlu Rabas</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-xl space-y-1 shadow-xs dark:shadow-md transition-all duration-200 hover:-translate-y-0.5">
          <span className="text-slate-500 dark:text-slate-400 font-semibold text-[11px]">Bahaya Kritis</span>
          <div className="text-lg sm:text-2xl font-black text-rose-700 dark:text-rose-500">{criticalCount} Lokasi</div>
          <span className="text-[10px] text-rose-600 dark:text-rose-300 font-bold block">Darurat &lt;1.5m</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-xl space-y-1 shadow-xs dark:shadow-md transition-all duration-200 hover:-translate-y-0.5">
          <span className="text-slate-500 dark:text-slate-400 font-semibold text-[11px]">Jarak Bebas Aman</span>
          <div className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {poles.length - violationsCount} Lokasi
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">Sesuai Standar</span>
        </div>
      </div>

      {/* Sub-navigation Switcher: Titik Tiang vs Bentangan Kabel - Segmented Pill */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-100 dark:bg-slate-900 p-2 sm:p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs dark:shadow-md transition-colors">
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveSubTab('poles')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2 rounded-xl text-xs transition-colors cursor-pointer ${
              activeSubTab === 'poles'
                ? 'bg-amber-400 text-slate-950 font-black shadow-xs border border-amber-300'
                : 'text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white font-semibold hover:bg-slate-200 dark:hover:bg-slate-800 border border-transparent'
            }`}
          >
            <MapPin className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${activeSubTab === 'poles' ? 'text-slate-950' : 'text-amber-500 dark:text-amber-400'}`} />
            <span className="truncate">Tiang & ROW ({poles.length})</span>
            {violationsCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                activeSubTab === 'poles' ? 'bg-slate-950 text-amber-300' : 'bg-rose-600 text-white'
              }`}>
                {violationsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('cables')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2 rounded-xl text-xs transition-colors cursor-pointer ${
              activeSubTab === 'cables'
                ? 'bg-amber-400 text-slate-950 font-black shadow-sm border border-amber-300'
                : 'text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white font-semibold hover:bg-slate-200 dark:hover:bg-slate-800 border border-transparent'
            }`}
          >
            <Cable className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${activeSubTab === 'cables' ? 'text-slate-950' : 'text-amber-500 dark:text-amber-400'}`} />
            <span className="truncate">Kabel ({spans.length})</span>
            {cableViolationsCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                activeSubTab === 'cables' ? 'bg-slate-950 text-amber-300' : 'bg-rose-600 text-white'
              }`}>
                {cableViolationsCount}
              </span>
            )}
          </button>
        </div>

        <div className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 px-1 text-center sm:text-right">
          {activeSubTab === 'poles'
            ? `${filteredPoles.length} tiang PLN Baguala`
            : `${filteredSpans.length} bentangan kabel`}
        </div>
      </div>

      {/* Filter & Search Toolbar - Responsive Mobile Stack */}
      <div className="bg-white dark:bg-slate-900 p-3 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs shadow-sm dark:shadow-md transition-colors">
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 flex-1">
          {/* Search */}
          <div className="relative w-full sm:min-w-[240px] sm:max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={activeSubTab === 'poles' ? "Cari ID tiang, lokasi, penyulang..." : "Cari kabel, tiang, penyulang..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:border-amber-500 transition-colors shadow-xs"
            />
          </div>

          {activeSubTab === 'cables' && (
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs transition-colors">
              <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
              <select
                value={cableFeederFilter}
                onChange={(e) => setCableFeederFilter(e.target.value)}
                className="bg-transparent text-slate-900 dark:text-white text-xs font-bold focus:outline-none cursor-pointer w-full"
              >
                <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold">Semua Penyulang ({allFeeders.length})</option>
                {allFeeders.map(f => (
                  <option key={f} value={f} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium">{f}</option>
                ))}
              </select>
            </div>
          )}

          {/* Severity Tabs - Responsive 4-Column on Mobile */}
          <div className="grid grid-cols-4 sm:flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 gap-1 w-full sm:w-auto transition-colors">
            <button
              onClick={() => setFilterSeverity('ALL')}
              className={`px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer text-center ${
                filterSeverity === 'ALL' ? 'bg-amber-400 text-slate-950 shadow-xs font-black' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setFilterSeverity('CRITICAL')}
              className={`px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer text-center ${
                filterSeverity === 'CRITICAL' ? 'bg-rose-600 text-white shadow-xs font-black' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Kritis
            </button>
            <button
              onClick={() => setFilterSeverity('VIOLATION')}
              className={`px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer text-center ${
                filterSeverity === 'VIOLATION' ? 'bg-amber-400 text-slate-950 shadow-xs font-black' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              ROW
            </button>
            <button
              onClick={() => setFilterSeverity('SAFE')}
              className={`px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer text-center ${
                filterSeverity === 'SAFE' ? 'bg-emerald-500 text-slate-950 shadow-xs font-black' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Aman
            </button>
          </div>
        </div>

      </div>

      {/* Main Content: Mobile Card View (md:hidden) & Desktop Table View (hidden md:block) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm dark:shadow-xl transition-colors">
        {activeSubTab === 'poles' ? (
          <>
            {/* 1. MOBILE CARD VIEW FOR POLES (md:hidden) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/90">
              {displayedPoles.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                  Tidak ada data tiang listrik yang sesuai filter pencarian.
                </div>
              ) : (
                displayedPoles.map((pole) => {
                  const isViolation = checkIsRowViolation(pole.clearanceDistanceMeters, pole.type);
                  const minReq = getMinRowRequirement(pole.type);
                  const isCritical = pole.clearanceDistanceMeters < (minReq / 2);

                  return (
                    <div key={pole.id} className="p-3.5 space-y-3 bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors">
                      {/* Top Row: Code, Type, Feeder, Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-900 dark:text-white font-mono font-black text-sm tracking-tight">{pole.code}</span>
                            <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">({pole.id})</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              pole.type === 'TR'
                                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                : pole.type === 'TT'
                                  ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                                  : 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                            }`}>
                              {pole.type === 'TR' ? 'JTR 220-380V' : pole.type === 'TT' ? 'SUTT 150kV+' : 'JTM 20kV'}
                            </span>
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold truncate max-w-[130px]">
                              ⚡ {pole.feeder}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border shrink-0 ${
                          isCritical
                            ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40 animate-pulse'
                            : isViolation
                              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                        }`}>
                          {isViolation ? <AlertTriangle className="w-3 h-3 text-amber-500 dark:text-amber-400 shrink-0" /> : <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                          <span>{isCritical ? 'Kritis' : isViolation ? 'Pelanggaran ROW' : 'Aman'}</span>
                        </span>
                      </div>

                      {/* Location Name */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                        <span className="font-medium truncate">{pole.locationName}</span>
                      </div>

                      {/* Metrics Box */}
                      <div className="bg-slate-50 dark:bg-slate-950/80 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs transition-colors">
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">Jarak Bebas ROW:</span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className={`text-base font-black ${
                              isCritical ? 'text-rose-600 dark:text-rose-400' : isViolation ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                              {pole.clearanceDistanceMeters}m
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">(Min {minReq}m)</span>
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">Objek Penghalang:</span>
                          <span className="text-slate-900 dark:text-white font-bold text-xs truncate block mt-0.5" title={pole.clearanceObject}>
                            {pole.clearanceObject || '-'}
                          </span>
                        </div>

                        <div className="col-span-2 pt-1.5 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 dark:text-slate-400">Kondisi Fisik Tiang:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{pole.physicalCondition || 'Baik'}</span>
                        </div>
                      </div>

                      {/* Touch-Friendly Action Buttons */}
                      <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => onOpenMapAtPole(pole)}
                          className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                          <span>Peta</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onCreateSpkForPole(pole)}
                          className={`col-span-2 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer ${
                            isViolation
                              ? 'bg-rose-600 hover:bg-rose-500 text-white'
                              : 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-black'
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          <span>Buat SPK Rabas</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingPoleId(pole.id);
                            setEditDistanceValue(pole.clearanceDistanceMeters);
                          }}
                          className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 shrink-0" />
                          <span>Ubah</span>
                        </button>
                      </div>

                      {/* Inline Distance Editor on Mobile */}
                      {editingPoleId === pole.id && (
                        <div className="bg-slate-100 dark:bg-slate-950 p-2.5 rounded-xl border border-amber-500/50 flex items-center justify-between gap-2 mt-1">
                          <span className="text-[11px] text-amber-700 dark:text-amber-300 font-bold">Ubah Jarak (m):</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.1"
                              value={editDistanceValue}
                              onChange={(e) => setEditDistanceValue(parseFloat(e.target.value) || 0)}
                              className="w-16 bg-white dark:bg-slate-900 border border-amber-400 text-slate-900 dark:text-white px-2 py-1 rounded text-xs font-bold text-center"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(pole.id)}
                              className="bg-amber-400 text-slate-950 font-black px-2.5 py-1 rounded text-xs cursor-pointer"
                            >
                              Simpan
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPoleId(null)}
                              className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold px-2 py-1 rounded text-xs cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* 2. DESKTOP TABLE VIEW FOR POLES (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
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
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {displayedPoles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500 dark:text-slate-400">
                        Tidak ada data tiang listrik yang sesuai filter.
                      </td>
                    </tr>
                  ) : (
                    displayedPoles.map((pole) => {
                      const isViolation = checkIsRowViolation(pole.clearanceDistanceMeters, pole.type);
                      const minReq = getMinRowRequirement(pole.type);
                      const isCritical = pole.clearanceDistanceMeters < (minReq / 2);

                      return (
                        <tr key={pole.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-4 font-bold">
                            <div className="text-slate-900 dark:text-white text-sm font-mono">{pole.id}</div>
                            <div className="text-amber-600 dark:text-amber-400 font-mono text-[11px]">{pole.code}</div>
                          </td>

                          <td className="p-4 font-bold">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                              pole.type === 'TR'
                                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                : pole.type === 'TT'
                                  ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                                  : 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                            }`}>
                              {pole.type === 'TR' ? 'JTR (220-380V)' : pole.type === 'TT' ? 'SUTT (150kV+)' : 'JTM (20kV)'}
                            </span>
                          </td>

                          <td className="p-4">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">{pole.locationName}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">{pole.feeder}</div>
                          </td>

                          <td className="p-4">
                            {editingPoleId === pole.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={editDistanceValue}
                                  onChange={(e) => setEditDistanceValue(parseFloat(e.target.value) || 0)}
                                  className="w-20 bg-white dark:bg-slate-950 border border-amber-500 text-slate-900 dark:text-white px-2 py-1 rounded text-xs"
                                />
                                <button
                                  onClick={() => handleSaveEdit(pole.id)}
                                  className="bg-amber-400 text-slate-950 font-bold px-2 py-1 rounded text-[10px]"
                                >
                                  Simpan
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className={`text-base font-black ${
                                  isCritical ? 'text-rose-600 dark:text-rose-400' : isViolation ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
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
                                  className="text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
                                >
                                  Edit
                                </button>
                              </div>
                            )}
                          </td>

                          <td className="p-4 font-medium text-slate-700 dark:text-slate-300">
                            {pole.clearanceObject}
                          </td>

                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${
                              isCritical
                                ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40 animate-pulse'
                                : isViolation
                                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
                                  : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                            }`}>
                              {isViolation ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                              <span>{pole.clearanceStatus}</span>
                            </span>
                          </td>

                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => onOpenMapAtPole(pole)}
                                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 p-2 rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                                title="Lihat di Peta GIS"
                              >
                                <ExternalLink className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                              </button>

                              <button
                                onClick={() => onCreateSpkForPole(pole)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                                  isViolation
                                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md'
                                    : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                                }`}
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Buat SPK Rabas</span>
                              </button>

                              <button
                                onClick={() => setPoleToDelete(pole)}
                                className="bg-rose-500/10 hover:bg-rose-600 text-rose-600 hover:text-white dark:bg-rose-500/20 dark:text-rose-300 dark:hover:text-white p-2 rounded-xl border border-rose-500/30 transition-all cursor-pointer"
                                title="Hapus Tiang dari Sistem GIS"
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
          </>
        ) : (
          <>
            {/* 3. MOBILE CARD VIEW FOR CABLES (md:hidden) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/90">
              {displayedSpans.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                  Tidak ada bentangan kabel yang sesuai filter pencarian.
                </div>
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
                    <div key={span.id} className="p-3.5 space-y-3 bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors">
                      {/* Top Row: From ↔ To, Spat, Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 font-mono font-black text-sm text-slate-900 dark:text-white">
                            <span className="text-amber-600 dark:text-amber-400">{fromCode}</span>
                            <span className="text-slate-400 dark:text-slate-500">↔</span>
                            <span className="text-amber-600 dark:text-amber-400">{toCode}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] border border-slate-200 dark:border-slate-700">
                              {span.conductorType}
                            </span>
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                              ⚡ {effectiveFeeder}
                            </span>
                          </div>
                        </div>

                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border shrink-0 ${
                          isCrit
                            ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40 animate-pulse'
                            : isViol
                              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                        }`}>
                          {isViol ? <AlertTriangle className="w-3 h-3 text-amber-500 dark:text-amber-400 shrink-0" /> : <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                          <span>{isCrit ? 'Kritis' : isViol ? 'ROW <3m' : 'Aman'}</span>
                        </span>
                      </div>

                      {/* Location & Spat */}
                      <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                          📍 {fromPole?.locationName || toPole?.locationName || 'Jalur Distribusi ULP Baguala'}
                        </span>
                        <span className="font-mono font-bold text-sky-600 dark:text-sky-400 text-xs shrink-0">
                          Spat {span.lengthMeters}m
                        </span>
                      </div>

                      {/* Metrics Box */}
                      <div className="bg-slate-50 dark:bg-slate-950/80 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs transition-colors">
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">Jarak Pohon:</span>
                          <span className={`text-sm font-black block mt-0.5 ${treeDist < 3.0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            🌳 {treeDist}m
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">Jarak Bangunan:</span>
                          <span className={`text-sm font-black block mt-0.5 ${bldgDist < 3.0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            🏢 {bldgDist}m
                          </span>
                        </div>

                        <div className="col-span-2 pt-1.5 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 dark:text-slate-400">Kondisi Fisik Kabel:</span>
                          <span className={`font-bold ${
                            span.cableCondition === 'Baik' || !span.cableCondition ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {span.cableCondition || 'Baik'}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="grid grid-cols-2 gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => setSelectedSpanForEdit(span)}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition-colors shadow-sm cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Ubah Info Kabel</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteSpanItem(span)}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-600 text-rose-600 hover:text-white dark:bg-rose-600/20 dark:hover:bg-rose-600 dark:text-rose-300 dark:hover:text-white text-xs font-bold border border-rose-500/30 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus Kabel</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 4. DESKTOP TABLE VIEW FOR CABLES (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
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
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {displayedSpans.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500 dark:text-slate-400">
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
                        <tr key={span.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-4">
                            <div className="font-mono font-bold text-slate-900 dark:text-white text-xs">{span.id}</div>
                            <span className="inline-block mt-1 bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-500/30">
                              {effectiveFeeder}
                            </span>
                          </td>

                          <td className="p-4">
                            <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                              <span className="text-amber-600 dark:text-amber-400 font-mono">{fromCode}</span>
                              <span className="text-slate-400 dark:text-slate-500">↔</span>
                              <span className="text-amber-600 dark:text-amber-400 font-mono">{toCode}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {fromPole?.locationName || toPole?.locationName || 'Jalur Distribusi ULP Baguala'}
                            </div>
                          </td>

                          <td className="p-4">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/90 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px]">
                              {span.conductorType}
                            </span>
                          </td>

                          <td className="p-4">
                            <div className="font-mono font-bold text-sm text-sky-600 dark:text-sky-400">
                              {span.lengthMeters} m
                            </div>
                            <span className="text-[10px] text-slate-500">Spat Jaringan</span>
                          </td>

                          <td className="p-4">
                            <div className="space-y-0.5">
                              <div className="text-[11px]">
                                🌳 Pohon: <b className={treeDist < 3.0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>{treeDist}m</b>
                              </div>
                              <div className="text-[11px]">
                                🏢 Bangunan: <b className={bldgDist < 3.0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>{bldgDist}m</b>
                              </div>
                            </div>
                          </td>

                          <td className="p-4">
                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                              span.cableCondition === 'Baik' || !span.cableCondition
                                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                            }`}>
                              {span.cableCondition || 'Baik'}
                            </span>
                          </td>

                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                              isCrit
                                ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40 animate-pulse'
                                : isViol
                                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
                                  : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                            }`}>
                              {isViol ? <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" /> : <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                              <span>{isCrit ? 'Kritis (<1.5m)' : isViol ? 'ROW <3.0m' : 'Aman (≥3.0m)'}</span>
                            </span>
                          </td>

                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setSelectedSpanForEdit(span)}
                                className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs transition-all shadow-sm cursor-pointer"
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
          </>
        )}

        {/* Responsive Sleek Pagination Bar */}
        {currentTotal > 0 && (
          <div className="bg-slate-50 dark:bg-slate-950/90 px-3.5 sm:px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs transition-colors">
            <div className="text-slate-600 dark:text-slate-400 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-[11px] sm:text-xs">
              <span>
                <b className="text-slate-900 dark:text-white">{((safeCurrentPage - 1) * pageSize) + 1}</b> - <b className="text-slate-900 dark:text-white">{Math.min(safeCurrentPage * pageSize, currentTotal)}</b> dari <b className="text-amber-600 dark:text-amber-400">{currentTotal.toLocaleString('id-ID')}</b>
              </span>
              <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Per hal:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-[11px] sm:text-xs rounded-lg px-2 py-0.5 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={99999}>Semua</option>
                </select>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-end">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safeCurrentPage <= 1}
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-transparent transition-all flex items-center gap-1 cursor-pointer text-[11px] sm:text-xs"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Sebelumnya</span>
                </button>

                <div className="px-2 py-1 text-slate-700 dark:text-slate-300 font-semibold text-[11px] sm:text-xs">
                  <span className="text-slate-900 dark:text-white font-bold">{safeCurrentPage}</span> / <span className="text-slate-500 dark:text-slate-400">{totalPages}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-transparent transition-all flex items-center gap-1 cursor-pointer text-[11px] sm:text-xs"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 transition-colors">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 bg-rose-500/15 rounded-xl border border-rose-500/30">
                <Trash2 className="w-6 h-6 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Hapus Bentangan Kabel?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Tindakan ini akan menghapus kabel dari jaringan GIS PLN Baguala</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950/80 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">ID Bentangan:</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{spanToDelete.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Titik Tiang:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {poleMap.get(spanToDelete.fromPoleId)?.code || spanToDelete.fromPoleId} ↔ {poleMap.get(spanToDelete.toPoleId)?.code || spanToDelete.toPoleId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Penyulang:</span>
                <span className="font-bold text-sky-600 dark:text-sky-400">{spanToDelete.feeder || poleMap.get(spanToDelete.fromPoleId)?.feeder || 'FEEDER PASSO'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Panjang Spat:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{spanToDelete.lengthMeters} meter</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSpanToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-transparent transition-all cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 transition-colors">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 bg-rose-500/15 rounded-xl border border-rose-500/30">
                <Trash2 className="w-6 h-6 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Hapus Titik Tiang?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Tiang dan kabel yang tersambung akan dihapus dari peta GIS</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950/80 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">ID / Kode Tiang:</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{poleToDelete.id} ({poleToDelete.code})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Lokasi:</span>
                <span className="font-bold text-slate-900 dark:text-white">{poleToDelete.locationName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Penyulang:</span>
                <span className="font-bold text-sky-600 dark:text-sky-400">{poleToDelete.feeder} · {poleToDelete.type}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPoleToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-transparent transition-all cursor-pointer"
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
