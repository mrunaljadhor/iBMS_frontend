import { TRINITY_DATASET_PROFILE } from './trinityDatasetProfile';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseCsv = (csvText) => {
  const lines = String(csvText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('CSV must include a header and at least one row.');
  }

  const headers = lines[0].split(',').map((header) => header.trim());
  const rows = lines.slice(1).map((line) => {
    const values = line.split(',');
    const row = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] || '').trim();
    });
    return row;
  });

  return { headers, rows };
};

const getColumnStats = (rows, columnName) => {
  const values = rows
    .map((row) => toNumber(row[columnName]))
    .filter((value) => value !== undefined);

  if (!values.length) {
    return undefined;
  }

  const sum = values.reduce((acc, value) => acc + value, 0);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: sum / values.length
  };
};

const pickMetric = (rows, headers, candidates, reducer = 'avg') => {
  for (const columnName of candidates) {
    if (!headers.includes(columnName)) {
      continue;
    }

    const stats = getColumnStats(rows, columnName);
    if (!stats) {
      continue;
    }

    if (reducer === 'max') {
      return stats.max;
    }

    if (reducer === 'min') {
      return stats.min;
    }

    return stats.avg;
  }

  return undefined;
};

export const deriveDatasetProfileFromCsv = (
  csvText,
  datasetFileName,
  fallbackProfile = TRINITY_DATASET_PROFILE
) => {
  const { headers, rows } = parseCsv(csvText);

  const socStats = getColumnStats(rows, 'Actual_SOC');
  const tempStats = getColumnStats(rows, 'Max_Temp_C');
  const voltDiffStats = getColumnStats(rows, 'Volt_Diff_V');

  const requiredColumns = ['Actual_SOC', 'Max_Temp_C', 'Volt_Diff_V'];
  const missingColumns = requiredColumns.filter((columnName) => !headers.includes(columnName));

  const profile = {
    ...fallbackProfile,
    datasetName: datasetFileName || fallbackProfile.datasetName,
    rows: rows.length,
    socMin: socStats?.min ?? fallbackProfile.socMin,
    socMax: socStats?.max ?? fallbackProfile.socMax,
    socAvg: socStats?.avg ?? fallbackProfile.socAvg,
    tempMinC: tempStats?.min ?? fallbackProfile.tempMinC,
    tempMaxC: tempStats?.max ?? fallbackProfile.tempMaxC,
    tempAvgC: tempStats?.avg ?? fallbackProfile.tempAvgC,
    voltDiffMinV: voltDiffStats?.min ?? fallbackProfile.voltDiffMinV,
    voltDiffMaxV: voltDiffStats?.max ?? fallbackProfile.voltDiffMaxV,
    voltDiffAvgV: voltDiffStats?.avg ?? fallbackProfile.voltDiffAvgV,
    nominalTemperatureC: tempStats?.avg ?? fallbackProfile.nominalTemperatureC,
    nominalVoltDiffV: Math.max(0, voltDiffStats?.avg ?? fallbackProfile.nominalVoltDiffV),
    cycleCount:
      pickMetric(rows, headers, ['Cycle_Count', 'cycle_count', 'cycleCount', 'cycles'], 'max') ??
      fallbackProfile.cycleCount,
    designCycleLife:
      pickMetric(rows, headers, ['Design_Cycle_Life', 'design_cycle_life', 'designCycleLife', 'rated_cycles'], 'max') ??
      fallbackProfile.designCycleLife,
    batteryAgeYears:
      pickMetric(rows, headers, ['Battery_Age_Years', 'battery_age_years', 'batteryAgeYears', 'age_years']) ??
      fallbackProfile.batteryAgeYears,
    baselineSoh:
      pickMetric(rows, headers, ['SOH_Baseline', 'soh_baseline', 'baselineSoh', 'SOH']) ??
      fallbackProfile.baselineSoh,
    eolThreshold:
      pickMetric(rows, headers, ['EOL_Threshold', 'eol_threshold', 'EOL']) ??
      fallbackProfile.eolThreshold
  };

  return {
    profile,
    summary: {
      rows: rows.length,
      columns: headers.length,
      missingColumns,
      supportsIbmsMetrics: missingColumns.length === 0
    }
  };
};
