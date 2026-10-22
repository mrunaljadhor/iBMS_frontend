'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { calculateBatteryHealthMetrics } from '../utils/batteryHealth';
import { TRINITY_DATASET_PROFILE } from '../utils/trinityDatasetProfile';
import ExplainButton from './ExplainButton';
import {
  graphDegradation, graphEnergyBreakdown, graphModeEfficiency, graphOperatingEnvelope, graphRangeVsSoc, graphRouteUtilization,
  graphRulComparison, graphSocAccuracy, graphStressFactors, SOC_ACCURACY_RESULTS
} from '../utils/graphExplanations';
import { routeEnergyModel } from '../utils/explanations';

const socColors = ['#22c55e', '#334155'];
const utilizationColors = ['#38bdf8', '#374151'];
const stressColors = ['#f97316', '#0ea5e9', '#f43f5e'];
const degradationColors = ['#94a3b8', '#a78bfa', '#f97316', '#0ea5e9'];
const efficiencyColors = ['#10b981', '#f97316'];
const accuracyColors = { CALCE: '#38bdf8', Field: '#f97316', Synthetic: '#a78bfa' };
const waterfallColors = { base: '#38bdf8', up: '#f97316', down: '#10b981', total: '#cbd5e1', ok: '#22c55e', short: '#ef4444' };

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
  userRole,
  socSlider,
  drivingMode,
  routeDistance,
  calculateDTE,
  estimateRangeAtSoc,
  batteryData,
  datasetProfile,
  amsa,
  riskAware = false,
  socMargin = 0
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

  const healthProfile = {
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
  };
  const healthMetrics = calculateBatteryHealthMetrics({
    soc: getNumeric(socSlider, batteryData?.Actual_SOC, batteryData?.SOC, 0),
    temperatureC: liveTemperature,
    voltageDiffV: liveVoltDiff,
    datasetProfile: healthProfile
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

  const degradationData = [
    { name: 'Calendar Aging', value: Number((healthMetrics.calendarFade || 0).toFixed(2)) },
    { name: 'Cycle Aging', value: Number((healthMetrics.cycleFade || 0).toFixed(2)) },
    { name: 'Thermal Stress', value: Number(healthMetrics.tempPenalty.toFixed(2)) },
    { name: 'Cell Imbalance', value: Number(healthMetrics.imbalancePenalty.toFixed(2)) }
  ];

  const envelopeData = [
    { subject: 'Temp', value: Math.min(100, (liveTemperature / 45) * 100), fullMark: 100 },
    { subject: 'Volt Diff', value: Math.min(100, (liveVoltDiff / 0.15) * 100), fullMark: 100 },
    { subject: 'Power', value: drivingMode === 'SPORT' ? 85 : 45, fullMark: 100 },
    { subject: 'SOC', value: socSlider, fullMark: 100 },
  ];

  const efficiencyData = [
    { name: 'Range (km)', ECO: Math.round((socSlider / 100) * 76), SPORT: Math.round((socSlider / 100) * 62) },
    { name: 'Consump (Wh/km)', ECO: 25.8, SPORT: 31.6 }
  ];

  const rulComparisonData = [
    { name: 'RUL (Years)', Current: Number(healthMetrics.rulYears.toFixed(1)), Baseline: 10 }
  ];

  // Route graphs: only after a route was planned in the User view (AMSA reply kept by the dashboard)
  const hasRouteModel = Number(amsa?.route_distance_km) > 0;
  const decisionSoc = Math.max(0, Number(socSlider) - (riskAware ? Number(socMargin) || 0 : 0));
  const routeModel = hasRouteModel
    ? routeEnergyModel({ amsa, soc: decisionSoc, fallbackSoh: healthMetrics.soh })
    : null;
  const routeStatus = !routeModel ? 'n/a'
    : decisionSoc < routeModel.thrEco ? 'IMPOSSIBLE (charge first)'
      : decisionSoc < routeModel.thrSport ? 'CRITICAL (ECO-Lock)' : 'SAFE';

  const rangeVsSocData = routeModel
    ? Array.from({ length: 51 }, (_, i) => i * 2).map((soc) => ({
      soc,
      eco: Number((routeModel.ecoFull * soc / 100).toFixed(1)),
      sport: Number((routeModel.sportFull * soc / 100).toFixed(1)),
      naive: Number((routeModel.naiveFull * soc / 100).toFixed(1))
    }))
    : [];

  const waterfallData = (() => {
    if (!routeModel) return [];
    const e = routeModel.energy;
    let level = 0;
    const step = (name, delta, kind) => {
      const start = level;
      level += delta;
      return { name, base: Math.min(start, level), value: Math.abs(delta), text: `${kind === 'base' ? '' : delta >= 0 ? '+' : '−'}${Math.round(Math.abs(delta))} Wh`, kind };
    };
    return [
      step('Flat road', e.flatWh, 'base'),
      step('+ Climb', e.climbWh, e.climbWh >= 0 ? 'up' : 'down'),
      step('− Regen', e.regenWh, e.regenWh >= 0 ? 'up' : 'down'),
      step('± Traffic', e.trafficWh, e.trafficWh >= 0 ? 'up' : 'down'),
      { name: 'Total needed', base: 0, value: e.totalWh, text: `${Math.round(e.totalWh)} Wh`, kind: 'total' },
      { name: 'In battery', base: 0, value: routeModel.availableWh, text: `${Math.round(routeModel.availableWh)} Wh`,
        kind: routeModel.availableWh >= e.totalWh ? 'ok' : 'short' }
    ];
  })();

  const accuracyData = SOC_ACCURACY_RESULTS.map((r, i) => ({ ...r, id: String(i) }));

  const kpiData = [
    { label: 'SOC', value: `${socSlider.toFixed(1)}%`, accent: '#22c55e' },
    ...(userRole === 'analyst' ? [
      { label: 'SOH', value: `${healthMetrics.soh.toFixed(1)}%`, accent: '#a78bfa' },
      { label: 'RUL', value: `${healthMetrics.rulYears.toFixed(1)} yrs`, accent: '#f59e0b' }
    ] : [
      { label: 'DTE', value: `${dte} km`, accent: '#38bdf8' }
    ]),
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

      {userRole === 'analyst' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '18px'
        }}>
          {routeModel ? (
            <>
              <div style={{ ...chartCardStyle, gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '14px', color: '#cbd5e1', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Range vs SOC for the Planned Route
              </h4>
              <ExplainButton compact {...graphRangeVsSoc({ model: routeModel, decisionSoc, status: routeStatus })} />
            </div>
                <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
                  {routeModel.L.toFixed(1)} km route · ECO needs {routeModel.thrEco.toFixed(1)} % SOC, SPORT {routeModel.thrSport.toFixed(1)} % · flat-road display says {routeModel.thrNaive.toFixed(1)} % · now {decisionSoc.toFixed(1)} % → {routeStatus}
                </p>
                <div style={{ width: '100%', height: '280px' }}>
                  <ResponsiveContainer>
                    <LineChart data={rangeVsSocData} margin={{ top: 10, right: 16, left: -5, bottom: 10 }}>
                      <ReferenceArea x1={0} x2={Math.min(100, routeModel.thrEco)} fill="#ef4444" fillOpacity={0.12} ifOverflow="hidden" />
                      <ReferenceArea x1={Math.min(100, routeModel.thrEco)} x2={Math.min(100, routeModel.thrSport)} fill="#f59e0b" fillOpacity={0.14} ifOverflow="hidden" />
                      <ReferenceArea x1={Math.min(100, routeModel.thrSport)} x2={100} fill="#22c55e" fillOpacity={0.1} ifOverflow="hidden" />
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.18)" />
                      <XAxis dataKey="soc" type="number" domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }}
                        label={{ value: 'Starting SOC (%)', position: 'insideBottom', offset: -4, fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }}
                        label={{ value: 'Range (km)', angle: -90, position: 'insideLeft', offset: 15, fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `SOC ${v} %`} formatter={(v) => `${v} km`} />
                      <Legend verticalAlign="top" wrapperStyle={{ fontSize: '11px', color: '#cbd5e1', paddingBottom: '6px' }} />
                      <ReferenceLine y={routeModel.L} stroke="#f43f5e" strokeDasharray="8 3 2 3" strokeWidth={2}
                        label={{ value: `Route ${routeModel.L.toFixed(1)} km`, position: 'insideTopLeft', fill: '#fda4af', fontSize: 11 }} />
                      <ReferenceLine x={Math.min(100, decisionSoc)} stroke="#f8fafc" strokeWidth={1.5}
                        label={{ value: 'Now', position: 'insideTopRight', fill: '#f8fafc', fontSize: 11 }} />
                      <Line type="linear" dataKey="naive" name="Flat-road display (ECO)" stroke="#94a3b8" strokeDasharray="5 4" strokeWidth={2} dot={false} />
                      <Line type="linear" dataKey="eco" name="ECO on this route" stroke="#10b981" strokeWidth={2} dot={false} />
                      <Line type="linear" dataKey="sport" name="SPORT on this route" stroke="#f97316" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ ...chartCardStyle, gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '14px', color: '#cbd5e1', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Route Energy Breakdown (ECO)
              </h4>
              <ExplainButton compact {...graphEnergyBreakdown({ model: routeModel })} />
            </div>
                <div style={{ width: '100%', height: '260px' }}>
                  <ResponsiveContainer>
                    <BarChart data={waterfallData} margin={{ top: 22, right: 10, left: -5, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.18)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} interval={0} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }}
                        label={{ value: 'Energy (Wh)', angle: -90, position: 'insideLeft', offset: 15, fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                        formatter={(v, key, item) => [item.payload.text, 'Energy']} />
                      <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} legendType="none" tooltipType="none" />
                      <Bar dataKey="value" stackId="w" radius={[4, 4, 0, 0]}>
                        {waterfallData.map((entry) => (
                          <Cell key={`wf-${entry.name}`} fill={waterfallColors[entry.kind]} />
                        ))}
                        <LabelList dataKey="text" position="top" fill="#e2e8f0" fontSize={11} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          ) : (
            <div style={{ ...chartCardStyle, gridColumn: '1 / -1' }}>
              <h4 style={{ fontSize: '14px', color: '#cbd5e1', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '6px' }}>
                Range vs SOC · Route Energy Breakdown
              </h4>
              <p style={{ fontSize: '13px', color: '#94a3b8' }}>
                Plan a route in the User view (Route Planning → Calculate Route) and come back: these two graphs are drawn from the AMSA result of that route.
              </p>
            </div>
          )}

          <div style={chartCardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '14px', color: '#cbd5e1', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Degradation Contribution
              </h4>
              <ExplainButton compact {...graphDegradation({ health: healthMetrics })} />
            </div>
            <div style={{ width: '100%', height: '200px' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={degradationData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={78}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {degradationData.map((entry, index) => (
                      <Cell key={`deg-cell-${entry.name}`} fill={degradationColors[index % degradationColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={renderPieTooltip} wrapperStyle={{ outline: 'none' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#cbd5e1' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={chartCardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '14px', color: '#cbd5e1', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Route Utilization
              </h4>
              <ExplainButton compact {...graphRouteUtilization({ routeDistance, dte })} />
            </div>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '14px', color: '#cbd5e1', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Health Stress Factors
              </h4>
              <ExplainButton compact {...graphStressFactors({ health: healthMetrics, temperatureC: liveTemperature, voltageDiffV: liveVoltDiff, soc: socSlider, profile: { ...TRINITY_DATASET_PROFILE, ...healthProfile } })} />
            </div>
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

          <div style={chartCardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '14px', color: '#cbd5e1', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Mode Efficiency Comparison
              </h4>
              <ExplainButton compact {...graphModeEfficiency({ soc: socSlider })} />
            </div>
            <div style={{ width: '100%', height: '200px' }}>
              <ResponsiveContainer>
                <BarChart data={efficiencyData} margin={{ top: 5, right: 0, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.18)" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#cbd5e1' }} />
                  <Bar dataKey="ECO" fill={efficiencyColors[0]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="SPORT" fill={efficiencyColors[1]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={chartCardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '14px', color: '#cbd5e1', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Operating Envelope
              </h4>
              <ExplainButton compact {...graphOperatingEnvelope({ temperatureC: liveTemperature, voltageDiffV: liveVoltDiff, mode: drivingMode, soc: socSlider })} />
            </div>
            <div style={{ width: '100%', height: '200px' }}>
              <ResponsiveContainer>
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={envelopeData}>
                  <PolarGrid stroke="rgba(148, 163, 184, 0.3)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Radar name="Current Operation" dataKey="value" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.4} />
                  <Tooltip contentStyle={tooltipStyle} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={chartCardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '14px', color: '#cbd5e1', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                RUL Projection Comparison
              </h4>
              <ExplainButton compact {...graphRulComparison({ rul: healthMetrics.rulYears })} />
            </div>
            <div style={{ width: '100%', height: '200px' }}>
              <ResponsiveContainer>
                <BarChart data={rulComparisonData} margin={{ top: 5, right: 0, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.18)" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#cbd5e1' }} />
                  <Bar dataKey="Current" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Baseline" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ ...chartCardStyle, gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '14px', color: '#cbd5e1', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                SOC Estimation Accuracy (MAE, % SOC)
              </h4>
              <ExplainButton compact {...graphSocAccuracy()} />
            </div>
            <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: '#cbd5e1', marginBottom: '6px', flexWrap: 'wrap' }}>
              {Object.entries({ CALCE: 'CALCE public data (unseen drive cycle, 25 °C)', Field: 'Field stand-test sessions', Synthetic: 'Synthetic test' }).map(([key, text]) => (
                <span key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: accuracyColors[key] }} />{text}
                </span>
              ))}
            </div>
            <div style={{ width: '100%', height: '340px' }}>
              <ResponsiveContainer>
                <BarChart data={accuracyData} layout="vertical" margin={{ top: 5, right: 48, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.18)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis type="category" dataKey="id" width={175} tick={{ fill: '#cbd5e1', fontSize: 11 }} interval={0}
                    tickFormatter={(id) => (accuracyData[Number(id)]?.name || '').replace(/ /g, ' ')} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                    labelFormatter={(id) => `${accuracyData[Number(id)]?.name} (${accuracyData[Number(id)]?.dataset})`}
                    formatter={(v) => [`${v} % SOC`, 'MAE']} />
                  <Bar dataKey="mae" radius={[0, 4, 4, 0]}>
                    {accuracyData.map((entry) => (
                      <Cell key={`acc-${entry.id}`} fill={accuracyColors[entry.dataset]} />
                    ))}
                    <LabelList dataKey="mae" position="right" fill="#e2e8f0" fontSize={11} formatter={(v) => `${Number(v).toFixed(2)} %`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
              Offline results from the paper (TABLE II), not live values. On the field sessions a constant guess does as well as the LSTM, so only CALCE ranks the estimators: EKF-1RC is the most accurate; the LSTM needs no starting SOC or OCV curve.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
