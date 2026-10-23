import React, { useState } from 'react';
import { 
  Map, BarChart3, AlertTriangle, FileText, Upload, Bot, Zap, Users, LogOut, 
  ChevronLeft, Grid, X, ShieldCheck, Plus
} from 'lucide-react';
import { GisPlnLogo } from './GisPlnLogo';
import { GeometricBlueHeaderBg } from './GeometricBlueHeaderBg';
import { UserAccount } from '../types';
import { SyncStatusBadge } from './SyncStatusBadge';
import { SystemMetaState } from '../lib/firebase';

interface NavbarProps {
  activeTab: 'map' | 'clearance' | 'ai' | 'spk' | 'kmz' | 'users';
  setActiveTab: (tab: 'map' | 'clearance' | 'ai' | 'spk' | 'kmz' | 'users') => void;
  totalPoles: number;
  totalSpans?: number;
  rowViolations: number;
  criticalPoles: number;
  onOpenAiAssistant: () => void;
  masterName?: string;
  currentUser?: UserAccount | null;
  onLogout?: () => void;
  isCloudConnected?: boolean;
  systemMeta?: SystemMetaState | null;
  onOpenFeederDrawer?: () => void;
  onAddCustomPole?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  totalPoles,
  totalSpans = 0,
  rowViolations,
  criticalPoles,
  onOpenAiAssistant,
  masterName = 'TITIK TIANG BGL.kml',
  currentUser,
  onLogout,
  isCloudConnected = true,
  systemMeta = null,
  onOpenFeederDrawer,
  onAddCustomPole
}) => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  return (
    <>
      {/* ========================================================
          DESKTOP NAVBAR (hidden on mobile, unchanged for md+)
          ======================================================== */}
      <header id="app-navbar" className="hidden md:block relative text-white sticky top-0 z-40 shadow-xl select-none print:hidden border-b border-teal-500/30 overflow-hidden">
        {/* Dynamic Geometric Emerald-Teal to Dark Motif Background */}
        <GeometricBlueHeaderBg variant="navbar" />

        <div className="relative z-10 w-full px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-3 lg:gap-6">
            
            {/* Official GROW Brand */}
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 select-none">
              <GisPlnLogo 
                size={36} 
                withBadge={true} 
                className="shrink-0 hover:scale-105 transition-transform cursor-pointer shadow-md" 
              />
              <div className="flex flex-col justify-center">
                <span className="font-black text-lg sm:text-xl text-white tracking-[0.14em] leading-none whitespace-nowrap block drop-shadow-sm">
                  GROW
                </span>
                <span className="text-[10px] sm:text-[11px] font-semibold text-teal-200 tracking-wide leading-none mt-1.5 whitespace-nowrap block drop-shadow-xs">
                  Great Right of Way
                </span>
              </div>
            </div>

            {/* Sharp High-Contrast Navigation Tabs (Zero-Blur, Responsive & Neat) */}
            <nav className="flex items-center bg-slate-950/70 backdrop-blur-md p-1 rounded-xl border border-teal-500/30 shadow-md shrink-0 gap-1">
              <button
                onClick={() => setActiveTab('map')}
                className={`flex items-center gap-2 px-3 lg:px-3.5 h-8 text-xs rounded-lg whitespace-nowrap cursor-pointer btn-tactile ${
                  activeTab === 'map'
                    ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-400/20 border border-amber-300 scale-[1.01]'
                    : 'text-slate-100 hover:text-white font-semibold hover:bg-slate-800/80 border border-transparent hover:border-slate-700/50'
                }`}
              >
                <Map className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${activeTab === 'map' ? 'text-slate-950 scale-110' : 'text-amber-400'}`} />
                <span>Peta GIS</span>
              </button>

              <button
                onClick={() => setActiveTab('clearance')}
                className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-3.5 h-8 text-xs rounded-lg whitespace-nowrap cursor-pointer btn-tactile ${
                  activeTab === 'clearance'
                    ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-400/20 border border-amber-300 scale-[1.01]'
                    : 'text-slate-100 hover:text-white font-semibold hover:bg-slate-800/80 border border-transparent hover:border-slate-700/50'
                }`}
              >
                <AlertTriangle className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${activeTab === 'clearance' ? 'text-slate-950 scale-110' : 'text-amber-400'}`} />
                <span>Jarak ROW</span>
                <span className="hidden xl:inline">& Kabel</span>
                {rowViolations > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    activeTab === 'clearance' ? 'bg-slate-950 text-amber-300' : 'bg-rose-600 text-white shadow-xs'
                  }`}>
                    {rowViolations}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('ai')}
                className={`flex items-center gap-2 px-3 lg:px-3.5 h-8 text-xs rounded-lg whitespace-nowrap cursor-pointer btn-tactile ${
                  activeTab === 'ai'
                    ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-400/20 border border-amber-300 scale-[1.01]'
                    : 'text-slate-100 hover:text-white font-semibold hover:bg-slate-800/80 border border-transparent hover:border-slate-700/50'
                }`}
              >
                <BarChart3 className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${activeTab === 'ai' ? 'text-slate-950 scale-110' : 'text-amber-400'}`} />
                <span>GROW AI</span>
              </button>

              <button
                onClick={() => setActiveTab('spk')}
                className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-3.5 h-8 text-xs rounded-lg whitespace-nowrap cursor-pointer btn-tactile ${
                  activeTab === 'spk'
                    ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-400/20 border border-amber-300 scale-[1.01]'
                    : 'text-slate-100 hover:text-white font-semibold hover:bg-slate-800/80 border border-transparent hover:border-slate-700/50'
                }`}
              >
                <FileText className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${activeTab === 'spk' ? 'text-slate-950 scale-110' : 'text-amber-400'}`} />
                <span className="hidden lg:inline">Surat Kerja</span>
                <span>(SPK)</span>
              </button>

              <button
                onClick={() => setActiveTab('kmz')}
                className={`flex items-center gap-2 px-3 lg:px-3.5 h-8 text-xs rounded-lg whitespace-nowrap cursor-pointer btn-tactile ${
                  activeTab === 'kmz'
                    ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-400/20 border border-amber-300 scale-[1.01]'
                    : 'text-slate-100 hover:text-white font-semibold hover:bg-slate-800/80 border border-transparent hover:border-slate-700/50'
                }`}
              >
                <Upload className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${activeTab === 'kmz' ? 'text-slate-950 scale-110' : 'text-amber-400'}`} />
                <span>Unggah KMZ</span>
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-3.5 h-8 text-xs rounded-lg whitespace-nowrap cursor-pointer btn-tactile ${
                  activeTab === 'users'
                    ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-400/20 border border-amber-300 scale-[1.01]'
                    : 'text-slate-100 hover:text-white font-semibold hover:bg-slate-800/80 border border-transparent hover:border-slate-700/50'
                }`}
                title="Kelola Pengguna & Akun Akses Sistem"
              >
                <Users className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${activeTab === 'users' ? 'text-slate-950 scale-110' : 'text-amber-400'}`} />
                <span className="hidden lg:inline">Management</span>
                <span>User</span>
              </button>
            </nav>

            {/* Quick Metrics & AI Button */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="hidden xl:flex items-center gap-2.5 text-xs bg-slate-950/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-teal-500/30 whitespace-nowrap shadow-md">
                <div className="text-slate-100">
                  <span className="text-white font-black">{totalPoles.toLocaleString('id-ID')}</span> Tiang
                </div>
                <span className="text-teal-300/40">|</span>
                <div className="text-amber-400">
                  <span className="font-black">{rowViolations.toLocaleString('id-ID')}</span> Bahaya ROW
                </div>
                <span className="text-teal-300/40">|</span>
                <div className="text-rose-400">
                  <span className="font-black">{criticalPoles.toLocaleString('id-ID')}</span> Kritis
                </div>
              </div>

              {/* Interactive Real-Time 2-Way Sync Badge (AI Studio ⇄ Vercel) */}
              <SyncStatusBadge
                systemMeta={systemMeta || null}
                totalPoles={totalPoles}
                totalSpans={totalSpans || 0}
                isCloudConnected={isCloudConnected}
              />

              <button
                onClick={onOpenAiAssistant}
                className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 border border-amber-300 px-3.5 h-9 rounded-xl text-xs font-black shadow-md cursor-pointer whitespace-nowrap btn-tactile hover:shadow-amber-400/25"
              >
                <Bot className="w-4 h-4 text-slate-950 shrink-0" />
                <span>Tanya GROW AI</span>
              </button>

              {/* Current Logged-in User & Logout */}
              {currentUser && (
                <div className="flex items-center gap-2 pl-2 border-l border-teal-500/30">
                  <div className="hidden lg:flex flex-col text-right">
                    <span className="text-[11px] font-bold text-white leading-none font-mono">{currentUser.userId}</span>
                    <span className="text-[9px] font-semibold text-amber-300 leading-none mt-0.5">{currentUser.role}</span>
                  </div>
                  {onLogout && (
                    <button
                      onClick={onLogout}
                      className="flex items-center gap-1 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 px-2.5 h-8 rounded-lg text-xs font-bold cursor-pointer shadow-xs btn-tactile"
                      title="Keluar dari Sistem GROW"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Keluar</span>
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* ========================================================
          MOBILE TOP BAR (Shown ONLY on non-map views: Clearance, AI, SPK, KMZ, Users)
          When on 'map', MapViewer renders the Google Maps floating search bar!
          ======================================================== */}
      {activeTab !== 'map' && (
        <div className="md:hidden sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-3.5 py-2.5 flex items-center justify-between text-white shadow-lg select-none">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setActiveTab('map')}
              className="p-1.5 -ml-1 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors"
              title="Kembali ke Peta"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex flex-col">
              <h1 className="font-extrabold text-sm text-white tracking-tight leading-tight">
                {activeTab === 'clearance' && 'Jarak ROW & Kabel'}
                {activeTab === 'ai' && 'GROW AI Predictive'}
                {activeTab === 'spk' && 'Surat Perintah Kerja (SPK)'}
                {activeTab === 'kmz' && 'Unggah Master File KMZ'}
                {activeTab === 'users' && 'Manajemen Pengguna'}
              </h1>
              <span className="text-[10px] text-teal-300 font-semibold leading-none mt-0.5">
                PLN ULP Baguala
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMobileMenu(true)}
              className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-teal-500 text-white font-black text-xs flex items-center justify-center border border-teal-300 shadow-md cursor-pointer"
              title="Menu Akun & Sistem"
            >
              {currentUser ? (currentUser.name?.charAt(0) || currentUser.userId?.charAt(0) || 'U') : 'P'}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          MOBILE BOTTOM NAVIGATION BAR (Google Maps Mobile UI Style)
          Tabs: Peta (Jelajahi), ROW & Kabel (Disimpan/Inspeksi), GROW AI (Asisten), SPK, Menu
          ======================================================== */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/90 shadow-[0_-4px_20px_rgba(0,0,0,0.5)] px-2 py-1 flex items-center justify-around select-none">
        
        {/* Tab 1: Peta (Google Maps "Jelajahi") */}
        <button
          onClick={() => setActiveTab('map')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all cursor-pointer ${
            activeTab === 'map'
              ? 'text-cyan-400 font-extrabold'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          <div className={`px-4 py-1 rounded-full transition-all ${
            activeTab === 'map' ? 'bg-cyan-500/20 text-cyan-300 shadow-sm' : ''
          }`}>
            <Map className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight font-bold">Peta</span>
        </button>

        {/* Tab 2: ROW & Kabel */}
        <button
          onClick={() => setActiveTab('clearance')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl relative transition-all cursor-pointer ${
            activeTab === 'clearance'
              ? 'text-amber-400 font-extrabold'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          <div className={`px-4 py-1 rounded-full transition-all relative ${
            activeTab === 'clearance' ? 'bg-amber-500/20 text-amber-300 shadow-sm' : ''
          }`}>
            <AlertTriangle className="w-5 h-5" />
            {rowViolations > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-black ring-2 ring-slate-900 animate-pulse">
                {rowViolations}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight font-bold">ROW</span>
        </button>

        {/* Tab 3: GROW AI */}
        <button
          onClick={onOpenAiAssistant}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all cursor-pointer text-slate-400 hover:text-amber-300 font-medium"
        >
          <div className="px-4 py-1 rounded-full bg-gradient-to-r from-amber-500/25 to-amber-400/20 text-amber-400 border border-amber-400/40 shadow-xs">
            <Bot className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight text-amber-300 font-extrabold">GROW AI</span>
        </button>

        {/* Tab 4: SPK */}
        <button
          onClick={() => setActiveTab('spk')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all cursor-pointer ${
            activeTab === 'spk'
              ? 'text-cyan-400 font-extrabold'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          <div className={`px-4 py-1 rounded-full transition-all ${
            activeTab === 'spk' ? 'bg-cyan-500/20 text-cyan-300 shadow-sm' : ''
          }`}>
            <FileText className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight font-bold">SPK</span>
        </button>

        {/* Tab 5: Menu / Lainnya */}
        <button
          onClick={() => setShowMobileMenu(true)}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all cursor-pointer ${
            ['kmz', 'users'].includes(activeTab) || showMobileMenu
              ? 'text-cyan-400 font-extrabold'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          <div className={`px-4 py-1 rounded-full transition-all ${
            ['kmz', 'users'].includes(activeTab) || showMobileMenu ? 'bg-cyan-500/20 text-cyan-300 shadow-sm' : ''
          }`}>
            <Grid className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight font-bold">Menu</span>
        </button>
      </nav>

      {/* ========================================================
          MOBILE MENU BOTTOM SHEET / DRAWER (Google Maps Style)
          ======================================================== */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col justify-end md:hidden animate-fade-in select-none">
          {/* Backdrop Click */}
          <div className="flex-1" onClick={() => setShowMobileMenu(false)} />
          
          <div className="bg-slate-900 border-t border-slate-700 rounded-t-3xl p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto" />

            {/* User Profile Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 via-teal-600 to-emerald-500 text-white font-black text-lg flex items-center justify-center border-2 border-teal-300 shadow-lg">
                  {currentUser ? (currentUser.name?.charAt(0) || currentUser.userId?.charAt(0) || 'U') : 'P'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-sm text-white">
                      {currentUser?.name || currentUser?.userId || 'Petugas PLN'}
                    </h3>
                    <span className="text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full">
                      {currentUser?.role || 'User'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {currentUser?.userId} • {currentUser?.unit || 'ULP Baguala'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sync Status Badge on Mobile */}
            <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-slate-200">Status Database Cloud</span>
              </div>
              <SyncStatusBadge
                systemMeta={systemMeta || null}
                totalPoles={totalPoles}
                totalSpans={totalSpans || 0}
                isCloudConnected={isCloudConnected}
              />
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-center">
                <div className="text-sm font-black text-white">{totalPoles}</div>
                <div className="text-[10px] text-slate-400 font-medium">Total Tiang</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-center">
                <div className="text-sm font-black text-amber-400">{rowViolations}</div>
                <div className="text-[10px] text-slate-400 font-medium">Bahaya ROW</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-center">
                <div className="text-sm font-black text-rose-400">{criticalPoles}</div>
                <div className="text-[10px] text-slate-400 font-medium">Kritis</div>
              </div>
            </div>

            {/* Feature Actions Grid */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                Menu & Fitur Sistem
              </div>
              
              <button
                onClick={() => {
                  setActiveTab('kmz');
                  setShowMobileMenu(false);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Unggah & Kelola Master KMZ</div>
                    <div className="text-[10px] text-slate-400">Import KML/KMZ atau restore data bawaan</div>
                  </div>
                </div>
                <span className="text-xs text-slate-500 font-bold">›</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('users');
                  setShowMobileMenu(false);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Management User & Hak Akses</div>
                    <div className="text-[10px] text-slate-400">Kelola akun administrator & tim lapangan</div>
                  </div>
                </div>
                <span className="text-xs text-slate-500 font-bold">›</span>
              </button>

              {onOpenFeederDrawer && (
                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    onOpenFeederDrawer();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Kelola Penyulang & Jalur</div>
                      <div className="text-[10px] text-slate-400">Atur visibilitas dan warna kabel feeder</div>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 font-bold">›</span>
                </button>
              )}

              {onAddCustomPole && (
                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    onAddCustomPole();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                      <Plus className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Tambah Titik Tiang Lapangan</div>
                      <div className="text-[10px] text-slate-400">Input tiang baru dengan koordinat GPS</div>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 font-bold">›</span>
                </button>
              )}
            </div>

            {/* Logout Button */}
            {onLogout && (
              <div className="pt-2">
                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    onLogout();
                  }}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Keluar dari Akun Sistem GROW</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
