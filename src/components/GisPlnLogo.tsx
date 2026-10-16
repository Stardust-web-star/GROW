import React from 'react';

interface GisPlnLogoProps {
  className?: string;
  size?: number | string;
  withBadge?: boolean;
}

/**
 * Official GIS Kelistrikan PLN Logo (Geographic Information System PLN)
 * Exactly reproduces the user's uploaded logo image:
 * - Stylized circular 'G' letter in blue gradient (Geographic Information System)
 * - Power transmission pylon tower (tiang transmisi listrik) on the right shelf
 * - 3 flowing electric power lines
 * - Centered royal-blue GPS location pin with white cutout
 * - Perspective map terrain with green fields and diagonal yellow avenue
 */
export const GisPlnLogo: React.FC<GisPlnLogoProps> = ({
  className = '',
  size = 40,
  withBadge = true
}) => {
  const content = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 400 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 select-none overflow-visible"
      aria-label="Logo GIS Kelistrikan PLN ULP Baguala"
    >
      <defs>
        {/* Gradient for outer 'G' ring */}
        <linearGradient id="gisGGrad" x1="100" y1="30" x2="350" y2="370" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00A2E8" />
          <stop offset="30%" stopColor="#0080D0" />
          <stop offset="70%" stopColor="#00529C" />
          <stop offset="100%" stopColor="#003B75" />
        </linearGradient>

        {/* Gradient for GPS Map Pin */}
        <linearGradient id="gisPinGrad" x1="172" y1="95" x2="172" y2="265" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0072BC" />
          <stop offset="100%" stopColor="#004A8F" />
        </linearGradient>

        {/* Gradient for Diagonal Highway */}
        <linearGradient id="gisRoadGrad" x1="185" y1="245" x2="225" y2="380" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>

      {/* 1. PERSPECTIVE MAP TERRAIN (Green Parcels & Yellow Road) */}
      <g id="terrain-map">
        {/* Far Left Top Plot */}
        <polygon points="98,212 135,225 148,252 115,248 92,232" fill="#15803D" />
        {/* Mid Left Plot */}
        <polygon points="115,248 148,252 138,288 96,270" fill="#22C55E" />
        {/* Lower Left Large Plot */}
        <polygon points="96,270 138,288 196,368 132,342 100,305" fill="#166534" />
        {/* Central Left Plot beside road */}
        <polygon points="138,288 184,272 205,342 196,368" fill="#16A34A" />
        {/* Center Plot under pin */}
        <polygon points="148,252 196,242 184,272 138,288" fill="#15803D" />
        {/* Right Field Plot 1 */}
        <polygon points="196,242 270,242 265,282 205,262" fill="#166534" />
        {/* Right Field Plot 2 (Large) */}
        <polygon points="205,262 270,282 242,338 195,312" fill="#1E7E34" />

        {/* Yellow Diagonal Highway / Central Road */}
        <polygon points="186,246 202,249 238,370 208,378" fill="url(#gisRoadGrad)" />

        {/* White Road & Plot Separation Lines */}
        <g stroke="#FFFFFF" strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round" fill="none">
          <line x1="92" y1="232" x2="148" y2="252" />
          <line x1="135" y1="225" x2="196" y2="242" />
          <line x1="96" y1="270" x2="184" y2="272" />
          <line x1="138" y1="288" x2="205" y2="342" />
          <line x1="205" y1="262" x2="265" y2="282" />
          {/* Left road curb */}
          <line x1="186" y1="246" x2="208" y2="378" />
          {/* Right road curb */}
          <line x1="202" y1="249" x2="238" y2="370" />
        </g>
      </g>

      {/* 2. THE STYLIZED CIRCULAR 'G' */}
      <g id="stylized-G">
        {/* Main circular body of the letter 'G' */}
        <path
          d="M 302 78
             A 160 160 0 1 0 318 305
             L 318 236
             L 226 236
             C 222 236 218 233 218 229
             C 218 225 222 222 226 222
             L 346 222
             C 350 222 354 226 354 232
             C 354 278 330 324 298 350
             A 182 182 0 1 1 324 55
             C 318 62 310 70 302 78
             Z"
          fill="url(#gisGGrad)"
        />

        {/* The horizontal crossbar of the 'G' serving as the pylon platform */}
        <path
          d="M 224 236
             L 348 236
             C 348 215 348 195 348 188
             L 236 188
             Z"
          fill="url(#gisGGrad)"
        />
      </g>

      {/* 3. TRANSMISSION TOWER PYLON (Tiang SUTET Listrik) */}
      <g id="transmission-tower" stroke="#004A8F" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round">
        {/* Left and Right Legs */}
        <line x1="248" y1="188" x2="260" y2="92" />
        <line x1="288" y1="188" x2="276" y2="92" />

        {/* Top Peak Triangle */}
        <polygon points="260,92 268,74 276,92" fill="#004A8F" stroke="none" />

        {/* Upper Crossarm (Horizontal) */}
        <line x1="240" y1="114" x2="296" y2="114" />
        {/* Upper Insulators */}
        <line x1="240" y1="114" x2="240" y2="126" strokeWidth="4" />
        <line x1="296" y1="114" x2="296" y2="126" strokeWidth="4" />

        {/* Lower Crossarm (Horizontal) */}
        <line x1="234" y1="140" x2="302" y2="140" />
        {/* Lower Insulators */}
        <line x1="234" y1="140" x2="234" y2="154" strokeWidth="4" />
        <line x1="302" y1="140" x2="302" y2="154" strokeWidth="4" />

        {/* Diagonal X-Bracings */}
        <line x1="262" y1="114" x2="274" y2="140" strokeWidth="4" />
        <line x1="274" y1="114" x2="262" y2="140" strokeWidth="4" />
        <line x1="258" y1="140" x2="284" y2="188" strokeWidth="4" />
        <line x1="278" y1="140" x2="252" y2="188" strokeWidth="4" />
        {/* Horizontal tie bar */}
        <line x1="254" y1="164" x2="282" y2="164" strokeWidth="4" />
      </g>

      {/* 4. ELECTRIC POWER LINES (3 Kabel Transmisi Lengkung ke Kanan) */}
      <g id="electric-power-lines" stroke="#00A2E8" strokeWidth="4.5" strokeLinecap="round" fill="none">
        {/* Line 1 (Top) */}
        <path d="M 296 124 C 318 136, 338 145, 362 148" />
        {/* Line 2 (Middle) */}
        <path d="M 302 148 C 324 162, 344 170, 368 174" />
        {/* Line 3 (Bottom) */}
        <path d="M 294 170 C 316 186, 342 194, 372 198" />
      </g>

      {/* 5. GPS LOCATION PIN (Pin Peta di Tengah) */}
      <g id="location-pin">
        {/* Teardrop Pin Body */}
        <path
          d="M 172 90
             C 138 90 110 118 110 152
             C 110 196 172 274 172 274
             C 172 274 234 196 234 152
             C 234 118 206 90 172 90
             Z"
          fill="url(#gisPinGrad)"
          stroke="#FFFFFF"
          strokeWidth="4"
          strokeLinejoin="round"
        />

        {/* Central White Cutout Circle */}
        <circle cx="172" cy="150" r="22" fill="#FFFFFF" />
      </g>
    </svg>
  );

  if (withBadge) {
    return (
      <div className={`w-10 h-10 rounded-full bg-white flex items-center justify-center p-0.5 shadow-md border border-slate-200/90 shrink-0 ${className}`}>
        {content}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center justify-center shrink-0 ${className}`}>
      {content}
    </div>
  );
};
export default GisPlnLogo;
