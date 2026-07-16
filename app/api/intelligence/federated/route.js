import { respondViaProxyOrLocal, localFederated } from '../../_lib/ibms';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  return respondViaProxyOrLocal('/api/intelligence/federated', body, async () => ({
    data: {
      feature: 'federated_learning',
      ...localFederated(body),
      timestamp: new Date().toISOString(),
    },
  }));
}