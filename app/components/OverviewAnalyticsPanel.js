'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { calculateBatteryHealthMetrics } from '../utils/batteryHealth';
import { TRINITY_DATASET_PROFILE } from '../utils/trinityDatasetProfile';

const socColors = ['#22c55e', '#334155'];
const utilizationColors = ['#38bdf8', '#374151'];
const stressColors = ['#f97316', '#0ea5e9', '#f43f5e'];

const chartCardStyle = {
  background: 'linear-gradient(160deg, rgba(8, 10, 14, 0.96) 0%, rgba(2, 3, 6, 0.96) 100%)',
  border: '1px solid rgba(148, 163, 184, 0.22)',
  borderRadius: '12px',
  padding: '18px',
  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)'
};

const tooltipStyle = {
  backgroundColor: '#020617',
  border: '1px solid rgba(148, 163, 184, 0.3)',
  borderRadius: '8px',
  color: '#e2e8f0'
};

const pieTooltipContainerStyle = {
  backgroundColor: 'rgba(2, 6, 23, 0.97)',
  border: '1px solid rgba(56, 189, 248, 0.28)',
  borderRadius: '10px',
  color: '#e2e8f0',
  padding: '10px 12px',
  minWidth: '176px',
  boxShadow: '0 10px 26px rgba(2, 6, 23, 0.65)'
};

const pieTooltipLabelStyle = {
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#94a3b8',
  marginBottom: '5px'
};

const pieTooltipValueStyle = {
  fontSize: '16px',
  fontWeight: 700,
  color: '#f8fafc',
  lineHeight: 1.2
};

