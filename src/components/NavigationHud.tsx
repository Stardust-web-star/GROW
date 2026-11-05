import React, { useState } from 'react';
import { RouteResult, formatDistance, formatDuration, getGoogleMapsUrl } from '../utils/navigationService';
import {
  Navigation,
  Car,
  Footprints,
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CornerUpRight,
  CornerUpLeft,
  ArrowUp,
  MapPin,
  Compass,
  RotateCw,
  LocateFixed,
  Layers
} from 'lucide-react';

interface NavigationHudProps {
  route: RouteResult;
  userLocation: { lat: number; lng: number } | null;
  isAutoFollow: boolean;
  onToggleAutoFollow: () => void;
  onFitRoute: () => void;
  onChangeMode: (mode: 'driving' | 'walking') => void;
  onClose: () => void;
}

export const NavigationHud: React.FC<NavigationHudProps> = ({
  route,
  userLocation,
  isAutoFollow,
  onToggleAutoFollow,
  onFitRoute,
  onChangeMode,
  onClose
}) => {
  const [showSteps, setShowSteps] = useState(false);

  const googleMapsUrl = getGoogleMapsUrl(
    userLocation ? [userLocation.lat, userLocation.lng] : null,
    [route.destination.lat, route.destination.lng],
    route.mode
  );

  const currentStep = route.steps && route.steps.length > 0 ? route.steps[0] : null;

  const getStepIcon = (modifier?: string, type?: string) => {
    if (type === 'arrive') {
      return <MapPin className="w-5 h-5 text-emerald-400" />;
    }
    if (modifier?.includes('right')) {
      return <CornerUpRight className="w-5 h-5 text-amber-400" />;
    }
    if (modifier?.includes('left')) {
      return <CornerUpLeft className="w-5 h-5 text-cyan-400" />;
    }
    return <ArrowUp className="w-5 h-5 text-emerald-400" />;
  };

  return (
    <div className="absolute top-2 inset-x-2 md:inset-x-auto md:left-4 md:top-4 z-40 max-w-md pointer-events-auto select-none animate-in fade-in slide-in-from-top-4 duration-200">
      <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xl border border-slate-700/80 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-white">
        
        {/* Header Bar */}
        <div className="p-3 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shrink-0">
              <Navigation className="w-4 h-4 rotate-45" />
            </div>
            <div className="overflow-hidden">
              <div className="text-[10px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                <span>Rute Petunjuk Jalan GPS</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="font-extrabold text-xs text-white truncate" title={route.destination.name}>
                {route.destination.name}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Mode Switcher: Mobil vs Jalan Kaki */}
            <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
              <button
                onClick={() => onChangeMode('driving')}
                className={`p-1.5 rounded-md cursor-pointer transition-all ${
                  route.mode === 'driving'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Rute Kendaraan (Mobil / Motor)"
              >
                <Car className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onChangeMode('walking')}
                className={`p-1.5 rounded-md cursor-pointer transition-all ${
                  route.mode === 'walking'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Rute Jalan Kaki"
              >
                <Footprints className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
              title="Tutup Navigasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ETA & Distance Hero Row */}
        <div className="px-4 py-3 bg-slate-900/60 flex items-center justify-between border-b border-slate-800/80">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-400 tracking-tight">
                {formatDuration(route.durationSeconds)}
              </span>
              <span className="text-sm font-bold text-slate-300">
                ({formatDistance(route.distanceMeters)})
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              {route.mode === 'driving' ? 'Perkiraan waktu berkendara lancar' : 'Perkiraan waktu jalan kaki'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto-Follow Toggle */}
            <button
              onClick={onToggleAutoFollow}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                isAutoFollow
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md font-black'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
              title="Ikuti pergerakan GPS saya secara otomatis di peta"
            >
              <LocateFixed className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isAutoFollow ? 'Kamera Mengikuti' : 'Ikuti GPS'}</span>
            </button>

            {/* Fit Route */}
            <button
              onClick={onFitRoute}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 cursor-pointer"
              title="Pusatkan seluruh rute pada peta"
            >
              <Compass className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Next Maneuver Banner */}
        {currentStep && (
          <div className="px-4 py-2.5 bg-slate-950/70 flex items-center gap-3 border-b border-slate-800/80">
            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
              {getStepIcon(currentStep.modifier, currentStep.maneuverType)}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-xs font-bold text-white leading-snug line-clamp-2">
                {currentStep.instruction}
              </div>
              {currentStep.distanceMeters > 0 && (
                <div className="text-[10px] text-amber-400 font-extrabold mt-0.5">
                  Jarak langkah ini: {formatDistance(currentStep.distanceMeters)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions & Google Maps Launcher Row */}
        <div className="p-2.5 bg-slate-950 flex items-center justify-between gap-2">
          {/* External Google Maps Button */}
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs py-2 px-3 rounded-xl shadow-lg border border-blue-400/40 cursor-pointer active:scale-95 transition-transform"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Buka Navigasi Google Maps</span>
          </a>

          {/* Toggle Steps Drawer */}
          {route.steps.length > 1 && (
            <button
              onClick={() => setShowSteps(!showSteps)}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2 px-3 rounded-xl border border-slate-700 cursor-pointer transition-colors"
            >
              <span>{showSteps ? 'Tutup' : 'Petunjuk'}</span>
              {showSteps ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* Expandable Step-by-Step Instructions */}
        {showSteps && route.steps.length > 0 && (
          <div className="max-h-56 overflow-y-auto p-3 bg-slate-900 border-t border-slate-800 divide-y divide-slate-800/80 text-xs">
            {route.steps.map((step, idx) => (
              <div key={idx} className="py-2 flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5 text-slate-300">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-200 leading-snug">
                    {step.instruction}
                  </div>
                  {step.distanceMeters > 0 && (
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {formatDistance(step.distanceMeters)} · {formatDuration(step.durationSeconds)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};
