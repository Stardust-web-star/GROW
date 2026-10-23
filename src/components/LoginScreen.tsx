import React, { useState } from 'react';
import { UserAccount } from '../types';
import { GisPlnLogo } from './GisPlnLogo';
import { PlnBadge } from './PlnBadge';
import { Lock, Mail, Eye, EyeOff, ShieldCheck, Key, AlertCircle, Sparkles, CheckCircle2, Clock } from 'lucide-react';

import { loginWithCloudOrLocal } from '../lib/authService';
import plnRowInspectionBg from '../assets/images/pln_row_inspection_1792108668671.jpg';

interface LoginScreenProps {
  onLoginSuccess: (user: UserAccount) => void;
  sessionExpiredMessage?: string | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, sessionExpiredMessage }) => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isLoggingInSuccess, setIsLoggingInSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!userId.trim()) {
      setError('Silakan masukkan User ID atau Email Anda.');
      return;
    }
    if (!password.trim()) {
      setError('Silakan masukkan password akun Anda.');
      return;
    }

    setLoading(true);

    try {
      const user = await loginWithCloudOrLocal(userId, password);

      // Store session in sessionStorage (auto-clears when tab/browser is closed)
      sessionStorage.setItem('grow_pln_user', JSON.stringify(user));
      sessionStorage.setItem('grow_last_activity', Date.now().toString());
      localStorage.removeItem('grow_pln_user');
      setIsLoggingInSuccess(true);
      setTimeout(() => {
        onLoginSuccess(user);
      }, 350);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'User ID atau password tidak valid.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-[100dvh] max-h-[100dvh] overflow-hidden flex items-center justify-center p-3 sm:p-6 bg-slate-950 font-sans select-none">
      
      {/* 1. Background Foto Petugas PLN Melakukan Inspeksi Right of Way (ROW) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img
          src={plnRowInspectionBg}
          alt="Petugas PLN ULP Baguala melakukan inspeksi Right of Way (ROW)"
          className="w-full h-full object-cover object-center filter brightness-[0.72] contrast-[1.08] scale-100 transition-transform duration-1000"
          onError={(e) => {
            const img = e.currentTarget;
            if (!img.src.endsWith('/assets/images/pln_row_inspection_1792108668671.jpg')) {
              img.src = '/assets/images/pln_row_inspection_1792108668671.jpg';
            }
          }}
        />
        {/* Cinematic Vignette Overlay to maintain contrast & high readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/60 via-transparent to-slate-950/60" />
        <div className="absolute inset-0 bg-teal-950/20 mix-blend-multiply" />

        {/* Subtle grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(45, 212, 191, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(45, 212, 191, 0.2) 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      {/* Ambient Lighting Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* 2. Main Login Card: Perfectly fits 100dvh on mobile, expands to 2-column on desktop */}
      <div className={`relative z-10 w-full max-w-sm sm:max-w-md md:max-w-4xl max-h-[96dvh] bg-slate-900/95 border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl flex flex-col md:flex-row transition-all duration-350 ease-out ${isLoggingInSuccess ? 'animate-login-exit pointer-events-none' : 'animate-login-enter'}`}>
        
        {/* --- LEFT PANEL: PLN Brand & GROW Identity (Desktop Only - hidden on mobile to avoid scrolling) --- */}
        <div className="hidden md:flex md:w-5/12 bg-gradient-to-br from-[#064e43] via-[#0a3847] to-[#041c30] p-8 sm:p-10 flex-col justify-between relative overflow-hidden border-r border-teal-500/20 text-white">
          
          {/* Subtle electric pattern overlay */}
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Top: Official PLN ULP Baguala Pill Badge */}
          <PlnBadge size="md" className="relative z-10 w-fit self-start" />

          {/* Center: GROW Emblem & Brand Typography */}
          <div className="relative z-10 my-8 sm:my-10 flex flex-col items-start">
            {/* Glowing Emblem Circle */}
            <div className="relative mb-5 group">
              <div className="absolute -inset-1.5 bg-gradient-to-r from-teal-400 to-cyan-500 rounded-full blur-md opacity-60 group-hover:opacity-100 transition duration-500" />
              <div className="relative w-20 h-20 rounded-full bg-slate-950 p-1 flex items-center justify-center border-2 border-teal-400/80 shadow-2xl">
                <GisPlnLogo size={58} withBadge={false} />
              </div>
            </div>

            {/* GROW Title */}
            <h1 className="font-black text-3xl sm:text-4xl text-white tracking-tight leading-none">
              GROW
            </h1>
            <p className="font-extrabold text-xs text-teal-300 tracking-widest uppercase mt-1">
              GREAT RIGHT OF WAY
            </p>

            {/* Description */}
            <p className="text-xs text-slate-300 mt-4 leading-relaxed font-normal">
              Sistem Terpadu Pemantauan Right of Way (ROW) & Manajemen Aset Jaringan Tiang Listrik ULP Baguala PT PLN (Persero).
            </p>
          </div>

          {/* Bottom: Version & Unit */}
          <div className="relative z-10 pt-4 border-t border-teal-500/20 flex items-center justify-between text-[11px] text-teal-200/80 font-mono">
            <span>PLN ULP Baguala</span>
            <span>2026 Edition</span>
          </div>
        </div>

        {/* --- RIGHT PANEL: Login Form (Compact on Mobile, Full on Desktop) --- */}
        <div className="w-full md:w-7/12 p-4 sm:p-7 md:p-10 flex flex-col justify-between bg-slate-900/90 text-slate-100 overflow-y-auto no-scrollbar">
          
          <div>
            {/* Mobile-Only Compact Branding Header (Eliminates multi-paragraph hero on mobile) */}
            <div className="md:hidden flex items-center justify-between pb-2.5 mb-2.5 border-b border-teal-500/20">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-slate-950 p-1 flex items-center justify-center border border-teal-400/80 shadow-md shrink-0">
                  <GisPlnLogo size={28} withBadge={false} />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-base text-white tracking-tight leading-none">GROW</span>
                    <span className="text-[9px] font-black bg-teal-500/20 text-teal-300 border border-teal-400/30 px-1.5 py-0.5 rounded leading-none">ULP BAGUALA</span>
                  </div>
                  <span className="text-[8.5px] font-bold text-teal-300 tracking-wider uppercase mt-0.5 leading-none">GREAT RIGHT OF WAY</span>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-emerald-950/60 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>Secure</span>
              </div>
            </div>

            {/* Desktop-Only Header with Title & Secure Portal Badge */}
            <div className="hidden md:flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="font-black text-2xl text-white tracking-tight">
                  Login Sistem GROW
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Silakan masukkan akun terdaftar Anda
                </p>
              </div>

              {/* Secure Portal Badge */}
              <div className="flex items-center gap-1.5 bg-emerald-950/60 text-emerald-400 border border-emerald-500/40 px-3 py-1 rounded-full text-xs font-bold shadow-xs shrink-0">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Secure Portal</span>
              </div>
            </div>

            {/* Mobile Header Title */}
            <div className="md:hidden mb-2.5">
              <h2 className="font-black text-base text-white tracking-tight leading-none">
                Masuk ke Akun
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Masukkan User ID & Password terdaftar
              </p>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="mb-2.5 sm:mb-4 bg-rose-500/15 border border-rose-500/50 text-rose-300 text-xs p-2.5 sm:p-3 rounded-xl flex items-start gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Session Expired / Timeout Notification */}
            {sessionExpiredMessage && !error && (
              <div className="mb-2.5 sm:mb-4 bg-amber-500/15 border border-amber-500/50 text-amber-300 text-xs p-2.5 sm:p-3 rounded-xl flex items-start gap-2">
                <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <span>{sessionExpiredMessage}</span>
              </div>
            )}

            {/* Login Form: Tight Spacing for Zero-Scroll Mobile Experience */}
            <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-4">
              
              {/* Field 1: User ID / Email */}
              <div className="space-y-1">
                <label className="block text-[11px] sm:text-xs font-bold text-slate-300">
                  Email / User ID <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="Contoh: 9925045ZY atau email"
                    required
                    className="w-full bg-slate-950/70 border border-slate-700 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 rounded-xl pl-9 pr-3 py-2 sm:py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 transition-all outline-none"
                  />
                </div>
              </div>

              {/* Field 2: Password */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] sm:text-xs font-bold text-slate-300">
                    Password <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-[11px] sm:text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer transition-colors"
                  >
                    Lupa Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password Anda"
                    required
                    className="w-full bg-slate-950/70 border border-slate-700 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 rounded-xl pl-9 pr-10 py-2 sm:py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button with Dynamic Success State */}
              <button
                type="submit"
                disabled={loading || isLoggingInSuccess}
                className={`w-full mt-1 sm:mt-2 font-black py-2.5 sm:py-3 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 text-xs sm:text-sm transition-all duration-300 cursor-pointer btn-tactile disabled:opacity-90 ${
                  isLoggingInSuccess
                    ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/40 scale-[1.02]'
                    : 'bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-700 hover:from-blue-500 hover:via-cyan-500 hover:to-blue-600 text-white shadow-cyan-900/40'
                }`}
              >
                {isLoggingInSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950 animate-bounce" />
                    <span>Autentikasi Berhasil!</span>
                  </>
                ) : loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Memverifikasi Akun...</span>
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    <span>Masuk ke Dashboard GROW</span>
                  </>
                )}
              </button>

            </form>
          </div>

          {/* Footer Info */}
          <div className="mt-3 sm:mt-6 pt-2.5 sm:pt-4 border-t border-slate-800 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
              <span>Enkripsi Terproteksi</span>
            </div>
            <div>PLN ULP Baguala • 2026</div>
          </div>

        </div>

      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 text-slate-200 shadow-2xl">
            <h3 className="font-black text-lg text-white mb-2 flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-400" />
              <span>Reset Password Akun</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Untuk mereset password akun GROW PLN, silakan hubungi <b>Administrator Utama</b> atau <b>Supervisor Teknik ULP Baguala</b> melalui menu <i>Management User</i> di dalam dashboard.
            </p>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1 mb-5">
              <div>User ID Bawaan: <b className="text-amber-400 font-mono">9925045ZY</b></div>
              <div>Password Default: <b className="text-amber-400 font-mono">admin123</b></div>
              <div>Unit: <b>ULP Baguala - UP3 Ambon</b></div>
            </div>
            <button
              onClick={() => setShowForgotModal(false)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Field Inspection Documentation Badge */}
      <div className="absolute bottom-4 left-4 sm:left-6 z-20 hidden sm:flex items-center gap-2.5 bg-slate-950/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-teal-500/40 text-[11px] text-teal-200 shadow-xl pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-semibold tracking-wide text-white">Dokumentasi Lapangan:</span>
        <span className="text-teal-200/90 font-medium">Petugas PLN Inspeksi Right of Way (ROW) & Jaringan Tiang</span>
      </div>

    </div>
  );
};
export default LoginScreen;
