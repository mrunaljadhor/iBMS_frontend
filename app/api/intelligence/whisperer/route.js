import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';

// Data-derived from trinity_ev_dataset.csv — see derive_fleet.py
const FLEET_DATA = [
  { id: 'south-02',   region: 'Southern Fleet', soh: 94.9, temperature: 31.0, cycles: 830,  voltageDiff: 0.0042, maintenance: 'healthy' },
  { id: 'central-08', region: 'Central Fleet',  soh: 93.6, temperature: 32.8, cycles: 975,  voltageDiff: 0.018,  maintenance: 'healthy' },
  { id: 'north-31',   region: 'Northern Fleet', soh: 91.2, temperature: 34.1, cycles: 1184, voltageDiff: 0.0283, maintenance: 'healthy' },
  { id: 'north-23',   region: 'Northern Fleet', soh: 88.5, temperature: 36.1, cycles: 1322, voltageDiff: 0.0437, maintenance: 'due soon' },
  { id: 'north-17',   region: 'Northern Fleet', soh: 86.2, temperature: 38.2, cycles: 1468, voltageDiff: 0.0535, maintenance: 'overdue' },
];

export async function POST(request) {
  const data = await request.json();
  const question = data.question || '';
  const context = data.liveContext || {};

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      answer: '[Config Error] GEMINI_API_KEY is not set. Go to Vercel → Settings → Environment Variables and add it.',
      citations: []
    });
  }

  const ai = new GoogleGenAI({ apiKey });

  // Format fleet table for Gemini
  const fleetTable = FLEET_DATA.map(b =>
    `  - ${b.id} (${b.region}): SoH=${b.soh}%, Temp=${b.temperature}°C, Cycles=${b.cycles}, VoltDiff=${b.voltageDiff}V, Maintenance=${b.maintenance}`
  ).join('\n');

  const systemPrompt = `You are the 'Battery Whisperer', an advanced AI for a motorcycle fleet management dashboard (iBMS).
Your job is to answer the fleet manager's questions based on the live telemetry context and fleet records provided.
Keep your answers concise, professional, and directly address the risk or status of the batteries.
All SoH values were computed using physics-based degradation equations calibrated on the trinity_ev_dataset (1,668 rows of real EV telemetry).

LIVE OPERATOR CONTEXT (current dashboard session):
- Active Dataset / Mode: ${context.datasetName || 'trinity_ev_dataset'} | ${context.drivingMode || 'ECO'}
- Operator SOC slider: ${context.socSlider || 0}%
- Measured Battery Temperature: ${context.temperature || 25}°C
- Route Distance: ${context.routeDistance || 0} km
- Estimated DTE (Range): ${context.dte || 0} km

FLEET RECORDS (data-derived from trinity_ev_dataset.csv):
${fleetTable}

RISK THRESHOLDS:
- SoH < 80% → End of Life (EOL) — retire or replace immediately
- SoH 80–85% → Critical — schedule maintenance urgently
- Temperature > 35°C → Thermal stress zone
- Volt Diff > 0.05V → Dangerous cell imbalance
- Maintenance 'overdue' → Highest priority for action`;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            { role: 'user', parts: [{ text: question }] }
        ],
        config: {
            systemInstruction: systemPrompt,
            temperature: 0.4,
            maxOutputTokens: 300,
            thinkingConfig: { thinkingBudget: 0 }, // gemini-2.5-flash otherwise spends the budget on hidden thinking
        }
    });

    return NextResponse.json({
      answer: response.text,
      citations: [
        { label: 'LLM Provider', detail: 'Google Gemini (gemini-2.5-flash)' },
        { label: 'Live Telemetry', detail: `SOC ${context.socSlider || 0}% at ${context.temperature || 25}°C` },
        { label: 'Fleet Records', detail: `5 batteries from trinity_ev_dataset.csv — highest risk: north-17 (SoH 86.2%, overdue)` }
      ]
    });
  } catch (error) {
    return NextResponse.json({
      answer: `[Gemini Error] ${error.message}`,
      citations: []
    });
  }
}

