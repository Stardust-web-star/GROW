import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { PoleData, AiAnalysisResult } from "../types/index.js";
import { calculatePlnEnsAnalysis } from "../utils/ensCalculator.js";

const GEMINI_MODEL = "gemini-4-hydrogen";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes server cache
const MAX_PRIORITY_POLES_IN_PROMPT = 35;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// In-memory cache & rate-limit cooldown state
interface CachedAnalysisEntry {
  fingerprint: string;
  timestamp: number;
  result: AiAnalysisResult;
}

let cachedAnalysis: CachedAnalysisEntry | null = null;
const inFlightAnalyses = new Map<string, Promise<AiAnalysisResult>>();
let rateLimitCooldownUntil = 0;

function isRateLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  const status = (err as { status?: number })?.status;
  return (
    status === 429 ||
    message.includes("429") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.toLowerCase().includes("quota")
  );
}

function extractRetryDelayMs(err: unknown): number {
  const message = err instanceof Error ? err.message : String(err ?? "");
  const match = message.match(/retry(?:Delay)?["']?\s*[:=]?\s*["']?(\d+(?:\.\d+)?)s/i);
  if (match && match[1]) {
    const seconds = Math.ceil(parseFloat(match[1]));
    return Math.min(Math.max(seconds * 1000, 15_000), 120_000);
  }
  return 60_000;
}

function getMinSafeClearance(poleType: PoleData["type"]): number {
  if (poleType === "TR") return 1.0;
  if (poleType === "TT") return 5.0;
  return 3.0;
}

function getPoleSeverityScore(p: PoleData): number {
  let score = 0;
  if (p.physicalCondition === "Korosi Kritis") score += 100;
  else if (p.physicalCondition === "Miring / Retak") score += 80;
  else if (p.physicalCondition === "Perlu Perbaikan") score += 40;

  const minRow = getMinSafeClearance(p.type);
  if (p.clearanceDistanceMeters < 1.5) score += 90;
  else if (p.clearanceDistanceMeters < minRow) score += 60;
  else if (p.clearanceDistanceMeters < 3.0) score += 30;

  // Higher severity sorts earlier; break ties by smaller clearance
  return score - p.clearanceDistanceMeters;
}

function buildDatasetFingerprint(poles: PoleData[], criticalCount: number, rowCount: number): string {
  const firstId = poles[0]?.id ?? "none";
  const lastId = poles[poles.length - 1]?.id ?? "none";
  return `${poles.length}:${criticalCount}:${rowCount}:${firstId}:${lastId}`;
}

function buildDeterministicAnalysis(
  poles: PoleData[],
  ensCalculation: ReturnType<typeof calculatePlnEnsAnalysis>
): AiAnalysisResult {
  const criticalPoles = poles.filter(
    (p) => p.physicalCondition === "Korosi Kritis" || p.physicalCondition === "Miring / Retak"
  );
  const rowViolations = poles.filter((p) => p.clearanceDistanceMeters < getMinSafeClearance(p.type));
  const total = poles.length || 1;
  const criticalRatio = criticalPoles.length / total;
  const rowRatio = rowViolations.length / total;
  const health = Math.max(15, Math.min(95, Math.round(100 - criticalRatio * 120 - rowRatio * 65)));

  const sortedAtRisk = poles
    .filter((p) => p.clearanceDistanceMeters < 3.0 || p.physicalCondition !== "Baik")
    .sort((a, b) => getPoleSeverityScore(b) - getPoleSeverityScore(a));

  const sortedRow = poles
    .filter((p) => p.clearanceDistanceMeters < 3.0)
    .sort((a, b) => a.clearanceDistanceMeters - b.clearanceDistanceMeters);

  return {
    gridHealthScore: health,
    summary: `Analisis sistematis jaringan PLN ULP Baguala berbasis ${poles.length} titik tiang terdata. Ditemukan ${rowViolations.length} pelanggaran jarak aman kabel (ROW) dan ${criticalPoles.length} tiang berkondisi kritis/miring. Estimasi potensi ENS akibat gangguan vegetasi mencapai ${ensCalculation.totalPotentialEnsKwh.toLocaleString("id-ID")} kWh (${ensCalculation.totalPotentialEnsMwh} MWh) dengan potensi kerugian penjualan Rp ${ensCalculation.totalPotentialLossRp.toLocaleString("id-ID")}.`,
    criticalPolesCount: criticalPoles.length,
    rowViolationsCount: rowViolations.length,
    ensAnalysis: ensCalculation,
    riskAssessment: {
      highRiskPoles: sortedAtRisk.slice(0, 50).map((p) => ({
        poleId: p.id,
        location: p.locationName || `Feeder ${p.feeder} (${p.lat.toFixed(4)}, ${p.lng.toFixed(4)})`,
        reason: `Jarak kabel ${p.clearanceDistanceMeters}m (${p.clearanceStatus}) & kondisi tiang ${p.physicalCondition}`,
        riskLevel:
          p.clearanceDistanceMeters < 1.5 || p.physicalCondition === "Korosi Kritis"
            ? "Kritis"
            : "Tinggi",
      })),
      vegetationThreats: sortedRow.slice(0, 50).map((p) => ({
        poleId: p.id,
        distance: p.clearanceDistanceMeters,
        object: p.clearanceObject || "Pohon Kelapa / Pala / Vegetasi",
        action: `Pangkas dahan/pohon radius 3.5m dari kawat konduktor ${p.type} (${p.feeder})`,
      })),
    },
    preventiveActionPlan: [
      {
        step: 1,
        title: "Pemberitahuan & Rabas Pohon Darurat (ROW)",
        description: `Regu Yantek & Tim ROW melakukan pemangkasan dahan pohon pada ${rowViolations.length} titik tiang berisiko < 3.0m untuk menekan potensi ENS ${ensCalculation.totalPotentialEnsMwh} MWh.`,
        assignedUnit: "Regu Rabas ULP Baguala",
        targetDays: 2,
      },
      {
        step: 2,
        title: "Peninggian Travers & Penggantian Tiang Miring",
        description: `Penguatan pondasi dan penataan tiang pada ${criticalPoles.length} tiang beton yang miring/korosi kritis di jalur utama Passo, Waiheru, dan Lateri.`,
        assignedUnit: "Tim Pemeliharaan Konstruksi",
        targetDays: 5,
      },
      {
        step: 3,
        title: "Inspeksi Ulang Thermovision Trafo & Arrester",
        description:
          "Pengukuran beban puncak dan pemeriksaan ketahanan isolasi pada seluruh Gardu Trafo Tiang ULP Baguala.",
        assignedUnit: "Inspektor Harkat Baguala",
        targetDays: 7,
      },
    ],
    generatedSpkDrafts: sortedRow.slice(0, 30).map((p, idx) => ({
      poleId: p.id,
      locationName: p.locationName || `Feeder ${p.feeder} (${p.lat.toFixed(4)}, ${p.lng.toFixed(4)})`,
      issueType: `Rabas Pohon & Penataan Kabel (${p.clearanceStatus})`,
      priority: p.clearanceDistanceMeters < 1.5 ? "Kritis" : "Tinggi",
      assignedTeam: `Tim Yantek Regu ${idx % 2 === 0 ? "A Passo" : "B Waiheru"}`,
      aiRecommendation: `Prioritas pemangkasan vegetasi pada ${p.locationName || p.feeder}. Pertahankan jarak bebas aman minimal 3.0 Meter sesuai Permen ESDM No. 13/2021 & SPLN.`,
    })),
  };
}

export async function analyzePoleDataWithGemini(poles: PoleData[]): Promise<AiAnalysisResult> {
  const ensCalculation = calculatePlnEnsAnalysis(poles);
  const criticalCount = poles.filter(
    (p) => p.physicalCondition === "Korosi Kritis" || p.physicalCondition === "Miring / Retak"
  ).length;
  const rowCount = poles.filter((p) => p.clearanceDistanceMeters < getMinSafeClearance(p.type)).length;
  const fingerprint = buildDatasetFingerprint(poles, criticalCount, rowCount);

  // Return fresh cached analysis when dataset has not changed
  if (
    cachedAnalysis &&
    cachedAnalysis.fingerprint === fingerprint &&
    Date.now() - cachedAnalysis.timestamp < CACHE_TTL_MS
  ) {
    return {
      ...cachedAnalysis.result,
      ensAnalysis: ensCalculation,
    };
  }

  // Deduplicate concurrent requests for the same dataset
  const existingPromise = inFlightAnalyses.get(fingerprint);
  if (existingPromise) {
    return existingPromise;
  }

  const runAnalysis = async (): Promise<AiAnalysisResult> => {
    const ai = getAiClient();
    const now = Date.now();

    // If API key is absent or rate-limit cooldown is active, serve deterministic fallback smoothly
    if (!ai || now < rateLimitCooldownUntil) {
      const fallback = buildDeterministicAnalysis(poles, ensCalculation);
      cachedAnalysis = { fingerprint, timestamp: now, result: fallback };
      return fallback;
    }

    // Build compact aggregated telemetry (keeps prompt < 3,500 tokens even for 10,000+ poles)
    const conditionCounts = {
      baik: poles.filter((p) => p.physicalCondition === "Baik").length,
      perluPerbaikan: poles.filter((p) => p.physicalCondition === "Perlu Perbaikan").length,
      miringRetak: poles.filter((p) => p.physicalCondition === "Miring / Retak").length,
      korosiKritis: poles.filter((p) => p.physicalCondition === "Korosi Kritis").length,
    };

    const feederSummary = ensCalculation.feederBreakdown.slice(0, 12).map((f) => ({
      feeder: f.feederName,
      powerKw: f.powerKw,
      rowViolations: f.rowViolationsCount,
      critical: f.criticalPolesCount,
      ensKwh: f.potentialEnsKwh,
      risk: f.riskLevel,
    }));

    const priorityPoles = poles
      .filter((p) => p.clearanceDistanceMeters < 3.0 || p.physicalCondition !== "Baik")
      .sort((a, b) => getPoleSeverityScore(b) - getPoleSeverityScore(a))
      .slice(0, MAX_PRIORITY_POLES_IN_PROMPT)
      .map((p) => ({
        id: p.id,
        code: p.code,
        feeder: p.feeder,
        type: p.type,
        loc: p.locationName,
        cond: p.physicalCondition,
        clrM: p.clearanceDistanceMeters,
        obj: p.clearanceObject,
        spk: p.spkStatus,
      }));

    const aggregatePayload = {
      totalPoles: poles.length,
      conditionCounts,
      rowViolationsTotal: rowCount,
      rowUnder3mTotal: poles.filter((p) => p.clearanceDistanceMeters < 3.0).length,
      ens: {
        potentialKwh: ensCalculation.totalPotentialEnsKwh,
        potentialMwh: ensCalculation.totalPotentialEnsMwh,
        potentialLossRp: ensCalculation.totalPotentialLossRp,
        savedKwh: ensCalculation.totalSavedEnsKwh,
        savedRevenueRp: ensCalculation.totalSavedRevenueRp,
      },
      topFeeders: feederSummary,
      priorityPolesTop35: priorityPoles,
    };

    const prompt = `Anda adalah Sistem Analis AI Pemeliharaan Jaringan Distribusi Listrik PLN ULP Baguala, Ambon.

ACUAN RESMI BATAS JARAK AMAN MINIMUM (ROW) PERMEN ESDM NO. 13/2021:
1. JTR (220V-380V): Minimal 1.0 Meter dari bangunan/dahan (lintasan jalan 5-6m).
2. JTM / SUTM (20kV): Minimal 3.0 Meter (horizontal & vertikal terhadap pohon, bangunan, baliho, antene).
3. SUTT / SUTET (150kV-500kV): Minimal 5.0 s.d 9+ Meter.

STANDAR ENS PLN (SPLN 68-1B:1986 & Kepdir PLN 0687.K/DIR/2019, Tarif Rp 1.444,70/kWh):
Data Agregat & Sampel Prioritas Tertinggi (${priorityPoles.length} dari ${poles.length} tiang):
${JSON.stringify(aggregatePayload)}

Tugas analisis ringkas & akurat dalam Bahasa Indonesia:
1. Hitung gridHealthScore (0-100) berdasarkan proporsi pelanggaran ROW (${rowCount}) & tiang kritis (${criticalCount}) terhadap total ${poles.length} tiang.
2. Buat summary eksekutif yang menyertakan dampak ENS (${ensCalculation.totalPotentialEnsKwh} kWh / Rp ${ensCalculation.totalPotentialLossRp.toLocaleString("id-ID")}) dan langkah mitigasi utama.
3. Isi highRiskPoles (maks 15 item terparah dari sampel prioritas), vegetationThreats (maks 15 item terdekat <3m), preventiveActionPlan (3-4 langkah), dan generatedSpkDrafts (maks 12 draf SPK).`;

    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              gridHealthScore: { type: Type.INTEGER, description: "Skor kesehatan jaringan 0-100" },
              summary: { type: Type.STRING, description: "Ringkasan kondisi umum ULP Baguala" },
              criticalPolesCount: { type: Type.INTEGER },
              rowViolationsCount: { type: Type.INTEGER },
              riskAssessment: {
                type: Type.OBJECT,
                properties: {
                  highRiskPoles: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        poleId: { type: Type.STRING },
                        location: { type: Type.STRING },
                        reason: { type: Type.STRING },
                        riskLevel: { type: Type.STRING },
                      },
                      required: ["poleId", "location", "reason", "riskLevel"],
                    },
                  },
                  vegetationThreats: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        poleId: { type: Type.STRING },
                        distance: { type: Type.NUMBER },
                        object: { type: Type.STRING },
                        action: { type: Type.STRING },
                      },
                      required: ["poleId", "distance", "object", "action"],
                    },
                  },
                },
                required: ["highRiskPoles", "vegetationThreats"],
              },
              preventiveActionPlan: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    step: { type: Type.INTEGER },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    assignedUnit: { type: Type.STRING },
                    targetDays: { type: Type.INTEGER },
                  },
                  required: ["step", "title", "description", "assignedUnit", "targetDays"],
                },
              },
              generatedSpkDrafts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    poleId: { type: Type.STRING },
                    locationName: { type: Type.STRING },
                    issueType: { type: Type.STRING },
                    priority: { type: Type.STRING },
                    assignedTeam: { type: Type.STRING },
                    aiRecommendation: { type: Type.STRING },
                  },
                  required: [
                    "poleId",
                    "locationName",
                    "issueType",
                    "priority",
                    "assignedTeam",
                    "aiRecommendation",
                  ],
                },
              },
            },
            required: [
              "gridHealthScore",
              "summary",
              "criticalPolesCount",
              "rowViolationsCount",
              "riskAssessment",
              "preventiveActionPlan",
              "generatedSpkDrafts",
            ],
          },
        },
      });

      const text = response.text;
      if (text) {
        const parsed = JSON.parse(text) as AiAnalysisResult;
        parsed.criticalPolesCount = criticalCount;
        parsed.rowViolationsCount = rowCount;
        parsed.ensAnalysis = ensCalculation;
        cachedAnalysis = { fingerprint, timestamp: Date.now(), result: parsed };
        return parsed;
      }
    } catch (err) {
      if (isRateLimitError(err)) {
        const delayMs = extractRetryDelayMs(err);
        rateLimitCooldownUntil = Date.now() + delayMs;
        console.warn(
          `[GROW AI] Gemini rate limit cooldown active for ${Math.round(delayMs / 1000)}s; serving deterministic PLN technical analysis.`
        );
      } else {
        console.warn("[GROW AI] Gemini analysis fallback triggered:", err instanceof Error ? err.message : err);
      }
    }

    const fallback = buildDeterministicAnalysis(poles, ensCalculation);
    cachedAnalysis = { fingerprint, timestamp: Date.now(), result: fallback };
    return fallback;
  };

  const promise = runAnalysis().finally(() => {
    inFlightAnalyses.delete(fingerprint);
  });
  inFlightAnalyses.set(fingerprint, promise);
  return promise;
}

