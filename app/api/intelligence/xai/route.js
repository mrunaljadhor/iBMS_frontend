import { respondViaProxyOrLocal, localXai } from '../../_lib/ibms';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  return respondViaProxyOrLocal('/api/intelligence/xai', body, async () => ({
    data: {
      feature: 'xai_explainability',
      ...localXai(body),
      timestamp: new Date().toISOString(),
    },
  }));
}