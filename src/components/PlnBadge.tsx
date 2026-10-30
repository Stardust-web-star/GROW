import React from 'react';
import plnEmblemImg from '../assets/images/PLN_Emblem.png';

interface PlnBadgeProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Official PLN ULP Baguala Pill Badge
 * Exactly matches image_4e638016.png & official PLN Brand guidelines:
 * - Rounded pill container with dark teal-cyan background (#022123) and glowing teal border
 * - Authentic PLN Golden Yellow square emblem with official 3 cyan waves & sharp red lightning bolt
 * - Bold Electric Cyan "PLN" wordmark (#00E5FF)
 * - Mint Pale-Green "ULP BAGUALA" subtitle (#A7F3D0)
 */
export const PlnBadge: React.FC<PlnBadgeProps> = ({
  className = '',
  size = 'md'
}) => {
  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  };

  const plnTextSizes = {
    sm: 'text-xs',
    md: 'text-sm sm:text-base',
    lg: 'text-lg'
  };

  const ulpTextSizes = {
    sm: 'text-[8px]',
    md: 'text-[9.5px] sm:text-[10.5px]',
    lg: 'text-xs'
  };

  const paddings = {
    sm: 'px-2.5 py-1',
    md: 'px-3 py-1.5',
    lg: 'px-3.5 py-2'
  };

  return (
    <div
      className={`inline-flex items-center gap-2.5 bg-[#022123]/95 hover:bg-[#032a2c] backdrop-blur-md ${paddings[size]} rounded-2xl border border-teal-500/50 shadow-lg shadow-teal-950/40 transition-all duration-200 select-none w-fit max-w-fit shrink-0 self-start ${className}`}
      aria-label="PT PLN (Persero) ULP Baguala"
    >
      {/* Official Golden Yellow Emblem with 3 Waves & Red Lightning Bolt */}
      <div
        className={`${iconSizes[size]} rounded-xl bg-[#FFE600] flex items-center justify-center p-0.5 shadow-sm shrink-0 overflow-hidden relative`}
      >
        <img
          src={plnEmblemImg}
          alt="Logo Resmi PLN"
          className="w-full h-full object-contain select-none"
          draggable={false}
          loading="eager"
        />
      </div>

      {/* Official Corporate Typography: PLN (Cyan) & ULP BAGUALA (Mint Green) */}
      <div className="text-left flex flex-col justify-center leading-none">
        <span
          className={`font-black ${plnTextSizes[size]} text-[#00E5FF] tracking-wide leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]`}
        >
          PLN
        </span>
        <span
          className={`font-bold ${ulpTextSizes[size]} text-[#A7F3D0] tracking-wider uppercase leading-tight mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]`}
        >
          ULP BAGUALA
        </span>
      </div>
    </div>
  );
};

export default PlnBadge;

