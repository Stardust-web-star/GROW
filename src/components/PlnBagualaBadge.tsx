import React from 'react';

interface PlnBagualaBadgeProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showContainer?: boolean;
}

/**
 * PlnBagualaBadge
 * Exactly reproduces the official PLN ULP Baguala badge from the user's reference:
 * - Rounded container with dark teal-green background (#022824) and teal border (#14b8a6)
 * - Bright golden-yellow square with rounded corners (#FFD100)
 * - 3 horizontal blue wavy lines representing power/energy waves (#0080FF)
 * - Sharp red electric lightning bolt (#ED1C24) slicing through the waves
 * - "PLN" wordmark in vibrant cyan (#00c8ff)
 * - "ULP BAGUALA" subtitle in mint-teal (#86efac)
 */
export const PlnBagualaBadge: React.FC<PlnBagualaBadgeProps> = ({
  className = '',
  size = 'md',
  showContainer = true
}) => {
  // Dimension mappings
  const dimensions = {
    sm: {
      box: 28,
      plnText: 'text-sm',
      subText: 'text-[9px]',
      gap: 'gap-2',
      padding: 'px-2.5 py-1.5',
      rounded: 'rounded-xl'
    },
    md: {
      box: 38,
      plnText: 'text-lg',
      subText: 'text-[11px]',
      gap: 'gap-3',
      padding: 'px-4 py-2.5',
      rounded: 'rounded-2xl'
    },
    lg: {
      box: 48,
      plnText: 'text-2xl',
      subText: 'text-xs',
      gap: 'gap-3.5',
      padding: 'px-5 py-3',
      rounded: 'rounded-2xl'
    },
    xl: {
      box: 64,
      plnText: 'text-3xl sm:text-4xl',
      subText: 'text-sm sm:text-base',
      gap: 'gap-4',
      padding: 'px-6 py-4',
      rounded: 'rounded-3xl'
    }
  }[size];

  const content = (
    <div className={`inline-flex items-center ${dimensions.gap} select-none`}>
      {/* 1. Yellow Square with 3 Blue Waves and Red Lightning Bolt */}
      <div 
        className="shrink-0 flex items-center justify-center shadow-md overflow-hidden"
        style={{ width: dimensions.box, height: dimensions.box }}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full drop-shadow-sm overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Subtle soft drop shadow for lightning */}
            <filter id="plnLightningGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#991b1b" floodOpacity="0.4" />
            </filter>
            {/* Subtle gradient for yellow box to match photo */}
            <linearGradient id="plnYellowBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFE000" />
              <stop offset="100%" stopColor="#FACC15" />
            </linearGradient>
          </defs>

          {/* Yellow rounded square */}
          <rect
            x="3"
            y="3"
            width="94"
            height="94"
            rx="22"
            ry="22"
            fill="url(#plnYellowBg)"
          />

          {/* 3 Horizontal Blue Waves (Gelombang Energi Tri Tunggal) */}
          <g stroke="#0072CE" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
            {/* Top Wave */}
            <path d="M 16 38 Q 28 30 40 38 T 64 38 T 84 38" />
            {/* Middle Wave */}
            <path d="M 16 52 Q 28 44 40 52 T 64 52 T 84 52" />
            {/* Bottom Wave */}
            <path d="M 16 66 Q 28 58 40 66 T 64 66 T 84 66" />
          </g>

          {/* Red Electric Lightning Bolt */}
          <polygon
            points="55,12 36,48 50,48 29,88 65,42 49,42"
            fill="#ED1C24"
            filter="url(#plnLightningGlow)"
          />
        </svg>
      </div>

      {/* 2. Text Content: PLN (Cyan) & ULP BAGUALA (Mint Green) */}
      <div className="flex flex-col justify-center text-left leading-none">
        <span className={`${dimensions.plnText} font-black text-[#00c8ff] tracking-tight leading-none drop-shadow-xs`}>
          PLN
        </span>
        <span className={`${dimensions.subText} font-bold text-[#86efac] tracking-wider uppercase leading-none mt-1 drop-shadow-xs`}>
          ULP BAGUALA
        </span>
      </div>
    </div>
  );

  if (!showContainer) {
    return <div className={`inline-block ${className}`}>{content}</div>;
  }

  return (
    <div 
      className={`inline-flex items-center bg-[#012521]/90 backdrop-blur-md border border-teal-500/40 shadow-xl ${dimensions.padding} ${dimensions.rounded} ${className}`}
    >
      {content}
    </div>
  );
};

export default PlnBagualaBadge;
