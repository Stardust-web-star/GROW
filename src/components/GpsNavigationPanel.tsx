import React, { useState, useMemo } from 'react';
import { 
  Navigation, 
  MapPin, 
  Compass, 
  X, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink, 
  CornerUpRight, 
  CornerUpLeft, 
  ArrowUp, 
  RotateCcw, 
  CheckCircle, 
  AlertCircle,
  LocateFixed,
  Car,
  Bike,
  Footprints,
  Clock,
  Sparkles,
  Route
} from 'lucide-react';
import { PoleData, CableSpan } from '../types';
import { RouteResult, RouteMode, formatDistance, formatDuration, getGoogleMapsNavigationUrl } from '../utils/routingService';
import { UserLocation } from '../hooks/useLiveGeolocation';

interface GpsNavigationPanelProps {
  poles: PoleData[];
  spans: CableSpan[];
  userLocation: UserLocation | null;
  isGpsTracking: boolean;
  gpsError: string | null;
  activeRoute: RouteResult | null;
  targetDestination: { title: string; lat: number; lng: number; type: 'pole' | 'cable'; code?: string } | null;
  selectedTravelMode: RouteMode;
  isCalculatingRoute: boolean;
  isFollowMeActive: boolean;
  onToggleGps: () => void;
  onToggleFollowMe: () => void;
  onStartRoute: (
    origin: { lat: number; lng: number; name: string },
    destination: { lat: number; lng: number; name: string },
    mode: RouteMode
  ) => void;
  onClearRoute: () => void;
  onChangeTravelMode: (mode: RouteMode) => void;
  onFitRouteBounds: () => void;
  onSimulateLocation?: (lat: number, lng: number) => void;
}

