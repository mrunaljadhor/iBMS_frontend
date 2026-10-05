import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

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

  const systemPrompt = `You are the 'Battery Whisperer', an advanced AI for a motorcycle fleet management dashboard (iBMS).
Your job is to answer the fleet manager's questions based on the live telemetry context provided.
Keep your answers concise, professional, and directly address the risk or status of the batteries.

LIVE FLEET CONTEXT:
- Active Dataset / Mode: ${context.datasetName || 'Unknown'} | ${context.drivingMode || 'ECO'}
- Current SOC: ${context.socSlider || 0}%
- Battery Temperature: ${context.temperature || 25}°C
- Route Distance: ${context.routeDistance || 0} km
- Estimated DTE (Range): ${context.dte || 0} km
Note: Assume there are multiple fleets (Northern, Southern, Central) if asked about them.
High temp (>35C) or low SOC (<20%) is considered risky.`;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            { role: 'user', parts: [{ text: question }] }
        ],
        config: {
            systemInstruction: systemPrompt,
            temperature: 0.4,
            maxOutputTokens: 250,
        }
    });

    return NextResponse.json({
      answer: response.text,
      citations: [
        { label: 'LLM Provider', detail: 'Google Gemini (gemini-2.5-flash)' },
        { label: 'Live Telemetry', detail: `SOC ${context.socSlider || 0}% at ${context.temperature || 25}°C` }
      ]
    });
  } catch (error) {
    return NextResponse.json({
      answer: `[Gemini Error] ${error.message}`,
      citations: []
    });
  }
}
