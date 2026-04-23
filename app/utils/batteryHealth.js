import { TRINITY_DATASET_PROFILE } from './trinityDatasetProfile';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const pickNumber = (...values) => {
  for (const value of values) {
    const parsed = toNumber(value);
    if (parsed !== undefined) {
      return parsed;
    }
  }
  return undefined;
};

const resolveDatasetProfile = (datasetProfile = {}) => {
  const baseProfile = {
    ...TRINITY_DATASET_PROFILE,
    ...(datasetProfile || {})
  };

  const baselineSoh = clamp(
    pickNumber(baseProfile.baselineSoh, baseProfile.baseSoh, baseProfile.initialSoh, TRINITY_DATASET_PROFILE.baselineSoh),
    85,
    100
  );

  const cycleCount = clamp(
    pickNumber(baseProfile.cycleCount, baseProfile.cycles, baseProfile.Cycle_Count, TRINITY_DATASET_PROFILE.cycleCount),
    0,
    200000
  );

  const designCycleLife = clamp(
    pickNumber(baseProfile.designCycleLife, baseProfile.totalCycles, baseProfile.Design_Cycle_Life, TRINITY_DATASET_PROFILE.designCycleLife),
    500,
    200000
  );

  const batteryAgeYears = clamp(
    pickNumber(baseProfile.batteryAgeYears, baseProfile.ageYears, baseProfile.Battery_Age_Years, TRINITY_DATASET_PROFILE.batteryAgeYears),
    0.2,
    25
  );

  const calendarFadePerYear = clamp(
    pickNumber(baseProfile.calendarFadePerYear, baseProfile.calendarAgingPerYear, TRINITY_DATASET_PROFILE.calendarFadePerYear),
    0.1,
    1.2
  );

  const cycleFadeTotalAtEol = clamp(
    pickNumber(baseProfile.cycleFadeTotalAtEol, baseProfile.capacityFadeAtEol, TRINITY_DATASET_PROFILE.cycleFadeTotalAtEol),
    8,
    35
  );

  const eolThreshold = clamp(
    pickNumber(baseProfile.eolThreshold, baseProfile.EOL_Threshold, TRINITY_DATASET_PROFILE.eolThreshold),
    70,
    90
  );

  const nominalTemperatureC = clamp(
    pickNumber(baseProfile.nominalTemperatureC, baseProfile.tempAvgC, TRINITY_DATASET_PROFILE.nominalTemperatureC),
    -20,
    80
  );

  const nominalVoltDiffV = clamp(
    pickNumber(baseProfile.nominalVoltDiffV, baseProfile.voltDiffAvgV, TRINITY_DATASET_PROFILE.nominalVoltDiffV),
    0,
    0.2
  );

  const datasetName = String(baseProfile.datasetName || TRINITY_DATASET_PROFILE.datasetName);
  const rows = clamp(
    pickNumber(baseProfile.rows, baseProfile.datasetRows, TRINITY_DATASET_PROFILE.rows),
    1,
    100000000
  );

  return {
    datasetName,
    rows,
    baselineSoh,
    cycleCount,
    designCycleLife,
    batteryAgeYears,
    calendarFadePerYear,
    cycleFadeTotalAtEol,
    eolThreshold,
    nominalTemperatureC,
    nominalVoltDiffV
  };
};

export function calculateBatteryHealthMetrics({ soc, temperatureC, voltageDiffV, datasetProfile } = {}) {
  const safeSoc = clamp(Number(soc) || 0, 0, 100);
  const profile = resolveDatasetProfile(datasetProfile);
  const safeTemp = Number(temperatureC) || profile.nominalTemperatureC;
  const safeVoltDiff = clamp(Number(voltageDiffV) || 0, 0, 0.35);

  // Thermal and imbalance reflect real stress in current operating window.
  const tempDelta = Math.max(0, Math.abs(safeTemp - profile.nominalTemperatureC) - 0.8);
  const tempPenalty = clamp(tempDelta * 0.28, 0, 4.5);
  const imbalancePenalty = clamp((Math.max(0, safeVoltDiff - (profile.nominalVoltDiffV + 0.01)) / 0.08) * 7.5, 0, 7.5);

  // SOC is retained as a stress indicator only; SOH/RUL are derived from dataset aging.
  const lowSocPenalty = safeSoc < 20 ? ((20 - safeSoc) / 20) * 1.4 : 0;
  const deepDischargePenalty = safeSoc < 10 ? ((10 - safeSoc) / 10) * 0.8 : 0;
  const socStressPenalty = lowSocPenalty + deepDischargePenalty;

  const cycleFadePerCycle = profile.cycleFadeTotalAtEol / profile.designCycleLife;
  const cycleFade = profile.cycleCount * cycleFadePerCycle;
  const calendarFade = profile.batteryAgeYears * profile.calendarFadePerYear;

  const soh = clamp(
    profile.baselineSoh - cycleFade - calendarFade - tempPenalty - imbalancePenalty,
    profile.eolThreshold - 10,
    99.5
  );

  const avgCyclesPerYear = profile.cycleCount / profile.batteryAgeYears;
  const cycleFadePerYear = cycleFadePerCycle * avgCyclesPerYear;
  const stressMultiplier = 1 + tempPenalty * 0.04 + imbalancePenalty * 0.03;

  const yearlyDegradation = clamp(
    (profile.calendarFadePerYear + cycleFadePerYear) * stressMultiplier,
    0.6,
    3.6
  );

  const rulYears = clamp((soh - profile.eolThreshold) / yearlyDegradation, 0, 15);

  return {
    datasetName: profile.datasetName,
    datasetRows: profile.rows,
    soh,
    rulYears,
    yearlyDegradation,
    eolThreshold: profile.eolThreshold,
    tempPenalty,
    imbalancePenalty,
    lowSocPenalty: socStressPenalty,
    cycleCount: profile.cycleCount,
    designCycleLife: profile.designCycleLife,
    batteryAgeYears: profile.batteryAgeYears
  };
}
