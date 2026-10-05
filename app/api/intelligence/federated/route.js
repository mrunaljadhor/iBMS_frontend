import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const data = await request.json();
  const round = data.rounds || 3;
  const edgeNodes = data.edgeNodes || 6;

  // Simulate federated aggregation locally
  const clients = Array.from({ length: edgeNodes }).map((_, index) => {
    const clamp = (val, min, max) => Math.min(max, Math.max(min, val));
    const nodeLoss = clamp(0.8 - (round * 0.04) - (index * 0.03), 0.12, 0.82);
    const nodeAccuracy = clamp(91.8 + (round * 0.72) + (index * 0.18), 90, 98.9);

    return {
      id: `edge-${index + 1}`,
      loss: Number(nodeLoss.toFixed(2)),
      accuracy: Number(nodeAccuracy.toFixed(1)),
      uplinkKb: Number((240 + (index * 18)).toFixed(0))
    };
  });

  const federatedBandwidth = edgeNodes * 185;
  const federatedWeights = edgeNodes * 9;
  const bandwidthSavings = Math.max(0, Math.round(100 - ((federatedWeights / federatedBandwidth) * 100)));

  let signal = `Global model aggregated from ${edgeNodes} nodes in Round ${round}. Bandwidth saved: ${bandwidthSavings}%`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are an AI tracking a Federated Learning process for a motorcycle battery fleet.
Write a 1-sentence technical status report (max 20 words) for Global Round ${round} aggregating ${edgeNodes} edge devices, which achieved ~${clients[0].accuracy}% accuracy and saved ${bandwidthSavings}% bandwidth.`;
      
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
    round,
    clients,
    bandwidthSavings,
    signal
  });
}
