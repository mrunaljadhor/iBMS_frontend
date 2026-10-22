import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { computeAttributions } from '../../../utils/xaiAttributions';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const data = await request.json();

  const inputs = {
    temperature:  Number(data.temperature  || 25),
    soc:          Number(data.soc          || 50),
    cycleCount:   Number(data.cycleCount   || 0),
    voltageDiff:  Number(data.voltageDiff  || 0.006),
    current:      Number(data.current      || 0),
    voltage:      Number(data.voltage      || 63.5),
    drivingMode:  String(data.drivingMode  || 'ECO'),
  };

  // Compute per-target attributions
  const targets = ['SoH', 'RUL', 'DTE', 'Risk Score'];
  const attributions = {};
  for (const t of targets) {
    attributions[t] = computeAttributions(inputs, t);
  }

  // Build a concise summary string for Gemini
  const summaryLines = targets.map(t => {
    const top2 = attributions[t].slice(0, 2);
    return `${t}: driven by ${top2[0].label} (${top2[0].percent}%) and ${top2[1].label} (${top2[1].percent}%)`;
  }).join('; ');

  let narrative = `At SOC ${inputs.soc}%, ${inputs.temperature}°C, ${inputs.cycleCount} cycles: ${summaryLines}.`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are an explainable AI analyst for a Battery Management System.
Write 2 concise professional sentences summarising these SHAP-style feature attributions for live battery telemetry:
Input: SOC=${inputs.soc}%, Temperature=${inputs.temperature}°C, Cycles=${inputs.cycleCount}, VoltDiff=${inputs.voltageDiff}V, Current=${inputs.current}A, Mode=${inputs.drivingMode}
Attributions: ${summaryLines}
Focus on what the operator should act on first. Do not exceed 2 sentences.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { maxOutputTokens: 120, thinkingConfig: { thinkingBudget: 0 } }
      });
      if (response.text) narrative = response.text.trim();
    } catch {
      // fall back to computed narrative
    }
  }

  return NextResponse.json({
    attributions,   // { SoH: [...], RUL: [...], DTE: [...], 'Risk Score': [...] }
    narrative,
    signal: `SHAP attributions across 4 targets | SOC ${inputs.soc}% | ${inputs.temperature}°C | ${inputs.cycleCount} cycles | Mode: ${inputs.drivingMode}`
  });
}
