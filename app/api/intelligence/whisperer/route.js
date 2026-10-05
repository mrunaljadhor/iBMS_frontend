import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request) {
  const data = await request.json();
  const question = data.question || '';
  const context = data.liveContext || {};

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      answer: '[Config Error] OPENAI_API_KEY is not set. Go to Vercel → Settings → Environment Variables and add it.',
      citations: []
    });
  }

  const client = new OpenAI({ apiKey });

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
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ],
      temperature: 0.4,
      max_tokens: 250
    });

    return NextResponse.json({
      answer: response.choices[0].message.content,
      citations: [
        { label: 'LLM Provider', detail: 'OpenAI (gpt-4o-mini)' },
        { label: 'Live Telemetry', detail: `SOC ${context.socSlider || 0}% at ${context.temperature || 25}°C` }
      ]
    });
  } catch (error) {
    return NextResponse.json({
      answer: `[OpenAI Error] ${error.message}`,
      citations: []
    });
  }
}
