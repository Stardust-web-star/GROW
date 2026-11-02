import { GoogleGenAI } from '@google/genai';
import { generateLocalChatAnswer } from '../../src/utils/aiTechnicalEngine.js';

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

  const { question } = req.body || {};
  if (!question) {
    return res.status(400).json({ error: 'Pertanyaan wajib diisi' });
  }

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

      const prompt = `Anda adalah Asisten Teknis AI Ketenagalistrikan untuk PLN Unit Layanan Pelanggan (ULP) Baguala, Ambon.
Anda mengacu pada ACUAN TABEL BATAS JARAK AMAN MINIMUM (ROW) PERMEN ESDM:
- JTR (220V–380V): Minimal 1.0 Meter (kabel ke dinding/atap/dahan). Lintasan jalan 5-6m.
- JTM / SUTM (20kV): Minimal 3.0 Meter (horizontal & vertikal terhadap bangunan, pohon, baliho, antene, pekerja).
- SUTT / SUTET (150kV–500kV): Minimal 5.0 s.d 9+ Meter.
- Standar ENS: SPLN No. 68-1B : 1986. Rumus ENS (kWh) = P (kW) × t (jam padam). Tarif Permen ESDM Rp 1.444,70 / kWh.

Pertanyaan Petugas/Insinyur PLN: "${question}"

Jawablah secara singkat, akurat, profesional, dan dalam bahasa Indonesia yang ramah teknis PLN.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt
      });

      if (response.text) {
        return res.status(200).json({ answer: response.text });
      }
    } catch (e) {
      console.error('Vercel Gemini chat error, using technical knowledge engine:', e);
    }
  }

  // Fallback to intelligent local technical answer
  const answer = generateLocalChatAnswer(question, []);
  return res.status(200).json({ answer });
}
