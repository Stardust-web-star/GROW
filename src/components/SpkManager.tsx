import React, { useState } from 'react';
import { MaintenanceWorkOrder, PoleData } from '../types';
import { FileText, Plus, Printer, CheckCircle, Clock, Zap, Calendar, UserCheck, Edit3, RotateCcw, ArrowLeft, Search, ShieldCheck, MapPin, AlertTriangle, Layers, ChevronRight, Eye } from 'lucide-react';
import plnOfficialLogo from '../assets/images/Logo_PLN.png';

interface SpkManagerProps {
  spks: MaintenanceWorkOrder[];
  poles: PoleData[];
  onCreateSpk: (spk: MaintenanceWorkOrder) => void;
}

export const SpkManager: React.FC<SpkManagerProps> = ({
  spks,
  poles,
  onCreateSpk
}) => {
  const [selectedSpk, setSelectedSpk] = useState<MaintenanceWorkOrder | null>(spks[0] || null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<'list' | 'detail'>('list');
  const [mobileDocMode, setMobileDocMode] = useState<'card' | 'a4'>('card');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const activePole = selectedSpk ? poles.find(p => p.id === selectedSpk.poleId) : null;

  // Signatory Officials State (Manager & Supervisor Teknik)
  const DEFAULT_MANAGER_NAME = 'M. Ridwan Pelupessy';
  const DEFAULT_MANAGER_NIP = '8812039482';
  const DEFAULT_SUPERVISOR_NAME = 'Ahmad Latuconsina';
  const DEFAULT_SUPERVISOR_NIP = '9114028391';

  const [managerName, setManagerName] = useState<string>(() => {
    return localStorage.getItem('pln_manager_name') || DEFAULT_MANAGER_NAME;
  });
  const [managerNip, setManagerNip] = useState<string>(() => {
    return localStorage.getItem('pln_manager_nip') || DEFAULT_MANAGER_NIP;
  });
  const [supervisorName, setSupervisorName] = useState<string>(() => {
    return localStorage.getItem('pln_supervisor_name') || DEFAULT_SUPERVISOR_NAME;
  });
  const [supervisorNip, setSupervisorNip] = useState<string>(() => {
    return localStorage.getItem('pln_supervisor_nip') || DEFAULT_SUPERVISOR_NIP;
  });

  const [showSignatoryModal, setShowSignatoryModal] = useState<boolean>(false);
  const [editManagerName, setEditManagerName] = useState<string>(managerName);
  const [editManagerNip, setEditManagerNip] = useState<string>(managerNip);
  const [editSupervisorName, setEditSupervisorName] = useState<string>(supervisorName);
  const [editSupervisorNip, setEditSupervisorNip] = useState<string>(supervisorNip);

  const openSignatoryModal = () => {
    setEditManagerName(managerName);
    setEditManagerNip(managerNip);
    setEditSupervisorName(supervisorName);
    setEditSupervisorNip(supervisorNip);
    setShowSignatoryModal(true);
  };

  const handleSaveSignatories = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanManagerName = editManagerName.trim() || DEFAULT_MANAGER_NAME;
    const cleanManagerNip = editManagerNip.trim() || DEFAULT_MANAGER_NIP;
    const cleanSupervisorName = editSupervisorName.trim() || DEFAULT_SUPERVISOR_NAME;
    const cleanSupervisorNip = editSupervisorNip.trim() || DEFAULT_SUPERVISOR_NIP;

    setManagerName(cleanManagerName);
    setManagerNip(cleanManagerNip);
    setSupervisorName(cleanSupervisorName);
    setSupervisorNip(cleanSupervisorNip);

    localStorage.setItem('pln_manager_name', cleanManagerName);
    localStorage.setItem('pln_manager_nip', cleanManagerNip);
    localStorage.setItem('pln_supervisor_name', cleanSupervisorName);
    localStorage.setItem('pln_supervisor_nip', cleanSupervisorNip);

    setShowSignatoryModal(false);
  };

  const handleResetSignatories = () => {
    setEditManagerName(DEFAULT_MANAGER_NAME);
    setEditManagerNip(DEFAULT_MANAGER_NIP);
    setEditSupervisorName(DEFAULT_SUPERVISOR_NAME);
    setEditSupervisorNip(DEFAULT_SUPERVISOR_NIP);
  };

  // New SPK Form State
  const [targetPoleId, setTargetPoleId] = useState<string>(poles[0]?.id || '');
  const [issueType, setIssueType] = useState<string>('Rabas Pohon (ROW < 3m)');
  const [priority, setPriority] = useState<'Kritis' | 'Tinggi' | 'Sedang' | 'Rutin'>('Tinggi');
  const [assignedTeam, setAssignedTeam] = useState<string>('Tim Yantek Regu A Passo');
  const [scheduledDate, setScheduledDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const handleSaveSpk = (e: React.FormEvent) => {
    e.preventDefault();
    const targetPole = poles.find(p => p.id === targetPoleId);
    const newSpk: MaintenanceWorkOrder = {
      id: `SPK-${Date.now()}`,
      spkNumber: `SPK/ULP-BGL/2026/${String(spks.length + 101).padStart(3, '0')}`,
      poleId: targetPoleId,
      locationName: targetPole?.locationName || 'Wilayah Kerja ULP Baguala',
      issueType,
      priority,
      assignedTeam,
      scheduledDate,
      status: 'Disetujui',
      aiRecommendation: `Prioritas penanganan pada ${targetPoleId}. Pertahankan jarak aman bebas kabel minimal 3.0 Meter.`,
      createdAt: new Date().toISOString().split('T')[0]
    };

    onCreateSpk(newSpk);
    setSelectedSpk(newSpk);
    setShowCreateModal(false);
    setMobileTab('detail');
  };

  const filteredSpks = spks.filter(spk => {
    const matchesPriority = filterPriority === 'all' || spk.priority === filterPriority;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query || 
      spk.spkNumber.toLowerCase().includes(query) ||
      spk.poleId.toLowerCase().includes(query) ||
      spk.locationName.toLowerCase().includes(query) ||
      spk.issueType.toLowerCase().includes(query) ||
      spk.assignedTeam.toLowerCase().includes(query);
    return matchesPriority && matchesSearch;
  });

  const kritisCount = spks.filter(s => s.priority === 'Kritis').length;
  const tinggiCount = spks.filter(s => s.priority === 'Tinggi').length;

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 text-slate-900 dark:text-slate-100 pb-28 md:pb-8">
      
      {/* Top Bar Banner - Fully responsive */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500/20 text-amber-500 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-xl lg:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-snug">
              Surat Perintah Kerja (SPK) Pemeliharaan
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              PLN ULP Baguala • Manajemen rabas pohon (ROW) &amp; pemeliharaan jaringan 20 kV
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer w-full sm:w-auto shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Buat SPK Baru</span>
        </button>
      </div>

      {/* Overview Stat Badges */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
        <div className="bg-white dark:bg-slate-900/80 p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold">Total SPK</div>
          <div className="text-base sm:text-xl font-black text-slate-900 dark:text-white mt-0.5">{spks.length}</div>
        </div>
        <div className="bg-rose-50 dark:bg-slate-900/80 p-2.5 sm:p-3 rounded-xl border border-rose-200 dark:border-rose-500/30 dark:bg-rose-500/5 shadow-sm transition-colors">
          <div className="text-[10px] sm:text-xs text-rose-600 dark:text-rose-300 font-semibold flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            Prioritas Kritis
          </div>
          <div className="text-base sm:text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">{kritisCount}</div>
        </div>
        <div className="bg-amber-50 dark:bg-slate-900/80 p-2.5 sm:p-3 rounded-xl border border-amber-200 dark:border-amber-500/30 dark:bg-amber-500/5 shadow-sm transition-colors">
          <div className="text-[10px] sm:text-xs text-amber-700 dark:text-amber-300 font-semibold">Prioritas Tinggi</div>
          <div className="text-base sm:text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{tinggiCount}</div>
        </div>
      </div>

      {/* Mobile Screen Segmented Switcher (Visible on mobile only) */}
      <div className="lg:hidden flex items-center bg-slate-200/80 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-300 dark:border-slate-800 gap-1.5 transition-colors">
        <button
          onClick={() => setMobileTab('list')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            mobileTab === 'list'
              ? 'bg-amber-500 text-slate-950 shadow-md font-black'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Daftar SPK ({filteredSpks.length})</span>
        </button>
        <button
          onClick={() => {
            if (!selectedSpk && spks.length > 0) setSelectedSpk(spks[0]);
            setMobileTab('detail');
          }}
          className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            mobileTab === 'detail'
              ? 'bg-amber-500 text-slate-950 shadow-md font-black'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Detail Dokumen {selectedSpk ? `(${selectedSpk.spkNumber.split('/').pop()})` : ''}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SPK List Sidebar (Desktop always visible, Mobile toggleable) */}
        <div className={`bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-lg transition-colors ${
          mobileTab === 'list' ? 'block' : 'hidden lg:block'
        }`}>
          {/* Header & Search */}
          <div className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                <span>Daftar SPK Aktif</span>
              </span>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-300 px-2 py-0.5 rounded-full font-mono font-bold">
                {filteredSpks.length} dari {spks.length}
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari no. SPK, tiang, pelaksana..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500/70"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-1 pt-1">
              {['all', 'Kritis', 'Tinggi', 'Sedang', 'Rutin'].map(p => (
                <button
                  key={p}
                  onClick={() => setFilterPriority(p)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    filterPriority === p
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {p === 'all' ? 'Semua' : p}
                </button>
              ))}
            </div>
          </div>

          {/* SPK Cards Scroll Area */}
          <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
            {filteredSpks.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                Tidak ada SPK yang sesuai filter.
              </div>
            ) : (
              filteredSpks.map((spk) => {
                const isSelected = selectedSpk?.id === spk.id;
                return (
                  <div
                    key={spk.id}
                    onClick={() => {
                      setSelectedSpk(spk);
                      if (window.innerWidth < 1024) {
                        setMobileTab('detail');
                      }
                    }}
                    className={`p-3 sm:p-3.5 rounded-xl border cursor-pointer transition-all active:scale-[0.99] ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/70 text-slate-900 dark:text-white shadow-md'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span className="font-mono font-black text-amber-600 dark:text-amber-400">{spk.spkNumber}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        spk.priority === 'Kritis' 
                          ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30' 
                          : spk.priority === 'Tinggi'
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30'
                      }`}>
                        {spk.priority}
                      </span>
                    </div>

                    <div className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                      {spk.poleId} — {spk.issueType}
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1.5 truncate">
                      <MapPin className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
                      <span className="truncate">{spk.locationName}</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800/80 mt-2">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{spk.assignedTeam}</span>
                      <span className="font-mono text-slate-500 dark:text-slate-400">{spk.scheduledDate}</span>
                    </div>

                    {/* Mobile Tap Prompt */}
                    <div className="lg:hidden flex items-center justify-end gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-bold pt-1.5 mt-1 border-t border-amber-500/10">
                      <span>Lihat Dokumen SPK</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SPK Details Document View (Desktop column 2 & 3, Mobile toggleable) */}
        <div className={`lg:col-span-2 spk-wrapper space-y-4 ${
          mobileTab === 'detail' ? 'block' : 'hidden lg:block'
        }`}>
          
          {selectedSpk ? (
            <>
              {/* Mobile Back Bar (Visible on mobile only) */}
              <div className="lg:hidden flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl shadow-sm transition-colors">
                <button
                  onClick={() => setMobileTab('list')}
                  className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 py-1 px-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 active:scale-95 transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali ke Daftar</span>
                </button>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                    {selectedSpk.spkNumber}
                  </span>
                </div>
              </div>

              {/* Mobile View Mode Switcher: Card Summary vs Printable A4 */}
              <div className="lg:hidden flex items-center bg-slate-200/80 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-300 dark:border-slate-800 text-xs font-bold gap-1.5 transition-colors">
                <button
                  onClick={() => setMobileDocMode('card')}
                  className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    mobileDocMode === 'card'
                      ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Tampilan Ringkas Mobile</span>
                </button>
                <button
                  onClick={() => setMobileDocMode('a4')}
                  className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    mobileDocMode === 'a4'
                      ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Format Cetak A4</span>
                </button>
              </div>

              {/* Document Action Toolbar */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl print:hidden transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">Pratinjau Dokumen SPK</span>
                      <span className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-500/30">
                        Standar Resmi A4
                      </span>
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
                      Surat tugas resmi siap cetak, simpan PDF, atau verifikasi lapangan.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={openSignatoryModal}
                    className="flex-1 sm:flex-initial bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white font-bold px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl text-[11px] sm:text-xs flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 shadow-sm transition-all cursor-pointer active:scale-95"
                    title="Ubah nama dan NIP Manager serta Supervisor Teknik ULP Baguala"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    <span>Ubah Pejabat</span>
                  </button>

                  <button
                    onClick={() => window.print()}
                    className="flex-1 sm:flex-initial bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-[11px] sm:text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95"
                    title="Cetak SPK dengan ukuran standar kertas A4"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-950" />
                    <span>Cetak SPK (A4)</span>
                  </button>
                </div>
              </div>

              {/* 1. Mobile Native Card View (Clean & Responsive for Phone Screens) */}
              {mobileDocMode === 'card' && (
                <div className="lg:hidden space-y-3 print:hidden">
                  
                  {/* Card 1: Official Header & Status */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-3 shadow-md transition-colors">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={plnOfficialLogo}
                          alt="PLN Logo"
                          className="h-10 w-auto object-contain shrink-0"
                          onError={(e) => {
                            const img = e.currentTarget;
                            if (!img.src.includes('Logo_PLN_67ac91e8.png')) {
                              img.src = '/assets/aistudio/Logo_PLN_67ac91e8.png';
                            }
                          }}
                        />
                        <div>
                          <div className="font-black text-xs text-slate-900 dark:text-white uppercase leading-tight">PT PLN (PERSERO)</div>
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase">UP3 AMBON — ULP BAGUALA</div>
                          <div className="text-[9px] text-slate-500 dark:text-slate-400">Jalan Waitatiri Raya, Suli, Maluku</div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
                        Disetujui
                      </span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950/80 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">Nomor SPK Resmi</div>
                        <div className="font-mono font-black text-sm text-amber-600 dark:text-amber-400 mt-0.5">{selectedSpk.spkNumber}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Tanggal Terbit</div>
                        <div className="font-bold text-xs text-slate-900 dark:text-white mt-0.5">{selectedSpk.createdAt}</div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Bagian I - Data Lokasi & Tiang */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-3 shadow-md transition-colors">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                      <span className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                        <span>Bagian I: Data Lokasi &amp; Tiang</span>
                      </span>
                      <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                        {selectedSpk.poleId}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Lokasi / Wilayah Kerja:</span>
                        <span className="font-bold text-slate-900 dark:text-white text-sm">{selectedSpk.locationName}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                        <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Penyulang (Feeder):</span>
                          <span className="font-bold text-amber-700 dark:text-amber-300">{activePole?.feeder || 'Penyulang Baguala'}</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Jenis Konstruksi:</span>
                          <span className="font-bold text-slate-900 dark:text-white">{activePole?.type ? `${activePole.type} (20 kV)` : 'Tegangan Menengah'}</span>
                        </div>
                      </div>

                      <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 p-2.5 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-rose-700 dark:text-rose-300 block font-semibold">Jarak ROW Aktual ke Pohon:</span>
                          <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                            {activePole?.clearanceDistanceMeters ? `${activePole.clearanceDistanceMeters} Meter` : '< 3.0 Meter'}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold bg-rose-500/20 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded border border-rose-300 dark:border-rose-500/30">
                          Pelanggaran ROW
                        </span>
                      </div>

                      {activePole?.lat && activePole?.lng && (
                        <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 pt-0.5">
                          GPS: {activePole.lat.toFixed(6)}, {activePole.lng.toFixed(6)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 3: Bagian II - Pelaksana & Jadwal */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-3 shadow-md transition-colors">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                      <span className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                        <span>Bagian II: Pelaksana &amp; Jadwal</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        selectedSpk.priority === 'Kritis' 
                          ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30' 
                          : 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30'
                      }`}>
                        Prioritas: {selectedSpk.priority}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Tim Pelaksana Lapangan:</span>
                        <span className="font-bold text-slate-900 dark:text-white text-sm">{selectedSpk.assignedTeam}</span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Jadwal Pelaksanaan:</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">{selectedSpk.scheduledDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Bagian III - Uraian & Instruksi Lapangan */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-3 shadow-md transition-colors">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                      <span className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                        Bagian III: Uraian &amp; Instruksi Teknis
                      </span>
                      <span className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded font-bold border border-amber-300 dark:border-amber-500/30">
                        {selectedSpk.issueType}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      <p className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px]">
                        <strong className="text-slate-900 dark:text-white block mb-0.5">Instruksi Teknis:</strong>
                        {selectedSpk.aiRecommendation || 'Lakukan pekerjaan pemeliharaan preventif dan rabas pohon dengan membebaskan ruang aman konduktor minimal 3.0 meter.'}
                      </p>

                      <div className="bg-slate-100/70 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 text-[11px]">
                        <div className="font-bold text-amber-600 dark:text-amber-400 text-[10px] uppercase">Panduan Lapangan:</div>
                        <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
                          <li>Pertahankan jarak bebas Right of Way (ROW) minimal 3.0 meter dari konduktor 20 kV.</li>
                          <li>Potong dan bersihkan dahan pohon yang condong ke jaringan.</li>
                          <li>Koordinasi dengan pemilik lahan dan aparat desa sebelum pemotongan.</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Card 5: Standar K3 PLN */}
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 p-3.5 rounded-2xl space-y-1.5 shadow-sm transition-colors">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Standar Keselamatan K3 PLN</span>
                      </span>
                      <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded">Zero Accident</span>
                    </div>
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-200/80 leading-relaxed">
                      Wajib APD Lengkap: Helm Pengaman, Sarung Tangan Isolasi 20 kV, Sepatu Safety Anti-Slip, Full Body Harness, serta alat deteksi tegangan sebelum mulai bekerja.
                    </p>
                  </div>

                  {/* Card 6: Pejabat Penandatangan */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-3 shadow-md transition-colors">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                      <span className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                        Pengesahan Pejabat ULP Baguala
                      </span>
                      <button
                        type="button"
                        onClick={openSignatoryModal}
                        className="text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Ubah Pejabat</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">Manager ULP Baguala</div>
                        <div className="font-bold text-slate-900 dark:text-white text-xs">{managerName}</div>
                        <div className="text-[9px] font-mono text-slate-500 mt-0.5">NIP. {managerNip}</div>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">Supervisor Teknik</div>
                        <div className="font-bold text-slate-900 dark:text-white text-xs">{supervisorName}</div>
                        <div className="text-[9px] font-mono text-slate-500 mt-0.5">NIP. {supervisorNip}</div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Bottom Action Button */}
                  <div className="pt-2">
                    <button
                      onClick={() => window.print()}
                      className="w-full bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                    >
                      <Printer className="w-4 h-4 text-slate-950" />
                      <span>Cetak Dokumen SPK Format Resmi (A4)</span>
                    </button>
                  </div>

                </div>
              )}

              {/* 2. Official Printable A4 Sheet Container (Visible on Desktop OR when mobileDocMode === 'a4') */}
              <div className={`${mobileDocMode === 'a4' ? 'block' : 'hidden lg:block'}`}>
                
                {/* Mobile scroll notice banner */}
                <div className="lg:hidden mb-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 px-3 py-2 rounded-xl text-[11px] font-medium flex items-center gap-2 print:hidden">
                  <span className="text-base shrink-0">💡</span>
                  <span>Geser ke samping (swipe) untuk melihat seluruh lembar format A4 utuh secara proporsional.</span>
                </div>

                {/* Responsive Container for A4 Sheet with min-width wrapper to prevent cramped columns */}
                <div className="overflow-x-auto pb-6 pt-1 flex justify-start sm:justify-center">
                  {/* Official A4 Sheet: Exact 210mm x 297mm proportions */}
                  <div
                    id="spk-printable-document"
                    className="spk-a4-sheet bg-white text-slate-900 shadow-2xl border border-slate-300 rounded-sm font-sans flex flex-col justify-between shrink-0"
                    style={{
                      width: '210mm',
                      minHeight: '297mm',
                      minWidth: '680px',
                      padding: '16mm 18mm',
                      boxSizing: 'border-box'
                    }}
                  >
                    {/* Top Portion */}
                    <div className="space-y-4">
                      
                      {/* 1. Official PLN Header (Kop Surat Resmi) */}
                      <div>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 shrink-0">
                            <img
                              src={plnOfficialLogo}
                              alt="Logo Resmi PT PLN (Persero)"
                              className="h-16 w-auto object-contain shrink-0 select-none"
                              onError={(e) => {
                                const img = e.currentTarget;
                                if (!img.src.includes('Logo_PLN_67ac91e8.png')) {
                                  img.src = '/assets/aistudio/Logo_PLN_67ac91e8.png';
                                }
                              }}
                            />
                            <div className="flex flex-col justify-center">
                              <h1 className="font-black text-sm sm:text-[15px] text-slate-950 tracking-tight leading-tight uppercase whitespace-nowrap">
                                PT PLN (PERSERO) UID MALUKU &amp; MALUKU UTARA
                              </h1>
                              <h2 className="font-bold text-xs text-slate-900 tracking-wide uppercase leading-tight mt-0.5">
                                UP3 AMBON — ULP BAGUALA
                              </h2>
                              <p className="text-[10.5px] text-slate-600 leading-tight mt-1 whitespace-nowrap">
                                Jalan Waitatiri Raya, Suli, Kec. Salahutu, Kota Ambon, Maluku
                              </p>
                              <p className="text-[10.5px] text-slate-500 leading-tight mt-0.5">
                                pln123@pln.co.id
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex flex-col items-end justify-center">
                            <div className="bg-amber-50 text-amber-900 px-3 py-1 rounded font-mono font-bold text-xs border border-amber-300 inline-block shadow-xs">
                              {selectedSpk.spkNumber}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">Tanggal: <b className="text-slate-800">{selectedSpk.createdAt}</b></div>
                            <div className="text-[9px] text-emerald-700 font-bold uppercase tracking-wider mt-0.5 flex items-center gap-1 justify-end">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                              Status: Disetujui
                            </div>
                          </div>
                        </div>
                        
                        {/* Authentic BUMN Kop Surat Double Rule Divider */}
                        <div className="mt-2.5 border-b-2 border-slate-950">
                          <div className="border-b border-slate-700 mt-[2px]" />
                        </div>
                      </div>

                      {/* 2. Document Title */}
                      <div className="text-center py-2 bg-slate-100 border border-slate-300 rounded">
                        <h3 className="font-black text-sm tracking-wider uppercase text-slate-950">
                          SURAT PERINTAH KERJA PEMELIHARAAN JARINGAN (SPK)
                        </h3>
                        <p className="text-[10px] font-semibold text-slate-600 tracking-wide mt-0.5">
                          PROGRAM PEMBEBASAN RUANG BEBAS (RIGHT OF WAY / ROW) DAN PEMELIHARAAN DISTRIBUSI 20 kV
                        </p>
                      </div>

                      {/* 3. Formal Grid Details Table */}
                      <div className="border border-slate-300 rounded overflow-hidden text-xs">
                        <div className="grid grid-cols-2 divide-x divide-slate-300 bg-slate-50 font-bold text-[11px] uppercase tracking-wider py-1.5 px-3 border-b border-slate-300 text-slate-700">
                          <div>Bagian I: Data Lokasi &amp; Tiang</div>
                          <div>Bagian II: Pelaksana &amp; Jadwal</div>
                        </div>

                        <div className="grid grid-cols-2 divide-x divide-slate-300 text-[11px]">
                          {/* Left column */}
                          <div className="p-3 space-y-2">
                            <div>
                              <span className="text-slate-500 block text-[10px]">ID Tiang Target:</span>
                              <span className="font-mono font-black text-sm text-slate-950">{selectedSpk.poleId}</span>
                              {activePole?.code && (
                                <span className="ml-2 font-mono text-[10px] text-slate-500">({activePole.code})</span>
                              )}
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px]">Lokasi / Wilayah Kerja:</span>
                              <span className="font-bold text-slate-800">{selectedSpk.locationName}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                              <div>
                                <span className="text-slate-500 block">Penyulang (Feeder):</span>
                                <span className="font-semibold text-slate-800">{activePole?.feeder || 'Penyulang Baguala'}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">Jenis Konstruksi:</span>
                                <span className="font-semibold text-slate-800">{activePole?.type ? `${activePole.type} (20 kV)` : 'Tegangan Menengah'}</span>
                              </div>
                            </div>
                            {activePole?.lat && activePole?.lng && (
                              <div className="text-[10px] text-slate-500 pt-0.5 font-mono">
                                GPS: {activePole.lat.toFixed(6)}, {activePole.lng.toFixed(6)}
                              </div>
                            )}
                          </div>

                          {/* Right column */}
                          <div className="p-3 space-y-2">
                            <div>
                              <span className="text-slate-500 block text-[10px]">Tim Pelaksana Lapangan:</span>
                              <span className="font-bold text-sm text-slate-950">{selectedSpk.assignedTeam}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px]">Jadwal Pelaksanaan:</span>
                              <span className="font-bold text-slate-800">{selectedSpk.scheduledDate}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                              <div>
                                <span className="text-slate-500 block">Tingkat Prioritas:</span>
                                <span className={`font-bold inline-block px-1.5 py-0.5 rounded text-[10px] ${
                                  selectedSpk.priority === 'Kritis' 
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                                }`}>
                                  {selectedSpk.priority}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">Jarak ROW Aktual:</span>
                                <span className="font-bold text-rose-700">
                                  {activePole?.clearanceDistanceMeters ? `${activePole.clearanceDistanceMeters} Meter` : '< 3.0 Meter'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 4. Details Box & Technical Guidelines */}
                      <div className="bg-slate-50 border border-slate-300 rounded p-3.5 space-y-2 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                          <span className="font-bold text-slate-950 text-[11px] uppercase tracking-wide">
                            Bagian III: Uraian &amp; Instruksi Pengerjaan
                          </span>
                          <span className="font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded text-[10px] border border-amber-300">
                            {selectedSpk.issueType}
                          </span>
                        </div>
                        
                        <div className="text-slate-700 leading-relaxed text-[11px] space-y-1">
                          <p>
                            <b>Instruksi Teknis:</b> {selectedSpk.aiRecommendation || 'Lakukan pekerjaan pemeliharaan preventif dan rabas pohon dengan membebaskan ruang aman konduktor minimal 3.0 meter.'}
                          </p>
                          <ul className="list-disc list-inside text-slate-600 text-[10px] space-y-0.5 pt-1">
                            <li>Pertahankan jarak bebas Right of Way (ROW) minimal 3.0 meter dari konduktor kawat fasa 20 kV.</li>
                            <li>Potong dan bersihkan dahan pohon yang condong atau rentan tumbang ke arah jaringan transmisi.</li>
                            <li>Lakukan koordinasi dengan aparat desa/kelurahan serta pemilik lahan sebelum memulai pemotongan.</li>
                          </ul>
                        </div>
                      </div>

                      {/* 5. K3 Safety Standards */}
                      <div className="border border-slate-200 bg-emerald-50/40 rounded p-3 text-[10px] text-slate-700 space-y-1">
                        <div className="font-bold text-emerald-950 flex items-center justify-between">
                          <span>Standar Keselamatan &amp; Kesehatan Kerja (K3) PLN:</span>
                          <span className="font-normal text-[9px] text-emerald-800">Zero Accident Protocol</span>
                        </div>
                        <p className="text-slate-600 leading-tight">
                          Wajib menggunakan APD Lengkap: Helm Pengaman Standar, Sarung Tangan Isolasi 20 kV, Sepatu Safety Anti-Slip, Full Body Harness, serta menyiapkan Alat Deteksi Tegangan dan Grounding Set Portabel sebelum bekerja.
                        </p>
                      </div>

                    </div>

                    {/* Bottom Portion: Signatures & A4 Footer */}
                    <div className="pt-6 space-y-6">
                      
                      {/* Official Signatures */}
                      <div className="border-t border-slate-300 pt-4 space-y-3">
                        {/* Interactive edit button on sheet (hidden when printing) */}
                        <div className="flex items-center justify-between text-[10px] text-slate-500 print:hidden">
                          <span className="font-semibold text-slate-600 uppercase tracking-wider text-[9px]">
                            Pengesahan Pejabat ULP Baguala
                          </span>
                          <button
                            type="button"
                            onClick={openSignatoryModal}
                            className="text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100/90 border border-amber-300/80 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                            title="Ubah nama dan NIP Manager serta Supervisor Teknik"
                          >
                            <Edit3 className="w-3 h-3 text-amber-600" />
                            <span>Ubah Nama &amp; NIP Pejabat</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-8 text-center text-xs pt-1">
                          <div>
                            <div className="text-slate-600 mb-14 text-[11px]">
                              Mengetahui,<br />
                              <b>Manager ULP Baguala</b>
                            </div>
                            <div className="font-black underline text-slate-950 text-xs tracking-wide">
                              {managerName}
                            </div>
                            <div className="text-[10px] text-slate-600 font-mono mt-0.5">
                              NIP. {managerNip}
                            </div>
                          </div>

                          <div>
                            <div className="text-slate-600 mb-14 text-[11px]">
                              Penanggung Jawab Lapangan,<br />
                              <b>Supervisor Teknik ULP Baguala</b>
                            </div>
                            <div className="font-black underline text-slate-950 text-xs tracking-wide">
                              {supervisorName}
                            </div>
                            <div className="text-[10px] text-slate-600 font-mono mt-0.5">
                              NIP. {supervisorNip}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Footer text */}
                      <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-[9px] text-slate-400 font-mono">
                        <span>Dokumen Resmi Sistem Pemantauan GROW PLN ULP Baguala</span>
                        <span>Format Kertas A4 (210 × 297 mm)</span>
                      </div>

                    </div>

                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-slate-900 p-8 sm:p-12 rounded-2xl border border-slate-800 text-center py-16 sm:py-24 text-slate-500 text-xs space-y-3">
              <FileText className="w-10 h-10 text-slate-600 mx-auto" />
              <div>Pilih SPK dari daftar di samping untuk melihat cetakan resmi dalam format standar A4.</div>
            </div>
          )}

        </div>

      </div>

      {/* Create SPK Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto transition-colors">
            <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">Buat Surat Perintah Kerja (SPK) Baru</h3>
            
            <form onSubmit={handleSaveSpk} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Pilih Tiang Target ULP Baguala</label>
                <select
                  value={targetPoleId}
                  onChange={(e) => setTargetPoleId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-2.5 rounded-xl focus:outline-none focus:border-amber-500"
                >
                  {poles.map(p => (
                    <option key={p.id} value={p.id}>{p.id} - {p.locationName} (ROW: {p.clearanceDistanceMeters}m)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Jenis Pekerjaan</label>
                <input
                  type="text"
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-2.5 rounded-xl focus:outline-none focus:border-amber-500"
                  placeholder="Misal: Rabas Pohon Kelapa (ROW < 3m)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Prioritas</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-2.5 rounded-xl focus:outline-none focus:border-amber-500"
                  >
                    <option value="Kritis">Kritis (Segera)</option>
                    <option value="Tinggi">Tinggi</option>
                    <option value="Sedang">Sedang</option>
                    <option value="Rutin">Rutin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Tanggal Pelaksanaan</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-2.5 rounded-xl focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Tim Yantek / Regu Pelaksana</label>
                <input
                  type="text"
                  value={assignedTeam}
                  onChange={(e) => setAssignedTeam(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-2.5 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-md cursor-pointer transition-colors"
                >
                  Terbitkan SPK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Signatory Officials Modal */}
      {showSignatoryModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto transition-colors">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">Ubah Pejabat Penandatangan SPK</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Atur nama dan NIP pejabat pengesahan dokumen SPK ULP Baguala
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveSignatories} className="space-y-4 text-xs">
              {/* Manager Section */}
              <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-3">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400" />
                  <span>1. Manager ULP Baguala (Mengetahui)</span>
                </div>
                
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Nama Lengkap &amp; Gelar</label>
                  <input
                    type="text"
                    value={editManagerName}
                    onChange={(e) => setEditManagerName(e.target.value)}
                    required
                    placeholder="Contoh: M. Ridwan Pelupessy, S.T."
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-2.5 rounded-xl focus:outline-none focus:border-amber-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Nomor Induk Pegawai (NIP)</label>
                  <input
                    type="text"
                    value={editManagerNip}
                    onChange={(e) => setEditManagerNip(e.target.value)}
                    required
                    placeholder="Contoh: 8812039482"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-2.5 rounded-xl focus:outline-none focus:border-amber-500 font-mono text-[11px]"
                  />
                </div>
              </div>

              {/* Supervisor Teknik Section */}
              <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-3">
                <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-cyan-500 dark:bg-cyan-400" />
                  <span>2. Supervisor Teknik ULP Baguala (Penanggung Jawab Lapangan)</span>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Nama Lengkap &amp; Gelar</label>
                  <input
                    type="text"
                    value={editSupervisorName}
                    onChange={(e) => setEditSupervisorName(e.target.value)}
                    required
                    placeholder="Contoh: Ahmad Latuconsina"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-2.5 rounded-xl focus:outline-none focus:border-amber-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Nomor Induk Pegawai (NIP)</label>
                  <input
                    type="text"
                    value={editSupervisorNip}
                    onChange={(e) => setEditSupervisorNip(e.target.value)}
                    required
                    placeholder="Contoh: 9114028391"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-2.5 rounded-xl focus:outline-none focus:border-amber-500 font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleResetSignatories}
                  className="px-3 py-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Kembalikan ke pejabat default PLN ULP Baguala"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Default</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSignatoryModal(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl cursor-pointer transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-md cursor-pointer transition-colors flex items-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4 text-slate-950" />
                    <span>Simpan Perubahan</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
