import React from 'react';

interface PlnLogoProps {
  className?: string;
  size?: number | string;
  showText?: boolean;
  textColor?: string;
  subtext?: string;
}

/**
 * Authentic Official Logo of PT PLN (Persero)
 * - Yellow shield/emblem (#FFD100)
 * - 3 Red sinusoidal energy waves (#ED1C24)
 * - Sharp royal blue electric lightning bolt (#005BAA)
 * - Clean official PLN wordmark
 */
export const PlnLogo: React.FC<PlnLogoProps> = ({
  className = 'h-9 w-auto',
  size = 36,
  showText = false,
  textColor = 'text-white',
  subtext
}) => {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Official PLN Shield Emblem SVG */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-md"
        aria-label="Logo Resmi PT PLN (Persero)"
      >
        <defs>
          {/* Subtle shield gradient for depth */}
          <linearGradient id="plnYellowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF000" />
            <stop offset="100%" stopColor="#FFCC00" />
          </linearGradient>
          {/* Lightning bolt gradient */}
          <linearGradient id="plnBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0072BC" />
            <stop offset="100%" stopColor="#004A99" />
          </linearGradient>
          {/* Red wave shadow */}
          <filter id="plnEmblemShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.35" />
          </filter>
        </defs>

        {/* 1. Official PLN Golden-Yellow Shield Emblem */}
        <path
          d="M10 16 
             C10 10 14 6 20 6 
             L80 6 
             C86 6 90 10 90 16 
             L90 82 
             C90 98 62 114 50 118 
             C38 114 10 98 10 82 
             Z"
          fill="url(#plnYellowGrad)"
          stroke="#1E293B"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Inner thin shield border accent */}
        <path
          d="M14 18 
             C14 14 16 11 21 11 
             L79 11 
             C84 11 86 14 86 18 
             L86 80 
             C86 94 60 108 50 112 
             C40 108 14 94 14 80 
             Z"
          fill="none"
          stroke="#FFF9A6"
          strokeWidth="1.5"
          opacity="0.8"
        />

        {/* 2. Three Red Wavy Lines (3 Gelombang Merah Energi & Tri Tunggal PLN) */}
        <g stroke="#ED1C24" strokeWidth="5.5" strokeLinecap="round" fill="none">
          {/* Top Wave */}
          <path d="M22 40 Q32 32 42 40 T62 40 T78 40" />
          {/* Middle Wave */}
          <path d="M22 56 Q32 48 42 56 T62 56 T78 56" />
          {/* Bottom Wave */}
          <path d="M24 72 Q33 64 43 72 T63 72 T76 72" />
        </g>

        {/* 3. Sharp Royal Blue Lightning Bolt (Petir Kilat Biru PLN) */}
        <polygon
          points="64,18 36,54 52,54 30,98 66,58 50,58"
          fill="url(#plnBlueGrad)"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinejoin="miter"
          filter="url(#plnEmblemShadow)"
        />
      </svg>

      {/* Optional Brand Wordmark */}
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className={`font-black text-lg tracking-wider ${textColor}`}>
            PLN
          </span>
          {subtext && (
            <span className="text-[10px] font-semibold text-slate-400 tracking-normal">
              {subtext}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
export default PlnLogo;
