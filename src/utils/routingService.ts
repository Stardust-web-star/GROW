import { calculateHaversineDistanceMeters } from './kmzParser';

export type RouteMode = 'motorcycle' | 'driving' | 'walking';

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  name?: string;
  maneuverType?: string;
  modifier?: string;
}

export interface RouteResult {
  coordinates: [number, number][]; // [lat, lng] array for Leaflet
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  summary: string;
  steps: RouteStep[];
  mode: RouteMode;
  isFallback: boolean;
  destinationName?: string;
}

/**
 * Format meters to human-readable string (e.g., "450 m" or "3.2 km")
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format duration in seconds to human-readable string (e.g., "8 mnt" or "1 jam 12 mnt")
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
 * Translate OSRM maneuvers into friendly Indonesian instructions
 */
function translateManeuver(type?: string, modifier?: string, name?: string): string {
  const roadName = name && name.trim() !== '' ? ` ke ${name}` : '';

  switch (type) {
    case 'depart':
      return `Mulai perjalanan${roadName}`;
    case 'arrive':
      return 'Tiba di lokasi tujuan Tiang/Kabel PLN';
    case 'turn':
    case 'end of road':
      if (modifier === 'sharp right') return `Belok tajam ke kanan${roadName}`;
      if (modifier === 'right') return `Belok kanan${roadName}`;
      if (modifier === 'slight right') return `Serong kanan${roadName}`;
      if (modifier === 'sharp left') return `Belok tajam ke kiri${roadName}`;
      if (modifier === 'left') return `Belok kiri${roadName}`;
      if (modifier === 'slight left') return `Serong kiri${roadName}`;
      if (modifier === 'uturn') return `Putar balik${roadName}`;
      return `Belok${roadName}`;
    case 'fork':
      return modifier?.includes('left') ? `Ambil jalur kiri${roadName}` : `Ambil jalur kanan${roadName}`;
    case 'roundabout':
    case 'rotary':
      return `Masuk bundaran dan ambil jalur keluar${roadName}`;
    case 'continue':
    case 'new name':
      return `Lanjutkan lurus${roadName}`;
    default:
      if (modifier?.includes('right')) return `Arahkan ke kanan${roadName}`;
      if (modifier?.includes('left')) return `Arahkan ke kiri${roadName}`;
      return `Ikuti jalan${roadName}`;
  }
}

/**
 * Calculate cardinal bearing between two coordinates
 */
export function calculateBearingDirection(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
  let brng = Math.atan2(y, x) * 180 / Math.PI;
  brng = (brng + 360) % 360;

  if (brng >= 337.5 || brng < 22.5) return 'Utara';
  if (brng >= 22.5 && brng < 67.5) return 'Timur Laut';
  if (brng >= 67.5 && brng < 112.5) return 'Timur';
  if (brng >= 112.5 && brng < 157.5) return 'Tenggara';
  if (brng >= 157.5 && brng < 202.5) return 'Selatan';
  if (brng >= 202.5 && brng < 247.5) return 'Barat Daya';
  if (brng >= 247.5 && brng < 292.5) return 'Barat';
  return 'Barat Laut';
}

/**
 * Fetch road route from OSRM public service or create straight-line fallback
 */
export async function fetchRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  mode: RouteMode = 'motorcycle',
  destinationName: string = 'Lokasi Tiang PLN'
): Promise<RouteResult> {
  // Determine profile: OSRM supports driving, walking, bicycle
  const osrmProfile = mode === 'walking' ? 'walking' : 'driving';
  const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Routing HTTP error: ${response.status}`);
    }

    const data = await response.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const primaryRoute = data.routes[0];
      const rawCoordinates = primaryRoute.geometry.coordinates as [number, number][]; // [lng, lat]
      const leafletCoords: [number, number][] = rawCoordinates.map(([lng, lat]) => [lat, lng]);

      let totalDuration = primaryRoute.duration as number;
      // If mode is motorcycle in Ambon city traffic, it's typically ~25% faster than car
      if (mode === 'motorcycle') {
        totalDuration = Math.round(totalDuration * 0.78);
      }

      const steps: RouteStep[] = [];
      if (primaryRoute.legs && primaryRoute.legs.length > 0) {
        const rawSteps = primaryRoute.legs[0].steps || [];
        rawSteps.forEach((s: any) => {
          const instruction = translateManeuver(
            s.maneuver?.type,
            s.maneuver?.modifier,
            s.name
          );
          steps.push({
            instruction,
            distanceMeters: s.distance || 0,
            durationSeconds: s.duration || 0,
            name: s.name || '',
            maneuverType: s.maneuver?.type,
            modifier: s.maneuver?.modifier
          });
        });
      }

      return {
        coordinates: leafletCoords,
        totalDistanceMeters: primaryRoute.distance,
        totalDurationSeconds: totalDuration,
        summary: primaryRoute.legs?.[0]?.summary || 'Rute Jalan Raya Ambon - Baguala',
        steps,
        mode,
        isFallback: false,
        destinationName
      };
    }
    throw new Error('OSRM did not return valid routes');
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('OSRM routing request failed or timed out, generating accurate straight-line fallback:', err);

    // Fallback: Great Circle route with estimated speed
    const distanceMeters = calculateHaversineDistanceMeters(startLat, startLng, endLat, endLng);
    
    // Average speeds: Motorcycle 35 km/h, Car 28 km/h, Walking 4.5 km/h
    const speedKmh = mode === 'motorcycle' ? 35 : mode === 'driving' ? 28 : 4.5;
    const durationSeconds = Math.round((distanceMeters / (speedKmh * 1000 / 3600)));
    const bearing = calculateBearingDirection(startLat, startLng, endLat, endLng);

    return {
      coordinates: [
        [startLat, startLng],
        [endLat, endLng]
      ],
      totalDistanceMeters: distanceMeters,
      totalDurationSeconds: durationSeconds,
      summary: `Jalur Langsung ke Arah ${bearing}`,
      steps: [
        {
          instruction: `Mulai bergerak ke arah ${bearing} menuju target`,
          distanceMeters: Math.round(distanceMeters * 0.9),
          durationSeconds: Math.round(durationSeconds * 0.9)
        },
        {
          instruction: `Tiba di ${destinationName}`,
          distanceMeters: Math.round(distanceMeters * 0.1),
          durationSeconds: Math.round(durationSeconds * 0.1)
        }
      ],
      mode,
      isFallback: true,
      destinationName
    };
  }
}

/**
 * Generate native Google Maps deep link for external turn-by-turn navigation on mobile
 */
export function getGoogleMapsNavigationUrl(
  destLat: number,
  destLng: number,
  startLat?: number,
  startLng?: number,
  mode: RouteMode = 'driving'
): string {
  const travelMode = mode === 'walking' ? 'walking' : 'driving';
  if (startLat !== undefined && startLng !== undefined) {
    return `https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLng}&destination=${destLat},${destLng}&travelmode=${travelMode}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=${travelMode}`;
}
