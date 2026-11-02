import React from 'react';
import growEmblemImg from '../assets/images/GROW_Emblem.png';

export interface GisPlnLogoProps {
  className?: string;
  size?: number | string;
  withBadge?: boolean;
  withGlow?: boolean;
  alt?: string;
}

/**
 * Official GROW (Great Right of Way) Emblem Logo
 * Matches the crisp, high-resolution circular logo used in LoginScreen:
 * - High-definition GROW emblem (blue circular 'G', GPS location pin, transmission tower & power lines, green/yellow perspective map)
 * - Pure white circular badge background
 * - Glowing teal/cyan ambient outer ring (identical to LoginScreen)
 * - Teal border ring and soft drop shadow
 */
export const GisPlnLogo: React.FC<GisPlnLogoProps> = ({
  className = '',
  size = 40,
  withBadge = true,
  withGlow = true,
  alt = 'Logo Resmi GROW (Great Right of Way) PLN ULP Baguala'
}) => {
  const dimension = typeof size === 'number' ? `${size}px` : size;

  const imageElement = (
    <img
      src={growEmblemImg}
      alt={alt}
      className="w-full h-full object-contain select-none"
      draggable={false}
      onError={(e) => {
        const img = e.currentTarget;
        // Fallback to static public path if asset bundle path differs
        if (!img.src.includes('image_47433b0e.png') && !img.src.includes('/assets/images/GROW_Emblem.png')) {
          img.src = '/assets/aistudio/image_47433b0e.png';
        }
      }}
    />
  );

  if (withBadge) {
    return (
      <div 
        className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
        style={{ width: dimension, height: dimension }}
      >
        {/* Glowing Teal/Cyan Ambient Aura (identical to Login Screen) */}
        {withGlow && (
          <div 
            className="absolute -inset-1 bg-gradient-to-r from-teal-400 via-cyan-400 to-emerald-400 rounded-full blur-[3px] opacity-75 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" 
          />
        )}

        {/* Crisp White Circular Badge Container */}
        <div className="relative w-full h-full rounded-full bg-white p-1 flex items-center justify-center border-2 border-teal-400/90 shadow-lg overflow-hidden select-none">
          {imageElement}
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: dimension, height: dimension }}
    >
      {imageElement}
    </div>
  );
};

export default GisPlnLogo;