export const GpsNavigationPanel: React.FC<GpsNavigationPanelProps> = ({
  poles,
  spans,
  userLocation,
  isGpsTracking,
  gpsError,
  activeRoute,
  targetDestination,
  selectedTravelMode,
  isCalculatingRoute,
  isFollowMeActive,
  onToggleGps,
  onToggleFollowMe,
  onStartRoute,
  onClearRoute,
  onChangeTravelMode,
  onFitRouteBounds,
  onSimulateLocation
}) => {
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [isStepsExpanded, setIsStepsExpanded] = useState(false);
  const [searchTargetPole, setSearchTargetPole] = useState('');
  const [selectedTargetPoleId, setSelectedTargetPoleId] = useState<string>('');
  const [selectedOriginType, setSelectedOriginType] = useState<'myGps' | 'customPole'>('myGps');
  const [selectedOriginPoleId, setSelectedOriginPoleId] = useState<string>('');

  // Filter poles for destination dropdown
  const filteredTargetPoles = useMemo(() => {
    const q = searchTargetPole.trim().toLowerCase();
    if (!q) return poles.slice(0, 30);
    return poles.filter(p => 
      p.code.toLowerCase().includes(q) || 
      p.id.toLowerCase().includes(q) || 
      p.locationName.toLowerCase().includes(q) ||
      p.feeder.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [poles, searchTargetPole]);

  // Maneuver icon helper
  const renderManeuverIcon = (modifier?: string, type?: string) => {
    if (type === 'arrive') {
      return <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />;
    }
    if (modifier?.includes('left')) {
      return <CornerUpLeft className="w-5 h-5 text-sky-400 shrink-0" />;
    }
    if (modifier?.includes('right')) {
      return <CornerUpRight className="w-5 h-5 text-amber-400 shrink-0" />;
    }
    if (modifier?.includes('uturn')) {
      return <RotateCcw className="w-5 h-5 text-rose-400 shrink-0" />;
    }
    return <ArrowUp className="w-5 h-5 text-sky-400 shrink-0" />;
  };

  // Launch navigation with selected inputs
  const handleLaunchNavigation = () => {
    let origin: { lat: number; lng: number; name: string } | null = null;

    if (selectedOriginType === 'myGps') {
      if (userLocation) {
        origin = {
          lat: userLocation.lat,
          lng: userLocation.lng,
          name: 'Lokasi Live GPS Saya'
        };
      } else {
        // Fallback to sample Baguala center if GPS not yet loaded
        if (poles.length > 0) {
          const sample = poles[0];
          origin = { lat: sample.lat + 0.005, lng: sample.lng - 0.005, name: 'Posisi Petugas Lapangan (Estimasi)' };
        } else {
          origin = { lat: -3.6425, lng: 128.2325, name: 'Kantor ULP Baguala' };
        }
      }
    } else {
      const origPole = poles.find(p => p.id === selectedOriginPoleId || p.code === selectedOriginPoleId);
      if (origPole) {
        origin = { lat: origPole.lat, lng: origPole.lng, name: `Tiang ${origPole.code}` };
      }
    }

    const destPole = poles.find(p => p.id === selectedTargetPoleId || p.code === selectedTargetPoleId);
    if (!origin || !destPole) {
      alert('Pilih titik tujuan tiang PLN terlebih dahulu.');
      return;
    }

    const destination = {
      lat: destPole.lat,
      lng: destPole.lng,
      name: `Tiang ${destPole.code} (${destPole.locationName})`
    };

    onStartRoute(origin, destination, selectedTravelMode);
    setIsPlannerOpen(false);
  };

  return (
    <>
      {/* 1. Floating Top/Bottom Active Navigation HUD Bar (Ketika Rute Sedang Aktif) */}
      {activeRoute && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] w-[95%] max-w-xl animate-dashboard-enter">
          <div className="bg-slate-950/95 backdrop-blur-xl border-2 border-sky-500/60 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
            {/* Top Primary Banner: Next Turn & ETA */}
            <div className="p-3.5 bg-gradient-to-r from-slate-900 via-sky-950/80 to-slate-900 border-b border-sky-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center shrink-0 shadow-inner">
                  {renderManeuverIcon(activeRoute.steps[0]?.modifier, activeRoute.steps[0]?.maneuverType)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-sky-300 flex items-center gap-1.5 truncate">
                    <span>🧭 Menuju:</span>
                    <b className="text-white font-extrabold truncate">{activeRoute.destinationName || 'Titik Sasaran PLN'}</b>
                  </div>
                  <div className="text-sm font-black text-amber-300 leading-tight truncate">
                    {activeRoute.steps[0]?.instruction || 'Lanjutkan perjalanan menuju tiang target'}
                  </div>
                </div>
              </div>

              {/* ETA & Distance Pill */}
              <div className="flex flex-col items-end shrink-0 pl-2">
                <span className="text-lg font-black text-sky-400 leading-none">
                  {formatDistance(activeRoute.totalDistanceMeters)}
                </span>
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 text-sky-400" />
                  {formatDuration(activeRoute.totalDurationSeconds)}
                </span>
              </div>
            </div>

            {/* Sub-bar: Controls & Mode Switcher */}
            <div className="px-3.5 py-2.5 bg-slate-950/90 flex flex-wrap items-center justify-between gap-2 text-xs">
              {/* Travel Mode Pills */}
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                <button
                  onClick={() => onChangeTravelMode('motorcycle')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition-all ${
                    selectedTravelMode === 'motorcycle'
                      ? 'bg-amber-400 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Sepeda Motor (Armada Patroli)"
                >
                  <Bike className="w-3.5 h-3.5" />
                  <span>Motor</span>
                </button>
                <button
                  onClick={() => onChangeTravelMode('driving')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition-all ${
                    selectedTravelMode === 'driving'
                      ? 'bg-sky-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Mobil Operasional / Truk Crane"
                >
                  <Car className="w-3.5 h-3.5" />
                  <span>Mobil</span>
                </button>
                <button
                  onClick={() => onChangeTravelMode('walking')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition-all ${
                    selectedTravelMode === 'walking'
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Jalan Kaki / Rintis Jalur Trase"
                >
                  <Footprints className="w-3.5 h-3.5" />
                  <span>Jalan</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 ml-auto">
                {/* Fit Bounds */}
                <button
                  onClick={onFitRouteBounds}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-bold flex items-center gap-1 shadow-xs"
                  title="Pusatkan peta ke seluruh bentangan rute"
                >
                  <Compass className="w-3 h-3 text-sky-400" />
                  <span className="hidden sm:inline">Pusatkan</span>
                </button>

                {/* Follow Me Toggle */}
                <button
                  onClick={onToggleFollowMe}
                  className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 border transition-all ${
                    isFollowMeActive
                      ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-sm'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                  title="Ikuti pergerakan live GPS saya di tengah layar"
                >
                  <LocateFixed className="w-3 h-3" />
                  <span>{isFollowMeActive ? 'Mengikuti' : 'Ikuti Saya'}</span>
                </button>

                {/* Toggle Step Details */}
                <button
                  onClick={() => setIsStepsExpanded(!isStepsExpanded)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-bold flex items-center gap-1"
                  title="Buka daftar petunjuk belokan demi belokan"
                >
                  <span>Petunjuk ({activeRoute.steps.length})</span>
                  {isStepsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {/* Open in Google Maps */}
                {targetDestination && (
                  <a
                    href={getGoogleMapsNavigationUrl(
                      targetDestination.lat,
                      targetDestination.lng,
                      userLocation?.lat,
                      userLocation?.lng,
                      selectedTravelMode
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-extrabold flex items-center gap-1 shadow-md"
                    title="Buka rute navigasi di aplikasi Google Maps HP"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>G-Maps</span>
                  </a>
                )}

                {/* Close Route */}
                <button
                  onClick={onClearRoute}
                  className="p-1 bg-rose-900/80 hover:bg-rose-800 text-rose-200 border border-rose-700 rounded-lg"
                  title="Akhiri / Tutup Petunjuk Rute"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Expandable Turn-by-Turn List */}
            {isStepsExpanded && (
              <div className="max-h-64 overflow-y-auto p-3 bg-slate-900/90 border-t border-slate-800 space-y-2 text-xs">
                <div className="font-extrabold text-slate-400 uppercase tracking-wider text-[10px] pb-1 border-b border-slate-800 flex justify-between">
                  <span>Daftar Manuver Petunjuk Jalan</span>
                  <span>{activeRoute.summary}</span>
                </div>
                {activeRoute.steps.map((st, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                    <div className="mt-0.5">
                      {renderManeuverIcon(st.modifier, st.maneuverType)}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-slate-200">{st.instruction}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {formatDistance(st.distanceMeters)} {st.durationSeconds > 0 && `· ${formatDuration(st.durationSeconds)}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Floating Action Button: Open Route Planner (🧭 Rute) on the right/bottom */}
      <div className="fixed bottom-6 right-6 z-[950] flex flex-col items-end gap-2.5">
        {/* Live GPS Quick Status Chip */}
        {isGpsTracking && userLocation && (
          <div className="bg-slate-950/90 backdrop-blur-md border border-sky-500/40 px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 text-xs text-slate-200 animate-dashboard-enter">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping shrink-0" />
            <span className="font-extrabold text-sky-300">Live GPS:</span>
            <span className="font-medium text-slate-300">±{userLocation.accuracy}m</span>
            {userLocation.speed !== null && userLocation.speed > 0 && (
              <span className="font-bold text-amber-400">· {Math.round(userLocation.speed * 3.6)} km/j</span>
            )}
          </div>
        )}

        {/* GPS Error Notification */}
        {gpsError && (
          <div className="bg-rose-950/95 border border-rose-500 px-3 py-1.5 rounded-xl text-xs text-rose-200 shadow-xl max-w-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="text-[11px]">{gpsError}</span>
            <button onClick={onToggleGps} className="text-sky-300 underline font-bold text-[11px] shrink-0">Coba</button>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Tombol GPS Live Tracking */}
          <button
            onClick={onToggleGps}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl shadow-xl font-black text-xs transition-all border cursor-pointer ${
              isGpsTracking
                ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 border-sky-300 shadow-sky-500/30'
                : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700/80 backdrop-blur-md'
            }`}
            title={isGpsTracking ? 'Matikan Live GPS Tracking' : 'Aktifkan Live GPS Tracking Posisi Pengguna'}
          >
            <LocateFixed className={`w-4 h-4 ${isGpsTracking ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
            <span>{isGpsTracking ? 'GPS Aktif' : 'Lokasi Saya'}</span>
          </button>

          {/* Tombol Buka Perencana Rute (Petunjuk Arah) */}
          <button
            onClick={() => setIsPlannerOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs rounded-2xl shadow-xl shadow-amber-500/20 border border-amber-300 transition-all cursor-pointer"
            title="Buka formulir rute petunjuk arah menuju tiang atau kabel PLN"
          >
            <Route className="w-4 h-4 stroke-[2.5]" />
            <span>Petunjuk Rute</span>
          </button>
        </div>
      </div>

      {/* 3. Modal / Dialog Planner: Pilih Titik Awal & Tujuan Rute */}
      {isPlannerOpen && (
        <div className="fixed inset-0 z-[1100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-dashboard-enter">
          <div className="bg-slate-900 border border-teal-500/40 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-slate-950 via-teal-950/70 to-slate-950 border-b border-teal-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md">
                  <Navigation className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white tracking-tight">Petunjuk Rute & Direction Tiang</h3>
                  <p className="text-xs text-teal-300">Navigasi jalan raya menuju tiang atau bentangan kabel PLN</p>
                </div>
              </div>
              <button
                onClick={() => setIsPlannerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto text-sm text-slate-200">
              {/* Origin Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Titik Awal Keberangkatan (Origin)
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setSelectedOriginType('myGps')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      selectedOriginType === 'myGps'
                        ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-md font-black'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    <LocateFixed className="w-4 h-4" />
                    <span>📍 Lokasi GPS Saya</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedOriginType('customPole')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      selectedOriginType === 'customPole'
                        ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-md font-black'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    <MapPin className="w-4 h-4" />
                    <span>Pilih Tiang Awal</span>
                  </button>
                </div>

                {selectedOriginType === 'myGps' && (
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      <span>{userLocation ? `GPS Terkunci (±${userLocation.accuracy}m)` : 'GPS belum aktif, akan menggunakan estimasi lapangan.'}</span>
                    </div>
                    {!isGpsTracking && (
                      <button
                        onClick={onToggleGps}
                        className="text-sky-400 hover:text-sky-300 font-extrabold underline text-xs"
                      >
                        Aktifkan GPS
                      </button>
                    )}
                  </div>
                )}

                {selectedOriginType === 'customPole' && (
                  <select
                    value={selectedOriginPoleId}
                    onChange={(e) => setSelectedOriginPoleId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    <option value="">-- Pilih Tiang Awal --</option>
                    {poles.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.code} ({p.id}) - {p.feeder} - {p.locationName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Destination Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Titik Sasaran Tujuan (Destination Pole / Tiang Target)
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={searchTargetPole}
                    onChange={(e) => setSearchTargetPole(e.target.value)}
                    placeholder="Ketik kode tiang, lokasi, atau nama jalan (cth: Passo, PSW-012)..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />

                  <select
                    value={selectedTargetPoleId}
                    onChange={(e) => setSelectedTargetPoleId(e.target.value)}
                    size={5}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400 overflow-y-auto"
                  >
                    {filteredTargetPoles.map(p => (
                      <option key={p.id} value={p.id} className="py-1 px-2 hover:bg-slate-800 rounded">
                        ⚡ {p.code} · {p.feeder} · {p.locationName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Travel Mode Choice */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Pilihan Armada / Moda Perjalanan
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => onChangeTravelMode('motorcycle')}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                      selectedTravelMode === 'motorcycle'
                        ? 'bg-amber-400/20 border-amber-400 text-amber-300 font-extrabold shadow-sm'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-750'
                    }`}
                  >
                    <Bike className="w-5 h-5 text-amber-400" />
                    <span className="text-xs">Sepeda Motor</span>
                    <span className="text-[10px] text-slate-400">Tim Yantek</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onChangeTravelMode('driving')}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                      selectedTravelMode === 'driving'
                        ? 'bg-sky-400/20 border-sky-400 text-sky-300 font-extrabold shadow-sm'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-750'
                    }`}
                  >
                    <Car className="w-5 h-5 text-sky-400" />
                    <span className="text-xs">Mobil Dinas</span>
                    <span className="text-[10px] text-slate-400">Mobil Crane / Ops</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onChangeTravelMode('walking')}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                      selectedTravelMode === 'walking'
                        ? 'bg-emerald-400/20 border-emerald-400 text-emerald-300 font-extrabold shadow-sm'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-750'
                    }`}
                  >
                    <Footprints className="w-5 h-5 text-emerald-400" />
                    <span className="text-xs">Jalan Kaki</span>
                    <span className="text-[10px] text-slate-400">Inspeksi Trase</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsPlannerOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleLaunchNavigation}
                disabled={!selectedTargetPoleId || isCalculatingRoute}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-teal-500 to-sky-500 hover:from-teal-400 hover:to-sky-400 text-slate-950 shadow-lg shadow-teal-500/20 border border-teal-300 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isCalculatingRoute ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Menghitung Rute...</span>
                  </>
                ) : (
                  <>
                    <Route className="w-4 h-4" />
                    <span>Mulai Petunjuk Arah</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
