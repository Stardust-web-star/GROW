import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (showReconnected) {
    return (
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-600/95 backdrop-blur-md text-white text-xs px-3.5 py-1.5 rounded-full shadow-lg border border-emerald-400/40 animate-fade-in pointer-events-none">
        <Wifi className="w-3.5 h-3.5 animate-pulse" />
        <span className="font-semibold">Koneksi Terhubung Kembali (Online)</span>
      </div>
    );
  }

  if (isOnline) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-amber-600/95 backdrop-blur-md text-white text-xs px-3.5 py-1.5 rounded-full shadow-lg border border-amber-400/40 animate-bounce pointer-events-none">
      <WifiOff className="w-3.5 h-3.5" />
      <span className="font-semibold">Mode Offline — Data tersimpan di memori perangkat</span>
    </div>
  );
};
