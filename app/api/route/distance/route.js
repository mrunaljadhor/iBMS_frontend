import { respondViaProxyOrLocal, localRouteDistance } from '../../_lib/ibms';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  return respondViaProxyOrLocal('/api/route/distance', body, async () => {
    try {
      return {
        data: localRouteDistance(body),
      };
    } catch (error) {
      return {
        status: 400,
        data: { error: error.message },
      };
    }
  });
}