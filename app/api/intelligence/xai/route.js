import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * Compute physics-based SHAP-style feature attributions for a given prediction target.
 * Each target has its own sensitivity to each input feature.
 */
function computeAttributions(inputs, target) {
  const { temperature, soc, cycleCount, voltageDiff, current, voltage, drivingMode } = inputs;

  // Baseline stress factors (all raw, before normalization)
  const tempDelta      = Math.max(0, Math.abs(temperature - 25) - 0.8);
  const thermalRaw     = clamp(tempDelta * 0.28, 0, 4.5) * 12;

  const imbalanceRaw   = clamp((Math.max(0, voltageDiff - 0.006) / 0.08) * 7.5, 0, 7.5) * 10
                         + clamp((cycleCount / 500) * 0.4, 0, 3); // cycles worsen imbalance

  const lowSocRaw      = soc < 20 ? ((20 - soc) / 20) * 22 : clamp((100 - soc) * 0.04, 1, 6);

  const agingRaw       = 12 + (cycleCount / 420);

  const currentStressRaw = clamp(Math.abs(current) * 0.8, 0, 12); // high current → stress

  const modeMultiplier = drivingMode === 'SPORT' ? 1.35 : drivingMode === 'HIGHWAY' ? 1.18 : 1.0;

  // Each target emphasises different features based on physics
  let weights;
  if (target === 'SoH') {
    // SoH degrades primarily from aging, thermal, and cell imbalance — not instantaneous SOC
    weights = {
      'Thermal stress':      thermalRaw * 1.0,
      'Cell imbalance':      imbalanceRaw * 1.3,
      'Aging / cycle life':  agingRaw * 1.5,
      'Low SOC exposure':    lowSocRaw * 0.6,
      'Discharge current':   currentStressRaw * 0.5,
    };
  } else if (target === 'RUL') {
    // RUL is most sensitive to aging + imbalance, then thermal
    weights = {
      'Cell imbalance':      imbalanceRaw * 1.5,
      'Aging / cycle life':  agingRaw * 1.4,
      'Thermal stress':      thermalRaw * 1.0,
      'Low SOC exposure':    lowSocRaw * 0.7,
      'Discharge current':   currentStressRaw * 0.6,
    };
  } else if (target === 'DTE') {
    // DTE (range) is driven by SOC + drive mode + current draw + temperature
    const dte_soc    = clamp(soc * 0.55, 0, 55);
    const dte_mode   = clamp((modeMultiplier - 1) * 60, 0, 25);
    const dte_temp   = clamp(thermalRaw * 0.4, 0, 12);
    const dte_curr   = clamp(currentStressRaw * 0.9, 0, 14);
    const dte_aging  = clamp(agingRaw * 0.4, 0, 10);
    weights = {
      'State of charge (SOC)': dte_soc,
      'Drive mode':             dte_mode,
      'Temperature':            dte_temp,
      'Discharge current':      dte_curr,
      'Aging penalty':          dte_aging,
    };
  } else {
    // Risk Score — highest risk from overdue maintenance + thermal + imbalance + low SOC
    weights = {
      'Thermal stress':      thermalRaw * 1.2,
      'Cell imbalance':      imbalanceRaw * 1.3,
      'Low SOC exposure':    lowSocRaw * 1.0,
      'Aging / cycle life':  agingRaw * 1.0,
      'Discharge current':   currentStressRaw * 0.8,
    };
  }

  const total = Object.values(weights).reduce((s, v) => s + v, 0) || 1;
  return Object.entries(weights)
    .map(([label, value]) => ({
      label,
      percent: Number(((value / total) * 100).toFixed(1))
    }))
    .sort((a, b) => b.percent - a.percent);
}

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
        config: { maxOutputTokens: 80 }
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
