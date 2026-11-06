import { useState, useEffect, useRef, useCallback } from 'react';

export interface UserLocation {
  lat: number;
  lng: number;
  accuracy: number; // in meters
  heading: number | null; // 0-360 degrees
  speed: number | null; // m/s
  timestamp: number;
}

interface UseLiveGeolocationReturn {
  isSupported: boolean;
  isTracking: boolean;
  userLocation: UserLocation | null;
  error: string | null;
  isSimulated: boolean;
  startTracking: () => void;
  stopTracking: () => void;
  toggleTracking: () => void;
  setSimulatedLocation: (lat: number, lng: number) => void;
  clearSimulatedLocation: () => void;
  refreshLocation: () => void;
}

export function useLiveGeolocation(): UseLiveGeolocationReturn {
  const [isSupported] = useState<boolean>(typeof navigator !== 'undefined' && 'geolocation' in navigator);
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSimulated, setIsSimulated] = useState<boolean>(false);

  const watchIdRef = useRef<number | null>(null);

  const handleSuccess = useCallback((pos: GeolocationPosition) => {
    setError(null);
    setUserLocation({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: Math.round(pos.coords.accuracy || 10),
      heading: pos.coords.heading ?? null,
      speed: pos.coords.speed ?? null,
      timestamp: pos.timestamp
    });
    setIsSimulated(false);
  }, []);

  const handleError = useCallback((err: GeolocationPositionError) => {
    let msg = 'Gagal mendeteksi lokasi GPS.';
    switch (err.code) {
      case err.PERMISSION_DENIED:
        msg = 'Izin akses GPS / Lokasi ditolak oleh browser. Harap izinkan akses lokasi di pengaturan browser.';
        break;
      case err.POSITION_UNAVAILABLE:
        msg = 'Sinyal GPS tidak tersedia atau perangkat tidak dapat mendeteksi satelit.';
        break;
      case err.TIMEOUT:
        msg = 'Pencarian sinyal GPS melebihi batas waktu (timeout). Mencoba kembali...';
        break;
    }
    setError(msg);
  }, []);

  const startTracking = useCallback(() => {
    if (!isSupported) {
      setError('Browser perangkat ini tidak mendukung fitur Geolocation GPS.');
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setIsTracking(true);
    setError(null);

    // Initial immediate lookup
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 2000
    });

    // Continuous watch
    const id = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 2000
    });

    watchIdRef.current = id;
  }, [isSupported, handleSuccess, handleError]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  const toggleTracking = useCallback(() => {
    if (isTracking) {
      stopTracking();
    } else {
      startTracking();
    }
  }, [isTracking, startTracking, stopTracking]);

  const refreshLocation = useCallback(() => {
    if (!isSupported) return;
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
  }, [isSupported, handleSuccess, handleError]);

  const setSimulatedLocation = useCallback((lat: number, lng: number) => {
    setUserLocation({
      lat,
      lng,
      accuracy: 5,
      heading: 45,
      speed: 0,
      timestamp: Date.now()
    });
    setIsSimulated(true);
    setIsTracking(true);
    setError(null);
  }, []);

  const clearSimulatedLocation = useCallback(() => {
    setIsSimulated(false);
    setUserLocation(null);
    stopTracking();
  }, [stopTracking]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined') {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    isSupported,
    isTracking,
    userLocation,
    error,
    isSimulated,
    startTracking,
    stopTracking,
    toggleTracking,
    setSimulatedLocation,
    clearSimulatedLocation,
    refreshLocation
  };
}
