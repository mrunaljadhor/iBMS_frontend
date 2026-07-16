import { respondViaProxyOrLocal, localDigitalTwin } from '../../_lib/ibms';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  return respondViaProxyOrLocal('/api/intelligence/digital-twin', body, async () => ({
    data: {
      feature: 'digital_twin',
      ...localDigitalTwin(body),
      timestamp: new Date().toISOString(),
    },
  }));
}