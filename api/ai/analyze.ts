import { GoogleGenAI, Type } from '@google/genai';
import { calculatePlnEnsAnalysis } from '../../src/utils/ensCalculator.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const poles = req.body?.poles || [];
  const ensCalculation = calculatePlnEnsAnalysis(poles);

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const polesSummary = poles.map((p: any) => ({
        id: p.id,
        code: p.code,
        feeder: p.feeder,
        type: p.type,
        location: p.locationName,
        condition: p.physicalCondition,
        clearanceMeters: p.clearanceDistanceMeters,
        clearanceStatus: p.clearanceStatus,
        clearanceObject: p.clearanceObject
      }));

      const prompt = `Anda adalah Sistem Analis AI Pemeliharaan Jaringan Distribusi Listrik untuk PLN ULP Baguala Ambon.
Batas ROW Permen ESDM: JTR minimal 1.0m, JTM 20kV minimal 3.0m, SUTT minimal 5.0m.
Standar ENS: SPLN No. 68-1B : 1986. Potensi ENS: ${ensCalculation.totalPotentialEnsKwh} kWh, Estimasi Kerugian: Rp ${ensCalculation.totalPotentialLossRp}.
Data tiang: ${JSON.stringify(polesSummary.slice(0, 40), null, 2)}
Berikan analisis JSON dengan properti: gridHealthScore, summary, criticalPolesCount, rowViolationsCount, riskAssessment, preventiveActionPlan, generatedSpkDrafts.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              gridHealthScore: { type: Type.INTEGER },
              summary: { type: Type.STRING },
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
                      required: ['poleId', 'location', 'reason', 'riskLevel']
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
                      required: ['poleId', 'distance', 'object', 'action']
                    }
                  }
                },
                required: ['highRiskPoles', 'vegetationThreats']
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
                  required: ['step', 'title', 'description', 'assignedUnit', 'targetDays']
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
                  required: ['poleId', 'locationName', 'issueType', 'priority', 'assignedTeam', 'aiRecommendation']
                }
              }
            },
            required: ['gridHealthScore', 'summary', 'criticalPolesCount', 'rowViolationsCount', 'riskAssessment', 'preventiveActionPlan', 'generatedSpkDrafts']
          }
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        parsed.ensAnalysis = ensCalculation;
        return res.status(200).json(parsed);
      }
    } catch (e) {
      console.error('Vercel Gemini analyze error, falling back to local calculation:', e);
    }
  }

  // Fallback if no Gemini key or Gemini request failed
  const criticalCount = poles.filter((p: any) => p.physicalCondition === 'Korosi Kritis' || p.physicalCondition === 'Miring / Retak').length;
  const rowCount = poles.filter((p: any) => p.clearanceDistanceMeters < 3.0).length;
  const health = Math.max(20, Math.round(100 - (criticalCount * 15) - (rowCount * 8)));

  return res.status(200).json({
    gridHealthScore: health,
    summary: `Analisis sistematis jaringan PLN ULP Baguala berbasis ${poles.length} titik tiang terdata. Ditemukan ${rowCount} pelanggaran jarak aman kabel (ROW < 3m) dan ${criticalCount} tiang berkondisi kritis/miring. Estimasi potensi ENS akibat gangguan vegetasi mencapai ${ensCalculation.totalPotentialEnsKwh.toLocaleString('id-ID')} kWh (${ensCalculation.totalPotentialEnsMwh} MWh) dengan potensi kerugian penjualan Rp ${ensCalculation.totalPotentialLossRp.toLocaleString('id-ID')}.`,
    criticalPolesCount: criticalCount,
    rowViolationsCount: rowCount,
    ensAnalysis: ensCalculation,
    riskAssessment: {
      highRiskPoles: poles.filter((p: any) => p.clearanceDistanceMeters < 3.0 || p.physicalCondition !== 'Baik').slice(0, 30).map((p: any) => ({
        poleId: p.id,
        location: p.locationName || 'Wilayah ULP Baguala',
        reason: `Jarak kabel ${p.clearanceDistanceMeters}m (${p.clearanceStatus}) & kondisi tiang ${p.physicalCondition}`,
        riskLevel: p.clearanceDistanceMeters < 1.5 || p.physicalCondition === 'Korosi Kritis' ? 'Kritis' : 'Tinggi'
      })),
      vegetationThreats: poles.filter((p: any) => p.clearanceDistanceMeters < 3.0).slice(0, 30).map((p: any) => ({
        poleId: p.id,
        distance: p.clearanceDistanceMeters,
        object: p.clearanceObject || 'Pohon Kelapa / Bangunan',
        action: `Pangkas dahan/pohon radius 3.5m dari kawat konduktor ${p.type}`
      }))
    },
    preventiveActionPlan: [
      {
        step: 1,
        title: 'Pemberitahuan & Rabas Pohon Darurat (ROW)',
        description: 'Regu Yantek Passo & Baguala melakukan pemangkasan dahan pohon kelapa/pala yang mendekati kawat 20kV < 3 Meter.',
        assignedUnit: 'Regu Rabas ULP Baguala',
        targetDays: 2
      },
      {
        step: 2,
        title: 'Peninggian Travers & Penggantian Tiang Miring',
        description: 'Penggantian pondasi tiang beton yang retak di Lateri & Passo untuk mencegah tiang roboh saat musim hujan.',
        assignedUnit: 'Tim Pemeliharaan Konstruksi',
        targetDays: 5
      },
      {
        step: 3,
        title: 'Inspeksi Ulang Thermovision Trafo & Arrester',
        description: 'Pengukuran beban puncak dan pemeriksaan ketahanan isolasi pada seluruh Gardu Trafo Tiang ULP Baguala.',
        assignedUnit: 'Inspektor Harkat Baguala',
        targetDays: 7
      }
    ],
    generatedSpkDrafts: poles.filter((p: any) => p.clearanceDistanceMeters < 3.0).slice(0, 20).map((p: any, idx: number) => ({
      poleId: p.id,
      locationName: p.locationName || 'ULP Baguala',
      issueType: `Rabas Pohon & Penataan Kabel (${p.clearanceStatus})`,
      priority: p.clearanceDistanceMeters < 1.5 ? 'Kritis' : 'Tinggi',
      assignedTeam: `Tim Yantek Regu ${idx % 2 === 0 ? 'A Passo' : 'B Waiheru'}`,
      aiRecommendation: `Prioritas pemangkasan vegetasi pada ${p.locationName || 'lokasi tiang'}. Pertahankan jarak bebas aman minimal 3.0 Meter sesuai Permen ESDM / SPLN.`
    }))
  });
}
