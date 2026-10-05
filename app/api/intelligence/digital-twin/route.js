import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const data = await request.json();
  const baseSoh = data.baseSoh || 90;
  const payloadWeightKg = data.payloadWeightKg || 0;
  const terrainGradientPct = data.terrainGradientPct || 0;
  const fastChargeFreqPct = data.fastChargeFreqPct || 0;
  const ambientTempDeltaC = data.ambientTempDeltaC || 0;
  const avgSpeedKmh = data.avgSpeedKmh || 40;
  const accelAggressionPct = data.accelAggressionPct || 0;
  const brakingAggressionPct = data.brakingAggressionPct || 0;
  const days = data.days || 7;

  // Physics-based digital twin calculations
  const weightPenalty = (payloadWeightKg / 100) * 0.05;
  const terrainPenalty = terrainGradientPct * 0.15;
  const speedPenalty = Math.max(0, avgSpeedKmh - 45) * 0.02;
  const accelPenalty = accelAggressionPct * 0.005;
  const regenBenefit = brakingAggressionPct * 0.004;

  const dailyDegradation = 0.002 + weightPenalty + terrainPenalty + speedPenalty + accelPenalty - regenBenefit;
  
  // Fast charging adds thermal stress
  const fastChargePenalty = (fastChargeFreqPct / 100) * 0.001;
  const thermalDegradation = (ambientTempDeltaC * 0.0005) + fastChargePenalty;

  const totalDailyDegradation = Math.max(0.001, dailyDegradation + thermalDegradation);
  const scenarioRul = Math.max(0, (baseSoh - 70) / (totalDailyDegradation * 365));
  
  const baselineDailyDegradation = 0.002;
  const baselineRul = Math.max(0, (baseSoh - 70) / (baselineDailyDegradation * 365));

  // Projected DTE calculation
  const efficiencyLoss = (weightPenalty + terrainPenalty + speedPenalty) * 10;
  const projected_dte = Math.max(10, 120 - efficiencyLoss);

  // Generate 7-day curve
  const curve = Array.from({ length: days }).map((_, i) => {
    return {
      day: i,
      soh: Number((baseSoh - (totalDailyDegradation * i)).toFixed(3))
    };
  });

  let signal = `Simulated ${days} days. Projected DTE: ${Math.round(projected_dte)} km. RUL impact: ${(baselineRul - scenarioRul).toFixed(1)} years.`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are a Digital Twin AI simulator for an EV battery.
The user is simulating a scenario with ${payloadWeightKg}kg payload, ${ambientTempDeltaC}°C ambient temp increase, and ${fastChargeFreqPct}% fast charging frequency.
This scenario reduces the battery's Remaining Useful Life (RUL) by ${(baselineRul - scenarioRul).toFixed(1)} years compared to baseline, and drops the range (DTE) to ${Math.round(projected_dte)} km.
Write a 1-sentence analytical insight (max 20 words) explaining the primary cause of this degradation.`;
      
      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
              maxOutputTokens: 50,
          }
      });
      if (response.text) {
        signal = response.text.trim();
      }
    } catch {
      // Use default signal on failure
    }
  }

  return NextResponse.json({
    curve,
    baselineRul: Number(baselineRul.toFixed(1)),
    scenarioRul: Number(scenarioRul.toFixed(1)),
    projected_dte: Number(projected_dte.toFixed(0)),
    signal
  });
}
