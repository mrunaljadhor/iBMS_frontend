'use client';

import { calculateBatteryHealthMetrics } from '../utils/batteryHealth';
import { TRINITY_DATASET_PROFILE } from '../utils/trinityDatasetProfile';

export default function LeftPanel({ batteryData, drivingMode, setDrivingMode, socSlider, setSocSlider, calculateDTE, routeDistance, datasetProfile }) {
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
  const dteStatus = routeDistance && dte > (routeDistance * 1.1) ? 'safe' : 
                   routeDistance && dte >= (routeDistance * 0.8) ? 'critical' : 
                   'impossible';

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
  const rul = healthMetrics.rulYears;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
            <>
              <div style={{ marginTop: '16px', borderTop: '1px solid rgba(71, 85, 105, 0.5)', paddingTop: '16px' }}>
                <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px' }}>Route Distance: <span style={{ color: getStatusColor(dteStatus), fontWeight: 'bold' }}>{routeDistance} km</span></p>
                <p style={{ fontSize: '14px', fontWeight: 'bold', color: getStatusColor(dteStatus) }}>
                  {dteStatus === 'safe' ? 'SAFE - Sufficient for journey' : dteStatus === 'critical' ? 'CRITICAL - Consider charging' : 'IMPOSSIBLE - Charging required'}
                </p>

        {/* STATE OF HEALTH (SOH) */}
        <div style={{
          background: 'linear-gradient(160deg, rgba(8, 10, 14, 0.96) 0%, rgba(2, 3, 6, 0.96) 100%)',
          border: `1px solid ${getSOHColor(soh)}`,
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)'
        }} className="slide-up">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>State of Health (SOH)</h3>
            <span style={{ fontSize: '11px', color: '#38bdf8', letterSpacing: '0.1em', textTransform: 'uppercase', border: '1px solid rgba(56, 189, 248, 0.45)', borderRadius: '9999px', padding: '4px 10px' }}>Health</span>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#9ca3af' }}>Battery Health Status</span>
              <span style={{ fontSize: '28px', fontWeight: 'bold', color: getSOHColor(soh) }}>
                {soh.toFixed(1)}%
              </span>
            </div>
            <div style={{
              height: '16px',
              backgroundColor: 'rgba(55, 65, 81, 0.5)',
              borderRadius: '9999px',
              overflow: 'hidden',
              border: '1px solid #4b5563'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(soh, 100)}%`,
                background: `linear-gradient(90deg, ${getSOHColor(soh)} 0%, ${getSOHColor(soh)} 100%)`,
                transition: 'width 0.5s ease',
                boxShadow: `0 0 15px ${getSOHColor(soh)}`
              }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px', color: '#9ca3af' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', backgroundColor: 'rgba(51, 65, 85, 0.3)', borderRadius: '6px' }}>
              <span>Temperature Impact</span>
              <span style={{ color: '#60a5fa' }}>{healthMetrics.tempPenalty.toFixed(1)}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', backgroundColor: 'rgba(51, 65, 85, 0.3)', borderRadius: '6px' }}>
              <span>Cell Imbalance Risk</span>
              <span style={{ color: healthMetrics.imbalancePenalty > 5 ? '#f59e0b' : '#10b981' }}>
                {healthMetrics.imbalancePenalty.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
              </div>
            </>
          )}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
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
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '16px'
        }}>
          <div style={{ textAlign: 'center', padding: '16px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '12px' }}>
            <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Years Remaining</p>
            <p style={{
              fontSize: '36px',
              fontWeight: 'bold',
              color: rul > 5 ? '#10b981' : rul > 2 ? '#f59e0b' : '#ef4444'
            }}>
              {rul.toFixed(1)}
            </p>
            <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>Until end of life</p>
          </div>

          <div style={{ padding: '16px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '12px' }}>
            <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Health Progression</p>
            <div style={{
              height: '3px',
              backgroundColor: 'rgba(55, 65, 81, 0.5)',
              borderRadius: '9999px',
              marginBottom: '8px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(soh, 100)}%`,
                background: `linear-gradient(90deg, #10b981 0%, #3b82f6 50%, #ef4444 100%)`,
                transition: 'width 0.5s ease'
              }} />
            </div>
            <p style={{ fontSize: '11px', color: '#9ca3af' }}>
              Current: <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{soh.toFixed(1)}%</span> → Threshold: {healthMetrics.eolThreshold}%
            </p>
          </div>
        </div>

        <div style={{ padding: '12px', backgroundColor: 'rgba(100, 116, 139, 0.2)', borderRadius: '8px', marginBottom: '12px' }}>
          <p style={{ fontSize: '12px', color: '#9ca3af' }}>
            {rul > 5 ? 'Battery lifespan excellent - more than 5 years expected'
            : rul > 3 ? 'Battery lifespan good - 3 to 5 years expected'
            : rul > 1 ? 'Battery nearing end of life - 1 to 3 years remaining'
            : 'Battery at end of life - replacement planning recommended'}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '11px', color: '#6b7280' }}>
          <div>
            <p><strong>Degradation Rate:</strong></p>
            <p style={{ marginTop: '4px', color: '#9ca3af' }}>~{healthMetrics.yearlyDegradation.toFixed(1)}% per year</p>
          </div>
          <div>
            <p><strong>End of Life at:</strong></p>
            <p style={{ marginTop: '4px', color: '#9ca3af' }}>{healthMetrics.eolThreshold}% SOH</p>
          </div>
        </div>
      </div>
    </div>
  );
}
