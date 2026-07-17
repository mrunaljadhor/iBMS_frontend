import { NextResponse } from 'next/server';

const BACKEND_API_URL = (process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

const BATTERY = {
  nominalCapacityAh: 60,
  nominalVoltageV: 63.5,
  ecoConsumptionWhPerKm: 150,
  sportConsumptionWhPerKm: 250,
};

const SAMPLE_FLEET = [
  { id: 'north-17', region: 'Northern Fleet', soh: 78.4, temperature: 39.2, cycles: 1468, voltageDiff: 0.094, maintenance: 'overdue' },
  { id: 'north-23', region: 'Northern Fleet', soh: 81.7, temperature: 36.1, cycles: 1322, voltageDiff: 0.073, maintenance: 'due soon' },
  { id: 'north-31', region: 'Northern Fleet', soh: 83.6, temperature: 34.8, cycles: 1184, voltageDiff: 0.058, maintenance: 'healthy' },
  { id: 'central-08', region: 'Central Fleet', soh: 86.9, temperature: 31.4, cycles: 975, voltageDiff: 0.047, maintenance: 'healthy' },
  { id: 'south-02', region: 'Southern Fleet', soh: 89.3, temperature: 29.7, cycles: 830, voltageDiff: 0.039, maintenance: 'healthy' },
];

const KNOWLEDGE_SNIPPETS = [
  'High temperatures and overdue maintenance usually correlate with elevated battery risk.',
  'Cells with lower SoH and higher cycle counts should be prioritized for inspection.',
  'Voltage imbalance is often an early sign of pack instability under stress.',
  'Fleet risk improves when hot packs are moved back into cooler operating windows.',
  'Rapid cycling combined with heat can accelerate degradation across a group of packs.',
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function calculateDTE(currentSoc, driveMode = 'ECO', env = {}) {
  const {
    baseSoh = 100,
    ambientTempDeltaC = 0,
    avgSpeedKmh = 60,
    accelAggressionPct = 0,
    elevationGrade = 0
  } = env;

  const realSoh = clamp(baseSoh, 0, 100);
  const batteryCapacityWh = (BATTERY.nominalCapacityAh * BATTERY.nominalVoltageV) * (realSoh / 100);
  const availableEnergy = (currentSoc / 100) * batteryCapacityWh;
  
  const baseConsumption = driveMode === 'SPORT' ? BATTERY.sportConsumptionWhPerKm : BATTERY.ecoConsumptionWhPerKm;
  
  const tempPenalty = 1 + Math.max(0, ambientTempDeltaC * 0.005);
  const speedFactor = Math.max(0.5, (avgSpeedKmh / 60.0) ** 2);
  const accelPenalty = 1 + (accelAggressionPct / 100) * 0.2;
  const elevationPenalty = 1 + (elevationGrade > 0 ? elevationGrade * 0.12 : elevationGrade * 0.05);

  const finalConsumptionRate = baseConsumption * speedFactor * accelPenalty * tempPenalty * elevationPenalty;
  
  return availableEnergy / finalConsumptionRate;
}

function parseLatLng(value) {
  if (typeof value !== 'string') return null;
  const [latRaw, lngRaw] = value.split(',').map((part) => Number(part.trim()));
  if (!Number.isFinite(latRaw) || !Number.isFinite(lngRaw)) return null;
  return { lat: latRaw, lng: lngRaw };
}

function haversineKm(origin, destination) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRad(destination.lat - origin.lat);
  const deltaLng = toRad(destination.lng - origin.lng);
  const lat1 = toRad(origin.lat);
  const lat2 = toRad(destination.lat);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function proxyToBackend(pathname, body) {
  if (!BACKEND_API_URL) {
    return null;
  }

  try {
    const response = await fetch(`${BACKEND_API_URL}${pathname}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return null;
    }

    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return null;
  }
}

function regionFromQuestion(question = '') {
  const normalized = String(question).toLowerCase();
  if (normalized.includes('north')) return 'Northern Fleet';
  if (normalized.includes('south')) return 'Southern Fleet';
  if (normalized.includes('central')) return 'Central Fleet';
  return null;
}

function scoreFleetBattery(battery) {
  return (
    (100 - battery.soh) * 0.55 +
    Math.max(0, battery.temperature - 30) * 0.85 +
    Math.max(0, battery.cycles - 900) / 70 +
    battery.voltageDiff * 120 +
    (battery.maintenance === 'overdue' ? 12 : battery.maintenance === 'due soon' ? 6 : 0)
  );
}

function localSampleTelemetry() {
  return {
    SOC: 75,
    temperature: 28,
    voltage: 61.5,
    current: -2.5,
    timestamp: new Date().toISOString(),
  };
}

function localRouteDistance(body = {}) {
  const origin = parseLatLng(body.origin);
  let destination = parseLatLng(body.destination);
  let waypoints = body.waypoints || [];
  
  if (body.roundTrip) {
    waypoints = Array.isArray(waypoints) ? [...waypoints, body.destination] : [waypoints, body.destination];
    destination = origin;
  }

  if (!origin || !destination) {
    throw new Error('Origin and destination must be provided as "lat,lng" strings.');
  }
  
  const parsedWaypoints = (Array.isArray(waypoints) ? waypoints : [waypoints]).map(parseLatLng).filter(Boolean);
  const routePoints = [origin, ...parsedWaypoints, destination];
  
  let totalDistanceKm = 0;
  let legDetails = [];
  
  for (let i = 0; i < routePoints.length - 1; i++) {
    const dist = haversineKm(routePoints[i], routePoints[i+1]);
    totalDistanceKm += dist;
    legDetails.push({
      distance_km: dist,
      duration_minutes: (dist / 35 * 60).toFixed(1)
    });
  }

  const durationMinutes = totalDistanceKm / 35 * 60;

  return {
    origin: body.origin,
    destination: body.destination,
    distance_km: totalDistanceKm.toFixed(2),
    distance_m: Math.round(totalDistanceKm * 1000),
    duration_s: Math.round(durationMinutes * 60),
    duration_minutes: durationMinutes.toFixed(1),
    route_summary: 'Approximate Vercel-side route estimate',
    legs: legDetails,
  };
}

function localFeasibility(body = {}) {
  const currentSoc = Number(body.current_soc ?? 100);
  const routeResult = localRouteDistance(body);
  const totalDistance = Number(routeResult.distance_km);
  const legs = routeResult.legs;
  
  const chargeAtStops = body.chargeAtStops || false;
  
  const envParams = {
    baseSoh: Number(body.baseSoh ?? 100),
    ambientTempDeltaC: Number(body.ambientTempDeltaC ?? 0),
    avgSpeedKmh: Number(body.avgSpeedKmh ?? 60),
    accelAggressionPct: Number(body.accelAggressionPct ?? 0),
    elevationGrade: 0 // Cannot easily fetch elevation on client side fallback without CORS
  };

  const ecoDte = calculateDTE(currentSoc, 'ECO', envParams);
  const sportDte = calculateDTE(currentSoc, 'SPORT', envParams);

  let simulatedSoc = currentSoc;
  let overallStatus = 'SAFE';
  let recommendation = 'Both ECO and SPORT modes available';
  let action = 'MANUAL_MODE';
  let alert = null;
  
  for (let i = 0; i < legs.length; i++) {
    const legDist = legs[i].distance_km;
    const legEcoDte = calculateDTE(simulatedSoc, 'ECO', envParams);
    const legSportDte = calculateDTE(simulatedSoc, 'SPORT', envParams);
    
    if (legDist > legEcoDte) {
      overallStatus = 'IMPOSSIBLE';
      recommendation = `CHARGE REQUIRED - Cannot reach leg ${i+1} in ECO mode`;
      action = 'CHARGE_REQUIRED';
      alert = 'Charge the battery before attempting this route.';
      break;
    } else if (legDist > legSportDte && overallStatus !== 'IMPOSSIBLE') {
      overallStatus = 'CRITICAL';
      recommendation = 'MUST USE ECO MODE - SPORT mode insufficient for route';
      action = 'FORCE_ECO_MODE';
      alert = 'SPORT mode will not be sufficient to reach destination.';
    }
    
    simulatedSoc -= (legDist / legEcoDte) * simulatedSoc;
    if (chargeAtStops && i < legs.length - 1) {
      simulatedSoc = 100;
    }
  }

  return {
    route_distance_km: Number(totalDistance.toFixed(2)),
    feasibility: {
      status: overallStatus,
      eco_dte: ecoDte,
      sport_dte: sportDte,
      safety_margin_eco: ecoDte - totalDistance,
      safety_margin_sport: sportDte - totalDistance,
    },
    amsa_decision: {
      action,
      recommendation,
      alert,
    },
  };
}

function localWhisperer(body = {}) {
  const question = String(body.question || '').trim() || 'fleet risk overview';
  const region = regionFromQuestion(question);
  const fleet = region ? SAMPLE_FLEET.filter((battery) => battery.region === region) : SAMPLE_FLEET;
  const ranked = [...fleet]
    .map((battery) => ({ ...battery, riskScore: Number(scoreFleetBattery(battery).toFixed(1)) }))
    .sort((left, right) => right.riskScore - left.riskScore);
  const top = ranked[0];
  const critical = ranked.filter((battery) => battery.soh < 80);
  const snippets = KNOWLEDGE_SNIPPETS.filter((snippet) => {
    const normalized = question.toLowerCase();
    return normalized.includes('hot') || normalized.includes('risk') || normalized.includes('battery') || normalized.includes('maintenance') ? true : false;
  }).slice(0, 3);

  let answer = `I scanned ${ranked.length} batteries${region ? ` in the ${region.toLowerCase()}` : ''}. `;
  if (top) {
    answer += `${top.id} is the highest-risk unit with ${top.soh.toFixed(1)}% SoH, ${top.temperature.toFixed(1)}°C, and a risk score of ${top.riskScore.toFixed(1)}. `;
  }
  if (critical.length) {
    answer += `${critical.slice(0, 3).map((battery) => battery.id).join(', ')} are already below the 80% SoH threshold and should be prioritized for inspection this week. `;
  }
  answer += 'This Vercel deployment is using a local RAG-style fallback unless an external backend is configured. ';

  return {
    answer,
    confidence: ranked.length ? 'High' : 'Medium',
    citations: [
      { label: 'Knowledge snippets', detail: snippets.join(' ') || 'No matching snippets found' },
      { label: 'Historical fleet logs', detail: `${ranked.length} records scanned from ${region || 'all regions'}; top battery ${top?.id || 'n/a'} is leading the risk ranking` },
      { label: 'Live telemetry', detail: `SOC ${Number(body.liveContext?.socSlider || 0).toFixed(1)}%, temperature ${Number(body.liveContext?.temperature || 0).toFixed(1)}°C, route ${Number(body.liveContext?.routeDistance || 0)} km` },
    ],
    ranked,
  };
}

function localXai(body = {}) {
  const defaults = {
    voltage: 60,
    current: 40,
    temperature: 30,
    cycleCount: 300,
  };

  const featureRow = {
    voltage: Number(body.voltage ?? defaults.voltage),
    current: Number(body.current ?? defaults.current),
    temperature: Number(body.temperature ?? defaults.temperature),
    cycleCount: Number(body.cycleCount ?? defaults.cycleCount),
  };

  const contributions = [
    { label: 'Voltage', value: Math.abs(featureRow.voltage - defaults.voltage) * 3.5, direction: featureRow.voltage < defaults.voltage ? 'increases risk' : 'reduces risk' },
    { label: 'Current', value: Math.abs(featureRow.current - defaults.current) * 1.2, direction: featureRow.current > defaults.current ? 'increases risk' : 'reduces risk' },
    { label: 'Temperature', value: Math.abs(featureRow.temperature - defaults.temperature) * 4.2, direction: featureRow.temperature > defaults.temperature ? 'increases risk' : 'reduces risk' },
    { label: 'Cycle Count', value: Math.abs(featureRow.cycleCount - defaults.cycleCount) / 10, direction: featureRow.cycleCount > defaults.cycleCount ? 'increases risk' : 'reduces risk' },
  ];

  const total = contributions.reduce((sum, item) => sum + item.value, 0) || 1;
  const breakdown = contributions
    .sort((left, right) => right.value - left.value)
    .map((item) => ({
      label: item.label,
      percent: Number(((item.value / total) * 100).toFixed(1)),
      direction: item.direction,
    }));

  const predictedRul = Math.max(0, 2400 - (contributions[0].value * 12) - (featureRow.temperature - 25) * 18 - featureRow.cycleCount * 0.8);

  return {
    signal: `${predictedRul.toFixed(1)} cycles remaining`,
    narrative: `${breakdown[0]?.label || 'Temperature'} is the primary driver in the Vercel fallback explanation.`,
    score: 0.79,
    breakdown,
    prediction: Number(predictedRul.toFixed(1)),
    method: 'Local SHAP-style fallback',
  };
}

function localFederated(body = {}) {
  const rounds = Number(body.rounds || 1);
  const edgeNodes = Math.max(2, Number(body.edgeNodes || 6));
  const clients = Array.from({ length: edgeNodes }, (_, index) => {
    const loss = clamp(22 - rounds * 1.2 - index * 0.6, 5, 40);
    const accuracy = clamp(97.4 - index * 0.1 + rounds * 0.05, 90, 99.5);

    return {
      id: `edge-${index + 1}`,
      loss: Number(loss.toFixed(3)),
      accuracy: Number(accuracy.toFixed(1)),
      uplinkKb: Number((0.3 + index * 0.02).toFixed(1)),
      samples: 2500,
      convergence: Number((1 / (1 + loss)).toFixed(3)),
    };
  });

  const weights = [277.773819, 7.480453, 0.228735, -8.404299, -0.095091];

  return {
    round: rounds,
    edge_nodes: clients.length,
    clients,
    global_accuracy: Number((clients.reduce((sum, item) => sum + item.accuracy, 0) / clients.length).toFixed(1)),
    global_loss: Number((clients.reduce((sum, item) => sum + item.loss, 0) / clients.length).toFixed(3)),
    bandwidth_saved_pct: Math.max(10, 100 - clients.length * 8),
    total_samples: clients.length * 2500,
    algorithm: 'FedAvg',
    weights,
  };
}

function localDigitalTwin(body = {}) {
  const baseSoh = Number(body.baseSoh ?? 85);
  const loadIncreasePct = Number(body.loadIncreasePct ?? 15);
  const ambientTempDeltaC = Number(body.ambientTempDeltaC ?? 6);
  const cycleStressPct = Number(body.cycleStressPct ?? 18);
  const avgSpeedKmh = Number(body.avgSpeedKmh ?? 60);
  const accelAggressionPct = Number(body.accelAggressionPct ?? 10);
  const days = Number(body.days ?? 7);
  const curve = [];

  const baseDegradationRate = 0.5;
  const tempAccel = Math.max(0, ambientTempDeltaC * 0.03);
  const loadAccel = (loadIncreasePct / 10) * 0.02;
  const cycleAccel = (cycleStressPct / 10) * 0.008;
  const accelAccel = (accelAggressionPct / 10) * 0.025;
  const stressMultiplier = 1 + tempAccel + loadAccel + cycleAccel + accelAccel;
  const scenarioDegradationRate = baseDegradationRate * stressMultiplier;

  for (let day = 0; day <= days; day += 1) {
    const baseline = clamp(baseSoh - day * baseDegradationRate, 0, 100);
    const scenario = clamp(baseSoh - day * scenarioDegradationRate, 0, 100);
    curve.push({
      day,
      baseline: Number(baseline.toFixed(1)),
      scenario: Number(scenario.toFixed(1)),
      projectedRul: Number(Math.max(0, (scenario - 70) * 0.6).toFixed(1)),
      degradationRate: Number(scenarioDegradationRate.toFixed(3)),
      avgVoltage: 3.177,
      avgTemperature: Number((33 + ambientTempDeltaC * (0.5 + 0.5 * Math.sin((2 * Math.PI * day) / 7))).toFixed(2)),
      stressMultiplier: Number(stressMultiplier.toFixed(3)),
    });
  }

  const finalScenarioSoh = clamp(baseSoh - days * scenarioDegradationRate, 0, 100);
  
  const speedFactor = Math.max(0.5, (avgSpeedKmh / 60.0) ** 2);
  const accelFactor = 1.0 + (accelAggressionPct / 100.0) * 0.5;
  const nominalConsumption = 150 * (1 + loadIncreasePct / 100.0);
  const scenarioConsumption = 150 * speedFactor * accelFactor * (1 + loadIncreasePct / 100.0);
  
  const scenarioDte = (finalScenarioSoh / 100) * BATTERY.nominalVoltageV * BATTERY.nominalCapacityAh / scenarioConsumption;
  const baselineDte = (baseSoh / 100) * BATTERY.nominalVoltageV * BATTERY.nominalCapacityAh / nominalConsumption;

  return {
    curve,
    projected_dte: Math.max(0, Number(scenarioDte.toFixed(0))),
    baseline_dte: Math.max(0, Number(baselineDte.toFixed(0))),
    dte_delta: Number((baselineDte - scenarioDte).toFixed(1)),
    summary: {
      baseSoh: Number(baseSoh.toFixed(1)),
      finalBaselineSoh: Number(clamp(baseSoh - days * baseDegradationRate, 0, 100).toFixed(1)),
      finalScenarioSoh: Number(finalScenarioSoh.toFixed(1)),
      degradationDelta: Number((days * (scenarioDegradationRate - baseDegradationRate)).toFixed(1)),
      loadIncreasePct,
      ambientTempDeltaC,
      cycleStressPct,
      avgSpeedKmh,
      accelAggressionPct,
      stressMultiplier: Number(stressMultiplier.toFixed(3)),
      degradationRateBaseline: Number(baseDegradationRate.toFixed(3)),
      degradationRateScenario: Number(scenarioDegradationRate.toFixed(3)),
    },
    physics: 'Vercel fallback physics model',
  };
}

export async function respondViaProxyOrLocal(pathname, body, localHandler) {
  const proxied = await proxyToBackend(pathname, body);
  if (proxied) {
    return proxied;
  }

  const result = await localHandler();
  return NextResponse.json(result.data, { status: result.status || 200 });
}

export { calculateDTE, localDigitalTwin, localFederated, localFeasibility, localRouteDistance, localSampleTelemetry, localWhisperer, localXai };