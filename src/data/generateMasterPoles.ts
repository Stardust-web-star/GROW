import { PoleData, CableSpan } from '../types';
import { generateNearestNeighborCableSpans, getClearanceStatus } from '../utils/kmzParser';

interface FeederSpec {
  name: string;
  count: number;
  startLat: number;
  startLng: number;
  latStep: number;
  lngStep: number;
  curviness?: number;
}

const FEEDER_SPECS: FeederSpec[] = [
  { name: 'FEEDER ALLANG', count: 371, startLat: -3.720, startLng: 128.020, latStep: -0.00035, lngStep: 0.00045 },
  { name: 'FEEDER BANDARA 1', count: 259, startLat: -3.615, startLng: 128.085, latStep: -0.00040, lngStep: 0.00035 },
  { name: 'FEEDER BANDARA 2', count: 354, startLat: -3.622, startLng: 128.092, latStep: -0.00038, lngStep: 0.00042 },
  { name: 'FEEDER GALALA 1', count: 15, startLat: -3.655, startLng: 128.202, latStep: 0.00030, lngStep: 0.00040 },
  { name: 'FEEDER GALALA 2', count: 15, startLat: -3.652, startLng: 128.208, latStep: 0.00028, lngStep: 0.00038 },
  { name: 'FEEDER HUTUMURI', count: 309, startLat: -3.685, startLng: 128.252, latStep: -0.00030, lngStep: 0.00055 },
  { name: 'FEEDER KARPAN 1', count: 16, startLat: -3.692, startLng: 128.188, latStep: -0.00025, lngStep: 0.00030 },
  { name: 'FEEDER LATERI 1', count: 385, startLat: -3.642, startLng: 128.212, latStep: 0.00025, lngStep: 0.00035 },
  { name: 'FEEDER LATERI 2', count: 203, startLat: -3.638, startLng: 128.218, latStep: 0.00028, lngStep: 0.00032 },
  { name: 'FEEDER LATERI 3', count: 228, startLat: -3.632, startLng: 128.222, latStep: 0.00022, lngStep: 0.00038 },
  { name: 'FEEDER MVTIC 1', count: 156, startLat: -3.625, startLng: 128.232, latStep: -0.00030, lngStep: 0.00030 },
  { name: 'FEEDER MVTIC 2', count: 152, startLat: -3.618, startLng: 128.238, latStep: -0.00028, lngStep: 0.00032 },
  { name: 'FEEDER PASSO', count: 103, startLat: -3.612, startLng: 128.228, latStep: 0.00035, lngStep: 0.00040 },
  { name: 'FEEDER RIJALI', count: 38, startLat: -3.698, startLng: 128.182, latStep: -0.00030, lngStep: 0.00025 },
  { name: 'FEEDER WAIHERU', count: 189, startLat: -3.622, startLng: 128.202, latStep: -0.00032, lngStep: 0.00038 },
  { name: 'FEEDER WAIHERU 1', count: 406, startLat: -3.602, startLng: 128.182, latStep: -0.00028, lngStep: 0.00045 },
  { name: 'FEEDER WAIHERU 2', count: 71, startLat: -3.608, startLng: 128.192, latStep: -0.00030, lngStep: 0.00035 },
  { name: 'FEEDER WAIHERU 3', count: 88, startLat: -3.612, startLng: 128.198, latStep: -0.00025, lngStep: 0.00040 },
  { name: 'FEEDER WAYAME 1', count: 333, startLat: -3.632, startLng: 128.142, latStep: -0.00032, lngStep: 0.00048 },
  { name: 'FEEDER WAYAME 2', count: 213, startLat: -3.638, startLng: 128.148, latStep: -0.00028, lngStep: 0.00042 }
];

export function generateFullMasterPolesAndSpans(): { poles: PoleData[]; spans: CableSpan[] } {
  const poles: PoleData[] = [];

  FEEDER_SPECS.forEach((spec) => {
    let currLat = spec.startLat;
    let currLng = spec.startLng;

    for (let i = 1; i <= spec.count; i++) {
      // Add road sine wave curvature
      const angle = (i * 0.15);
      const waveLat = Math.sin(angle) * 0.00018;
      const waveLng = Math.cos(angle) * 0.00022;

      currLat += spec.latStep + waveLat;
      currLng += spec.lngStep + waveLng;

      // Realistic clearance calculation (~35% chance of ROW violation < 3.0m)
      const isViolation = (i * 17 + spec.count) % 3 === 0;
      let clearance = 4.2;
      if (isViolation) {
        clearance = Number((1.1 + ((i * 13) % 18) * 0.1).toFixed(1)); // 1.1m - 2.8m
      } else {
        clearance = Number((3.2 + ((i * 7) % 25) * 0.1).toFixed(1)); // 3.2m - 5.6m
      }

      const poleType = i % 10 === 0 ? 'Gardu Trafo' : i % 3 === 0 ? 'TR' : 'TM';
      const clearanceStatus = getClearanceStatus(clearance, poleType);

      const feederCodeShort = spec.name.replace('FEEDER ', '').substring(0, 3);
      const poleId = `BGL-KMZ-20146-${feederCodeShort}-${String(i).padStart(3, '0')}`;

      poles.push({
        id: poleId,
        code: `${feederCodeShort}-${String(i).padStart(3, '0')}`,
        feeder: spec.name,
        type: poleType,
        lat: Number(currLat.toFixed(6)),
        lng: Number(currLng.toFixed(6)),
        locationName: `Jalur Utama ${spec.name}, ULP Baguala`,
        material: 'Beton',
        heightMeters: poleType === 'TR' ? 11 : 12,
        physicalCondition: clearance < 1.5 ? 'Korosi Kritis' : clearance < 3.0 ? 'Perlu Perbaikan' : 'Baik',
        installationYear: 2021,
        lastInspectionDate: '2026-10-01',
        clearanceDistanceMeters: clearance,
        clearanceStatus: clearanceStatus,
        clearanceObject: clearance < 3.0 ? 'Pohon Pohon/Bangunan' : 'Bebas',
        spkStatus: clearance < 3.0 ? 'SPK Diterbitkan' : 'Belum SPK',
        notes: `Tiang Master Data ${spec.name} titik ke-${i}.`,
        kmlSource: 'TITIK TIANG BGL.kml',
        inspectionHistory: []
      });
    }
  });

  // Generate Nearest Neighbor Cable Spans for all 2,953 poles across all 20 feeders
  const spans = generateNearestNeighborCableSpans(poles);

  return { poles, spans };
}
