import { respondViaProxyOrLocal, localWhisperer } from '../../_lib/ibms';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  return respondViaProxyOrLocal('/api/intelligence/whisperer', body, async () => ({
    data: {
      feature: 'battery_whisperer',
      ...localWhisperer(body),
      timestamp: new Date().toISOString(),
    },
  }));
}