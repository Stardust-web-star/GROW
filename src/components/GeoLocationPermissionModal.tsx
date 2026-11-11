import React, { useState } from 'react';
import { X, MapPin, AlertCircle, RefreshCw } from 'lucide-react';

interface GeoLocationPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAllowSuccess?: (coords: { lat: number; lng: number; accuracy: number }) => void;
  onDisallow?: () => void;
}

export const GeoLocationPermissionModal: React.FC<GeoLocationPermissionModalProps> = ({
  isOpen,
  onClose,
  onAllowSuccess,
  onDisallow
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeniedByBrowser, setIsDeniedByBrowser] = useState(false);

  if (!isOpen) return null;

  const handleAllow = () => {
    setIsLoading(true);
    setErrorMessage(null);
    setIsDeniedByBrowser(false);

    if (!navigator.geolocation) {
      setIsLoading(false);
      setErrorMessage('Browser atau perangkat Anda tidak mendukung fitur Geolocation / GPS.');
      return;
    }

    // Direct invocation from user click triggers native browser permission smoothly
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLoading(false);
        try {
          localStorage.setItem('pln_geo_permission', 'granted');
        } catch {
          // Ignore storage quota
        }
        if (onAllowSuccess) {
          onAllowSuccess({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy || 15
          });
        }
        onClose();
      },
      (err) => {
        setIsLoading(false);
        console.warn('Geolocation permission error:', err);
        if (err.code === err.PERMISSION_DENIED) {
          setIsDeniedByBrowser(true);
          setErrorMessage(
            'Akses lokasi sebelumnya diblokir di browser. Klik ikon gembok 🔒 atau setelan di sebelah kiri kolom alamat URL browser Anda, pilih "Izinkan Lokasi" (Allow Location), lalu klik Coba Lagi.'
          );
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setErrorMessage('Sinyal GPS tidak tersedia saat ini. Pastikan GPS/Location di perangkat Anda telah aktif.');
        } else if (err.code === err.TIMEOUT) {
          setErrorMessage('Waktu tunggu sinyal GPS habis. Silakan klik tombol di bawah untuk mencoba kembali.');
        } else {
          setErrorMessage(err.message || 'Gagal memperoleh izin akses lokasi geografis.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleDisallow = () => {
    try {
      sessionStorage.setItem('pln_geo_disallowed', 'true');
    } catch {
      // Ignore
    }
    if (onDisallow) {
      onDisallow();
    }
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleDisallow();
        }
      }}
    >
      <div 
        className="relative w-full max-w-md bg-[#1e232b] text-white border border-slate-700/80 rounded-2xl shadow-2xl p-5 sm:p-6 animate-modal-pop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="geo-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3">
          <h2 
            id="geo-modal-title" 
            className="text-[17px] sm:text-lg font-bold text-slate-100 tracking-tight"
          >
            Geographic location access request
          </h2>
          <button
            onClick={handleDisallow}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Message */}
        <div className="space-y-3 my-2 text-sm text-slate-300 leading-relaxed">
          <p>
            This app requests access to Geographic location to work properly. Do you want to allow Geographic location access?
          </p>

          <p className="text-xs text-slate-400 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60 flex items-start gap-2">
            <MapPin className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <span>
              Akses lokasi (GPS) diperlukan untuk menampilkan posisi real-time petugas di peta GIS dan menghitung rute navigasi langsung ke tiang listrik lapangan.
            </span>
          </p>

          {/* Error / Instructions Banner if blocked */}
          {errorMessage && (
            <div className="bg-amber-950/90 border border-amber-500/70 text-amber-200 text-xs p-3 rounded-xl flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <span className="font-semibold block">{errorMessage}</span>
                {isDeniedByBrowser && (
                  <span className="block text-[11px] text-amber-300/90">
                    💡 Tips mudah: Di Google Chrome/Edge, klik ikon 🔒 di sebelah kiri URL, ubah "Location" menjadi "Allow", lalu klik "Allow Geographic location access" di bawah ini.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700/60 mt-4">
          <button
            type="button"
            onClick={handleDisallow}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800/90 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            Disallow
          </button>

          <button
            type="button"
            onClick={handleAllow}
            disabled={isLoading}
            className="px-4 sm:px-5 py-2.5 text-sm font-bold text-white bg-slate-700 hover:bg-slate-600 active:bg-slate-800 border border-slate-600/80 rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                <span>Memproses...</span>
              </>
            ) : (
              <span>Allow Geographic location access</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
