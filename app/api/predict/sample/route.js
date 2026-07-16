import { respondViaProxyOrLocal, localSampleTelemetry } from '../../_lib/ibms';

export async function GET() {
  return respondViaProxyOrLocal('/api/predict/sample', {}, async () => ({
    data: localSampleTelemetry(),
  }));
}

export async function POST() {
  return respondViaProxyOrLocal('/api/predict/sample', {}, async () => ({
    data: localSampleTelemetry(),
  }));
}