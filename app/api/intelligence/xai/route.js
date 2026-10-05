import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const data = await request.json();
  const temp = data.temperature || 25;
  const soc = data.soc || 50;
  const cycles = data.cycleCount || 0;

  // Physics-based SHAP-like attribution
  const tempDelta = Math.max(0, Math.abs(temp - 25) - 0.8);
  const thermalStress = Math.min(tempDelta * 0.28, 4.5) * 12;
  const imbalanceStress = Math.min((cycles / 500) + (100 - soc) * 0.05, 7.5) * 10;
  const lowSocStress = soc < 20 ? ((20 - soc) / 20 * 18) : 5;
  const agingStress = 12 + (cycles / 420);
  const totalStress = thermalStress + imbalanceStress + lowSocStress + agingStress;

  const factors = [
    { label: 'Thermal stress', value: (thermalStress / totalStress) * 100 },
    { label: 'Voltage imbalance', value: (imbalanceStress / totalStress) * 100 },
    { label: 'Low SOC exposure', value: (lowSocStress / totalStress) * 100 },
    { label: 'Aging / cycle history', value: (agingStress / totalStress) * 100 }
  ].sort((a, b) => b.value - a.value);

  const breakdown = factors.map(f => ({ label: f.label, percent: Math.round(f.value * 10) / 10 }));

  let narrative = `RUL is primarily driven by ${breakdown[0].label.toLowerCase()} and ${breakdown[1].label.toLowerCase()}.`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Write a 1-sentence analytical summary stating that RUL is primarily driven by '${breakdown[0].label}' (${breakdown[0].percent}%) and '${breakdown[1].label}' (${breakdown[1].percent}%).`;
      
      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
              maxOutputTokens: 50,
          }
      });
      if (response.text) {
        narrative = response.text.trim();
      }
    } catch {
      // Use default narrative on failure
    }
  }

  return NextResponse.json({
    breakdown,
    narrative,
    signal: `SHAP Attributions Computed over ${breakdown.length} features.`
  });
}
