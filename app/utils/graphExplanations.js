// Explanations for the graphs in the Analyst view (opened with the small "i" icon on each graph).
// Each builder returns { title, intro, sections } for <ExplainButton compact />.
// The formulas mirror the chart code named under "Where in the code".

const n = (value, digits = 1) => {
  const x = Number(value);
  return Number.isFinite(x) ? x.toFixed(digits) : 'n/a';
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function graphDegradation({ health }) {
  const parts = [['Calendar Aging', health.calendarFade], ['Cycle Aging', health.cycleFade],
    ['Thermal Stress', health.tempPenalty], ['Cell Imbalance', health.imbalancePenalty]];
  const total = parts.reduce((s, [, v]) => s + (Number(v) || 0), 0) || 1;
  return {
    title: 'Graph: Degradation Contribution',
    intro: 'This ring shows which causes have taken health away from the battery. Each slice is one cause; the size of the slice is its share of the total health lost.',
    sections: [
      { heading: 'What each slice is',
        meaning: 'Calendar ageing (loss with time), cycle ageing (loss from charge cycles), thermal stress (running too hot or cold) and cell imbalance (cells drifting apart). These are the same four terms that are subtracted in the SOH calculation.',
        source: 'app/utils/batteryHealth.js → calculateBatteryHealthMetrics()' },
      { heading: 'Values now', formula: ['Slice share (%) = that cause ÷ sum of all four × 100'],
        steps: parts.map(([name, v]) => `${name}: ${n(v, 2)} % of health → ${n(100 * (Number(v) || 0) / total, 1)} % of the ring`),
        source: 'app/components/OverviewAnalyticsPanel.js → degradationData' },
      { heading: 'How to read it', meaning: 'A large cycle or calendar slice means normal ageing. A visible thermal or imbalance slice means the operating conditions are hurting the battery and can be improved (cooling, balancing).' }
    ]
  };
}

export function graphRouteUtilization({ routeDistance, dte }) {
  const pct = dte > 0 && routeDistance > 0 ? Math.min(100, (routeDistance / dte) * 100) : 0;
  return {
    title: 'Graph: Route Utilization',
    intro: 'This ring shows how much of the available range the planned route would use, and how much would be left over.',
    sections: [
      { heading: 'Charge Utilized', value: `${n(pct, 1)} %`,
        formula: ['Charge utilized (%) = route distance ÷ flat-road range × 100   (at most 100)', 'Charge reserved (%) = 100 − charge utilized'],
        steps: [`= ${n(routeDistance, 1)} km ÷ ${n(dte, 0)} km × 100 = ${n(pct, 1)} %`],
        source: 'app/components/OverviewAnalyticsPanel.js → routeUtilizationData' },
      { heading: 'Which range is used', meaning: 'The flat-road range of the selected mode and driving level (SOC × 76 or 62 km ÷ level factor). It does not include hills; the route-aware check is the AMSA decision in the User view.',
        source: 'app/components/ProfessionalDashboard.js → estimateRangeAtSoc()' },
      { heading: 'How to read it', meaning: 'Near 100 % means the trip uses almost the whole battery, with little safety reserve. 100 % means the route is longer than the range.' }
    ]
  };
}

export function graphStressFactors({ health, temperatureC, voltageDiffV, soc, profile }) {
  return {
    title: 'Graph: Health Stress Factors',
    intro: 'Three bars showing how much the current operating conditions are stressing the battery (in % of health). Zero means no stress from that factor.',
    sections: [
      { heading: 'Thermal', value: n(health.tempPenalty, 2),
        formula: ['Thermal = 0.28 × max(0, |temperature − normal temperature| − 0.8)   (at most 4.5)'],
        steps: [`= 0.28 × max(0, |${n(temperatureC, 2)} − ${n(profile.nominalTemperatureC, 2)}| − 0.8) = ${n(health.tempPenalty, 2)}`],
        source: 'app/utils/batteryHealth.js (tempPenalty)' },
      { heading: 'Imbalance', value: n(health.imbalancePenalty, 2),
        formula: ['Imbalance = max(0, cell voltage spread − (normal spread + 0.01)) ÷ 0.08 × 7.5   (at most 7.5)'],
        steps: [`= max(0, ${n(voltageDiffV, 3)} − ${n(profile.nominalVoltDiffV + 0.01, 3)}) ÷ 0.08 × 7.5 = ${n(health.imbalancePenalty, 2)}`],
        source: 'app/utils/batteryHealth.js (imbalancePenalty)' },
      { heading: 'Low SOC', value: n(health.lowSocPenalty, 2),
        meaning: 'Sitting at very low charge stresses LiFePO4 cells. Zero above 20 % SOC.',
        formula: ['Low SOC = 1.4 × (20 − SOC) ÷ 20 if SOC < 20, plus 0.8 × (10 − SOC) ÷ 10 if SOC < 10'],
        steps: [`SOC ${n(soc, 1)} % → ${n(health.lowSocPenalty, 2)}`], source: 'app/utils/batteryHealth.js (lowSocPenalty)' },
      { heading: 'Inputs on this chart', meaning: 'Temperature and cell spread come from the dataset reading when one is loaded; otherwise they are estimated from SOC and mode (temperature = 25 + 0.04 × (100 − SOC) + 1.4 in SPORT or 0.6 in ECO).',
        source: 'app/components/OverviewAnalyticsPanel.js (liveTemperature, liveVoltDiff)' }
    ]
  };
}

export function graphModeEfficiency({ soc }) {
  const eco = Math.round((soc / 100) * 76);
  const sport = Math.round((soc / 100) * 62);
  return {
    title: 'Graph: Mode Efficiency Comparison',
    intro: 'Compares ECO and SPORT mode: how far each can go at the current SOC, and how much energy each uses per km.',
    sections: [
      { heading: 'Range (km)', value: `ECO ${eco} · SPORT ${sport}`,
        formula: ['Range = SOC/100 × full-charge range of the mode   (ECO 76 km, SPORT 62 km)'],
        steps: [`ECO = ${n(soc, 1)}/100 × 76 = ${eco} km`, `SPORT = ${n(soc, 1)}/100 × 62 = ${sport} km`],
        source: 'app/components/OverviewAnalyticsPanel.js → efficiencyData' },
      { heading: 'Consumption (Wh/km)', value: 'ECO 25.8 · SPORT 31.6',
        meaning: 'Energy per km on a flat road at 60 km/h, obtained by dividing the full pack energy (30.9 Ah × 63.5 V ≈ 1,962 Wh) by the display ranges.',
        formula: ['ECO = 1,962 Wh ÷ 76 km ≈ 25.8 Wh/km', 'SPORT = 1,962 Wh ÷ 62 km ≈ 31.6 Wh/km'],
        source: 'backend/server.js → CONFIG.CONSUMPTION' },
      { heading: 'How to read it', meaning: 'SPORT gives more power but uses about 22 % more energy per km, so its range is about 18 % shorter. This chart is for a flat road at level L1; hills and traffic are handled by the route-aware AMSA.' }
    ]
  };
}

export function graphOperatingEnvelope({ temperatureC, voltageDiffV, mode, soc }) {
  return {
    title: 'Graph: Operating Envelope',
    intro: 'A radar chart that places four operating values on a common 0–100 scale, so you can see at a glance which one is close to its limit. A larger shape means the battery is working harder.',
    sections: [
      { heading: 'Temp', value: n(Math.min(100, (temperatureC / 45) * 100), 0),
        formula: ['Temp score = temperature ÷ 45 °C × 100   (45 °C taken as the upper limit)'],
        steps: [`= ${n(temperatureC, 2)} ÷ 45 × 100`], source: 'app/components/OverviewAnalyticsPanel.js → envelopeData' },
      { heading: 'Volt Diff', value: n(Math.min(100, (voltageDiffV / 0.15) * 100), 0),
        formula: ['Volt-diff score = cell voltage spread ÷ 0.15 V × 100   (0.15 V taken as the limit)'],
        steps: [`= ${n(voltageDiffV, 3)} ÷ 0.15 × 100`], source: 'OverviewAnalyticsPanel.js → envelopeData' },
      { heading: 'Power', value: mode === 'SPORT' ? '85' : '45',
        meaning: 'A fixed indicator of the mode: 85 for SPORT and 45 for ECO. It is not a measured power.',
        source: 'OverviewAnalyticsPanel.js → envelopeData' },
      { heading: 'SOC', value: n(soc, 0), meaning: 'The state of charge itself (already on a 0–100 scale).', source: 'OverviewAnalyticsPanel.js → envelopeData' }
    ]
  };
}

export function graphRulComparison({ rul }) {
  return {
    title: 'Graph: RUL Projection Comparison',
    intro: "Compares the battery's remaining useful life with a reference battery.",
    sections: [
      { heading: 'Current', value: `${n(rul, 1)} years`,
        meaning: 'Remaining useful life of this battery, from the ageing model (see the RUL card for the full calculation).',
        formula: ['RUL = (SOH − end-of-life limit 80 %) ÷ health lost per year'], source: 'app/utils/batteryHealth.js → rulYears' },
      { heading: 'Baseline', value: '10 years',
        meaning: 'A fixed reference value of 10 years, used only for comparison. It is an assumed typical figure, not a calculated one.',
        source: 'app/components/OverviewAnalyticsPanel.js → rulComparisonData' },
      { heading: 'How to read it', meaning: 'If the orange bar is taller than the green one, the battery is ageing more slowly than the reference; shorter means faster ageing.' }
    ]
  };
}

export function graphSohGauge({ soh, eol }) {
  return {
    title: 'Graph: SOH gauge',
    intro: 'The ring fills in proportion to the state of health; the colour shows how healthy the battery is.',
    sections: [
      { heading: 'Fill', value: `${n(soh, 1)} %`, formula: ['Filled part of the ring = SOH ÷ 100 × full circle'],
        source: 'app/components/LeftPanel.js (SOH card, SVG circle)' },
      { heading: 'Colour', formula: ['≥ 95 % green · 85–95 % blue · 80–85 % amber · below 80 % red'],
        meaning: `Red means the battery is below its end-of-life limit (${eol} %).`, source: 'LeftPanel.js → getSOHColor()' }
    ]
  };
}

export function graphSohDonut({ health }) {
  const fade = health.cycleFade + health.calendarFade + health.tempPenalty + health.imbalancePenalty;
  return {
    title: 'Graph: Capacity Fade breakdown',
    intro: 'The small ring next to the SOH gauge splits the lost capacity into its causes. Slices that are zero are hidden.',
    sections: [
      { heading: 'Capacity Fade', value: `${n(fade, 1)} %`,
        formula: ['Capacity fade = cycle wear + calendar ageing + temperature penalty + imbalance penalty'],
        steps: [`= ${n(health.cycleFade, 2)} + ${n(health.calendarFade, 2)} + ${n(health.tempPenalty, 2)} + ${n(health.imbalancePenalty, 2)} = ${n(fade, 1)} %`],
        source: 'app/components/LeftPanel.js → donutData' },
      { heading: 'Why SOH + fade is not exactly 100', meaning: 'SOH starts from the initial health of the pack (98.6 %, not 100 %), so SOH + capacity fade = initial health.' }
    ]
  };
}

export function graphRulTrajectory({ soh, eol, rate, rul }) {
  return {
    title: 'Graph: Degradation Trajectory',
    intro: 'The blue line shows how the health is expected to fall year by year; the red dashed line is the end-of-life limit. Where they meet is the end of useful life.',
    sections: [
      { heading: 'Blue line', formula: ['SOH in year t = SOH today − t × health lost per year   (not below the limit)'],
        steps: [`= ${n(soh, 1)} − t × ${n(rate, 3)}`], source: 'app/components/LeftPanel.js → projectionData' },
      { heading: 'Red dashed line', value: `${eol} %`, meaning: 'The end-of-life limit chosen with the slider (default 80 %).', source: 'LeftPanel.js (activeEol)' },
      { heading: 'Where they meet', value: `after ${n(rul, 1)} years`, formula: ['Years = (SOH − limit) ÷ health lost per year'] }
    ]
  };
}

export function graphTwinTornado({ tornado, baseDte }) {
  return {
    title: 'Graph: DTE Impact Tornado Chart',
    intro: 'Each bar shows how much range one what-if slider removes (red, negative) or adds (green, positive) on its own, so you can see which condition matters most.',
    sections: [
      { heading: 'Formula',
        formula: ['Impact (km) = round(range ÷ factor) − range',
          'Terrain factor = 1 + 0.05 × slope (%)   ·   Payload factor = 1 + 0.0005 × payload (kg)',
          'Speed factor = max(0.5, (speed ÷ 60)²)   ·   Temperature factor = 1 + 0.004 × temperature rise (°C)'],
        steps: [`Range used = ${baseDte} km (flat-road range of the dashboard)`].concat(tornado.map((t) => `${t.name}: ${t.impact} km`)),
        source: 'app/components/AdvancedIntelligenceSuite.js → tornadoData' },
      { heading: 'How to read it', meaning: 'The longest bar is the condition with the biggest effect. Bars are sorted from most negative to most positive.' }
    ]
  };
}

export function graphTwinSoh({ baseSoh, payloadWeightKg, ambientTempDeltaC }) {
  return {
    title: 'Graph: SOH Projection Horizon (7 days)',
    intro: "Health over the next seven days: the blue line keeps today's ageing speed, the orange line uses the what-if conditions.",
    sections: [
      { heading: 'Daily health loss', formula: ['Daily loss = 0.0085 × (100 − SOH)   (0.03–0.32 % per day)'],
        steps: [`= 0.0085 × (100 − ${n(baseSoh, 1)}) = ${n(clamp((100 - baseSoh) * 0.0085, 0.03, 0.32), 3)} % per day`],
        source: 'app/components/AdvancedIntelligenceSuite.js → buildDigitalTwinCurve()' },
      { heading: 'Blue line (baseline)', formula: ['SOH(day) = SOH today − daily loss × day'] },
      { heading: 'Orange line (what-if)',
        formula: ['Stress = 1 + 0.0008 × payload + 0.032 × temp rise + 0.08 × slope + 0.015 × fast-charge % + 0.0025 × accel % + 0.0015 × braking %',
          'SOH(day) = SOH today − daily loss × stress × day − 0.001 × payload − 0.12 × temp rise'],
        steps: [`Immediate offset = 0.001 × ${payloadWeightKg} + 0.12 × ${ambientTempDeltaC} = ${n(0.001 * payloadWeightKg + 0.12 * ambientTempDeltaC, 2)} %`] }
    ]
  };
}

export function graphTwinRul() {
  return {
    title: 'Graph: RUL Projection Horizon (7 days)',
    intro: 'Remaining useful life computed on each of the next seven days, for the baseline (green) and the what-if conditions (red).',
    sections: [
      { heading: 'Formula', formula: ['RUL(day) = (SOH of that day − 80) ÷ (daily loss × 365)', 'What-if uses the what-if SOH and daily loss × stress'],
        source: 'app/components/AdvancedIntelligenceSuite.js → buildDigitalTwinCurve()' },
      { heading: 'How to read it', meaning: 'The gap between the two lines is how many years of battery life the what-if conditions would cost.' }
    ]
  };
}