export default function OverviewAnalyticsPanel({
  socSlider,
  drivingMode,
  routeDistance,
  calculateDTE,
  estimateRangeAtSoc,
  batteryData,
  datasetProfile
}) {
  const dte = calculateDTE();

  const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

  const renderPieTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) {
      return null;
    }

    const point = payload[0];
    const displayName = point?.name || point?.payload?.name || 'Value';
    const displayValue = formatPercent(point?.value);

    return (
      <div style={pieTooltipContainerStyle}>
        <div style={pieTooltipLabelStyle}>{displayName}</div>
        <div style={pieTooltipValueStyle}>{displayValue}</div>
      </div>
    );
  };

  const getNumeric = (...values) => {
    for (const value of values) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return undefined;
  };

  const estimateVoltDiff = socSlider > 90
    ? 0.04 + (socSlider - 90) * 0.008
    : socSlider < 15
      ? 0.07 + (15 - socSlider) * 0.01
      : 0.01 + Math.abs(socSlider - 50) * 0.0015;

  const estimatedTemperature = Math.min(
    32,
    25 + (100 - socSlider) * 0.04 + (drivingMode === 'SPORT' ? 1.4 : 0.6)
  );

  const liveTemperature = getNumeric(
    batteryData?.Max_Temp_C,
    batteryData?.temperature,
    estimatedTemperature,
    25
  );

  const liveVoltDiff = getNumeric(
    batteryData?.Volt_Diff_V,
    batteryData?.voltage_diff,
    batteryData?.volt_diff,
    estimateVoltDiff,
    0.05
  );

  const activeDatasetProfile = datasetProfile || TRINITY_DATASET_PROFILE;

  const healthMetrics = calculateBatteryHealthMetrics({
    soc: getNumeric(socSlider, batteryData?.Actual_SOC, batteryData?.SOC, 0),
    temperatureC: liveTemperature,
    voltageDiffV: liveVoltDiff,
    datasetProfile: {
      ...TRINITY_DATASET_PROFILE,
      ...activeDatasetProfile,
      datasetName: activeDatasetProfile.datasetName || batteryData?.Dataset_Name || TRINITY_DATASET_PROFILE.datasetName,
      rows: getNumeric(activeDatasetProfile.rows, batteryData?.Dataset_Rows, TRINITY_DATASET_PROFILE.rows),
      cycleCount: getNumeric(
        batteryData?.Cycle_Count,
        batteryData?.cycle_count,
        batteryData?.cycleCount,
        batteryData?.cycles,
        activeDatasetProfile.cycleCount,
        TRINITY_DATASET_PROFILE.cycleCount
      ),
      designCycleLife: getNumeric(
        batteryData?.Design_Cycle_Life,
        batteryData?.design_cycle_life,
        batteryData?.designCycleLife,
        batteryData?.rated_cycles,
        activeDatasetProfile.designCycleLife,
        TRINITY_DATASET_PROFILE.designCycleLife
      ),
      batteryAgeYears: getNumeric(
        batteryData?.Battery_Age_Years,
        batteryData?.battery_age_years,
        batteryData?.batteryAgeYears,
        batteryData?.age_years,
        activeDatasetProfile.batteryAgeYears,
        TRINITY_DATASET_PROFILE.batteryAgeYears
      ),
      baselineSoh: getNumeric(
        batteryData?.SOH_Baseline,
        batteryData?.soh_baseline,
        batteryData?.baselineSoh,
        activeDatasetProfile.baselineSoh,
        TRINITY_DATASET_PROFILE.baselineSoh
      ),
      eolThreshold: getNumeric(
        batteryData?.EOL_Threshold,
        batteryData?.eol_threshold,
        activeDatasetProfile.eolThreshold,
        TRINITY_DATASET_PROFILE.eolThreshold
      ),
      nominalTemperatureC: getNumeric(
        activeDatasetProfile.nominalTemperatureC,
        TRINITY_DATASET_PROFILE.nominalTemperatureC
      ),
      nominalVoltDiffV: getNumeric(
        activeDatasetProfile.nominalVoltDiffV,
        TRINITY_DATASET_PROFILE.nominalVoltDiffV
      )
    }
  });

  const socPieData = [
    { name: 'Charge Available', value: Number(socSlider.toFixed(1)) },
    { name: 'Charge Consumed', value: Number((100 - socSlider).toFixed(1)) }
  ];

  const utilizationPct = dte > 0 && routeDistance > 0
    ? Math.min(100, (routeDistance / dte) * 100)
    : 0;

  const routeUtilizationData = [
    { name: 'Charge Utilized', value: Number(utilizationPct.toFixed(1)) },
    { name: 'Charge Reserved', value: Number((100 - utilizationPct).toFixed(1)) }
  ];

  const fallbackRangeProjection = (soc) => {
    const safeSoc = Math.max(0, Math.min(100, Number(soc) || 0));
    const baseFullRange = drivingMode === 'SPORT' ? 62 : 76;
    return Math.round((safeSoc / 100) * baseFullRange);
  };

  const getProjectedRange = typeof estimateRangeAtSoc === 'function'
    ? estimateRangeAtSoc
    : fallbackRangeProjection;

  const projectionData = [100, 80, 60, 40, 20, 10].map((soc) => ({
    soc,
    range: getProjectedRange(soc)
  }));

  const stressData = [
    { name: 'Thermal', value: Number(healthMetrics.tempPenalty.toFixed(2)) },
    { name: 'Imbalance', value: Number(healthMetrics.imbalancePenalty.toFixed(2)) },
    { name: 'Low SOC', value: Number(healthMetrics.lowSocPenalty.toFixed(2)) }
  ];

  const kpiData = [
    { label: 'SOC', value: `${socSlider.toFixed(1)}%`, accent: '#22c55e' },
    { label: 'DTE', value: `${dte} km`, accent: '#38bdf8' },
    { label: 'SOH', value: `${healthMetrics.soh.toFixed(1)}%`, accent: '#a78bfa' },
    { label: 'RUL', value: `${healthMetrics.rulYears.toFixed(1)} yrs`, accent: '#f59e0b' },
    { label: 'Route', value: `${routeDistance || 0} km`, accent: '#f43f5e' },
    {
      label: 'Mode',
      value: drivingMode,
      accent: drivingMode === 'SPORT' ? '#f97316' : '#10b981'
    }
  ];

  return (
    <div style={{ marginBottom: '22px' }} className="slide-up">
      <div style={{
        ...chartCardStyle,
        padding: '20px',
        marginBottom: '18px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', letterSpacing: '0.02em' }}>
            Vehicle Analytics
          </h3>
          <span style={{
            fontSize: '11px',
            color: '#22c55e',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            border: '1px solid rgba(34, 197, 94, 0.45)',
            borderRadius: '9999px',
            padding: '4px 10px'
          }}>
            Live
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '10px'
        }}>
          {kpiData.map((item) => (
            <div key={item.label} style={{
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid rgba(71, 85, 105, 0.5)',
              borderRadius: '10px',
              padding: '12px'
            }}>
              <p style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#94a3b8',
                marginBottom: '6px'
              }}>
                {item.label}
              </p>
              <p style={{ fontSize: '22px', fontWeight: 700, color: item.accent }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '18px'
      }}>
        <div style={chartCardStyle}>
          <h4 style={{ fontSize: '14px', color: '#cbd5e1', marginBottom: '12px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Charge Composition
          </h4>
          <div style={{ width: '100%', height: '200px' }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={socPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={78}
                  paddingAngle={2}
                  stroke="none"
                >
                  {socPieData.map((entry, index) => (
                    <Cell key={`soc-cell-${entry.name}`} fill={socColors[index % socColors.length]} />
                  ))}
                </Pie>
                <Tooltip content={renderPieTooltip} wrapperStyle={{ outline: 'none' }} />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#cbd5e1' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={chartCardStyle}>
          <h4 style={{ fontSize: '14px', color: '#cbd5e1', marginBottom: '12px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Route Utilization
          </h4>
          <div style={{ width: '100%', height: '200px' }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={routeUtilizationData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={78}
                  paddingAngle={2}
                  stroke="none"
                >
                  {routeUtilizationData.map((entry, index) => (
                    <Cell key={`route-cell-${entry.name}`} fill={utilizationColors[index % utilizationColors.length]} />
                  ))}
                </Pie>
                <Tooltip content={renderPieTooltip} wrapperStyle={{ outline: 'none' }} />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#cbd5e1' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={chartCardStyle}>
          <h4 style={{ fontSize: '14px', color: '#cbd5e1', marginBottom: '12px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Range Projection by SOC
          </h4>
          <div style={{ width: '100%', height: '200px' }}>
            <ResponsiveContainer>
              <LineChart data={projectionData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.18)" />
                <XAxis dataKey="soc" tick={{ fill: '#94a3b8', fontSize: 11 }} unit="%" />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} unit=" km" />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="range" stroke="#22d3ee" strokeWidth={3} dot={{ r: 3, fill: '#22d3ee' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={chartCardStyle}>
          <h4 style={{ fontSize: '14px', color: '#cbd5e1', marginBottom: '12px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Health Stress Factors
          </h4>
          <div style={{ width: '100%', height: '200px' }}>
            <ResponsiveContainer>
              <BarChart data={stressData} margin={{ top: 5, right: 0, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.18)" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {stressData.map((entry, index) => (
                    <Cell key={`stress-cell-${entry.name}`} fill={stressColors[index % stressColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
