import { respondViaProxyOrLocal, calculateDTE } from '../../_lib/ibms';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  return respondViaProxyOrLocal('/api/predict/dte', body, async () => {
    const currentSoc = Number(body.current_soc ?? 100);
    const driveMode = String(body.drive_mode ?? 'ECO').toUpperCase();

    if (currentSoc < 0 || currentSoc > 100) {
      return {
        status: 400,
        data: { error: 'SOC must be 0-100%' },
      };
    }

    if (!['ECO', 'SPORT'].includes(driveMode)) {
      return {
        status: 400,
        data: { error: 'Drive mode must be ECO or SPORT' },
      };
    }

    const dte = calculateDTE(currentSoc, driveMode);

    return {
      data: {
        current_soc: currentSoc,
        drive_mode: driveMode,
        estimated_range_km: dte.toFixed(2),
        battery_capacity: '60Ah @ 63.5V',
        consumption_rate: `${driveMode === 'SPORT' ? 250 : 150} Wh/km`,
        timestamp: new Date().toISOString(),
      },
    };
  });
}