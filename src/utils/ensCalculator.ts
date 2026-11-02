import { PoleData, EnsAnalysisResult, FeederEnsData } from '../types';

/**
 * PLN Official ENS (Energy Not Served / Energi Tidak Tersalurkan) Calculator
 *
 * Acuan Standar Resmi:
 * 1. SPLN No. 68-1B : 1986 (Tingkat Keandalan Sistem Distribusi Tenaga Listrik)
 * 2. Keputusan Direksi PT PLN (Persero) No. 0687.K/DIR/2019 (Pedoman Penilaian Kinerja Operasi Distribusi)
 * 3. Peraturan Menteri ESDM No. 18 Tahun 2019 / No. 27 Tahun 2017 (Tarif Tenaga Listrik / TTL Rp 1.444,70 / kWh)
 * 4. Pedoman Pengoperasian & Pemeliharaan JTM 20 kV PLN UID Maluku & Maluku Utara (UP3 Ambon / ULP Baguala)
 */

export const PLN_STANDARD_CONSTANTS = {
  VOLTAGE_KV: 20,                // Tegangan Menengah JTM 20 kV
  POWER_FACTOR_COS_PHI: 0.85,    // Faktor daya tipikal jaringan distribusi PLN (cos phi)
  DEFAULT_OUTAGE_HOURS: 2.0,     // Durasi pemadaman rata-rata penanganan gangguan pohon/ROW (jam)
  TARIFF_PER_KWH: 1444.70,       // Tarif Tenaga Listrik rata-rata Permen ESDM (Rp / kWh)
  STANDARD_DOC: 'SPLN No. 68-1B : 1986 & Kepdir PT PLN (Persero) No. 0687.K/DIR/2019'
};

// Arus beban nominal tipikal feeder 20 kV di ULP Baguala (Ampere)
const DEFAULT_FEEDER_CURRENTS: Record<string, number> = {
  'FEEDER PASSO': 125,
  'Penyulang Passo': 125,
  'FEEDER LATERI 1': 110,
  'FEEDER LATERI 2': 105,
  'FEEDER LATERI 3': 95,
  'Penyulang Lateri': 110,
  'FEEDER WAIHERU': 130,
  'FEEDER WAIHERU 1': 120,
  'FEEDER WAIHERU 2': 115,
  'FEEDER WAIHERU 3': 100,
  'Penyulang Waiheru': 120,
  'FEEDER WAYAME 1': 115,
  'FEEDER WAYAME 2': 105,
  'Penyulang Wayame': 110,
  'FEEDER MVTIC 1': 90,
  'FEEDER MVTIC 2': 85,
  'FEEDER RIJALI': 110,
  'Penyulang Tulehu': 115,
  'Penyulang Suli': 95,
  'Penyulang Liang': 85,
  'Penyulang Kota': 135
};

/**
 * Menghitung Daya Aktif Padam P (kW) sesuai rumus SPLN:
 * P = sqrt(3) * V_LL (kV) * I (A) * cos(phi)
 */
export function calculateActivePowerKw(
  currentAmpere: number,
  voltageKv: number = PLN_STANDARD_CONSTANTS.VOLTAGE_KV,
  cosPhi: number = PLN_STANDARD_CONSTANTS.POWER_FACTOR_COS_PHI
): number {
  return Math.sqrt(3) * voltageKv * currentAmpere * cosPhi;
}

/**
 * Menghitung Energi Tidak Tersalurkan (ENS) dalam kWh sesuai SPLN / Kepdir PLN:
 * ENS = P (kW) * t (jam)
 */
export function calculateEnsKwh(powerKw: number, outageHours: number): number {
  return powerKw * outageHours;
}

/**
 * Menghitung Kerugian Finansial PLN (Lost Sales Revenue) dalam Rupiah:
 * Kerugian = ENS (kWh) * Tarif per kWh
 */
export function calculateFinancialLossRp(
  ensKwh: number,
  tariffPerKwh: number = PLN_STANDARD_CONSTANTS.TARIFF_PER_KWH
): number {
  return ensKwh * tariffPerKwh;
}

/**
 * Analisis Lengkap ENS untuk seluruh jaringan tiang PLN ULP Baguala
 */
