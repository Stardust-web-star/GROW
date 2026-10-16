import React from 'react';

interface GeometricBlueHeaderBgProps {
  className?: string;
  variant?: 'navbar' | 'toolbar';
}

/**
 * GeometricBlueHeaderBg - PLN GROW Signature Dark Green-to-Black Theme
 * Clean, modern aesthetic without distracting lines/stripes:
 * - Rich deep emerald/teal gradient to deep black (#064e43 -> #09443c -> #0a3832 -> #010b0d)
 * - Refined dot-matrix motif matching the official login screen panel
 * - Soft ambient teal & emerald lighting flares
 * - Free of line/wave/stripe clutter for maximum contrast and sleek appearance
 */
export const GeometricBlueHeaderBg: React.FC<GeometricBlueHeaderBgProps> = ({
  className = '',
  variant = 'navbar'
}) => {
  const isToolbar = variant === 'toolbar';

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none overflow-hidden select-none z-0 ${className}`}
    >
      <svg
        className="w-full h-full object-cover"
        viewBox="0 0 1920 120"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* 1. Login-Matched Green to Black Gradient */}
          <linearGradient id="plnGreenBlackBase" x1="0%" y1="15%" x2="100%" y2="85%">
            <stop offset="0%" stopColor="#064e43" />
            <stop offset="22%" stopColor="#09443c" />
            <stop offset="45%" stopColor="#0a3832" />
            <stop offset="70%" stopColor="#062624" />
            <stop offset="88%" stopColor="#031618" />
            <stop offset="100%" stopColor="#010b0d" />
          </linearGradient>

          {/* 2. Soft Ambient Electrical Flares (Teal & Emerald) */}
          <radialGradient id="plnTealAmbientGlow" cx="12%" cy="45%" r="50%">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.25" />
            <stop offset="50%" stopColor="#0d9488" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#064e43" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="plnEmeraldGlow" cx="75%" cy="40%" r="45%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
            <stop offset="55%" stopColor="#042f2e" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#010b0d" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="plnCenterSoftGlow" cx="45%" cy="30%" r="35%">
            <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.12" />
            <stop offset="60%" stopColor="#064e43" stopOpacity="0" />
          </radialGradient>

          {/* 3. Refined SCADA Dot Matrix Motif Pattern (Identical to Login Screen) */}
          <pattern
            id="plnLoginDotMatrix"
            width="18"
            height="18"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="9" cy="9" r="1.15" fill="#2dd4bf" fillOpacity="0.20" />
          </pattern>
        </defs>

        {/* --- LAYER 1: Deep Green-to-Black Gradient Canvas --- */}
        <rect width="1920" height="120" fill="url(#plnGreenBlackBase)" />

        {/* --- LAYER 2: Ambient Lighting Flares --- */}
        <rect width="1920" height="120" fill="url(#plnTealAmbientGlow)" />
        <rect width="1920" height="120" fill="url(#plnEmeraldGlow)" />
        <rect width="1920" height="120" fill="url(#plnCenterSoftGlow)" />

        {/* --- LAYER 3: Clean Dot Matrix Motif (No Lines / Stripes) --- */}
        <rect width="1920" height="120" fill="url(#plnLoginDotMatrix)" />

        {/* --- LAYER 4: Soft Contrast Overlay --- */}
        <rect
          width="1920"
          height="120"
          fill="url(#plnGreenBlackBase)"
          opacity={isToolbar ? "0.18" : "0.08"}
        />
      </svg>
    </div>
  );
};

export default GeometricBlueHeaderBg;
