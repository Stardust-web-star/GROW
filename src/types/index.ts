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
  updatedAt?: string;
  updatedBy?: string;
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
  updatedAt?: string;
  updatedBy?: string;
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

export interface FeederEnsData {
  feederName: string;
  voltageKv: number;               // Tegangan kerja (20 kV JTM)
  averageCurrentA: number;         // Arus beban rata-rata (Ampere)
  powerKw: number;                 // P = sqrt(3) * V * I * cosPhi (kW)
  estimatedOutageHours: number;    // Estimasi durasi padam (jam)
  rowViolationsCount: number;      // Jumlah titik pelanggaran ROW
  criticalPolesCount: number;       // Tiang kritis/miring
  riskLevel: 'Kritis' | 'Tinggi' | 'Sedang';
  potentialEnsKwh: number;         // ENS jika terjadi gangguan pohon (kWh)
  potentialLossRp: number;         // Potensi kerugian pendapatan (Rp)
  savedEnsKwh: number;             // ENS yang diselamatkan via rabas pohon (kWh)
  savedRevenueRp: number;          // Rupiah pendapatan yang diselamatkan (Rp)
}

export interface EnsAnalysisResult {
  totalPotentialEnsKwh: number;
  totalPotentialEnsMwh: number;
  totalPotentialLossRp: number;
  totalSavedEnsKwh: number;
  totalSavedRevenueRp: number;
  averageOutageDurationHours: number;
  tariffPerKwh: number;            // Tarif Tenaga Listrik rata-rata (Rp 1.444,70 / kWh)
  standardReference: string;       // SPLN No. 68-1B & Kepdir PLN No. 0687.K/DIR/2019
  feederBreakdown: FeederEnsData[];
  calculationFormula: {
    powerFormula: string;
    ensFormula: string;
    financialFormula: string;
    cosPhi: number;
    voltageKv: number;
  };
}

export interface AiAnalysisResult {
  gridHealthScore: number;
  summary: string;
  criticalPolesCount: number;
  rowViolationsCount: number;
  ensAnalysis?: EnsAnalysisResult;
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

