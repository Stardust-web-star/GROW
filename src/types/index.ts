export type PoleType = 'TM' | 'TR' | 'Gardu Trafo' | 'TT';

export type PhysicalCondition = 'Baik' | 'Perlu Perbaikan' | 'Miring / Retak' | 'Korosi Kritis';

export type ClearanceStatus = string;

export interface InspectionRecord {
  id: string;
  poleId: string;
  date: string;
  inspector: string;
  condition: PhysicalCondition;
  cableClearanceMeters: number;
  clearanceObject: string;
  actionTaken: string;
  notes: string;
  photoUrl?: string;
}

export interface PoleData {
  id: string;                  // Unique Pole ID, e.g. BGL-PSS-001
  code: string;                // PLN Code e.g. PSS-TM-012
  feeder: string;              // Penyulang e.g., Penyulang Passo, Penyulang Lateri
  type: PoleType;              // TM (20kV), TR (220/380V), Gardu Trafo
  lat: number;
  lng: number;
  locationName: string;        // e.g. Jl. Syaranualo, Passo, Ambon
  material: 'Beton' | 'Besi';
  heightMeters: number;        // e.g. 11, 12, 14
  physicalCondition: PhysicalCondition;
  installationYear: number;
  lastInspectionDate: string;
  clearanceDistanceMeters: number; // Jarak kabel ke pohon/bangunan
  clearanceStatus: ClearanceStatus;
  clearanceObject: 'Pohon Kelapa/Pala' | 'Bangunan Resident' | 'Atap Ruko' | 'Bebas' | string;
  inspectionHistory: InspectionRecord[];
  spkStatus: 'Belum SPK' | 'SPK Diterbitkan' | 'Selesai Dikerjakan';
  notes?: string;
  photoUrl?: string;           // Foto kondisi fisik tiang terkini
  photos?: string[];           // Galeri foto tiang
  kmlSource?: string;          // Name of uploaded KMZ file if loaded from file
}

export interface CableSpan {
  id: string;
  fromPoleId: string;
  toPoleId: string;
  conductorType: string;       // e.g., AACS 150 mm², TIC 3x70+1x50
  lengthMeters: number;
  clearanceMeters: number;
  hasViolation: boolean;
  violationType?: 'Pohon (<3m)' | 'Bangunan (<3m)' | 'Lendutan Berlebih' | string;
  feeder?: string;             // Penyulang
  cableCondition?: 'Baik' | 'Kendor / Andongan Rendah' | 'Terkelupas / Isolasi Rusak' | 'Sambungan Rentan' | 'Korosi Kritis' | string;
  treeDistanceMeters?: number; // Jarak terhadap pohon (meter)
  buildingDistanceMeters?: number; // Jarak terhadap bangunan (meter)
  notes?: string;
  photoUrl?: string;           // Foto kondisi kabel terkini
  photos?: string[];           // Galeri foto kabel
}

export interface MaintenanceWorkOrder {
  id: string;
  spkNumber: string;           // e.g., SPK/BGL/2026/042
  poleId: string;
  locationName: string;
  issueType: string;
  priority: 'Kritis' | 'Tinggi' | 'Sedang' | 'Rutin';
  assignedTeam: string;
  scheduledDate: string;
  status: 'Draf' | 'Disetujui' | 'Dalam Pengerjaan' | 'Selesai';
  aiRecommendation?: string;
  createdAt: string;
}

export interface KmzParseResult {
  fileName: string;
  poles: PoleData[];
  spans: CableSpan[];
  rawKmlText?: string;
}

export interface AiAnalysisResult {
  gridHealthScore: number;
  summary: string;
  criticalPolesCount: number;
  rowViolationsCount: number;
  riskAssessment: {
    highRiskPoles: { poleId: string; location: string; reason: string; riskLevel: 'Tinggi' | 'Kritis' }[];
    vegetationThreats: { poleId: string; distance: number; object: string; action: string }[];
  };
  preventiveActionPlan: {
    step: number;
    title: string;
    description: string;
    assignedUnit: string;
    targetDays: number;
  }[];
  generatedSpkDrafts: Partial<MaintenanceWorkOrder>[];
}

export interface UserAccount {
  id: string;
  userId: string;
  name: string;
  role: 'Administrator' | 'Supervisor Teknik' | 'Petugas Yantek' | 'Operator GIS';
  password?: string;
  unit?: string;
  email?: string;
  status: 'Aktif' | 'Nonaktif';
  createdAt: string;
  lastLogin?: string;
}

