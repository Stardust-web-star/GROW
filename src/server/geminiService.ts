import { GoogleGenAI, Type } from "@google/genai";
import { PoleData, AiAnalysisResult } from "../types";

const apiKey = process.env.GEMINI_API_KEY || "";

const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
});

export async function analyzePoleDataWithGemini(poles: PoleData[]): Promise<AiAnalysisResult> {
  const polesSummary = poles.map(p => ({
    id: p.id,
    code: p.code,
    feeder: p.feeder,
    type: p.type,
    location: p.locationName,
    condition: p.physicalCondition,
    clearanceMeters: p.clearanceDistanceMeters,
    clearanceStatus: p.clearanceStatus,
    clearanceObject: p.clearanceObject,
    spkStatus: p.spkStatus
  }));

  const prompt = `Anda adalah Sistem Analis AI Pemeliharaan Jaringan Distribusi Listrik untuk PLN Unit Layanan Pelanggan (ULP) Baguala, Ambon.

ACUAN RESMI TABEL BATAS JARAK AMAN MINIMUM (ROW) PERMEN ESDM:
1. Jaringan Tegangan Rendah (JTR - 220V s.d 380V): Minimal 1.0 Meter (Jarak aman kabel udara dari atap/dinding bangunan atau dahan pohon. Lintasan jalan raya 5-6m).
2. Jaringan Tegangan Menengah (JTM / SUTM - 20kV): Minimal 3.0 Meter (Berlaku untuk jarak horizontal maupun vertikal terhadap bangunan, pepohonan, baliho, antene, dan aktivitas konstruksi).
3. Saluran Udara Tegangan Tinggi (SUTT / SUTET - 150kV s.d 500kV): Minimal 5.0 s.d 9+ Meter.

Data Tiang Lapangan ULP Baguala: ${JSON.stringify(polesSummary, null, 2)}

Harap lakukan analisis prediktif berbasis acuan Permen ESDM di atas:
1. Hitung skor kesehatan jaringan ULP Baguala (0-100%).
2. Identifikasi tiang mana saja yang memiliki risiko TINGGI/KRITIS akibat kondisi fisik ATAU pelanggaran jarak aman kabel sesuai tingkatan tegangannya (JTR < 1.0m, JTM < 3.0m, SUTT < 5.0m).
3. Berikan rekomendasi teknis tindakan rabas pohon (ROW) atau perbaikan struktur tiang.
4. Buat draf usulan SPK (Surat Perintah Kerja) otomatis untuk tim teknik ULP Baguala.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
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
                      riskLevel: { type: Type.STRING }
                    },
                    required: ["poleId", "location", "reason", "riskLevel"]
                  }
                },
                vegetationThreats: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      poleId: { type: Type.STRING },
                      distance: { type: Type.NUMBER },
                      object: { type: Type.STRING },
                      action: { type: Type.STRING }
                    },
                    required: ["poleId", "distance", "object", "action"]
                  }
                }
              },
              required: ["highRiskPoles", "vegetationThreats"]
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
                  targetDays: { type: Type.INTEGER }
                },
                required: ["step", "title", "description", "assignedUnit", "targetDays"]
              }
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
                  aiRecommendation: { type: Type.STRING }
                },
                required: ["poleId", "locationName", "issueType", "priority", "assignedTeam", "aiRecommendation"]
              }
            }
          },
          required: ["gridHealthScore", "summary", "criticalPolesCount", "rowViolationsCount", "riskAssessment", "preventiveActionPlan", "generatedSpkDrafts"]
        }
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text) as AiAnalysisResult;
    }
  } catch (err) {
    console.error("Gemini AI Pole Analysis Error:", err);
  }

  // Fallback fallback calculation if Gemini API key not present or network error
  const criticalCount = poles.filter(p => p.physicalCondition === 'Korosi Kritis' || p.physicalCondition === 'Miring / Retak').length;
  const rowCount = poles.filter(p => p.clearanceDistanceMeters < 3.0).length;
  const total = poles.length || 1;
  const health = Math.max(20, Math.round(100 - (criticalCount * 15) - (rowCount * 8)));

  return {
    gridHealthScore: health,
    summary: `Analisis sistematis jaringan PLN ULP Baguala berbasis ${poles.length} titik tiang terdata. Ditemukan ${rowCount} pelanggaran jarak aman kabel (ROW < 3m) dan ${criticalCount} tiang berkondisi kritis/miring.`,
    criticalPolesCount: criticalCount,
    rowViolationsCount: rowCount,
    riskAssessment: {
      highRiskPoles: poles.filter(p => p.clearanceDistanceMeters < 3.0 || p.physicalCondition !== 'Baik').map(p => ({
        poleId: p.id,
        location: p.locationName,
        reason: `Jarak kabel ${p.clearanceDistanceMeters}m (${p.clearanceStatus}) & kondisi tiang ${p.physicalCondition}`,
        riskLevel: p.clearanceDistanceMeters < 1.5 || p.physicalCondition === 'Korosi Kritis' ? 'Kritis' : 'Tinggi'
      })),
      vegetationThreats: poles.filter(p => p.clearanceDistanceMeters < 3.0).map(p => ({
        poleId: p.id,
        distance: p.clearanceDistanceMeters,
        object: p.clearanceObject,
        action: `Pangkas dahan/pohon radius 3.5m dari kawat konduktor ${p.type}`
      }))
    },
    preventiveActionPlan: [
      {
        step: 1,
        title: "Pemberitahuan & Rabas Pohon Darurat (ROW)",
        description: "Regu Yantek Passo & Baguala melakukan pemangkasan dahan pohon kelapa/pala yang mendekati kawat 20kV < 3 Meter.",
        assignedUnit: "Regu Rabas ULP Baguala",
        targetDays: 2
      },
      {
        step: 2,
        title: "Peninggian Travers & Penggantian Tiang Miring",
        description: "Penggantian pondasi tiang beton yang retak di Lateri & Passo untuk mencegah tiang roboh saat musim hujan.",
        assignedUnit: "Tim Pemeliharaan Konstruksi",
        targetDays: 5
      },
      {
        step: 3,
        title: "Inspeksi Ulang Thermovision Trafo & Arrester",
        description: "Pengukuran beban puncak dan pemeriksaan ketahanan isolasi pada seluruh Gardu Trafo Tiang ULP Baguala.",
        assignedUnit: "Inspektor Harkat Baguala",
        targetDays: 7
      }
    ],
    generatedSpkDrafts: poles.filter(p => p.clearanceDistanceMeters < 3.0).map((p, idx) => ({
      poleId: p.id,
      locationName: p.locationName,
      issueType: `Rabas Pohon & Penataan Kabel (${p.clearanceStatus})`,
      priority: p.clearanceDistanceMeters < 1.5 ? 'Kritis' : 'Tinggi',
      assignedTeam: `Tim Yantek Regu ${idx % 2 === 0 ? 'A Passo' : 'B Waiheru'}`,
      aiRecommendation: `Prioritas pemangkasan vegetasi pada ${p.locationName}. Pertahankan jarak bebas aman minimal 3.0 Meter sesuai Permen ESDM / SPLN.`
    }))
  };
}

export async function askGeminiAiAssistant(question: string, contextPoles: PoleData[]): Promise<string> {
  const prompt = `Anda adalah Asisten Teknis AI Ketenagalistrikan untuk PLN Unit Layanan Pelanggan (ULP) Baguala, Ambon.
Anda mengacu pada ACUAN TABEL BATAS JARAK AMAN MINIMUM (ROW) PERMEN ESDM:
- JTR (220V–380V): Minimal 1.0 Meter (kabel ke dinding/atap/dahan). Lintasan jalan 5-6m.
- JTM / SUTM (20kV): Minimal 3.0 Meter (horizontal & vertikal terhadap bangunan, pohon, baliho, antene, pekerja).
- SUTT / SUTET (150kV–500kV): Minimal 5.0 s.d 9+ Meter.

Data ringkasan tiang ULP Baguala saat ini:
- Total Tiang: ${contextPoles.length}
- Pelanggaran ROW: ${contextPoles.filter(p => p.clearanceDistanceMeters < (p.type === 'TR' ? 1.0 : 3.0)).length}
- Tiang Kritis/Miring: ${contextPoles.filter(p => p.physicalCondition !== 'Baik').length}

Pertanyaan Petugas/Insinyur PLN: "${question}"

Jawablah secara singkat, akurat, profesional, dan dalam bahasa Indonesia yang ramah teknis PLN.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt
    });
    return response.text || "Maaf, sistem AI sedang memproses data. Silakan coba kembali.";
  } catch (err) {
    console.error("GROW AI Chat Assistant Error:", err);
    return "Layanan GROW AI sementara tidak dapat diakses. Silakan periksa koneksi atau API Key.";
  }
}
