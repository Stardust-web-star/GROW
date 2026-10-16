import React, { useState } from 'react';
import { MaintenanceWorkOrder, PoleData } from '../types';
import { FileText, Plus, Printer, CheckCircle, Clock, Zap, Calendar, UserCheck, Edit3, RotateCcw } from 'lucide-react';
import { GisPlnLogo } from './GisPlnLogo';

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
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 text-slate-100">
      
      {/* Top Bar */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex items-center justify-between gap-4 shadow-xl">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            <FileText className="w-7 h-7 text-amber-400" />
            <span>Surat Perintah Kerja (SPK) Pemeliharaan PLN ULP Baguala</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Sistem manajemen pengerjaan rabas pohon (ROW) dan perbaikan konstruksi tiang terintegrasi.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Buat SPK Baru</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SPK List Sidebar */}
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="font-bold text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
            Daftar SPK Aktif ({spks.length})
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {spks.map((spk) => {
              const isSelected = selectedSpk?.id === spk.id;
              return (
                <div
                  key={spk.id}
                  onClick={() => setSelectedSpk(spk)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500/60 text-white shadow-md'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-mono font-bold text-amber-400">{spk.spkNumber}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      spk.priority === 'Kritis' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {spk.priority}
                    </span>
                  </div>
                  <div className="font-bold text-xs text-white">{spk.poleId} - {spk.issueType}</div>
                  <div className="text-[11px] text-slate-400 truncate mt-1">{spk.locationName}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SPK Printable Details Document (Standard A4 Format: 210 x 297 mm) */}
        <div className="lg:col-span-2 spk-wrapper space-y-4">
          
          {selectedSpk ? (
            <>
              {/* Document A4 Action Toolbar */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xl print:hidden">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-white">Pratinjau Dokumen SPK</span>
                      <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                        Format Standar A4 (210 × 297 mm)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Ukuran dan tata letak proporsional kertas A4 potret siap cetak atau simpan ke PDF.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={openSignatoryModal}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 border border-slate-700 shadow-md transition-all cursor-pointer"
                    title="Ubah nama dan NIP Manager serta Supervisor Teknik ULP Baguala"
                  >
                    <Edit3 className="w-4 h-4 text-amber-400" />
                    <span>Ubah Penandatangan</span>
                  </button>

                  <button
                    onClick={() => window.print()}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                    title="Cetak SPK dengan ukuran standar kertas A4"
                  >
                    <Printer className="w-4 h-4 text-slate-950" />
                    <span>Cetak Dokumen SPK (A4)</span>
                  </button>
                </div>
              </div>

              {/* Responsive Container for A4 Sheet */}
              <div className="overflow-x-auto pb-6 pt-1 flex justify-center">
                {/* Official A4 Sheet: Exact 210mm x 297mm proportions */}
                <div
                  id="spk-printable-document"
                  className="spk-a4-sheet bg-white text-slate-900 shadow-2xl border border-slate-300 rounded-sm font-sans flex flex-col justify-between"
                  style={{
                    width: '210mm',
                    minHeight: '297mm',
                    maxWidth: '100%',
                    padding: '16mm 18mm',
                    boxSizing: 'border-box'
                  }}
                >
                  {/* Top Portion */}
                  <div className="space-y-4">
                    
                    {/* 1. Official PLN Header (Kop Surat Resmi) */}
                    <div className="border-b-2 border-slate-900 pb-2.5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                          <GisPlnLogo size={52} withBadge={false} className="shrink-0" />
                          <div>
                            <h1 className="font-black text-base sm:text-lg text-slate-950 tracking-tight leading-tight">
                              PT PLN (PERSERO) UIW MMU
                            </h1>
                            <h2 className="font-extrabold text-[11px] sm:text-xs text-slate-800 leading-tight">
                              UP3 AMBON - UNIT LAYANAN PELANGGAN (ULP) BAGUALA
                            </h2>
                            <p className="text-[10px] text-slate-600 mt-0.5 leading-snug">
                              Jl. Waitatiri Raya, Suli, Kec. Salahutu, Kota Ambon, Maluku | Call Center : 123
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="bg-amber-50 text-amber-900 px-3 py-1 rounded font-mono font-bold text-xs border border-amber-300 inline-block">
                            {selectedSpk.spkNumber}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">Tanggal: <b>{selectedSpk.createdAt}</b></div>
                          <div className="text-[9px] text-emerald-700 font-bold uppercase tracking-wider mt-0.5">
                            Status: Disetujui
                          </div>
                        </div>
                      </div>
                      
                      {/* Secondary thin rule for official BUMN header look */}
                      <div className="border-b border-slate-800 mt-1.5" />
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
            </>
          ) : (
            <div className="bg-slate-900 p-12 rounded-2xl border border-slate-800 text-center py-24 text-slate-500 text-xs">
              Pilih SPK dari daftar di samping untuk melihat cetakan resmi dalam format standar A4.
            </div>
          )}

        </div>

      </div>

      {/* Create SPK Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-white">Buat Surat Perintah Kerja (SPK) Baru</h3>
            
            <form onSubmit={handleSaveSpk} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Pilih Tiang Target ULP Baguala</label>
                <select
                  value={targetPoleId}
                  onChange={(e) => setTargetPoleId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl focus:outline-none"
                >
                  {poles.map(p => (
                    <option key={p.id} value={p.id}>{p.id} - {p.locationName} (ROW: {p.clearanceDistanceMeters}m)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Jenis Pekerjaan</label>
                <input
                  type="text"
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl focus:outline-none"
                  placeholder="Misal: Rabas Pohon Kelapa (ROW < 3m)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Prioritas</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl focus:outline-none"
                  >
                    <option value="Kritis">Kritis (Segera)</option>
                    <option value="Tinggi">Tinggi</option>
                    <option value="Sedang">Sedang</option>
                    <option value="Rutin">Rutin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Tanggal Pelaksanaan</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Tim Yantek / Regu Pelaksana</label>
                <input
                  type="text"
                  value={assignedTeam}
                  onChange={(e) => setAssignedTeam(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl focus:outline-none"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-md"
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
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Ubah Pejabat Penandatangan SPK</h3>
                  <p className="text-[11px] text-slate-400">
                    Atur nama dan NIP pejabat pengesahan dokumen SPK ULP Baguala
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveSignatories} className="space-y-4 text-xs">
              {/* Manager Section */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>1. Manager ULP Baguala (Mengetahui)</span>
                </div>
                
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Nama Lengkap &amp; Gelar</label>
                  <input
                    type="text"
                    value={editManagerName}
                    onChange={(e) => setEditManagerName(e.target.value)}
                    required
                    placeholder="Contoh: M. Ridwan Pelupessy, S.T."
                    className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl focus:outline-none focus:border-amber-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Nomor Induk Pegawai (NIP)</label>
                  <input
                    type="text"
                    value={editManagerNip}
                    onChange={(e) => setEditManagerNip(e.target.value)}
                    required
                    placeholder="Contoh: 8812039482"
                    className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl focus:outline-none focus:border-amber-500 font-mono text-[11px]"
                  />
                </div>
              </div>

              {/* Supervisor Teknik Section */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-3">
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>2. Supervisor Teknik ULP Baguala (Penanggung Jawab Lapangan)</span>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Nama Lengkap &amp; Gelar</label>
                  <input
                    type="text"
                    value={editSupervisorName}
                    onChange={(e) => setEditSupervisorName(e.target.value)}
                    required
                    placeholder="Contoh: Ahmad Latuconsina"
                    className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl focus:outline-none focus:border-amber-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Nomor Induk Pegawai (NIP)</label>
                  <input
                    type="text"
                    value={editSupervisorNip}
                    onChange={(e) => setEditSupervisorNip(e.target.value)}
                    required
                    placeholder="Contoh: 9114028391"
                    className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl focus:outline-none focus:border-amber-500 font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleResetSignatories}
                  className="px-3 py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Kembalikan ke pejabat default PLN ULP Baguala"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Default</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSignatoryModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl cursor-pointer transition-colors"
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
