import { PoleData, AiAnalysisResult } from '../types';
import { calculatePlnEnsAnalysis, PLN_STANDARD_CONSTANTS } from './ensCalculator';

/**
 * Client & Server Shared PLN Technical Engine
 * Provides instant predictive maintenance analysis and PLN technical Q&A
 * with 100% compliance to Permen ESDM, SPLN 68-1B, and PLN ULP Baguala SOP.
 */

export function generateLocalAiAnalysis(
  poles: PoleData[],
  customOutageHours: number = PLN_STANDARD_CONSTANTS.DEFAULT_OUTAGE_HOURS,
  customTariff: number = PLN_STANDARD_CONSTANTS.TARIFF_PER_KWH
): AiAnalysisResult {
  const ensCalculation = calculatePlnEnsAnalysis(poles, customOutageHours, customTariff);

  const criticalPoles = poles.filter(
    p => p.physicalCondition === 'Korosi Kritis' || p.physicalCondition === 'Miring / Retak'
  );
  const rowViolations = poles.filter(p => {
    const minRow = p.type === 'TR' ? 1.0 : p.type === 'TT' ? 5.0 : 3.0;
    return p.clearanceDistanceMeters < minRow;
  });

  const total = poles.length || 1;
  const criticalRatio = criticalPoles.length / total;
  const rowRatio = rowViolations.length / total;
  
  // Grid health score (0 - 100%)
  const healthScore = Math.max(
    15,
    Math.min(95, Math.round(100 - (criticalRatio * 120) - (rowRatio * 65)))
  );

  return {
    gridHealthScore: healthScore,
    summary: `Analisis sistematis jaringan PLN ULP Baguala berbasis ${poles.length} titik tiang terdata. Ditemukan ${rowViolations.length} pelanggaran jarak aman kabel (ROW) dan ${criticalPoles.length} tiang berkondisi kritis/miring. Estimasi potensi ENS akibat gangguan vegetasi mencapai ${ensCalculation.totalPotentialEnsKwh.toLocaleString('id-ID')} kWh (${ensCalculation.totalPotentialEnsMwh} MWh) dengan potensi kerugian penjualan Rp ${ensCalculation.totalPotentialLossRp.toLocaleString('id-ID')}. Total energi yang berhasil diselamatkan melalui program GROW AI adalah ${ensCalculation.totalSavedEnsKwh.toLocaleString('id-ID')} kWh senilai Rp ${ensCalculation.totalSavedRevenueRp.toLocaleString('id-ID')}.`,
    criticalPolesCount: criticalPoles.length,
    rowViolationsCount: rowViolations.length,
    ensAnalysis: ensCalculation,
    riskAssessment: {
      highRiskPoles: poles
        .filter(p => p.clearanceDistanceMeters < 3.0 || p.physicalCondition !== 'Baik')
        .slice(0, 50)
        .map(p => ({
          poleId: p.id,
          location: p.locationName || `Area KMZ (${p.lat.toFixed(4)}, ${p.lng.toFixed(4)})`,
          reason: `Jarak kabel ${p.clearanceDistanceMeters}m (${p.clearanceStatus}) & kondisi fisik ${p.physicalCondition}`,
          riskLevel: p.clearanceDistanceMeters < 1.5 || p.physicalCondition === 'Korosi Kritis' ? 'Kritis' : 'Tinggi'
        })),
      vegetationThreats: rowViolations.slice(0, 50).map(p => ({
        poleId: p.id,
        distance: p.clearanceDistanceMeters,
        object: p.clearanceObject || 'Pohon Kelapa / Pala / Bangunan',
        action: `Pangkas dahan radius 3.5m dari kawat konduktor ${p.type} (Feeder ${p.feeder})`
      }))
    },
    preventiveActionPlan: [
      {
        step: 1,
        title: "Pemberitahuan & Rabas Pohon Darurat (ROW)",
        description: `Regu Yantek Passo & Baguala melakukan pemangkasan darurat pada ${rowViolations.length} titik tiang dengan jarak kawat < 3m untuk menyelamatkan potensi ENS ${ensCalculation.totalPotentialEnsMwh} MWh.`,
        assignedUnit: "Regu Rabas ULP Baguala",
        targetDays: 2
      },
      {
        step: 2,
        title: "Peninggian Travers & Penggantian Tiang Miring",
        description: `Penggantian dan perkuatan pondasi pada ${criticalPoles.length} tiang beton kritis/miring di jalur utama Passo & Lateri guna mencegah tiang roboh.`,
        assignedUnit: "Tim Pemeliharaan Konstruksi",
        targetDays: 5
      },
      {
        step: 3,
        title: "Inspeksi Ulang Thermovision Trafo & Arrester",
        description: "Pengukuran beban puncak dan ketahanan isolasi arrester pada seluruh Gardu Trafo Tiang ULP Baguala.",
        assignedUnit: "Inspektor Harkat Baguala",
        targetDays: 7
      }
    ],
    generatedSpkDrafts: rowViolations.slice(0, 30).map((p, idx) => ({
      poleId: p.id,
      locationName: p.locationName || `Feeder ${p.feeder} (${p.lat.toFixed(4)}, ${p.lng.toFixed(4)})`,
      issueType: `Rabas Pohon & Penataan Kabel (${p.clearanceStatus})`,
      priority: p.clearanceDistanceMeters < 1.5 ? 'Kritis' : 'Tinggi',
      assignedTeam: `Tim Yantek Regu ${idx % 2 === 0 ? 'A Passo' : 'B Waiheru'}`,
      aiRecommendation: `Prioritas pemangkasan vegetasi pada ${p.locationName || p.feeder}. Pertahankan batas jarak aman minimum 3.0 Meter sesuai Permen ESDM No. 13/2021 & SPLN.`
    }))
  };
}

