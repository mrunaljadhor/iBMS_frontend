'use client';

import { useState } from 'react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { calculateBatteryHealthMetrics } from '../utils/batteryHealth';
import { TRINITY_DATASET_PROFILE } from '../utils/trinityDatasetProfile';

const DRIVING_LEVELS = [
  { id: 'level_1', label: 'L1: Optimal', description: 'Normal Braking, Normal Accel' },
  { id: 'level_2', label: 'L2: Moderate', description: 'Aggressive Braking, Normal Accel' },
  { id: 'level_3', label: 'L3: High Drain', description: 'Normal Braking, Aggressive Accel' },
  { id: 'level_4', label: 'L4: Extreme', description: 'Aggressive Braking, Aggressive Accel' }
];

export default function LeftPanel({ userRole, batteryData, drivingMode, setDrivingMode, socSlider, setSocSlider, calculateDTE, routeDistance, datasetProfile, routeInfo, operatingProfile, setOperatingProfile }) {
  const dte = calculateDTE();
  const AMAS_SPORT_LOCK_SOC_THRESHOLD = 40;
  const isSportLocked = socSlider < AMAS_SPORT_LOCK_SOC_THRESHOLD;
  const shouldRecommendEco = socSlider >= AMAS_SPORT_LOCK_SOC_THRESHOLD && drivingMode === 'SPORT';

  const getNumeric = (...values) => {
    for (const value of values) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return undefined;
  };

  // Calculate battery parameters based on SOC (realistic to trinity_ev dataset)
  const calculateBatteryParams = (soc) => {
    // Trinity EV uses lower voltage system (48-72V range typically)
    // Dataset shows voltage range: 38V (depleted) to 63V (full)
    
    // Voltage curve: Non-linear LiPo discharge curve
    // Maps SOC% to actual voltage (38V min, 63V max)
    let voltage;
    if (soc >= 95) {
      voltage = 63 + (soc - 95) * 0.08; // Near full charge
    } else if (soc >= 80) {
      voltage = 61 + (soc - 80) * 0.2; // High SOC plateau
    } else if (soc >= 50) {
      voltage = 55 + (soc - 50) * 0.12; // Middle range (linear decline)
    } else if (soc >= 20) {
      voltage = 48 + (soc - 20) * 0.175; // Lower range 
    } else if (soc >= 5) {
      voltage = 40 + (soc - 5) * 1.6; // Rapid drop at critical levels
    } else {
      voltage = 38; // Minimum safe voltage
    }
    
    // Current correlates with driving mode and power demand
    // Dataset shows: ECO mode ~0.3-0.65A, SPORT mode ~1.0-1.8A
    const baseCurrentEco = 0.3 + (100 - soc) * 0.003; // Slight increase at low SOC
    const baseCurrentSport = 1.2 + (100 - soc) * 0.006;
    const current = drivingMode === 'SPORT' ? baseCurrentSport : baseCurrentEco;
    
    // Power output = Voltage × Current (in kW)
    const power = (voltage * current) / 1000;
    
    // Temperature: Base 25°C + heat from power + stress at low SOC
    // Dataset shows range of 25-30°C
    const baseTemp = 25;
    const powerTemp = power * 3; // Power generates moderate heat
    const socStress = (100 - soc) * 0.04; // Stress increases significantly at low SOC
    const temperature = Math.min(32, baseTemp + powerTemp + socStress);
    
    // Voltage differential (cell imbalance)
    // Dataset shows range: 0.001V to 0.6V
    // Increases at extreme SOC levels (very high or very low)
    let voltDiff;
    if (soc > 90) {
      voltDiff = 0.04 + (soc - 90) * 0.008;
    } else if (soc < 15) {
      voltDiff = 0.07 + (15 - soc) * 0.01;
    } else {
      voltDiff = 0.01 + Math.abs(soc - 50) * 0.0015;
    }
    
    return {
      voltage: Math.max(38, Math.min(63.5, voltage)),
      current: Math.max(0.1, Math.min(1.8, current)),
      power: power,
      temperature: temperature,
      voltDiff: Math.min(0.6, voltDiff)
    };
  };

  const batteryParams = calculateBatteryParams(socSlider);

  // Correlate feasibility with actual route distance
  const socAdjustedDistance = routeInfo?.socAdjustedDistance || routeDistance;
  const dteStatus = routeDistance && dte > (socAdjustedDistance * 1.1) ? 'safe' : 
                   routeDistance && dte >= (socAdjustedDistance * 0.8) ? 'critical' : 
                   'impossible';

  const trafficSeverityLabel = (severity) => {
    switch (severity) {
      case 'heavy': return 'Heavy';
      case 'moderate': return 'Moderate';
      default: return 'Smooth';
    }
  };

  const trafficColor = routeInfo?.severity === 'heavy' ? '#ef4444' : routeInfo?.severity === 'moderate' ? '#f59e0b' : '#22c55e';
  const hasLiveTrafficData = routeInfo?.hasLiveTraffic;
  const socAdjustedDuration = routeInfo?.socAdjustedDuration;

  const getSOCColor = (soc) => {
    if (soc > 50) return '#10b981';
    if (soc > 20) return '#f59e0b';
    return '#ef4444';
  };

  const getStatusColor = (status) => {
    if (status === 'safe') return '#10b981';
    if (status === 'critical') return '#f59e0b';
    return '#ef4444';
  };

  const getSOHColor = (health) => {
    if (health >= 95) return '#10b981';
    if (health >= 85) return '#3b82f6';
    if (health >= 80) return '#f59e0b';
    return '#ef4444';
  };

  const activeDatasetProfile = datasetProfile || TRINITY_DATASET_PROFILE;

  const healthMetrics = calculateBatteryHealthMetrics({
    soc: getNumeric(socSlider, batteryData?.Actual_SOC, batteryData?.SOC, 0),
    temperatureC: getNumeric(batteryData?.Max_Temp_C, batteryData?.temperature, batteryParams.temperature, 25),
    voltageDiffV: getNumeric(batteryData?.Volt_Diff_V, batteryData?.voltage_diff, batteryData?.volt_diff, batteryParams.voltDiff, 0.05),
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

  const soh = healthMetrics.soh;
  
  const [customEol, setCustomEol] = useState(null);
  const activeEol = customEol ?? healthMetrics.eolThreshold;
  
  const dynamicRul = Math.max(0, (soh - activeEol) / healthMetrics.yearlyDegradation);
  const bestCaseRul = Math.max(0, (soh - activeEol) / (healthMetrics.yearlyDegradation * 0.85));
  const worstCaseRul = Math.max(0, (soh - activeEol) / (healthMetrics.yearlyDegradation * 1.15));

  const cycleFade = healthMetrics.cycleFade || 0;
  const calendarFade = healthMetrics.calendarFade || 0;
  const tempPenalty = healthMetrics.tempPenalty || 0;
  const imbalancePenalty = healthMetrics.imbalancePenalty || 0;
  const baseSoh = soh + cycleFade + calendarFade + tempPenalty + imbalancePenalty;
  
  const donutData = [
    { name: 'Cycle Wear', value: cycleFade, color: '#f97316' },
    { name: 'Calendar Aging', value: calendarFade, color: '#a855f7' },
    { name: 'Temp Impact', value: tempPenalty, color: '#ef4444' },
    { name: 'Imbalance', value: imbalancePenalty, color: '#eab308' },
  ].filter(d => d.value > 0);

  const currentYear = new Date().getFullYear();
  const projectionData = [];
  const resolution = Math.max(1, Math.floor(dynamicRul / 4));
  for (let i = 0; i <= Math.ceil(dynamicRul); i += resolution) {
    projectionData.push({
      year: currentYear + i,
      soh: Number(Math.max(activeEol, soh - (i * healthMetrics.yearlyDegradation)).toFixed(1)),
      threshold: activeEol
    });
  }
  if (dynamicRul > 0) {
    projectionData.push({
      year: Number((currentYear + dynamicRul).toFixed(1)),
      soh: activeEol,
      threshold: activeEol
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Side-by-Side Grid for Status and SOC */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* BATTERY STATUS */}
        <div style={{
          background: 'linear-gradient(160deg, rgba(8, 10, 14, 0.96) 0%, rgba(2, 3, 6, 0.96) 100%)',
          border: '1px solid rgba(148, 163, 184, 0.22)',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(148, 163, 184, 0.08)',
          backdropFilter: 'blur(16px)',
          transition: 'all 0.3s ease'
        }} className="slide-up">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>Battery Status</h3>
            <span style={{ fontSize: '11px', color: '#38bdf8', letterSpacing: '0.1em', textTransform: 'uppercase', border: '1px solid rgba(56, 189, 248, 0.5)', borderRadius: '9999px', padding: '4px 10px' }}>Battery</span>
          </div>

          {/* Voltage */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#d1d5db' }}>Voltage</span>
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#60a5fa' }}>{batteryParams.voltage.toFixed(2)}V</span>
            </div>
          </div>

          {/* Current */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#d1d5db' }}>Current</span>
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#f97316' }}>{batteryParams.current.toFixed(2)}A</span>
            </div>
          </div>

          {/* Temperature */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#d1d5db' }}>Max Temperature</span>
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>{batteryParams.temperature.toFixed(2)}°C</span>
            </div>
          </div>

          {/* Power */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#d1d5db' }}>Power Output</span>
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#a855f7' }}>{batteryParams.power.toFixed(3)}kW</span>
            </div>
          </div>

          {/* SOC Progress Bar */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#d1d5db' }}>State of Charge (SOC)</span>
              <span style={{ fontSize: '28px', fontWeight: 'bold', color: getSOCColor(socSlider) }}>
                {socSlider.toFixed(1)}%
              </span>
            </div>
            <div style={{
              height: '24px',
              backgroundColor: 'rgba(55, 65, 81, 0.5)',
              borderRadius: '9999px',
              overflow: 'hidden',
              border: '1px solid #4b5563'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(socSlider, 100)}%`,
                background: `linear-gradient(90deg, ${getSOCColor(socSlider)} 0%, ${getSOCColor(socSlider)} 100%)`,
                transition: 'width 0.5s ease',
                boxShadow: `0 0 20px ${getSOCColor(socSlider)}`
              }} />
            </div>
          </div>

          {/* Volt Diff */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#d1d5db' }}>Voltage Differential</span>
              <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#06b6d4' }}>{batteryParams.voltDiff.toFixed(3)}V</span>
            </div>
          </div>
        </div>

        {/* SOC SIMULATOR */}
        <div style={{
          background: 'linear-gradient(160deg, rgba(8, 10, 14, 0.96) 0%, rgba(2, 3, 6, 0.96) 100%)',
          border: '1px solid rgba(148, 163, 184, 0.22)',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(148, 163, 184, 0.08)',
          backdropFilter: 'blur(16px)',
          transition: 'all 0.3s ease'
        }} className="slide-up">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>Battery SOC Control</h3>
            <span style={{ fontSize: '11px', color: '#f59e0b', letterSpacing: '0.1em', textTransform: 'uppercase', border: '1px solid rgba(245, 158, 11, 0.45)', borderRadius: '9999px', padding: '4px 10px' }}>SOC</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Range Slider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#d1d5db' }}>Range Slider:</label>
              <input
                type="range"
                min="0"
                max="100"
                value={socSlider}
                onChange={(e) => setSocSlider(Number(e.target.value))}
                style={{
                  width: '100%',
                  height: '8px',
                  borderRadius: '9999px',
                  background: 'rgba(55, 65, 81, 0.5)',
                  border: '1px solid #4b5563',
                  outline: 'none',
                  accentColor: '#3b82f6',
                  cursor: 'pointer'
                }}
              />
            </div>

            {/* Number Input for Manual Entry */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#d1d5db' }}>Manual Input (0-100%):</label>
              <input
                type="number"
                min="0"
                max="100"
                value={socSlider}
                onChange={(e) => setSocSlider(Math.min(100, Math.max(0, Number(e.target.value))))}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(51, 65, 85, 0.6)',
                  border: '1px solid rgba(71, 85, 105, 0.5)',
                  color: '#fff',
                  fontSize: '16px',
                  textAlign: 'center',
                  fontWeight: 'bold'
                }}
                placeholder="Enter SOC %"
              />
            </div>

            {/* Display Current SOC */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              backgroundColor: 'rgba(51, 65, 85, 0.4)',
              borderRadius: '8px',
              border: '1px solid rgba(71, 85, 105, 0.5)'
            }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#d1d5db' }}>Current SOC</span>
              <span style={{ fontSize: '28px', fontWeight: 'bold', color: getSOCColor(socSlider) }}>{socSlider}%</span>
            </div>
            {/* Quick Preset Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
              {[0, 25, 50, 75, 100].map(value => (
                <button
                  key={value}
                  onClick={() => setSocSlider(value)}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    border: socSlider === value ? '2px solid #3b82f6' : '1px solid #475569',
                    background: socSlider === value ? 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)' : 'rgba(51, 65, 85, 0.4)',
                    color: socSlider === value ? 'white' : '#a0aec0',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontSize: '12px'
                  }}
                >
                  {value}%
                </button>
              ))}
            </div>

            {/* Driving Profile Levels */}
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#d1d5db' }}>Driving Profile Level:</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {DRIVING_LEVELS.map(level => (
                  <button
                    key={level.id}
                    onClick={() => setOperatingProfile && setOperatingProfile(level.id)}
                    style={{
                      padding: '12px 8px',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      border: operatingProfile === level.id ? '2px solid #3b82f6' : '1px solid rgba(71, 85, 105, 0.5)',
                      background: operatingProfile === level.id ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.2) 0%, rgba(59, 130, 246, 0.1) 100%)' : 'rgba(51, 65, 85, 0.4)',
                      color: operatingProfile === level.id ? '#60a5fa' : '#94a3b8',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      textAlign: 'center'
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{level.label}</span>
                    <span style={{ fontSize: '10px', opacity: 0.8, lineHeight: 1.2 }}>{level.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DRIVING MODE */}
      <div style={{
        background: 'linear-gradient(160deg, rgba(8, 10, 14, 0.96) 0%, rgba(2, 3, 6, 0.96) 100%)',
        border: '1px solid rgba(148, 163, 184, 0.22)',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(148, 163, 184, 0.08)',
        backdropFilter: 'blur(16px)',
        transition: 'all 0.3s ease'
      }} className="slide-up">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>Driving Mode</h3>
          <span style={{ fontSize: '11px', color: '#22c55e', letterSpacing: '0.1em', textTransform: 'uppercase', border: '1px solid rgba(34, 197, 94, 0.45)', borderRadius: '9999px', padding: '4px 10px' }}>Drive</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          {['ECO', 'SPORT'].map(mode => (
            <button
              key={mode}
              onClick={() => {
                if (!(isSportLocked && mode === 'SPORT')) {
                  setDrivingMode(mode);
                }
              }}
              disabled={isSportLocked && mode === 'SPORT'}
              style={{
                padding: '16px',
                borderRadius: '8px',
                fontWeight: 'bold',
                border: drivingMode === mode ? '2px solid #3b82f6' : '1px solid #475569',
                background: drivingMode === mode ? 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)' : 'rgba(51, 65, 85, 0.4)',
                color: drivingMode === mode ? 'white' : '#a0aec0',
                cursor: (isSportLocked && mode === 'SPORT') ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: drivingMode === mode ? '0 8px 16px rgba(59, 130, 246, 0.3)' : 'none',
                opacity: (isSportLocked && mode === 'SPORT') ? 0.55 : 1
              }}
            >
              <div style={{ fontSize: '11px', marginBottom: '4px', letterSpacing: '0.08em' }}>{mode === 'ECO' ? 'EFFICIENT' : 'PERFORMANCE'}</div>
              <div style={{ fontSize: '14px' }}>{mode}</div>
            </button>
          ))}
        </div>

        {isSportLocked && (
          <div style={{
            marginBottom: '20px',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #ef4444',
            background: 'rgba(239, 68, 68, 0.12)',
            color: '#fca5a5',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            AMAS LOCK: SOC {socSlider.toFixed(1)}% is below {AMAS_SPORT_LOCK_SOC_THRESHOLD}%. SPORT is disabled and ECO is enforced.
          </div>
        )}

        {shouldRecommendEco && (
          <div style={{
            marginBottom: '20px',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid rgba(245, 158, 11, 0.5)',
            background: 'rgba(245, 158, 11, 0.12)',
            color: '#fcd34d',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            AMAS RECOMMENDATION: SOC {socSlider.toFixed(1)}% - switch to ECO for better range. SPORT is still allowed until SOC goes below {AMAS_SPORT_LOCK_SOC_THRESHOLD}%.
          </div>
        )}
      </div>

      {/* DTE Display & Charging Recommendation */}
      {userRole !== 'analyst' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          
          {/* DTE Display */}
          <div style={{
            background: 'linear-gradient(160deg, rgba(7, 10, 14, 0.95) 0%, rgba(2, 4, 8, 0.95) 100%)',
            border: `1px solid ${getStatusColor(dteStatus)}`,
            borderRadius: '12px',
            padding: '24px',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Distance to Empty</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', justifyContent: 'center' }}>
              <p style={{ fontSize: '48px', fontWeight: 'bold', color: '#06b6d4' }}>{dte}</p>
              <p style={{ color: '#9ca3af', fontSize: '18px' }}>km</p>
            </div>
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>Consumption: {drivingMode === 'ECO' ? '150' : '250'} Wh/km</p>
            {routeDistance && (
              <div style={{ marginTop: '16px', borderTop: '1px solid rgba(71, 85, 105, 0.5)', paddingTop: '16px' }}>
                <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px' }}>Route Distance: <span style={{ color: getStatusColor(dteStatus), fontWeight: 'bold' }}>{routeDistance} km</span></p>
                <p style={{ fontSize: '14px', fontWeight: 'bold', color: getStatusColor(dteStatus) }}>
                  {dteStatus === 'safe' ? 'SAFE - Sufficient for journey' : dteStatus === 'critical' ? 'CRITICAL - Consider charging' : 'IMPOSSIBLE - Charging required'}
                </p>
              </div>
            )}
          </div>

          {/* CHARGING RECOMMENDATION */}
          <div style={{
            background: 'linear-gradient(160deg, rgba(7, 10, 14, 0.95) 0%, rgba(2, 4, 8, 0.95) 100%)',
            border: `1px solid ${getStatusColor(dteStatus)}`,
            borderRadius: '12px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: getStatusColor(dteStatus) }}>Charging Recommendation</h3>
                <span style={{ fontSize: '10px', color: getStatusColor(dteStatus), letterSpacing: '0.1em', textTransform: 'uppercase', border: `1px solid ${getStatusColor(dteStatus)}99`, borderRadius: '9999px', padding: '3px 8px' }}>
                  Charge
                </span>
              </div>
              <p style={{ fontSize: '13px', color: '#d1d5db', lineHeight: 1.5 }}>
                {dteStatus === 'safe'
                  ? 'Battery level is sufficient for the trip under current traffic.'
                  : dteStatus === 'critical'
                    ? 'Traffic load reduces margin. Charging before departure is recommended.'
                    : 'Immediate charging is required for this route under live traffic.'}
              </p>
            </div>
            
            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
              <p style={{ fontSize: '12px', color: '#9ca3af' }}>
                Current SOC: <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{socSlider.toFixed(1)}%</span>
              </p>
              <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
                Congestion Ratio: <span style={{ color: routeInfo?.congestionRatio > 1.2 ? '#ef4444' : routeInfo?.congestionRatio > 1.05 ? '#f59e0b' : '#22c55e', fontWeight: 'bold' }}>{routeInfo?.congestionRatio || 1}x</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {userRole === 'analyst' && (
        <>
          {/* STATE OF HEALTH (SOH) */}
          <div style={{
            background: 'linear-gradient(160deg, rgba(8, 10, 14, 0.96) 0%, rgba(2, 3, 6, 0.96) 100%)',
            border: `1px solid ${getSOHColor(soh)}`,
            borderRadius: '16px',
            padding: '24px',
            boxShadow: `0 10px 30px rgba(0, 0, 0, 0.45), inset 0 0 20px rgba(56, 189, 248, 0.05)`,
            backdropFilter: 'blur(16px)'
          }} className="slide-up">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>State of Health (SOH)</h3>
              <span style={{ fontSize: '11px', color: '#38bdf8', letterSpacing: '0.1em', textTransform: 'uppercase', border: '1px solid rgba(56, 189, 248, 0.45)', borderRadius: '9999px', padding: '4px 10px' }}>Health</span>
            </div>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '24px' }}>
              {/* Circular Glowing Gauge */}
              <div style={{ position: 'relative', width: '120px', height: '120px', flexShrink: 0 }}>
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(55, 65, 81, 0.5)" strokeWidth="8" />
                  <circle 
                    cx="60" cy="60" r="54" fill="none" 
                    stroke={getSOHColor(soh)} strokeWidth="8" 
                    strokeDasharray={`${(soh / 100) * 339.292} 339.292`}
                    strokeDashoffset="0"
                    strokeLinecap="round"
                    style={{
                      transform: 'rotate(-90deg)', transformOrigin: '50% 50%',
                      transition: 'stroke-dasharray 1s ease-out',
                      filter: `drop-shadow(0 0 6px ${getSOHColor(soh)})`
                    }}
                  />
                </svg>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                  <span style={{ fontSize: '24px', fontWeight: 'bold', color: getSOHColor(soh) }}>{soh.toFixed(1)}%</span>
                  <span style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase' }}>Current</span>
                </div>
              </div>

              {/* Degradation Breakdown Donut */}
              <div style={{ flexGrow: 1, height: '140px', position: 'relative' }}>
                <p style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', position: 'absolute', top: '-10px', left: 0 }}>Capacity Fade: {(baseSoh - soh).toFixed(1)}%</p>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={55}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} style={{ filter: `drop-shadow(0 0 4px ${entry.color}80)` }} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => [`${value.toFixed(1)}%`, 'Impact']}
                      contentStyle={{ backgroundColor: 'rgba(2, 6, 23, 0.9)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', fontSize: '12px', color: '#f8fafc' }}
                      itemStyle={{ color: '#f8fafc' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px', color: '#9ca3af' }}>
              {donutData.map((item) => (
                <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: 'rgba(51, 65, 85, 0.3)', borderRadius: '8px', borderLeft: `3px solid ${item.color}` }}>
                  <span>{item.name}</span>
                  <span style={{ color: '#f8fafc', fontWeight: 'bold' }}>{item.value.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* REMAINING USEFUL LIFE (RUL) */}
          <div style={{
            background: 'linear-gradient(160deg, rgba(8, 10, 14, 0.96) 0%, rgba(2, 3, 6, 0.96) 100%)',
            border: '1px solid rgba(148, 163, 184, 0.22)',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(148, 163, 184, 0.08)',
            backdropFilter: 'blur(16px)',
            transition: 'all 0.3s ease'
          }} className="slide-up">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>Remaining Useful Life</h3>
              <span style={{ fontSize: '11px', color: '#38bdf8', letterSpacing: '0.1em', textTransform: 'uppercase', border: '1px solid rgba(56, 189, 248, 0.45)', borderRadius: '9999px', padding: '4px 10px' }}>RUL</span>
            </div>

            <p style={{
              marginTop: '-4px',
              marginBottom: '14px',
              fontSize: '11px',
              color: '#93c5fd',
              letterSpacing: '0.06em',
              textTransform: 'uppercase'
            }}>
              Dataset source: {healthMetrics.datasetName} ({healthMetrics.datasetRows} rows)
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 2fr',
              gap: '20px',
              marginBottom: '24px'
            }}>
              {/* Dynamic RUL Metric */}
              <div style={{ textAlign: 'center', padding: '20px', backgroundColor: 'rgba(51, 65, 85, 0.25)', borderRadius: '16px', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
                <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Years Remaining</p>
                <p style={{
                  fontSize: '42px',
                  fontWeight: 'bold',
                  color: dynamicRul > 5 ? '#10b981' : dynamicRul > 2 ? '#f59e0b' : '#ef4444',
                  lineHeight: '1',
                  textShadow: dynamicRul > 5 ? '0 0 20px rgba(16, 185, 129, 0.3)' : 'none'
                }}>
                  {dynamicRul.toFixed(1)}
                </p>
                <p style={{ fontSize: '11px', color: '#64748b', marginTop: '12px' }}>Range: {worstCaseRul.toFixed(1)} - {bestCaseRul.toFixed(1)} yrs</p>
              </div>

              {/* Projection Curve */}
              <div style={{ height: '160px', paddingRight: '10px' }}>
                <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Degradation Trajectory</p>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={projectionData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                    <XAxis dataKey="year" stroke="#64748b" fontSize={10} tickFormatter={(tick) => `${tick}`} />
                    <YAxis domain={['dataMin - 2', 'dataMax + 2']} stroke="#64748b" fontSize={10} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(2, 6, 23, 0.9)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px' }}
                      itemStyle={{ color: '#f8fafc', fontSize: '12px' }}
                      labelStyle={{ color: '#94a3b8', fontSize: '11px' }}
                    />
                    <Line type="monotone" dataKey="soh" stroke="#38bdf8" strokeWidth={3} dot={{ r: 3, fill: '#0f172a', strokeWidth: 2 }} activeDot={{ r: 5 }} name="Projected SOH" />
                    <Line type="stepAfter" dataKey="threshold" stroke="#ef4444" strokeWidth={1} strokeDasharray="5 5" dot={false} name="EOL Limit" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Interactive Threshold Slider */}
            <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: '600' }}>Target EOL Threshold: <span style={{ color: '#ef4444' }}>{activeEol}%</span></span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Drag to simulate extended life</span>
              </div>
              <input
                type="range"
                min="60"
                max="85"
                step="1"
                value={activeEol}
                onChange={(e) => setCustomEol(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#ef4444', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: '#64748b' }}>
                <span>60% (Extreme)</span>
                <span>85% (Conservative)</span>
              </div>
            </div>

          </div>
        </>
      )}

      {/* Moved from RightMapPanel */}
      {routeInfo && userRole !== 'analyst' && (
        <>
          <div style={{
            background: 'linear-gradient(160deg, rgba(8, 10, 14, 0.96) 0%, rgba(2, 3, 6, 0.96) 100%)',
            border: '1px solid rgba(148, 163, 184, 0.22)',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#f8fafc' }}>Range Envelope</h3>
              <span style={{ fontSize: '11px', color: '#22c55e', letterSpacing: '0.1em', textTransform: 'uppercase', border: '1px solid rgba(34, 197, 94, 0.45)', borderRadius: '9999px', padding: '4px 10px' }}>Range</span>
            </div>
            <p style={{ fontSize: '14px', color: '#d1d5db', marginBottom: '12px' }}>
              Current driving range with {drivingMode} mode (SOC: {socSlider}%)
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#06b6d4' }}>{dte}km</span>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>Available range</span>
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(160deg, rgba(8, 10, 14, 0.96) 0%, rgba(2, 3, 6, 0.96) 100%)',
            border: '1px solid rgba(148, 163, 184, 0.22)',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#f8fafc' }}>Route Information</h3>
              <span style={{ fontSize: '11px', color: trafficColor, letterSpacing: '0.1em', textTransform: 'uppercase', border: `1px solid ${trafficColor}99`, borderRadius: '9999px', padding: '4px 10px' }}>
                {trafficSeverityLabel(routeInfo.severity)} Traffic
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
                <span style={{ color: '#9ca3af', fontSize: '13px' }}>Route Distance</span>
                <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{routeInfo.distance || routeDistance} km</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
                <span style={{ color: '#9ca3af', fontSize: '13px' }}>Base ETA</span>
                <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{routeInfo.duration ? `${routeInfo.duration} min` : 'n/a'}</span>
              </div>
              {hasLiveTrafficData && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
                  <span style={{ color: '#9ca3af', fontSize: '13px' }}>Live Traffic ETA</span>
                  <span style={{ color: trafficColor, fontWeight: 'bold' }}>
                    {routeInfo.durationInTraffic ? `${routeInfo.durationInTraffic} min` : 'n/a'}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
                <span style={{ color: '#9ca3af', fontSize: '13px' }}>SOC-Adjusted ETA</span>
                <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>
                  {socAdjustedDuration ? `${socAdjustedDuration} min` : 'n/a'}
                </span>
              </div>
              {hasLiveTrafficData && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
                  <span style={{ color: '#9ca3af', fontSize: '13px' }}>Traffic Delay</span>
                  <span style={{ color: routeInfo.delayMinutes > 0 ? '#f59e0b' : '#10b981', fontWeight: 'bold' }}>
                    {routeInfo.delayMinutes ? `+${routeInfo.delayMinutes} min` : '0 min'}
                  </span>
                </div>
              )}
              {hasLiveTrafficData && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
                  <span style={{ color: '#9ca3af', fontSize: '13px' }}>Traffic Distance</span>
                  <span style={{ color: trafficColor, fontWeight: 'bold' }}>
                    {routeInfo.effectiveDistance || routeDistance} km
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
                <span style={{ color: '#9ca3af', fontSize: '13px' }}>SOC-Adjusted Distance</span>
                <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>
                  {socAdjustedDistance} km
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
                <span style={{ color: '#9ca3af', fontSize: '13px' }}>DTE vs SOC Distance</span>
                <span style={{ color: getStatusColor(dteStatus), fontWeight: 'bold', fontSize: '12px' }}>
                  {dte}km / {socAdjustedDistance}km
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
                <span style={{ color: '#9ca3af', fontSize: '13px' }}>SOC Impact Factor</span>
                <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>
                  +{(routeInfo.socAdjustmentFactor * 100).toFixed(1)}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
                <span style={{ color: '#9ca3af', fontSize: '13px' }}>Routes Evaluated</span>
                <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>
                  {routeInfo.alternativesEvaluated || 1}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
                <span style={{ color: '#9ca3af', fontSize: '13px' }}>Traffic Source</span>
                <span style={{ color: '#38bdf8', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px' }}>
                  {routeInfo.routeProvider || 'n/a'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
                <span style={{ color: '#9ca3af', fontSize: '13px' }}>Feasibility</span>
                <span style={{ color: getStatusColor(dteStatus), fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px' }}>
                  {dteStatus === 'safe' ? 'Safe' : dteStatus === 'critical' ? 'Critical' : 'Impossible'}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
