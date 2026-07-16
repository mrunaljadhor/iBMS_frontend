import { respondViaProxyOrLocal, localFeasibility } from '../_lib/ibms';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  return respondViaProxyOrLocal('/api/feasibility', body, async () => {
    try {
      return {
        data: localFeasibility(body),
      };
    } catch (error) {
      return {
        status: 400,
        data: { error: error.message },
      };
    }
  });
}