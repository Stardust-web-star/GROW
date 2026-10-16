import React from 'react';

interface PlnBadgeProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Official PLN ULP Baguala Pill Badge
 * Matches the official identity with:
 * - Golden yellow rounded emblem (#FFCC00)
 * - 3 Blue horizontal energy waves (#0088FF)
 * - Red electric lightning bolt (#DC2626)
 * - Electric Cyan "PLN" text (#00E5FF)
 * - Mint/Teal "ULP BAGUALA" text (#A7F3D0)
 */
export const PlnBadge: React.FC<PlnBadgeProps> = ({
  className = '',
  size = 'md'
}) => {
  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-7 h-7 sm:w-8 sm:h-8',
    lg: 'w-9 h-9'
  };

  const plnTextSizes = {
    sm: 'text-xs',
    md: 'text-sm sm:text-base',
    lg: 'text-lg'
  };

  const ulpTextSizes = {
    sm: 'text-[8px]',
    md: 'text-[9px] sm:text-[10px]',
    lg: 'text-xs'
  };

  return (
    <div
      className={`inline-flex items-center gap-2 bg-[#022123]/95 hover:bg-[#032a2c] backdrop-blur-md px-2.5 sm:px-3 py-1.5 rounded-xl border border-teal-500/50 shadow-md transition-all duration-200 select-none w-fit max-w-fit shrink-0 self-start ${className}`}
    >
      {/* Yellow Emblem with 3 Blue Waves and Red Lightning Bolt */}
      <div
        className={`${iconSizes[size]} rounded-lg bg-[#FFCC00] flex items-center justify-center p-0.5 shadow-sm shrink-0 overflow-hidden relative`}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Three Blue Wavy Lines (Hydro / Electricity Flow) */}
          <g
            stroke="#0080FF"
            strokeWidth="7.5"
            strokeLinecap="round"
            fill="none"
          >
            {/* Top Wave */}
            <path d="M 12 32 C 22 23, 31 41, 41 32 C 51 23, 60 41, 70 32 C 79 23, 86 36, 88 32" />
            {/* Middle Wave */}
            <path d="M 12 52 C 22 43, 31 61, 41 52 C 51 43, 60 61, 70 52 C 79 43, 86 56, 88 52" />
            {/* Bottom Wave */}
            <path d="M 12 72 C 22 63, 31 81, 41 72 C 51 63, 60 81, 70 72 C 79 63, 86 76, 88 72" />
          </g>

          {/* Central Red Lightning Bolt (Petir Kilat Merah PLN) */}
          <polygon
            points="58,10 36,46 52,46 40,90 68,41 53,41"
            fill="#DC2626"
            stroke="#FFCC00"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Official Typography: PLN (Cyan) & ULP BAGUALA (Mint/Teal) */}
      <div className="text-left flex flex-col justify-center leading-none">
        <span
          className={`font-black ${plnTextSizes[size]} text-[#00E5FF] tracking-wide leading-tight drop-shadow-xs`}
        >
          PLN
        </span>
        <span
          className={`font-bold ${ulpTextSizes[size]} text-[#A7F3D0] tracking-wider uppercase leading-tight mt-0.5 drop-shadow-xs`}
        >
          ULP BAGUALA
        </span>
      </div>
    </div>
  );
};

export default PlnBadge;
