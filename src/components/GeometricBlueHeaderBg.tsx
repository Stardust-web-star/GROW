import React from 'react';
import { useTheme } from '../context/ThemeContext';

interface GeometricBlueHeaderBgProps {
  className?: string;
  variant?: 'navbar' | 'toolbar';
}

/**
 * GeometricBlueHeaderBg - Dynamic Responsive Background for GROW Header
 * Dual-Theme Aware:
 * - Dark Mode: Signature deep emerald-teal to obsidian gradient (#064e43 -> #09443c -> #010b0d)
 * - Light Mode: Executive PLN cyan-blue to vibrant teal gradient (#0284c7 -> #0369a1 -> #0f766e)
 * - Refined dot-matrix motif matching SCADA electrical layout
 * - Soft ambient lighting flares
 */
export const GeometricBlueHeaderBg: React.FC<GeometricBlueHeaderBgProps> = ({
  className = '',
  variant = 'navbar'
}) => {
  const isToolbar = variant === 'toolbar';
  let isDark = true;
  try {
    const themeContext = useTheme();
    isDark = themeContext.isDark;
  } catch {
    // Fallback if rendered outside ThemeProvider
    isDark = typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true;
  }

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none overflow-hidden select-none z-0 transition-opacity duration-300 ${className}`}
    >
      <svg
        className="w-full h-full object-cover"
        viewBox="0 0 1920 120"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Dark Mode Gradient */}
          <linearGradient id="plnGreenBlackBase" x1="0%" y1="15%" x2="100%" y2="85%">
            <stop offset="0%" stopColor="#064e43" />
            <stop offset="22%" stopColor="#09443c" />
            <stop offset="45%" stopColor="#0a3832" />
            <stop offset="70%" stopColor="#062624" />
            <stop offset="88%" stopColor="#031618" />
            <stop offset="100%" stopColor="#010b0d" />
          </linearGradient>

          {/* Light Mode Gradient: Executive PLN Royal Blue & Teal */}
          <linearGradient id="plnLightExecutiveBase" x1="0%" y1="15%" x2="100%" y2="85%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="28%" stopColor="#0369a1" />
            <stop offset="60%" stopColor="#0e7490" />
            <stop offset="85%" stopColor="#0f766e" />
            <stop offset="100%" stopColor="#115e59" />
          </linearGradient>

          {/* Ambient Electrical Flares */}
          <radialGradient id="plnTealAmbientGlow" cx="12%" cy="45%" r="50%">
            <stop offset="0%" stopColor={isDark ? "#14b8a6" : "#38bdf8"} stopOpacity={isDark ? "0.25" : "0.35"} />
            <stop offset="50%" stopColor={isDark ? "#0d9488" : "#0284c7"} stopOpacity="0.10" />
            <stop offset="100%" stopColor={isDark ? "#064e43" : "#0369a1"} stopOpacity="0" />
          </radialGradient>

          <radialGradient id="plnEmeraldGlow" cx="75%" cy="40%" r="45%">
            <stop offset="0%" stopColor={isDark ? "#10b981" : "#2dd4bf"} stopOpacity={isDark ? "0.18" : "0.25"} />
            <stop offset="55%" stopColor={isDark ? "#042f2e" : "#0d9488"} stopOpacity="0.05" />
            <stop offset="100%" stopColor={isDark ? "#010b0d" : "#0f766e"} stopOpacity="0" />
          </radialGradient>

          <radialGradient id="plnCenterSoftGlow" cx="45%" cy="30%" r="35%">
            <stop offset="0%" stopColor={isDark ? "#2dd4bf" : "#7dd3fc"} stopOpacity={isDark ? "0.12" : "0.20"} />
            <stop offset="60%" stopColor={isDark ? "#064e43" : "#0369a1"} stopOpacity="0" />
          </radialGradient>

          {/* Clean Dot Matrix Motif */}
          <pattern
            id="plnLoginDotMatrix"
            width="18"
            height="18"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="9" cy="9" r="1.15" fill={isDark ? "#2dd4bf" : "#e0f2fe"} fillOpacity={isDark ? "0.20" : "0.30"} />
          </pattern>
        </defs>

        {/* --- LAYER 1: Base Gradient Canvas --- */}
        <rect width="1920" height="120" fill={isDark ? "url(#plnGreenBlackBase)" : "url(#plnLightExecutiveBase)"} />

        {/* --- LAYER 2: Ambient Lighting Flares --- */}
        <rect width="1920" height="120" fill="url(#plnTealAmbientGlow)" />
        <rect width="1920" height="120" fill="url(#plnEmeraldGlow)" />
        <rect width="1920" height="120" fill="url(#plnCenterSoftGlow)" />

        {/* --- LAYER 3: Clean Dot Matrix Motif --- */}
        <rect width="1920" height="120" fill="url(#plnLoginDotMatrix)" />

        {/* --- LAYER 4: Soft Contrast Overlay --- */}
        <rect
          width="1920"
          height="120"
          fill={isDark ? "url(#plnGreenBlackBase)" : "url(#plnLightExecutiveBase)"}
          opacity={isToolbar ? "0.18" : "0.08"}
        />
      </svg>
    </div>
  );
};

export default GeometricBlueHeaderBg;