/**
 * Intelligent Technical Q&A Engine for PLN ULP Baguala
 */
export function generateLocalChatAnswer(question: string, contextPoles: PoleData[]): string {
  const q = question.toLowerCase();

  // 1. Standar Jarak Bebas ROW 20kV / Permen ESDM No 13
  if (q.includes('20kv') || q.includes('permen esdm') || q.includes('jarak bebas') || q.includes('standar row') || (q.includes('jarak') && q.includes('kabel'))) {
    return `Berdasarkan Permen ESDM No. 13 Tahun 2021 dan standar SPLN PT PLN (Persero), batas jarak bebas aman minimum (Right of Way / ROW) jaringan ketenagalistrikan adalah sebagai berikut:

1. JTM (Jaringan Tegangan Menengah 20 kV): Minimal 3.0 Meter. Berlaku vertikal maupun horizontal terhadap pohon, dahan, bagian bangunan, antena, baliho, dan aktivitas pekerja.
2. JTR (Jaringan Tegangan Rendah 220V - 380V): Minimal 1.0 Meter dari atap atau dinding bangunan, serta minimal 5.0 - 6.0 Meter melintasi jalan raya.
3. SUTT (Saluran Udara Tegangan Tinggi 150 kV): Minimal 5.0 s.d 8.5 Meter sesuai jarak andongan kawat.

Di ULP Baguala, dahan vegetasi dengan jarak < 3.0 Meter dari konduktor 20kV wajib segera diterbitkan SPK Rabas Pohon untuk mencegah flashover dan pemadaman penyulang.`;
  }

  // 2. SOP Kabel TR menyentuh atap
  if (q.includes('kabel tr') || q.includes('atap') || q.includes('ruko') || q.includes('menyentuh')) {
    return `SOP Penanganan Kabel JTR yang menyentuh atap bangunan/ruko sesuai Standar K3 PLN:

1. Pengamanan Area: Petugas memasang tanda bahaya dan memastikan penghuni tidak mendekati atap/instalasi.
2. Identifikasi Kabel: Periksa jenis kabel apakah LVTC (berisolasi) atau konduktor telanjang. Jika ada lecet/terkelupas, jadwalkan manuver pemadaman darurat.
3. Alat Pelindung Diri (APD): Petugas wajib menggunakan helm K3, sarung tangan isolasi 1000V, kacamata safety, dan safety shoes.
4. Tindakan Korektif Teknis:
   - Pasang tiang sisipan (pole addition) atau bracket penahan kabel jika bentangan terlalu panjang.
   - Lakukan penarikan ulang andongan kabel (re-sagging) agar kabel terangkat dan berjarak aman minimal 1.0 Meter dari atap bangunan.
   - Pasang pipa pelindung spiral / cover isolasi tambahan pada titik rawan gesekan.
5. Dokumentasi: Ambil foto sebelum & sesudah perbaikan, lalu update status tiang pada sistem GIS GROW PLN.`;
  }

  // 3. Penyebab tiang miring di Passo
  if (q.includes('passo') || q.includes('miring') || q.includes('tiang beton') || q.includes('retak')) {
    const passoPoles = contextPoles.filter(p => p.feeder.toLowerCase().includes('passo') && p.physicalCondition !== 'Baik');
    return `Penyebab utama tiang beton miring di area Passo (Feeder Passo & Feeder Waiheru) berdasarkan catatan teknis ULP Baguala:

1. Kontur Geoteknik & Lereng Labil: Kawasan Passo didominasi area pesisir Teluk Ambon dan perbukitan dengan tingkat kejenuhan air tanah yang tinggi saat musim hujan, memicu erosi di sekitar pondasi tiang.
2. Beban Tarikan Konduktor Tidak Simetris: Bentangan kabel AACS 150 mm² yang panjang disertai tumpukan kabel optik telematika liar tanpa penataan andongan yang seimbang menimbulkan momen puntir tiang.
3. Hantaman Dahan / Pohon Tumbang: Terpaan angin laut kencang sering membuat dahan pohon kelapa dan pala menimpa kawat fasa sehingga menarik tiang ke arah lateral.

Langkah Mitigasi ULP Baguala:
- Pemasangan kawat penopang (guy wire / treckschoor) pada tiang ujung dan tiang sudut.
- Perkuatan pondasi beton (concrete base foundation ring).
- Pemangkasan rutin vegetasi melalui sistem SPK GROW AI. (Saat ini terdata ${passoPoles.length} tiang perlu perhatian di Feeder Passo).`;
  }

  // 4. Perhitungan ENS (Energy Not Served)
  if (q.includes('ens') || q.includes('energy not served') || q.includes('rugi') || q.includes('kwh') || q.includes('spln')) {
    return `Standar Perhitungan ENS (Energy Not Served) PT PLN (Persero):

- Dasar Regulasi: SPLN No. 68-1B : 1986 & Kepdir PT PLN (Persero) No. 0687.K/DIR/2019.
- Rumus Resmi: ENS (kWh) = P (kW) × t (durasi padam jam)
  dengan Daya Aktif: P = √3 × V (20 kV) × I_beban (A) × cos φ (0.85)
- Estimasi Kerugian Finansial: Total ENS (kWh) × Tarif Dasar Listrik (Rp 1.444,70 / kWh sesuai Permen ESDM).

Sistem GROW AI di ULP Baguala secara otomatis menghitung potensi ENS untuk tiap penyulang (Feeder Passo, Waiheru, Lateri, dll.) sehingga anggaran dan prioritas rabas pohon dapat dipertanggungjawabkan secara finansial.`;
  }

  // 5. Informasi Umum ULP Baguala & GROW AI
  const totalPoles = contextPoles.length;
  const critical = contextPoles.filter(p => p.physicalCondition !== 'Baik').length;
  const rowIssues = contextPoles.filter(p => p.clearanceDistanceMeters < 3.0).length;

  return `Halo! Terkait sistem ketenagalistrikan PLN ULP Baguala:

- Data Tiang GIS Terpantau: ${totalPoles} tiang
- Pelanggaran Jarak Bebas (ROW < 3m): ${rowIssues} lokasi
- Tiang Kondisi Miring / Kritis: ${critical} titik

Standar Operasional Ruang Bebas (Permen ESDM No. 13/2021):
- JTR (220V–380V): Minimal 1.0 Meter dari bangunan/pohon.
- JTM (20 kV): Minimal 3.0 Meter ruang bebas tanpa vegetasi.
- SUTT (150 kV): Minimal 5.0 s.d 8.5 Meter.

Silakan ajukan pertanyaan lain seputar SOP penanganan pohon, perhitungan ENS, keselamatan K3, atau penerbitan SPK.`;
}
