import React from 'react';
import { Map, BarChart3, AlertTriangle, FileText, Upload, Bot, Zap, Users, LogOut, UserCheck } from 'lucide-react';
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
  systemMeta?: SystemMetaState | null;
  isCloudConnected?: boolean;
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
  systemMeta = null,
  isCloudConnected = true
}) => {
  return (
    <header id="app-navbar" className="relative text-white sticky top-0 z-40 shadow-xl select-none print:hidden border-b border-teal-500/30 overflow-hidden">
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
          <nav className="hidden md:flex items-center bg-slate-950/70 backdrop-blur-md p-1 rounded-xl border border-teal-500/30 shadow-md shrink-0 gap-1">
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

          {/* Quick Metrics & Cloud Sync Badge & AI Button */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Real-time Bidirectional Sync Badge */}
            <SyncStatusBadge
              systemMeta={systemMeta}
              totalPoles={totalPoles}
              totalSpans={totalSpans}
              isCloudConnected={isCloudConnected}
            />

            <div className="hidden 2xl:flex items-center gap-2.5 text-xs bg-slate-950/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-teal-500/30 whitespace-nowrap shadow-md">
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

      {/* Mobile Tab Bar - Sharp & Clear */}
      <div className="relative z-10 md:hidden flex items-center justify-around bg-slate-950/85 backdrop-blur-md border-t border-teal-500/30 p-2 text-xs overflow-x-auto gap-1">
        <button
          onClick={() => setActiveTab('map')}
          className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg cursor-pointer btn-tactile ${
            activeTab === 'map'
              ? 'text-amber-400 font-black bg-amber-500/20 border border-amber-500/40 scale-105'
              : 'text-slate-200 hover:text-white font-semibold'
          }`}
        >
          <Map className="w-4 h-4" />
          <span>Peta</span>
        </button>
        <button
          onClick={() => setActiveTab('clearance')}
          className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg relative cursor-pointer btn-tactile ${
            activeTab === 'clearance'
              ? 'text-amber-400 font-black bg-amber-500/20 border border-amber-500/40 scale-105'
              : 'text-slate-200 hover:text-white font-semibold'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>ROW & Kabel</span>
          {rowViolations > 0 && (
            <span className="absolute top-0.5 right-1 bg-rose-600 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-black">
              {rowViolations}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg cursor-pointer btn-tactile ${
            activeTab === 'ai'
              ? 'text-amber-400 font-black bg-amber-500/20 border border-amber-500/40 scale-105'
              : 'text-slate-200 hover:text-white font-semibold'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>GROW AI</span>
        </button>
        <button
          onClick={() => setActiveTab('spk')}
          className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg cursor-pointer btn-tactile ${
            activeTab === 'spk'
              ? 'text-amber-400 font-black bg-amber-500/20 border border-amber-500/40 scale-105'
              : 'text-slate-200 hover:text-white font-semibold'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>SPK</span>
        </button>
        <button
          onClick={() => setActiveTab('kmz')}
          className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg cursor-pointer btn-tactile ${
            activeTab === 'kmz'
              ? 'text-amber-400 font-black bg-amber-500/20 border border-amber-500/40 scale-105'
              : 'text-slate-200 hover:text-white font-semibold'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>KMZ</span>
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg cursor-pointer btn-tactile ${
            activeTab === 'users'
              ? 'text-amber-400 font-black bg-amber-500/20 border border-amber-500/40 scale-105'
              : 'text-slate-200 hover:text-white font-semibold'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User</span>
        </button>
      </div>
    </header>
  );
};
