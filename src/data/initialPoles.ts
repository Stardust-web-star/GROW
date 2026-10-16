import { PoleData, CableSpan, MaintenanceWorkOrder } from '../types';
import masterData from './masterPoles.json';

// Master Data TITIK TIANG BGL.kml (2,980 Titik Tiang, 2,855 Bentangan Kabel)
export const INITIAL_POLES: PoleData[] = (masterData.poles as unknown as PoleData[]) || [];
export const INITIAL_SPANS: CableSpan[] = (masterData.spans as unknown as CableSpan[]) || [];

export const INITIAL_SPKS: MaintenanceWorkOrder[] = [
  {
    id: 'SPK-001',
    spkNumber: 'SPK/ULP-BGL/2026/091',
    poleId: 'BGL-KMZ-20146-001',
    locationName: 'Jl. Passo - Lateri (FEEDER PASSO)',
    issueType: 'Rabas Pohon (Pelanggaran ROW < 3m)',
    priority: 'Tinggi',
    assignedTeam: 'Tim Yantek Regu A Passo',
    scheduledDate: '2026-10-08',
    status: 'Disetujui',
    aiRecommendation: 'Lakukan pemangkasan dahan pohon kelapa & mangga radius 3.5 meter dari kawat fasa 20kV.',
    createdAt: '2026-09-11'
  },
  {
    id: 'SPK-002',
    spkNumber: 'SPK/ULP-BGL/2026/094',
    poleId: 'BGL-KMZ-20146-005',
    locationName: 'Jl. Passo (FEEDER LATERI 3)',
    issueType: 'Peninggian Traversa & Penataan Kabel',
    priority: 'Kritis',
    assignedTeam: 'Tim Konstruksi Pemeliharaan Baguala',
    scheduledDate: '2026-10-06',
    status: 'Dalam Pengerjaan',
    aiRecommendation: 'Instalasi selubung isolasi (line cover) pada kabel TR dan koordinasi pemindahan atap ruko.',
    createdAt: '2026-09-23'
  }
];
