import { calculateHaversineDistanceMeters } from './kmzParser';

export interface GpsLocation {
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
  isFallback?: boolean;
  label?: string;
}

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuverType: string;
  modifier?: string;
  name?: string;
}

export interface NavigationDestination {
  lat: number;
  lng: number;
  name: string;
  subtitle?: string;
  targetType: 'pole' | 'cable' | 'custom';
  code?: string;
  poleId?: string;
  spanId?: string;
}

export interface RouteResult {
  coordinates: [number, number][]; // [lat, lng] Leaflet format
  distanceMeters: number;
  durationSeconds: number;
  mode: 'driving' | 'walking';
  steps: RouteStep[];
  destination: NavigationDestination;
}

/**
 * Format meters to clean readable text (e.g. "450 m" or "1.8 km")
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format seconds to clean readable time (e.g. "4 mnt" or "1 jam 12 mnt")
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) {
    return '< 1 mnt';
  }
  if (minutes < 60) {
    return `${minutes} mnt`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours} jam ${remainingMinutes} mnt` : `${hours} jam`;
}

/**
 * Translate OSRM step to Indonesian navigation instruction
 */
function translateOsrmManeuver(step: any): string {
  const type = step.maneuver?.type || 'turn';
  const modifier = step.maneuver?.modifier || '';
  const roadName = step.name && step.name !== '' ? `ke ${step.name}` : '';

  if (type === 'depart') {
    return roadName ? `Mulai perjalanan ${roadName}` : 'Mulai perjalanan ke titik tujuan';
  }
  if (type === 'arrive') {
    return 'Tiba di titik lokasi tiang / kabel PLN';
  }
  if (type === 'roundabout' || type === 'rotary') {
    return `Masuk bundaran lalu keluar ${roadName}`;
  }
  if (type === 'fork') {
    if (modifier.includes('right')) return `Ambil jalur kanan ${roadName}`;
    if (modifier.includes('left')) return `Ambil jalur kiri ${roadName}`;
    return `Ikuti percabangan jalan ${roadName}`;
  }

  // Turn modifiers
  if (modifier === 'sharp right') return `Belok tajam ke kanan ${roadName}`;
  if (modifier === 'right') return `Belok kanan ${roadName}`;
  if (modifier === 'slight right') return `Serong kanan ${roadName}`;
  if (modifier === 'sharp left') return `Belok tajam ke kiri ${roadName}`;
  if (modifier === 'left') return `Belok kiri ${roadName}`;
  if (modifier === 'slight left') return `Serong kiri ${roadName}`;
  if (modifier === 'straight') return `Lurus terus ${roadName}`;
  if (modifier === 'uturn') return `Putar balik ${roadName}`;

  if (type === 'new name') {
    return `Lanjutkan perjalanan ${roadName}`;
  }

  return roadName ? `Lanjutkan ${roadName}` : 'Terus ikuti jalan';
}

/**
 * Calculate routing from origin to destination using OSRM
 * with fallback to straight-line navigation if offline
 */
export async function fetchRouteDirections(
  origin: [number, number],
  dest: NavigationDestination,
  mode: 'driving' | 'walking' = 'driving'
): Promise<RouteResult> {
  const profile = mode === 'walking' ? 'foot' : 'driving';
  // OSRM expects: longitude,latitude;longitude,latitude
  const osrmUrl = `https://router.project-osrm.org/route/v1/${profile}/${origin[1]},${origin[0]};${dest.lng},${dest.lat}?overview=full&geometries=geojson&steps=true`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(osrmUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
        const coordinates: [number, number][] = route.geometry.coordinates.map(
          (c: [number, number]) => [c[1], c[0]] as [number, number]
        );

        const steps: RouteStep[] = [];
        if (route.legs && route.legs.length > 0 && route.legs[0].steps) {
          route.legs[0].steps.forEach((s: any) => {
            steps.push({
              instruction: translateOsrmManeuver(s),
              distanceMeters: s.distance || 0,
              durationSeconds: s.duration || 0,
              maneuverType: s.maneuver?.type || 'turn',
              modifier: s.maneuver?.modifier,
              name: s.name || ''
            });
          });
        }

        return {
          coordinates,
          distanceMeters: route.distance || 0,
          durationSeconds: route.duration || 0,
          mode,
          steps: steps.length > 0 ? steps : [
            {
              instruction: `Menuju lokasi ${dest.name}`,
              distanceMeters: route.distance,
              durationSeconds: route.duration,
              maneuverType: 'depart'
            }
          ],
          destination: dest
        };
      }
    }
  } catch (err) {
    console.warn('[NavService] OSRM routing unavailable, fallback to direct path:', err);
  }

  // Fallback: Direct Great-Circle navigation path
  const directDistance = calculateHaversineDistanceMeters(origin[0], origin[1], dest.lat, dest.lng);
  const avgSpeedMps = mode === 'walking' ? 1.3 : 8.5; // ~30 km/h driving, ~4.7 km/h walking
  const estimatedSeconds = Math.round(directDistance / avgSpeedMps);

  // Intermediate points for smooth straight line
  const coordinates: [number, number][] = [
    origin,
    [
      origin[0] + (dest.lat - origin[0]) * 0.5,
      origin[1] + (dest.lng - origin[1]) * 0.5
    ],
    [dest.lat, dest.lng]
  ];

  return {
    coordinates,
    distanceMeters: directDistance,
    durationSeconds: estimatedSeconds,
    mode,
    steps: [
      {
        instruction: `Arahkan perjalanan menuju ${dest.name}`,
        distanceMeters: directDistance,
        durationSeconds: estimatedSeconds,
        maneuverType: 'depart'
      },
      {
        instruction: `Tiba di titik tiang/kabel PLN (${dest.name})`,
        distanceMeters: 0,
        durationSeconds: 0,
        maneuverType: 'arrive'
      }
    ],
    destination: dest
  };
}

/**
 * Generate Google Maps App / Web URL for turn-by-turn voice navigation
 */
export function getGoogleMapsUrl(
  origin: [number, number] | null,
  destination: [number, number],
  mode: 'driving' | 'walking' = 'driving'
): string {
  const travelMode = mode === 'walking' ? 'walking' : 'driving';
  if (origin) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin[0]},${origin[1]}&destination=${destination[0]},${destination[1]}&travelmode=${travelMode}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${destination[0]},${destination[1]}&travelmode=${travelMode}`;
}
