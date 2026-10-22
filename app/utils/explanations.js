// Plain-language explanations behind every number on the dashboard.
// Each builder returns { title, intro, sections } for <ExplainButton />; each section says what the number
// means, the formula in words, the same formula with the current values, and where it lives in the code.
// The formulas mirror the code they point to; if a formula changes there, change it here too.

import { attributionStressTerms, attributionWeights } from './xaiAttributions';

export const PACK = { capacityAh: 30.9, voltageV: 63.5 };                   // backend/server.js CONFIG.BATTERY
export const BASE_CONSUMPTION = { ECO: 25.8, SPORT: 31.6 };                  // backend/server.js CONFIG.CONSUMPTION
export const ROAD_LOAD = { massKg: 155, g: 9.81, crr: 0.012, rho: 1.2, cdaM2: 0.5, auxW: 40, refKmh: 60, minKmh: 5 };
export const FULL_RANGE_KM = { ECO: 76, SPORT: 62 };                         // vehicle display range at 100 % SOC
export const DRIVING_LEVELS = [
  { id: 'level_1', label: 'L1: Optimal', description: 'Normal Braking, Normal Accel', factor: 1.0 },
  { id: 'level_2', label: 'L2: Moderate', description: 'Aggressive Braking, Normal Accel', factor: 1.1 },
  { id: 'level_3', label: 'L3: High Drain', description: 'Normal Braking, Aggressive Accel', factor: 1.25 },
  { id: 'level_4', label: 'L4: Extreme', description: 'Aggressive Braking, Aggressive Accel', factor: 1.4 }
];
export const SPORT_LOCK_SOC = 40;

