// Rule-based (SHAP-style) feature attributions shown on the dashboard's "SHAP Attributions" card.
// Shared by the API route (app/api/intelligence/xai/route.js) and the card's explanation pop-up,
// so the numbers in the pop-up are exactly the ones on the card.

export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * Compute physics-based SHAP-style feature attributions for a given prediction target.
 * Each target has its own sensitivity to each input feature.
 */
export function attributionWeights(inputs, target) {
  const { temperature, soc, cycleCount, voltageDiff, current, voltage, drivingMode } = inputs;

  // Baseline stress factors (all raw, before normalization)
  const tempDelta      = Math.max(0, Math.abs(temperature - 25) - 0.8);
  const thermalRaw     = clamp(tempDelta * 0.28, 0, 4.5) * 12;

  const imbalanceRaw   = clamp((Math.max(0, voltageDiff - 0.006) / 0.08) * 7.5, 0, 7.5) * 10
                         + clamp((cycleCount / 500) * 0.4, 0, 3); // cycles worsen imbalance

  const lowSocRaw      = soc < 20 ? ((20 - soc) / 20) * 22 : clamp((100 - soc) * 0.04, 1, 6);

  const agingRaw       = 12 + (cycleCount / 420);

  const currentStressRaw = clamp(Math.abs(current) * 0.8, 0, 12); // high current → stress

  const modeMultiplier = drivingMode === 'SPORT' ? 1.35 : drivingMode === 'HIGHWAY' ? 1.18 : 1.0;

  // Each target emphasises different features based on physics
  let weights;
  if (target === 'SoH') {
    // SoH degrades primarily from aging, thermal, and cell imbalance — not instantaneous SOC
    weights = {
      'Thermal stress':      thermalRaw * 1.0,
      'Cell imbalance':      imbalanceRaw * 1.3,
      'Aging / cycle life':  agingRaw * 1.5,
      'Low SOC exposure':    lowSocRaw * 0.6,
      'Discharge current':   currentStressRaw * 0.5,
    };
  } else if (target === 'RUL') {
    // RUL is most sensitive to aging + imbalance, then thermal
    weights = {
      'Cell imbalance':      imbalanceRaw * 1.5,
      'Aging / cycle life':  agingRaw * 1.4,
      'Thermal stress':      thermalRaw * 1.0,
      'Low SOC exposure':    lowSocRaw * 0.7,
      'Discharge current':   currentStressRaw * 0.6,
    };
  } else if (target === 'DTE') {
    // DTE (range) is driven by SOC + drive mode + current draw + temperature
    const dte_soc    = clamp(soc * 0.55, 0, 55);
    const dte_mode   = clamp((modeMultiplier - 1) * 60, 0, 25);
    const dte_temp   = clamp(thermalRaw * 0.4, 0, 12);
    const dte_curr   = clamp(currentStressRaw * 0.9, 0, 14);
    const dte_aging  = clamp(agingRaw * 0.4, 0, 10);
    weights = {
      'State of charge (SOC)': dte_soc,
      'Drive mode':             dte_mode,
      'Temperature':            dte_temp,
      'Discharge current':      dte_curr,
      'Aging penalty':          dte_aging,
    };
  } else {
    // Risk Score — highest risk from overdue maintenance + thermal + imbalance + low SOC
    weights = {
      'Thermal stress':      thermalRaw * 1.2,
      'Cell imbalance':      imbalanceRaw * 1.3,
      'Low SOC exposure':    lowSocRaw * 1.0,
      'Aging / cycle life':  agingRaw * 1.0,
      'Discharge current':   currentStressRaw * 0.8,
    };
  }

  return weights;
}

/** Raw stress terms (before the per-target weights), for the explanation pop-up. */
export function attributionStressTerms({ temperature, soc, cycleCount, voltageDiff, current, drivingMode }) {
  const tempDelta = Math.max(0, Math.abs(temperature - 25) - 0.8);
  return {
    tempDelta,
    thermalRaw: clamp(tempDelta * 0.28, 0, 4.5) * 12,
    imbalanceRaw: clamp((Math.max(0, voltageDiff - 0.006) / 0.08) * 7.5, 0, 7.5) * 10 + clamp((cycleCount / 500) * 0.4, 0, 3),
    lowSocRaw: soc < 20 ? ((20 - soc) / 20) * 22 : clamp((100 - soc) * 0.04, 1, 6),
    agingRaw: 12 + (cycleCount / 420),
    currentStressRaw: clamp(Math.abs(current) * 0.8, 0, 12),
    modeMultiplier: drivingMode === 'SPORT' ? 1.35 : drivingMode === 'HIGHWAY' ? 1.18 : 1.0
  };
}

export function computeAttributions(inputs, target) {
  const weights = attributionWeights(inputs, target);
  const total = Object.values(weights).reduce((s, v) => s + v, 0) || 1;
  return Object.entries(weights)
    .map(([label, value]) => ({
      label,
      percent: Number(((value / total) * 100).toFixed(1))
    }))
    .sort((a, b) => b.percent - a.percent);
}