export function calculatePlnEnsAnalysis(
  poles: PoleData[],
  customOutageHours: number = PLN_STANDARD_CONSTANTS.DEFAULT_OUTAGE_HOURS,
  customTariff: number = PLN_STANDARD_CONSTANTS.TARIFF_PER_KWH
): EnsAnalysisResult {
  // Kelompokkan tiang per penyulang
  const feederGroups: Record<string, PoleData[]> = {};

  poles.forEach(pole => {
    const feeder = (pole.feeder || 'Penyulang Baguala').trim();
    if (!feederGroups[feeder]) {
      feederGroups[feeder] = [];
    }
    feederGroups[feeder].push(pole);
  });

  const feederBreakdown: FeederEnsData[] = [];
  let totalPotentialEnsKwh = 0;
  let totalPotentialLossRp = 0;
  let totalSavedEnsKwh = 0;
  let totalSavedRevenueRp = 0;

  const feederNames = Object.keys(feederGroups);

  feederNames.forEach(feederName => {
    const feederPoles = feederGroups[feederName];
    const rowViolations = feederPoles.filter(p => p.clearanceDistanceMeters < (p.type === 'TR' ? 1.0 : 3.0)).length;
    const criticalPoles = feederPoles.filter(p => p.physicalCondition === 'Korosi Kritis' || p.physicalCondition === 'Miring / Retak').length;

    // Tentukan beban arus (A) penyulang
    const baseCurrent = DEFAULT_FEEDER_CURRENTS[feederName] || 110;
    const powerKw = calculateActivePowerKw(baseCurrent, PLN_STANDARD_CONSTANTS.VOLTAGE_KV, PLN_STANDARD_CONSTANTS.POWER_FACTOR_COS_PHI);

    // Hitung faktor risiko berdasarkan persentase pelanggaran ROW dan tiang kritis
    const violationRatio = rowViolations / Math.max(feederPoles.length, 1);
    const riskFactor = Math.min(2.5, Math.max(0.5, (rowViolations * 0.08) + (criticalPoles * 0.15)));

    // Estimasi potensi durasi gangguan (jam)
    const outageHours = customOutageHours;

    // ENS potensial jika terjadi trip akibat pohon tumbang/tersentuh kawat
    const potentialEnsKwh = Math.round(calculateEnsKwh(powerKw, outageHours) * riskFactor);
    const potentialLossRp = Math.round(calculateFinancialLossRp(potentialEnsKwh, customTariff));

    // ENS yang diselamatkan jika program rabas pohon (GROW AI) dieksekusi
    // Estimasi efektivitas pemangkasan ROW mencegah 85% trip vegetasi
    const savedEnsKwh = Math.round(potentialEnsKwh * 0.85);
    const savedRevenueRp = Math.round(savedEnsKwh * customTariff);

    let riskLevel: 'Kritis' | 'Tinggi' | 'Sedang' = 'Sedang';
    if (rowViolations >= 50 || criticalPoles >= 5 || violationRatio > 0.4) {
      riskLevel = 'Kritis';
    } else if (rowViolations >= 15 || criticalPoles >= 2 || violationRatio > 0.2) {
      riskLevel = 'Tinggi';
    }

    feederBreakdown.push({
      feederName,
      voltageKv: PLN_STANDARD_CONSTANTS.VOLTAGE_KV,
      averageCurrentA: baseCurrent,
      powerKw: Math.round(powerKw),
      estimatedOutageHours: outageHours,
      rowViolationsCount: rowViolations,
      criticalPolesCount: criticalPoles,
      riskLevel,
      potentialEnsKwh,
      potentialLossRp,
      savedEnsKwh,
      savedRevenueRp
    });

    totalPotentialEnsKwh += potentialEnsKwh;
    totalPotentialLossRp += potentialLossRp;
    totalSavedEnsKwh += savedEnsKwh;
    totalSavedRevenueRp += savedRevenueRp;
  });

  // Urutkan penyulang dari potensi risiko ENS terbesar
  feederBreakdown.sort((a, b) => b.potentialEnsKwh - a.potentialEnsKwh);

  return {
    totalPotentialEnsKwh: Math.round(totalPotentialEnsKwh),
    totalPotentialEnsMwh: parseFloat((totalPotentialEnsKwh / 1000).toFixed(2)),
    totalPotentialLossRp: Math.round(totalPotentialLossRp),
    totalSavedEnsKwh: Math.round(totalSavedEnsKwh),
    totalSavedRevenueRp: Math.round(totalSavedRevenueRp),
    averageOutageDurationHours: customOutageHours,
    tariffPerKwh: customTariff,
    standardReference: PLN_STANDARD_CONSTANTS.STANDARD_DOC,
    feederBreakdown,
    calculationFormula: {
      powerFormula: 'P (kW) = √3 × V_LL (20 kV) × I_beban (A) × cos φ (0.85)',
      ensFormula: 'ENS (kWh) = P (kW) × t_padam (jam)',
      financialFormula: 'Kerugian (Rp) = ENS (kWh) × Tarif Tenaga Listrik (Rp 1.444,70 / kWh)',
      cosPhi: PLN_STANDARD_CONSTANTS.POWER_FACTOR_COS_PHI,
      voltageKv: PLN_STANDARD_CONSTANTS.VOLTAGE_KV
    }
  };
}