export async function askGeminiAiAssistant(question: string, contextPoles: PoleData[]): Promise<string> {
  const ai = getAiClient();
  if (!ai || Date.now() < rateLimitCooldownUntil) {
    return "Layanan GROW AI sedang dalam mode hemat kuota. Silakan coba beberapa saat lagi atau gunakan ringkasan teknis jaringan pada dashboard.";
  }

  const prompt = `Anda adalah Asisten Teknis AI Ketenagalistrikan untuk PLN Unit Layanan Pelanggan (ULP) Baguala, Ambon.
Anda mengacu pada ACUAN TABEL BATAS JARAK AMAN MINIMUM (ROW) PERMEN ESDM:
- JTR (220V–380V): Minimal 1.0 Meter (kabel ke dinding/atap/dahan). Lintasan jalan 5-6m.
- JTM / SUTM (20kV): Minimal 3.0 Meter (horizontal & vertikal terhadap bangunan, pohon, baliho, antene, pekerja).
- SUTT / SUTET (150kV–500kV): Minimal 5.0 s.d 9+ Meter.

Data ringkasan tiang ULP Baguala saat ini:
- Total Tiang: ${contextPoles.length}
- Pelanggaran ROW: ${contextPoles.filter((p) => p.clearanceDistanceMeters < getMinSafeClearance(p.type)).length}
- Tiang Kritis/Miring: ${contextPoles.filter((p) => p.physicalCondition !== "Baik").length}

Pertanyaan Petugas/Insinyur PLN: "${question}"

Jawablah secara singkat, akurat, profesional, dan dalam bahasa Indonesia yang ramah teknis PLN.`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    return response.text || "Maaf, sistem AI sedang memproses data. Silakan coba kembali.";
  } catch (err) {
    if (isRateLimitError(err)) {
      rateLimitCooldownUntil = Date.now() + extractRetryDelayMs(err);
    }
    console.warn("[GROW AI] Chat Assistant fallback triggered:", err instanceof Error ? err.message : err);
    return "Layanan GROW AI sementara tidak dapat diakses. Silakan coba kembali beberapa saat lagi.";
  }
}
