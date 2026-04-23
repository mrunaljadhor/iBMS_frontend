export const TRINITY_DATASET_PROFILE = {
  datasetName: 'trinity_ev_dataset',
  rows: 1668,
  socMin: 94.9,
  socMax: 98.9,
  socAvg: 96.713489208634,
  tempMinC: 30,
  tempMaxC: 31,
  tempAvgC: 30.830035971223,
  voltDiffMinV: -0.00042424,
  voltDiffMaxV: 0.023919229,
  voltDiffAvgV: 0.005525604882494,

  // Dataset-calibrated battery aging defaults.
  baselineSoh: 98.6,
  cycleCount: 850,
  designCycleLife: 5000,
  batteryAgeYears: 3.5,
  calendarFadePerYear: 0.35,
  cycleFadeTotalAtEol: 18,
  eolThreshold: 80,

  // Nominal operating center from the training data.
  nominalTemperatureC: 30.830035971223,
  nominalVoltDiffV: 0.005525604882494
};