const n = (value, digits = 1) => {
  const x = Number(value);
  return Number.isFinite(x) ? x.toFixed(digits) : 'n/a';
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Road-load force F(v) in newtons (= energy per metre), exactly as backend/server.js roadLoadPerKm(). */
export function roadLoad(speedKmh) {
  const v = Math.max(ROAD_LOAD.minKmh, speedKmh) / 3.6;
  const rolling = ROAD_LOAD.massKg * ROAD_LOAD.g * ROAD_LOAD.crr;
  const air = 0.5 * ROAD_LOAD.rho * ROAD_LOAD.cdaM2 * v * v;
  const aux = ROAD_LOAD.auxW / v;
  return { rolling, air, aux, total: rolling + air + aux };
}

// ------------------------------------------------------------------ Route physics (AMSA)
export function explainRoutePhysics({ amsa, soh = 100, avgSpeedKmh = 60 }) {
  const p = amsa?.physics_metrics || {};
  const L = Number(amsa?.route_distance_km) || 0;
  const soc = Number(amsa?.decision_soc ?? amsa?.current_soc) || 0;
  const J = Number(p.traffic_jam_ratio) || 0;
  const gu = Number(p.uphill_grade_pct) || 0;
  const gd = Number(p.downhill_grade_pct) || 0;
  const eta = 0.6 + 0.2 * J;

  const packWh = PACK.capacityAh * PACK.voltageV * (soh / 100);
  const availWh = (soc / 100) * packWh;
  const vEff = avgSpeedKmh * (1 - 0.5 * J);
  const Fe = roadLoad(vEff);
  const Fr = roadLoad(ROAD_LOAD.refKmh);
  const speedFactor = Fe.total / Fr.total;
  const fsg = 1 + J * 0.3;
  const fup = 1 + 0.15 * gu;
  const fdn = Math.max(0.2, 1 - 0.08 * gd * eta);
  const product = speedFactor * fsg * fup * fdn;
  const cEco = BASE_CONSUMPTION.ECO * product;
  const cSport = BASE_CONSUMPTION.SPORT * product;
  const dteEco = Number(amsa?.feasibility?.eco_dte);
  const dteSport = Number(amsa?.feasibility?.sport_dte);
  const minSocEco = soc > 0 ? 100 * L / (dteEco * 100 / soc) : NaN;
  const minSocSport = soc > 0 ? 100 * L / (dteSport * 100 / soc) : NaN;
  const margin = Number(amsa?.soc_uncertainty_pct) || 0;

  return {
    title: 'Zero-Cost Physics Engine Math',
    intro: 'Every value in this block is computed by the backend for the route you planned. The backend asks TomTom for the route and live traffic, '
      + 'asks OpenTopoData for the ground height at up to 100 points along the route (SRTM 30 m elevation map), and then turns climb, traffic and speed '
      + 'into how much energy each kilometre costs. Below, each step is shown with its formula and with the numbers of this route.',
    sections: [
      {
        heading: 'Route length', value: `${n(L, 2)} km`,
        meaning: 'Length of the route returned by TomTom for your origin and destination (the backend fetches its own route).',
        source: 'backend/server.js → POST /api/feasibility (TomTom routing)'
      },
      {
        heading: 'Uphill Climb', value: `+${n(p.uphill_climb_meters, 0)} m`,
        meaning: 'Total height gained along the route: every time the next point is higher than the previous one, the difference is added up.',
        formula: ['Uphill climb (m) = sum of all "up" steps between neighbouring route points',
          'Uphill grade (%) = 100 × uphill climb (m) ÷ route length (m)'],
        steps: [`Uphill grade = 100 × ${n(p.uphill_climb_meters, 0)} ÷ ${n(L * 1000, 0)} = ${n(gu, 2)} %`],
        source: 'backend/server.js → /api/feasibility (OpenTopoData loop: uphillClimbMeters, uphillGrade)'
      },
      {
        heading: 'Downhill Descent', value: `−${n(p.downhill_descent_meters, 0)} m`,
        meaning: 'Total height lost along the route (sum of all "down" steps). Going downhill lets regenerative braking put some energy back.',
        formula: ['Downhill grade (%) = 100 × downhill descent (m) ÷ route length (m)'],
        steps: [`Downhill grade = 100 × ${n(p.downhill_descent_meters, 0)} ÷ ${n(L * 1000, 0)} = ${n(gd, 2)} %`],
        source: 'backend/server.js → /api/feasibility (downhillDescentMeters, downhillGrade)'
      },
      {
        heading: 'Traffic Torque Penalty', value: `+${n(p.torque_penalty_pct, 2)} %`,
        meaning: 'Extra energy for stopping and starting in jams. First the traffic-jam share J is found: the part of the route that TomTom marks as a jam '
          + '(or delayed by more than 20 s), divided by the route length. J = 0 means free flow, J = 1 means the whole route is jammed.',
        formula: ['Traffic-jam share J = jammed length ÷ route length   (0 … 1)',
          'Stop-and-go penalty (%) = J × (0.3 + 0.4 × acceleration aggressiveness) × 100',
          'Stop-and-go factor = 1 + J × (0.3 + 0.4 × aggressiveness)'],
        steps: [`J = ${n(J, 3)},  aggressiveness = 0 (normal riding)`,
          `Penalty = ${n(J, 3)} × 0.3 × 100 = ${n(J * 30, 2)} %   →  factor ${n(fsg, 3)}`],
        source: 'backend/server.js → calculateDTE() (stopAndGoPenalty), /api/feasibility (trafficJamRatio, torque_penalty_pct)'
      },
      {
        heading: 'Regenerative Bonus', value: `${n(p.downhill_bonus_pct, 2)} %`,
        meaning: 'Energy saved on descents because the motor works as a generator when braking. Recovery efficiency is 60 % in free flow and rises a little in traffic (more braking).',
        formula: ['Recovery efficiency = 0.6 + 0.2 × J',
          'Regenerative bonus (%) = downhill grade × 0.08 × recovery efficiency × 100',
          'Downhill factor = max(0.2, 1 − downhill grade × 0.08 × recovery efficiency)'],
        steps: [`Recovery efficiency = 0.6 + 0.2 × ${n(J, 3)} = ${n(eta, 2)}`,
          `Bonus = ${n(gd, 2)} × 0.08 × ${n(eta, 2)} × 100 = ${n(gd * 0.08 * eta * 100, 2)} %   →  factor ${n(fdn, 3)}`],
        source: 'backend/server.js → calculateDTE() (regenEfficiency, downhillBonus)'
      },
      {
        heading: 'Energy available in the battery', value: `${n(availWh, 0)} Wh`,
        meaning: 'Usable energy for this trip. A full new pack holds 30.9 Ah × 63.5 V ≈ 1,962 Wh; an aged pack (lower SOH) holds less.',
        formula: ['Energy available (Wh) = SOC/100 × SOH/100 × 30.9 Ah × 63.5 V'],
        steps: [`= ${n(soc, 1)}/100 × ${n(soh, 1)}/100 × 1,962 = ${n(availWh, 0)} Wh`,
          margin > 0 ? `(risk-aware: SOC used = slider SOC − ${n(margin, 1)} = ${n(soc, 1)} %)` : `(SOC used = ${n(soc, 1)} %)`],
        source: 'backend/server.js → calculateDTE() (battery_capacity_wh, available_energy)'
      },
      {
        heading: 'Speed effect (air drag)', value: `× ${n(speedFactor, 3)}`,
        meaning: 'Energy per km depends on speed, mostly through air drag. Traffic lowers the average speed. The force at that speed is compared with the force at 60 km/h, where the base consumption was measured.',
        formula: ['Effective speed = 60 km/h × (1 − 0.5 × J)',
          'Road force F(v) = rolling (m·g·Crr) + air drag (½·ρ·CdA·v²) + accessories (40 W ÷ v)',
          'Speed factor = F(effective speed) ÷ F(60 km/h)'],
        steps: [`Effective speed = 60 × (1 − 0.5 × ${n(J, 3)}) = ${n(vEff, 1)} km/h`,
          `F(${n(vEff, 1)}) = ${n(Fe.rolling, 2)} + ${n(Fe.air, 2)} + ${n(Fe.aux, 2)} = ${n(Fe.total, 2)} N`,
          `F(60) = ${n(Fr.rolling, 2)} + ${n(Fr.air, 2)} + ${n(Fr.aux, 2)} = ${n(Fr.total, 2)} N   (air drag ≈ ${n(100 * Fr.air / Fr.total, 0)} %)`,
          `Speed factor = ${n(Fe.total, 2)} ÷ ${n(Fr.total, 2)} = ${n(speedFactor, 3)}`],
        source: 'backend/server.js → roadLoadPerKm(), ROAD_LOAD (m = 155 kg, Crr = 0.012, ρ = 1.2, CdA = 0.5 m², 40 W)'
      },
      {
        heading: 'Energy per km (consumption)', value: `ECO ${n(cEco, 1)} · SPORT ${n(cSport, 1)} Wh/km`,
        meaning: 'Flat-road consumption of each mode, multiplied by every factor above. 25.8 and 31.6 Wh/km come from the vehicle display range (≈ 76 km ECO, ≈ 62 km SPORT on a full 1,962 Wh pack).',
        formula: ['Consumption = base consumption × speed factor × stop-and-go factor × climb factor × downhill factor × temperature factor',
          'Climb factor = 1 + 0.15 × uphill grade      Temperature factor = 1 (no ambient change)'],
        steps: [`Climb factor = 1 + 0.15 × ${n(gu, 2)} = ${n(fup, 3)}`,
          `ECO   = 25.8 × ${n(speedFactor, 3)} × ${n(fsg, 3)} × ${n(fup, 3)} × ${n(fdn, 3)} = ${n(cEco, 2)} Wh/km`,
          `SPORT = 31.6 × ${n(product, 3)} = ${n(cSport, 2)} Wh/km`],
        source: 'backend/server.js → calculateDTE() (final_consumption_rate), CONFIG.CONSUMPTION'
      },
      {
        heading: 'Range (distance-to-empty)', value: `ECO ${n(dteEco, 1)} · SPORT ${n(dteSport, 1)} km`,
        meaning: 'How far the battery can go on this kind of route in each mode.',
        formula: ['Range (km) = energy available (Wh) ÷ consumption (Wh/km)'],
        steps: [`ECO   = ${n(availWh, 0)} ÷ ${n(cEco, 2)} = ${n(availWh / cEco, 1)} km   (backend: ${n(dteEco, 1)} km)`,
          `SPORT = ${n(availWh, 0)} ÷ ${n(cSport, 2)} = ${n(availWh / cSport, 1)} km   (backend: ${n(dteSport, 1)} km)`,
          'Small differences come from the grades being rounded to 2 decimals in the backend reply.'],
        source: 'backend/server.js → calculateDTE(), checkFeasibility()'
      },
      {
        heading: 'AMSA decision', value: `${amsa?.feasibility?.status || 'n/a'} → ${amsa?.amsa_decision?.action || 'n/a'}`,
        meaning: 'The route is compared with both ranges. If even ECO cannot reach, a charging stop is required; if only ECO reaches, SPORT is locked (ECO-Lock); if SPORT also reaches, the rider is free.',
        formula: ['Route > ECO range              → IMPOSSIBLE  → CHARGE_REQUIRED',
          'SPORT range < route ≤ ECO range → CRITICAL    → FORCE_ECO_MODE (ECO-Lock)',
          'Route ≤ SPORT range            → SAFE        → MANUAL_MODE',
          'Minimum SOC to arrive in a mode = 100 × route ÷ range of that mode at 100 % SOC'],
        steps: [`Route ${n(L, 1)} km vs ECO ${n(dteEco, 1)} km and SPORT ${n(dteSport, 1)} km`,
          `Minimum SOC for ECO ≈ ${n(minSocEco, 1)} %, for SPORT ≈ ${n(minSocSport, 1)} %`],
        source: 'backend/server.js → checkFeasibility() and the leg loop in /api/feasibility; frontend RightMapPanel.js sends the request'
      }
    ]
  };
}

// ------------------------------------------------------------------ Driving profile levels
export function explainDrivingLevels({ soc, mode, level, routeDistance }) {
  const full = FULL_RANGE_KM[mode] || FULL_RANGE_KM.ECO;
  const current = DRIVING_LEVELS.find((l) => l.id === level) || DRIVING_LEVELS[0];
  const range = (f) => Math.round((soc / 100) * (full / f));
  const route = Number(routeDistance) || 0;
  const lockTriggers = route > 0 && current.id !== 'level_1' && range(current.factor) < route && range(1.0) >= route;

  return {
    title: 'Driving Profile Level – how it changes the range',
    intro: 'A driving level describes how hard the rider brakes and accelerates. Harder riding uses more energy per km, so the level divides the range by a factor.',
    sections: [
      {
        heading: 'What each level means',
        meaning: 'L1 Optimal: normal braking and acceleration. L2 Moderate: aggressive braking (energy lost as heat). L3 High Drain: aggressive acceleration (high current). L4 Extreme: both.',
        formula: DRIVING_LEVELS.map((l) => `${l.label.padEnd(16)} energy factor ${n(l.factor, 2)}  (uses ${n((l.factor - 1) * 100, 0)} % more energy per km)`),
        source: 'app/utils/explanations.js → DRIVING_LEVELS (used by ProfessionalDashboard.js)'
      },
      {
        heading: 'Range at this SOC for every level', value: `${current.label}: ${range(current.factor)} km`,
        meaning: `Flat-road range in ${mode} mode. ${mode === 'ECO' ? '76' : '62'} km is the range the vehicle display shows at 100 % SOC in ${mode}.`,
        formula: ['Range (km) = SOC/100 × full-charge range of the mode ÷ level factor   (rounded)'],
        steps: DRIVING_LEVELS.map((l) => `${l.label.padEnd(16)} ${n(soc, 0)}/100 × ${full} ÷ ${n(l.factor, 2)} = ${range(l.factor)} km${l.id === current.id ? '   ← selected' : ''}`),
        source: 'app/components/ProfessionalDashboard.js → estimateRangeAtSoc()'
      },
      {
        heading: 'How the level affects AMSA',
        meaning: 'If a route is planned and the destination is out of reach on the selected level, but reachable on L1, the dashboard forces L1 and shows "AMSA ECO-LOCK ENGAGED". '
          + 'Separately, SPORT is locked below 40 % SOC.',
        formula: ['If range(selected level) < route  AND  range(L1) ≥ route  →  force L1',
          `If SOC < ${SPORT_LOCK_SOC} %  →  SPORT disabled, ECO enforced`],
        steps: route > 0
          ? [`Route ${n(route, 1)} km: selected level ${range(current.factor)} km, L1 ${range(1.0)} km → ${lockTriggers ? 'L1 is forced' : 'no level lock'}`,
            `SOC ${n(soc, 0)} % → ${soc < SPORT_LOCK_SOC ? 'SPORT locked' : 'SPORT allowed by the SOC rule'}`]
          : ['No route planned yet, so the level lock is not active.'],
        source: 'app/components/ProfessionalDashboard.js → useEffect "AMSA 4-Level Logic"'
      },
      {
        heading: 'Note for the route-aware AMSA',
        meaning: 'The route-aware ranges in the Zero-Cost Physics Telemetry block come from the backend, which currently assumes normal riding (acceleration aggressiveness 0). '
          + 'The level therefore changes the flat-road range and the level lock shown here, not the backend ECO/SPORT ranges.',
        source: 'app/components/RightMapPanel.js → /api/feasibility request (no aggressiveness sent)'
      }
    ]
  };
}

// ------------------------------------------------------------------ Route information
export function explainRouteInfo({ routeInfo = {}, soc, dte, socAdjustedDistance, amsa, dteStatus }) {
  const dist = Number(routeInfo.distance) || 0;
  const base = Number(routeInfo.duration) || 0;
  const live = Number(routeInfo.durationInTraffic) || base;
  const delay = Math.max(0, live - base);
  const delayRatio = base > 0 ? delay / base : 0;
  const phi = Number(routeInfo.socAdjustmentFactor) || 0;
  const s = Number(soc) || 0;
  const phiFormula = s >= 70 ? '0 (SOC ≥ 70 %)'
    : s >= 40 ? `(70 − ${s}) ÷ 300 = ${n(phi, 3)}`
      : s >= 20 ? `0.10 + (40 − ${s}) ÷ 160 = ${n(phi, 3)}`
        : `0.23 + (20 − ${s}) ÷ 80 = ${n(phi, 3)}`;

  return {
    title: 'Route Information – where each value comes from',
    intro: 'These values come from the map panel. The route is fetched from the first service that answers (Google Routes, Google Directions, TomTom or OSRM). '
      + 'Traffic and SOC adjustments here are display estimates for the map; the AMSA decision itself uses the backend physics (see "View Engine Math").',
    sections: [
      { heading: 'Route Distance', value: `${n(dist, 1)} km`, meaning: 'Length of the selected route, as returned by the routing service.', source: 'app/components/RightMapPanel.js → route fetch (Google / TomTom / OSRM)' },
      { heading: 'Base ETA', value: `${n(base, 1)} min`, meaning: 'Travel time without traffic, as returned by the routing service.', source: 'RightMapPanel.js → staticMinutes' },
      { heading: 'Live Traffic ETA', value: `${n(live, 1)} min`, meaning: 'Travel time with current traffic (only when the service provides live traffic).', source: 'RightMapPanel.js → trafficMinutes' },
      {
        heading: 'Traffic Delay and severity', value: `+${n(delay, 1)} min`,
        formula: ['Delay (min) = live traffic ETA − base ETA', 'Delay ratio = delay ÷ base ETA',
          'Severity: delay ratio ≥ 0.35 → Heavy;  ≥ 0.15 → Moderate;  otherwise Smooth'],
        steps: [`Delay = ${n(live, 1)} − ${n(base, 1)} = ${n(delay, 1)} min`, `Delay ratio = ${n(delay, 1)} ÷ ${n(base, 1)} = ${n(delayRatio, 2)} → ${routeInfo.severity || 'light'}`],
        source: 'RightMapPanel.js → delayMinutes, trafficSeverityFromDelay()'
      },
      {
        heading: 'Congestion Ratio', value: `${n(routeInfo.congestionRatio || 1, 2)}×`,
        formula: ['Congestion ratio = live traffic ETA ÷ base ETA   (1.0 = no slowdown)'],
        steps: [`= ${n(live, 1)} ÷ ${n(base, 1)} = ${n(base > 0 ? live / base : 1, 2)}`],
        source: 'RightMapPanel.js → congestionRatio'
      },
      {
        heading: 'Traffic Distance', value: `${n(routeInfo.effectiveDistance || dist, 2)} km`,
        meaning: 'An "equivalent" distance that adds the extra effort of slow traffic to the real distance.',
        formula: ['Traffic distance = route distance × (1 + 0.35 × delay ratio)'],
        steps: [`= ${n(dist, 2)} × (1 + 0.35 × ${n(delayRatio, 2)}) = ${n(dist * (1 + 0.35 * delayRatio), 2)} km`],
        source: 'RightMapPanel.js → effectiveDistance'
      },
      {
        heading: 'SOC Impact Factor', value: `+${n(phi * 100, 1)} %`,
        meaning: 'At low charge the rider is advised to ride gently, so the trip is treated as a bit longer and slower. No change above 70 % SOC.',
        formula: ['SOC ≥ 70 %: 0', '40–70 %: (70 − SOC) ÷ 300', '20–40 %: 0.10 + (40 − SOC) ÷ 160', 'below 20 %: 0.23 + (20 − SOC) ÷ 80'],
        steps: [`SOC ${n(s, 0)} % → factor = ${phiFormula}`],
        source: 'RightMapPanel.js → getSocRouteAdjustment()'
      },
      {
        heading: 'SOC-Adjusted Distance and ETA', value: `${n(socAdjustedDistance, 2)} km · ${n(routeInfo.socAdjustedDuration, 1)} min`,
        formula: ['SOC-adjusted distance = traffic distance × (1 + 0.55 × SOC impact factor)', 'SOC-adjusted ETA = live traffic ETA × (1 + SOC impact factor)'],
        steps: [`Distance = ${n(routeInfo.effectiveDistance || dist, 2)} × (1 + 0.55 × ${n(phi, 3)}) = ${n((routeInfo.effectiveDistance || dist) * (1 + 0.55 * phi), 2)} km`,
          `ETA = ${n(live, 1)} × (1 + ${n(phi, 3)}) = ${n(live * (1 + phi), 1)} min`],
        source: 'RightMapPanel.js → applySocToRouteOutputs()'
      },
      {
        heading: 'DTE vs SOC Distance', value: `${n(dte, 0)} km / ${n(socAdjustedDistance, 1)} km`,
        meaning: 'Flat-road range (see Driving Profile Level) next to the SOC-adjusted distance. Without a backend answer, the status is estimated from these two numbers.',
        formula: ['Estimate: range > 1.1 × distance → Safe;  range ≥ 0.8 × distance → Critical;  otherwise Impossible'],
        source: 'app/components/LeftPanel.js → dteStatus'
      },
      {
        heading: 'Routes Evaluated', value: `${routeInfo.alternativesEvaluated || 1}`,
        meaning: 'When the service returns alternative routes, each gets a score and the lowest score is selected (fastest first, then least congested, then shortest).',
        formula: ['Each value is scaled to 0–1 across the alternatives',
          'Score = 0.5 × time + 0.3 × delay ratio + 0.2 × distance   (lowest wins)'],
        source: 'RightMapPanel.js → weightedCandidates (score)'
      },
      { heading: 'Traffic Source', value: routeInfo.routeProvider || 'n/a', meaning: 'Which routing service answered for the map route.', source: 'RightMapPanel.js → routeProvider' },
      {
        heading: 'AMSA rows and Feasibility', value: amsa ? `${amsa.feasibility?.status} → ${amsa.amsa_decision?.action}` : (dteStatus || 'n/a'),
        meaning: 'The AMSA rows (route, climb/descent, jam share, ECO/SPORT range, action) are the backend results explained under "View Engine Math". '
          + 'The backend fetches its own TomTom route, so its distance can differ slightly from the map route.',
        source: 'backend/server.js → /api/feasibility'
      }
    ]
  };
}

// ------------------------------------------------------------------ Battery status (simulated from the SOC slider)
export function explainBatteryStatus({ soc, mode, params }) {
  return {
    title: 'Battery Status – how the values are generated',
    intro: 'In the demo there is no live connection to the vehicle BMS, so these values are generated from the SOC slider with simple curves '
      + 'shaped like the recorded stand-test data (pack around 63 V, small currents, about 30 °C). They are illustrations, not measurements.',
    sections: [
      { heading: 'Voltage', value: `${n(params.voltage, 2)} V`, meaning: 'LiFePO4 pack voltage falls slowly through the middle and fast near empty.',
        formula: ['SOC ≥ 95: 63 + (SOC − 95) × 0.08', '80–95: 61 + (SOC − 80) × 0.2', '50–80: 55 + (SOC − 50) × 0.12', '20–50: 48 + (SOC − 20) × 0.175', '5–20: 40 + (SOC − 5) × 1.6', 'below 5: 38   (limited to 38–63.5 V)'],
        source: 'app/components/LeftPanel.js → calculateBatteryParams()' },
      { heading: 'Current', value: `${n(params.current, 2)} A`, meaning: `Higher in SPORT than in ECO, and a little higher at low charge. Mode now: ${mode}.`,
        formula: ['ECO: 0.3 + (100 − SOC) × 0.003', 'SPORT: 1.2 + (100 − SOC) × 0.006   (limited to 0.1–1.8 A)'],
        steps: [`= ${mode === 'SPORT' ? `1.2 + (100 − ${soc}) × 0.006` : `0.3 + (100 − ${soc}) × 0.003`} = ${n(params.current, 2)} A`] , source: 'LeftPanel.js → calculateBatteryParams()' },
      { heading: 'Power Output', value: `${n(params.power, 3)} kW`, formula: ['Power (kW) = voltage × current ÷ 1000'],
        steps: [`= ${n(params.voltage, 2)} × ${n(params.current, 2)} ÷ 1000 = ${n(params.power, 3)} kW`], source: 'LeftPanel.js → calculateBatteryParams()' },
      { heading: 'Max Temperature', value: `${n(params.temperature, 2)} °C`, meaning: 'Room temperature plus heat from power plus a little extra stress at low charge.',
        formula: ['Temperature = 25 + 3 × power (kW) + 0.04 × (100 − SOC)   (at most 32 °C)'],
        steps: [`= 25 + 3 × ${n(params.power, 3)} + 0.04 × (100 − ${soc}) = ${n(params.temperature, 2)} °C`], source: 'LeftPanel.js → calculateBatteryParams()' },
      { heading: 'Voltage Differential', value: `${n(params.voltDiff, 3)} V`, meaning: 'Difference between the highest and lowest cell (cell imbalance). It grows near full and near empty.',
        formula: ['SOC > 90: 0.04 + (SOC − 90) × 0.008', 'SOC < 15: 0.07 + (15 − SOC) × 0.01', 'otherwise: 0.01 + |SOC − 50| × 0.0015'], source: 'LeftPanel.js → calculateBatteryParams()' }
    ]
  };
}

// ------------------------------------------------------------------ SOH
export function explainSoh({ health, profile, temperatureC, voltageDiffV }) {
  const tempDelta = Math.max(0, Math.abs(temperatureC - profile.nominalTemperatureC) - 0.8);
  const fadePerCycle = profile.cycleFadeTotalAtEol / profile.designCycleLife;
  const totalFade = health.cycleFade + health.calendarFade + health.tempPenalty + health.imbalancePenalty;
  return {
    title: 'State of Health (SOH) – how it is calculated',
    intro: 'SOH is the capacity the battery still has, compared with when it was new (100 % = like new). It is computed with a simple ageing model: '
      + 'start from the initial health and subtract wear from charge cycles, wear from age, and penalties for heat and cell imbalance. '
      + 'The ageing constants are assumed values (not measured on the vehicle).',
    sections: [
      { heading: 'Cycle Wear', value: `${n(health.cycleFade, 2)} %`, meaning: 'Every full charge–discharge cycle wears the cells a little. The battery is assumed to lose 18 % over its rated cycle life.',
        formula: ['Cycle wear (%) = cycles done × (capacity loss at end of life ÷ rated cycle life)'],
        steps: [`= ${profile.cycleCount} × (${profile.cycleFadeTotalAtEol} ÷ ${profile.designCycleLife}) = ${n(health.cycleFade, 2)} %`],
        source: 'app/utils/batteryHealth.js → calculateBatteryHealthMetrics() (cycleFade); constants in app/utils/trinityDatasetProfile.js' },
      { heading: 'Calendar Aging', value: `${n(health.calendarFade, 2)} %`, meaning: 'Cells also age with time, even when not used.',
        formula: ['Calendar ageing (%) = battery age (years) × loss per year'],
        steps: [`= ${profile.batteryAgeYears} × ${profile.calendarFadePerYear} = ${n(health.calendarFade, 2)} %`], source: 'batteryHealth.js (calendarFade)' },
      { heading: 'Temp Impact', value: `${n(health.tempPenalty, 2)} %`, meaning: 'Running away from the normal temperature stresses the cells. A small band of ±0.8 °C is ignored.',
        formula: ['Temperature gap = max(0, |temperature − normal temperature| − 0.8)', 'Temperature penalty (%) = 0.28 × temperature gap   (at most 4.5)'],
        steps: [`Gap = max(0, |${n(temperatureC, 2)} − ${n(profile.nominalTemperatureC, 2)}| − 0.8) = ${n(tempDelta, 2)} °C`, `Penalty = 0.28 × ${n(tempDelta, 2)} = ${n(health.tempPenalty, 2)} %`],
        source: 'batteryHealth.js (tempPenalty)' },
      { heading: 'Imbalance', value: `${n(health.imbalancePenalty, 2)} %`, meaning: 'If cells drift apart in voltage, the weakest cell limits the pack. Up to 0.01 V above the normal spread is ignored.',
        formula: ['Imbalance penalty (%) = max(0, voltage spread − (normal spread + 0.01 V)) ÷ 0.08 × 7.5   (at most 7.5)'],
        steps: [`= max(0, ${n(voltageDiffV, 3)} − ${n(profile.nominalVoltDiffV + 0.01, 3)}) ÷ 0.08 × 7.5 = ${n(health.imbalancePenalty, 2)} %`],
        source: 'batteryHealth.js (imbalancePenalty)' },
      { heading: 'State of Health', value: `${n(health.soh, 1)} %`,
        formula: ['SOH = initial health − cycle wear − calendar ageing − temperature penalty − imbalance penalty', 'Capacity fade = sum of the four parts (the donut chart)'],
        steps: [`SOH = ${profile.baselineSoh} − ${n(health.cycleFade, 2)} − ${n(health.calendarFade, 2)} − ${n(health.tempPenalty, 2)} − ${n(health.imbalancePenalty, 2)} = ${n(health.soh, 1)} %`,
          `Capacity fade = ${n(totalFade, 1)} %`],
        source: 'batteryHealth.js → soh; displayed in app/components/LeftPanel.js (SOH card and donut)' },
      { heading: 'Where SOH is used', meaning: 'The same SOH is sent to the AMSA backend, where it scales the usable energy of the pack (Energy available = SOC × SOH × 1,962 Wh).',
        source: 'app/components/RightMapPanel.js → baseSoh in the /api/feasibility request' }
    ]
  };
}

// ------------------------------------------------------------------ RUL
export function explainRul({ health, profile, eol, rul, best, worst }) {
  const cyclesPerYear = profile.cycleCount / profile.batteryAgeYears;
  const cycleFadePerYear = (profile.cycleFadeTotalAtEol / profile.designCycleLife) * cyclesPerYear;
  const stress = 1 + health.tempPenalty * 0.04 + health.imbalancePenalty * 0.03;
  return {
    title: 'Remaining Useful Life (RUL) – how it is calculated',
    intro: 'RUL is how many years are left until the battery reaches its end-of-life health (the EOL limit, 80 % by default). '
      + 'It divides the health still available above that limit by how fast health is being lost per year.',
    sections: [
      { heading: 'Cycles per year', value: n(cyclesPerYear, 0), formula: ['Cycles per year = cycles done ÷ battery age'],
        steps: [`= ${profile.cycleCount} ÷ ${profile.batteryAgeYears} = ${n(cyclesPerYear, 0)}`], source: 'app/utils/batteryHealth.js (avgCyclesPerYear)' },
      { heading: 'Health lost per year', value: `${n(health.yearlyDegradation, 3)} %/yr`,
        meaning: 'Ageing per year from time plus from cycling, increased a little when the battery is hot or imbalanced.',
        formula: ['Cycle wear per year = (18 % ÷ rated cycle life) × cycles per year',
          'Stress multiplier = 1 + 0.04 × temperature penalty + 0.03 × imbalance penalty',
          'Health lost per year = (calendar loss per year + cycle wear per year) × stress multiplier   (limited to 0.6–3.6)'],
        steps: [`Cycle wear per year = (${profile.cycleFadeTotalAtEol} ÷ ${profile.designCycleLife}) × ${n(cyclesPerYear, 1)} = ${n(cycleFadePerYear, 3)} %`,
          `Stress multiplier = 1 + 0.04 × ${n(health.tempPenalty, 2)} + 0.03 × ${n(health.imbalancePenalty, 2)} = ${n(stress, 3)}`,
          `Health lost per year = (${profile.calendarFadePerYear} + ${n(cycleFadePerYear, 3)}) × ${n(stress, 3)} = ${n(health.yearlyDegradation, 3)} %/yr`],
        source: 'batteryHealth.js (yearlyDegradation)' },
      { heading: 'Years Remaining', value: `${n(rul, 1)} yrs`, formula: ['RUL (years) = (SOH − EOL limit) ÷ health lost per year'],
        steps: [`= (${n(health.soh, 1)} − ${eol}) ÷ ${n(health.yearlyDegradation, 3)} = ${n(rul, 1)} years`], source: 'app/components/LeftPanel.js (dynamicRul)' },
      { heading: 'Range', value: `${n(worst, 1)} – ${n(best, 1)} yrs`, meaning: 'A simple ±15 % band on the ageing speed, to show the uncertainty.',
        formula: ['Shortest = (SOH − EOL) ÷ (1.15 × health lost per year)', 'Longest = (SOH − EOL) ÷ (0.85 × health lost per year)'],
        source: 'LeftPanel.js (worstCaseRul, bestCaseRul)' },
      { heading: 'Degradation Trajectory and EOL slider', meaning: 'The line drops by "health lost per year" every year from today until it meets the red EOL line. '
          + 'Moving the slider changes the EOL limit (60–85 %) and therefore the years remaining.',
        formula: ['SOH in year t = SOH today − t × health lost per year'], source: 'LeftPanel.js (projectionData, customEol)' }
    ]
  };
}

// ------------------------------------------------------------------ SHAP attributions
export function explainShap({ inputs, target, attributions = [], fromApi }) {
  const t = attributionStressTerms(inputs);
  const w = attributionWeights(inputs, target);
  const total = Object.values(w).reduce((s, v) => s + v, 0) || 1;
  const targetWeights = {
    SoH: 'thermal × 1.0, imbalance × 1.3, ageing × 1.5, low SOC × 0.6, current × 0.5',
    RUL: 'imbalance × 1.5, ageing × 1.4, thermal × 1.0, low SOC × 0.7, current × 0.6',
    DTE: 'SOC: 0.55 × SOC (≤ 55); drive mode: (mode factor − 1) × 60 (≤ 25); temperature: 0.4 × thermal (≤ 12); current: 0.9 × current stress (≤ 14); ageing: 0.4 × ageing (≤ 10)',
    'Risk Score': 'thermal × 1.2, imbalance × 1.3, low SOC × 1.0, ageing × 1.0, current × 0.8'
  };
  return {
    title: `SHAP Attributions – ${target}`,
    intro: 'The bars show how much each battery condition contributes to the selected result (they always add up to 100 %). '
      + 'They are computed with simple, transparent rules in the same spirit as SHAP (share of each feature in the explanation). '
      + 'The true SHAP analysis was run offline on the LSTM SOC model and is summarised at the end.',
    sections: [
      { heading: 'Inputs used now',
        steps: [`Temperature ${n(inputs.temperature, 2)} °C · SOC ${n(inputs.soc, 0)} % · cycles ${inputs.cycleCount} · cell voltage spread ${n(inputs.voltageDiff, 3)} V · current ${n(inputs.current, 2)} A · mode ${inputs.drivingMode}`],
        source: 'app/components/AdvancedIntelligenceSuite.js → request to /api/intelligence/xai' },
      { heading: 'Basic stress scores',
        formula: ['Thermal = 12 × min(4.5, 0.28 × max(0, |temperature − 25| − 0.8))',
          'Imbalance = 10 × min(7.5, max(0, spread − 0.006) ÷ 0.08 × 7.5) + min(3, 0.4 × cycles ÷ 500)',
          'Low SOC = 22 × (20 − SOC) ÷ 20 if SOC < 20, else 0.04 × (100 − SOC) kept between 1 and 6',
          'Ageing = 12 + cycles ÷ 420',
          'Current = min(12, 0.8 × |current|)'],
        steps: [`Thermal ${n(t.thermalRaw, 2)} · Imbalance ${n(t.imbalanceRaw, 2)} · Low SOC ${n(t.lowSocRaw, 2)} · Ageing ${n(t.agingRaw, 2)} · Current ${n(t.currentStressRaw, 2)}`],
        source: 'app/utils/xaiAttributions.js → attributionStressTerms()' },
      { heading: `Weights for ${target}`, meaning: 'Each result depends on the conditions differently, so each score is multiplied by a weight for the selected result.',
        formula: [targetWeights[target] || ''],
        steps: Object.entries(w).map(([label, value]) => `${label}: ${n(value, 2)}`),
        source: 'app/utils/xaiAttributions.js → attributionWeights()' },
      { heading: 'Percentages on the bars',
        formula: ['Share (%) = weighted score of the factor ÷ sum of all weighted scores × 100'],
        steps: Object.entries(w).map(([label, value]) => `${label}: ${n(value, 2)} ÷ ${n(total, 2)} × 100 = ${n(100 * value / total, 1)} %`)
          .concat(fromApi ? [] : ['(The server was not reachable, so the card shows a simpler local version of these shares.)']),
        source: 'app/utils/xaiAttributions.js → computeAttributions(); text summary by Gemini in app/api/intelligence/xai/route.js' },
      { heading: 'True SHAP on the LSTM SOC model (offline experiment)',
        meaning: 'SHAP (expected gradients) was computed on the trained LSTM with 200 background windows. It shows which inputs the network uses to estimate SOC.',
        steps: ['Voltage 96.1 % (synthetic test) / 92.8 % (stand-test data)', 'Current ≈ 3 %   ·   Temperature 0.9 % / 4.2 %',
          'Last 10 of the 50 time steps carry 64.6 % / 71.1 % of the attribution → the model mostly reads the recent voltage'],
        source: 'experiments/exp678_edge_shap_fl/run_exp678.py (Exp 7)' }
    ]
  };
}

// ------------------------------------------------------------------ SOC uncertainty
export function explainSocUncertainty({ soc, margin, riskAware, amsa }) {
  const lb = Math.max(0, soc - margin);
  return {
    title: 'SOC Uncertainty – what the numbers mean',
    intro: 'Any SOC estimate can be wrong. To be safe, AMSA can decide using a lower bound of the SOC: a value that the real SOC is above 95 % of the time. '
      + 'The calibration numbers below come from an offline experiment on the public CALCE LiFePO4 battery data.',
    sections: [
      { heading: 'Estimate μ', value: `${n(soc, 1)} %`, meaning: 'The SOC estimate. In this demo it is the SOC slider (the LSTM is not yet connected live to the vehicle).', source: 'app/components/AdvancedIntelligenceSuite.js (socEstimate)' },
      { heading: 'Uncertainty margin', value: `${n(margin, 1)} points`,
        meaning: 'How far below the estimate the safe lower bound sits. Default 7.8 = the average calibrated margin found offline (median 6.6, 95th percentile 18.0).',
        formula: ['The LSTM is run 30 times with dropout switched on → average μ and spread σ',
          'Safety factor q = chosen on calibration data so that the true SOC is below μ − q × σ only 5 % of the time',
          'Margin = q × σ'],
        source: 'experiments/exp2_calce_lfp/run_exp10_uq.py (Exp 10); slider in AdvancedIntelligenceSuite.js' },
      { heading: 'Lower bound SOC_lb', value: `${n(lb, 1)} %`, formula: ['Lower bound = estimate − margin   (not below 0)'],
        steps: [`= ${n(soc, 1)} − ${n(margin, 1)} = ${n(lb, 1)} %`], source: 'AdvancedIntelligenceSuite.js (socLowerBound)' },
      { heading: 'Raw dropout 95 % interval: 83.5 %', meaning: 'Without calibration, a range that should contain the true SOC 95 % of the time only did so 83.5 % of the time – the model was over-confident.', source: 'Exp 10 results' },
      { heading: 'Conformal 95 % interval: 96.6 %', meaning: 'After calibration the range contained the true SOC 96.6 % of the time, as intended.', source: 'Exp 10 results' },
      { heading: 'Unsafe acceptances 0.71 → 0.007 %', meaning: 'How often AMSA accepted a trip that was actually impossible: 0.71 % when deciding on the estimate, 0.007 % when deciding on the lower bound (eight routes, CALCE test data).', source: 'Exp 10 results' },
      { heading: 'False refusals 1.59 → 8.15 %', meaning: 'The price of safety: more trips that were possible are refused (charge first).', source: 'Exp 10 results' },
      { heading: 'Current route decision', value: amsa ? `${amsa.feasibility?.status} → ${amsa.amsa_decision?.action}` : 'no route',
        meaning: riskAware ? 'Risk-aware AMSA is ON: the backend decides on SOC − margin.' : 'Risk-aware AMSA is OFF: the backend decides on the estimate itself.',
        formula: ['Decision SOC = estimate − margin (risk-aware ON)   or   estimate (OFF)'],
        steps: amsa ? [`Decision SOC = ${n(amsa.decision_soc, 1)} %`] : [],
        source: 'backend/server.js → /api/feasibility (soc_uncertainty_pct, decision_soc)' }
    ]
  };
}

// ------------------------------------------------------------------ Digital twin
export function explainDigitalTwin(v) {
  return {
    title: 'Digital Twin Simulator – how the what-if numbers are calculated',
    intro: 'The simulator answers "what if the conditions change?" with simple rules. It is separate from the route-aware AMSA backend: '
      + 'it starts from the current flat-road range and SOH and applies a penalty for each slider.',
    sections: [
      { heading: 'Energy Penalty', value: `${v.energyPenaltyPct > 0 ? '+' : ''}${v.energyPenaltyPct} %`,
        meaning: 'How much more energy per km the chosen conditions cost compared with normal riding.',
        formula: ['Speed factor = max(0.5, (speed ÷ 60)²)', 'Acceleration factor = 1 + 0.5 × acceleration aggression',
          'Regen factor = 1 − 0.2 × braking aggression', 'Total = speed × accel × regen × (1 + 0.0005 × payload) × (1 + 0.05 × slope) × (1 + 0.004 × temperature rise)',
          'Energy penalty (%) = (total − 1) × 100'],
        steps: [`Speed ${n(v.speedFactor, 3)} × accel ${n(v.accelFactor, 3)} × regen ${n(v.regenBonus, 3)} × payload ${n(1 + v.payloadWeightKg * 0.0005, 3)} × slope ${n(1 + v.terrainGradientPct * 0.05, 3)} × temp ${n(1 + v.ambientTempDeltaC * 0.004, 3)} = ${n(v.consumptionPenalty, 3)}`],
        source: 'app/components/AdvancedIntelligenceSuite.js (consumptionPenalty, energyPenaltyPct)' },
      { heading: 'Projected DTE', value: `${v.projectedDte} km`, formula: ['Projected range = current flat-road range ÷ total penalty'],
        steps: [`= ${v.baseDte} ÷ ${n(v.consumptionPenalty, 3)} = ${v.projectedDte} km`], source: 'AdvancedIntelligenceSuite.js (projectedDte)' },
      { heading: 'Feasibility banner', value: v.feasibilityStatus,
        formula: ['Projected range < route → CRITICAL', 'Projected range < 1.2 × route → MARGINAL', 'otherwise → SAFE'],
        steps: [`${v.projectedDte} km vs route ${v.twinDistance} km`], source: 'AdvancedIntelligenceSuite.js (feasibilityStatus)' },
      { heading: 'Projected RUL', value: `${n(v.projectedRul, 1)} yrs`,
        meaning: 'Health is assumed to fall faster under harsher conditions.',
        formula: ['Stress = 1 + 0.0008 × payload + 0.032 × temp rise + 0.08 × slope + 0.015 × fast-charge % + 0.0025 × accel % + 0.0015 × braking %',
          'Daily health loss = 0.0085 × (100 − SOH) × stress   (0.05–0.75 % per day)', 'Projected RUL = (SOH − EOL) ÷ (daily loss × 365)   (0–15 years)'],
        steps: [`Daily loss = 0.0085 × (100 − ${n(v.baseSoh, 1)}) × stress = ${n(v.scenarioDailyDrop, 3)} %/day`,
          `RUL = (${n(v.baseSoh, 1)} − ${v.eol}) ÷ (${n(v.scenarioDailyDrop, 3)} × 365) = ${n(v.projectedRul, 1)} years`],
        source: 'AdvancedIntelligenceSuite.js (scenarioDailyDrop, projectedRul)' },
      { heading: 'DTE Impact Tornado Chart', meaning: 'Each bar is the change in range caused by one slider alone (negative = less range).',
        formula: ['Impact of a factor = round(range ÷ that factor) − range'],
        steps: v.tornado.map((t) => `${t.name}: ${t.impact} km`), source: 'AdvancedIntelligenceSuite.js (tornadoData)' },
      { heading: 'SOH and RUL projection horizon', meaning: 'Seven-day curves: the blue/green lines keep today\'s ageing speed, the orange/red lines use the what-if stress.',
        formula: ['Baseline SOH(day) = SOH − daily loss × day', 'What-if SOH(day) = SOH − daily loss × stress × day − 0.001 × payload − 0.12 × temp rise'],
        source: 'AdvancedIntelligenceSuite.js → buildDigitalTwinCurve()' }
    ]
  };
}
