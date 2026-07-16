import { respondViaProxyOrLocal, localRouteDistance } from '../../_lib/ibms';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  return respondViaProxyOrLocal('/api/route/geometry', body, async () => {
    try {
      const route = localRouteDistance(body);
      return {
        data: {
          polyline: `${route.distance_m}:${route.duration_s}`,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        status: 400,
        data: { error: error.message },
      };
    }
  });
}