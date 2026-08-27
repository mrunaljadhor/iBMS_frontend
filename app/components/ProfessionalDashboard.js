'use client';

import { useState, useEffect } from 'react';
import LeftPanel from './LeftPanel';
import OverviewAnalyticsPanel from './OverviewAnalyticsPanel';
import AdvancedIntelligenceSuite from './AdvancedIntelligenceSuite';
import RightMapPanel from './RightMapPanel';
import { TRINITY_DATASET_PROFILE } from '../utils/trinityDatasetProfile';
import { deriveDatasetProfileFromCsv } from '../utils/datasetProfile';

const VEHICLE_OPTIONS = [
  {
    id: 'trinity_ev',
    label: 'Trinity EV',
    description: 'Reference profile calibrated from trinity_ev_dataset',
    datasetProfile: {
      ...TRINITY_DATASET_PROFILE
    }
  },
  {
    id: 'urban_commuter',
    label: 'Urban Commuter EV',
    description: 'City-focused profile with moderate cycle utilization',
    datasetProfile: {
      ...TRINITY_DATASET_PROFILE,
      datasetName: 'urban_commuter_reference_dataset',
      rows: 1420,
      baselineSoh: 98.1,
      cycleCount: 720,
      designCycleLife: 4200,
      batteryAgeYears: 2.8,
      calendarFadePerYear: 0.4,
      cycleFadeTotalAtEol: 20,
      nominalTemperatureC: 31.2,
      nominalVoltDiffV: 0.0063
    }
  },
  {
    id: 'touring_suv',
    label: 'Touring SUV EV',
    description: 'Long-range profile tuned for lower stress per cycle',
    datasetProfile: {
      ...TRINITY_DATASET_PROFILE,
      datasetName: 'touring_suv_reference_dataset',
      rows: 2140,
      baselineSoh: 99.0,
      cycleCount: 540,
      designCycleLife: 6000,
      batteryAgeYears: 2.2,
      calendarFadePerYear: 0.28,
      cycleFadeTotalAtEol: 16,
      nominalTemperatureC: 29.6,
      nominalVoltDiffV: 0.0049
    }
  }
];

const DRIVING_LEVELS = [
  { id: 'level_1', label: 'Level 1: Optimal', description: 'Normal Braking, Normal Acceleration', factor: 1.0 },
  { id: 'level_2', label: 'Level 2: Moderate', description: 'Aggressive Braking, Normal Acceleration', factor: 1.1 },
  { id: 'level_3', label: 'Level 3: High Drain', description: 'Normal Braking, Aggressive Acceleration', factor: 1.25 },
  { id: 'level_4', label: 'Level 4: Extreme', description: 'Aggressive Braking, Aggressive Acceleration', factor: 1.4 }
];

const TRINITY_FULL_RANGE_KM = {
  ECO: 76,
  SPORT: 62
};

const DEFAULT_VEHICLE_ID = 'trinity_ev';

const getVehicleOption = (vehicleId) =>
  VEHICLE_OPTIONS.find((vehicle) => vehicle.id === vehicleId) || VEHICLE_OPTIONS[0];

const getVehicleDatasetProfile = (vehicleId) => ({
  ...getVehicleOption(vehicleId).datasetProfile
});

export default function ProfessionalDashboard() {
  const defaultVehicleProfile = getVehicleDatasetProfile(DEFAULT_VEHICLE_ID);

  const [batteryData, setBatteryData] = useState({
    Voltage_V: 58.98,
    Current_A: 0.39,
    Max_Temp_C: 25.0,
    Actual_SOC: 41.7,
    Power_KW: 0.023,
    Volt_Diff_V: 0.083,
    Drive_Mode: 'ECO',
    Dataset_Name: defaultVehicleProfile.datasetName,
    Dataset_Rows: defaultVehicleProfile.rows,
    Cycle_Count: defaultVehicleProfile.cycleCount,
    Design_Cycle_Life: defaultVehicleProfile.designCycleLife,
    Battery_Age_Years: defaultVehicleProfile.batteryAgeYears,
    SOH_Baseline: defaultVehicleProfile.baselineSoh,
    EOL_Threshold: defaultVehicleProfile.eolThreshold
  });
  const [selectedVehicle, setSelectedVehicle] = useState(DEFAULT_VEHICLE_ID);
  const [activeDatasetProfile, setActiveDatasetProfile] = useState(defaultVehicleProfile);
  const [datasetMode, setDatasetMode] = useState('default');
  const [operatingProfile, setOperatingProfile] = useState('level_1');
  const [amsaAlert, setAmsaAlert] = useState(null);
  const [datasetMessage, setDatasetMessage] = useState(
    `Using normal configuration for ${getVehicleOption(DEFAULT_VEHICLE_ID).label} with dataset profile: ${defaultVehicleProfile.datasetName}`
  );
  const [datasetError, setDatasetError] = useState('');
  const [datasetInputKey, setDatasetInputKey] = useState(0);

  const [drivingMode, setDrivingMode] = useState('ECO');
  const [socSlider, setSocSlider] = useState(41.7);
  const [loading, setLoading] = useState(false);
  const [origin, setOrigin] = useState({ lat: 28.6328, lng: 77.2197, name: 'New Delhi' });
  const [destination, setDestination] = useState({ lat: 28.5821, lng: 77.3662, name: 'Noida' });
  const [routeDistance, setRouteDistance] = useState(25); // in km
  const [updateRoute, setUpdateRoute] = useState(false);
  const [userRole, setUserRole] = useState('user'); // 'user' or 'analyst'
  const [routeInfo, setRouteInfo] = useState(null);

  const applyDatasetProfile = (profile) => {
    setActiveDatasetProfile(profile);
    setBatteryData((previous) => ({
      ...previous,
      Dataset_Name: profile.datasetName,
      Dataset_Rows: profile.rows,
      Cycle_Count: profile.cycleCount,
      Design_Cycle_Life: profile.designCycleLife,
      Battery_Age_Years: profile.batteryAgeYears,
      SOH_Baseline: profile.baselineSoh,
      EOL_Threshold: profile.eolThreshold,
      Max_Temp_C: profile.nominalTemperatureC,
      Volt_Diff_V: profile.nominalVoltDiffV
    }));
  };

  const applyVehicleDefaultProfile = (vehicleId) => {
    const selectedVehicleOption = getVehicleOption(vehicleId);
    const profile = getVehicleDatasetProfile(vehicleId);
    applyDatasetProfile(profile);
    setDatasetMode('default');
    setDatasetMessage(
      `Using normal configuration for ${selectedVehicleOption.label} with dataset profile: ${profile.datasetName}`
    );
  };

  const handleVehicleChange = (event) => {
    const nextVehicleId = event.target.value;
    setSelectedVehicle(nextVehicleId);
    setDatasetError('');

    if (datasetMode === 'custom') {
      const nextVehicleOption = getVehicleOption(nextVehicleId);
      setDatasetMessage(
        `Custom dataset is active for ${nextVehicleOption.label}. Click \"Use Normal Configuration\" to restore the vehicle default profile.`
      );
      return;
    }

    applyVehicleDefaultProfile(nextVehicleId);
  };

  const handleDatasetUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setDatasetError('');

    try {
      const csvText = await file.text();
      const { profile, summary } = deriveDatasetProfileFromCsv(
        csvText,
        file.name,
        TRINITY_DATASET_PROFILE
      );

      applyDatasetProfile(profile);
      setDatasetMode('custom');

      if (summary.missingColumns.length) {
        setDatasetMessage(
          `Custom dataset loaded (${profile.datasetName}) with ${summary.rows} rows for ${getVehicleOption(selectedVehicle).label}. Missing ${summary.missingColumns.join(', ')} so defaults are used where needed.`
        );
      } else {
        setDatasetMessage(
          `Custom dataset loaded (${profile.datasetName}) with ${summary.rows} rows for ${getVehicleOption(selectedVehicle).label}. iBMS health model is now running on this dataset profile.`
        );
      }
    } catch (error) {
      setDatasetError(error?.message || 'Failed to parse custom dataset.');
      applyVehicleDefaultProfile(selectedVehicle);
    }
  };

  const handleUseDefaultDataset = () => {
    setDatasetError('');
    applyVehicleDefaultProfile(selectedVehicle);
    setDatasetInputKey((current) => current + 1);
  };

  const estimateRangeAtSoc = (socPercent, mode = drivingMode, profile = operatingProfile) => {
    const safeSoc = Math.max(0, Math.min(100, Number(socPercent) || 0));
    const normalizedMode = String(mode || 'ECO').toUpperCase();
    const baseFullRange = TRINITY_FULL_RANGE_KM[normalizedMode] || TRINITY_FULL_RANGE_KM.ECO;
    const profileFactor = DRIVING_LEVELS.find(l => l.id === profile)?.factor || 1.0;
    return Math.round((safeSoc / 100) * (baseFullRange / profileFactor));
  };

  const calculateDTE = () => estimateRangeAtSoc(socSlider);

  useEffect(() => {
    // Basic SOC lock
    if (socSlider < 40 && drivingMode === 'SPORT') {
      setDrivingMode('ECO');
    }

    // AMSA 4-Level Logic: Prevent selection of extreme levels if destination is unreachable
    const currentDte = estimateRangeAtSoc(socSlider, drivingMode, operatingProfile);
    if (currentDte < routeDistance && operatingProfile !== 'level_1') {
      const optimalDte = estimateRangeAtSoc(socSlider, drivingMode, 'level_1');
      if (optimalDte >= routeDistance) {
        setOperatingProfile('level_1');
        setAmsaAlert(`AMSA ECO-LOCK ENGAGED: Destination unreachable on current level. Forcing Level 1 to ensure safe arrival.`);
        
        // Auto-hide alert after 8 seconds
        const timer = setTimeout(() => setAmsaAlert(null), 8000);
        return () => clearTimeout(timer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socSlider, drivingMode, operatingProfile, routeDistance]);

  // Route distance is now traffic-aware and updated by RightMapPanel.
  // Keep the shared state here so other panels can consume the adjusted distance.

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at 15% 10%, rgba(22, 163, 74, 0.08) 0%, rgba(0, 0, 0, 0) 28%), radial-gradient(circle at 85% 0%, rgba(37, 99, 235, 0.1) 0%, rgba(0, 0, 0, 0) 30%), linear-gradient(160deg, #020202 0%, #05070b 45%, #010101 100%)',
      padding: '28px'
    }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        {amsaAlert && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            color: '#f87171',
            padding: '16px',
            borderRadius: '12px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontWeight: 500
          }}>
            <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            {amsaAlert}
          </div>
        )}
        {/* Premium Header */}
        <div style={{ marginBottom: '36px' }} className="slide-up">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '6px',
                height: '34px',
                background: 'linear-gradient(180deg, #22c55e 0%, #0ea5e9 100%)',
                borderRadius: '9999px'
              }}></div>
              <h1 style={{
                fontSize: '40px',
                fontWeight: 700,
                color: '#f8fafc',
                letterSpacing: '0.02em',
                fontFamily: "'Sora', 'Segoe UI', sans-serif",
                margin: 0
              }}>iBMS FOR EVs</h1>
            </div>

            {/* Role Toggle Switch */}
            <div style={{
              display: 'flex',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(71, 85, 105, 0.5)',
              borderRadius: '999px',
              padding: '4px',
              gap: '4px'
            }}>
              <button
                onClick={() => setUserRole('user')}
                style={{
                  padding: '8px 20px',
                  borderRadius: '999px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: userRole === 'user' ? 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)' : 'transparent',
                  color: userRole === 'user' ? '#fff' : '#94a3b8',
                  transition: 'all 0.3s ease',
                  boxShadow: userRole === 'user' ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none'
                }}
              >
                User View
              </button>
              <button
                onClick={() => setUserRole('analyst')}
                style={{
                  padding: '8px 20px',
                  borderRadius: '999px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: userRole === 'analyst' ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'transparent',
                  color: userRole === 'analyst' ? '#fff' : '#94a3b8',
                  transition: 'all 0.3s ease',
                  boxShadow: userRole === 'analyst' ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none'
                }}
              >
                Analyst View
              </button>
            </div>
          </div>
          <p style={{ color: '#94a3b8', marginLeft: '18px', fontSize: '14px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Real-Time Monitoring | Predictive Battery Health | Route Intelligence
          </p>
          {loading && <div style={{ marginTop: '10px', marginLeft: '18px', fontSize: '12px', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data synchronization in progress</div>}
        </div>

        <div style={{
          marginBottom: '22px',
          background: 'linear-gradient(160deg, rgba(8, 10, 14, 0.96) 0%, rgba(2, 3, 6, 0.96) 100%)',
          border: '1px solid rgba(148, 163, 184, 0.22)',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)'
        }} className="slide-up">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', letterSpacing: '0.02em' }}>
              Configuration
            </h3>
            <span style={{
              fontSize: '11px',
              color: '#38bdf8',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              border: '1px solid rgba(56, 189, 248, 0.45)',
              borderRadius: '9999px',
              padding: '4px 10px'
            }}>
              Local
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '10px', padding: '12px' }}>
              <label style={{ display: 'block', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '8px' }}>
                Vehicle
              </label>
              <select
                value={selectedVehicle}
                onChange={handleVehicleChange}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(51, 65, 85, 0.6)',
                  border: '1px solid rgba(71, 85, 105, 0.5)',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '13px'
                }}
              >
                {VEHICLE_OPTIONS.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>{vehicle.label}</option>
                ))}
              </select>
              <p style={{ marginTop: '8px', fontSize: '12px', color: '#9ca3af' }}>
                {VEHICLE_OPTIONS.find((vehicle) => vehicle.id === selectedVehicle)?.description}
              </p>
            </div>



            <div style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '10px', padding: '12px' }}>
              <label style={{ display: 'block', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '8px' }}>
                Dataset Source
              </label>
              <input
                key={datasetInputKey}
                type="file"
                accept=".csv"
                onChange={handleDatasetUpload}
                style={{
                  width: '100%',
                  color: '#cbd5e1',
                  fontSize: '12px',
                  marginBottom: '10px'
                }}
              />
              <button
                onClick={handleUseDefaultDataset}
                style={{
                  width: '100%',
                  padding: '9px',
                  borderRadius: '6px',
                  border: '1px solid rgba(56, 189, 248, 0.45)',
                  background: datasetMode === 'default' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(30, 41, 59, 0.55)',
                  color: '#cbd5e1',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Use Normal Configuration
              </button>
            </div>
          </div>

          <p style={{ fontSize: '12px', color: '#93c5fd', marginBottom: datasetError ? '8px' : '0' }}>
            {datasetMessage}
          </p>
          {datasetError && (
            <p style={{ fontSize: '12px', color: '#fca5a5' }}>{datasetError}</p>
          )}
        </div>

        <OverviewAnalyticsPanel
          userRole={userRole}
          socSlider={socSlider}
          drivingMode={drivingMode}
          routeDistance={routeDistance}
          calculateDTE={calculateDTE}
          estimateRangeAtSoc={estimateRangeAtSoc}
          batteryData={batteryData}
          datasetProfile={activeDatasetProfile}
        />



        {/* Main Dashboard - Split Screen */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: userRole !== 'analyst' ? '3.5fr 6.5fr' : '1fr 1fr',
          gap: '22px',
          minHeight: 'calc(100vh - 240px)'
        }}>
          {/* LEFT PANEL - 50% */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', paddingRight: '16px' }}>
            <LeftPanel
              userRole={userRole}
              batteryData={batteryData}
              drivingMode={drivingMode}
              setDrivingMode={setDrivingMode}
              socSlider={socSlider}
              setSocSlider={setSocSlider}
              calculateDTE={calculateDTE}
              routeDistance={routeDistance}
              datasetProfile={activeDatasetProfile}
              routeInfo={routeInfo}
              operatingProfile={operatingProfile}
              setOperatingProfile={setOperatingProfile}
            />
          </div>

          {/* RIGHT PANEL - 50% */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', paddingRight: '16px' }}>
            {userRole !== 'analyst' ? (
              <RightMapPanel
                origin={origin}
                setOrigin={setOrigin}
                destination={destination}
                setDestination={setDestination}
                batteryData={batteryData}
                drivingMode={drivingMode}
                calculateDTE={calculateDTE}
                routeDistance={routeDistance}
                setRouteDistance={setRouteDistance}
                socSlider={socSlider}
                datasetProfile={activeDatasetProfile}
                onRouteInfoUpdate={setRouteInfo}
              />
            ) : (
              <AdvancedIntelligenceSuite
                userRole={userRole}
                batteryData={batteryData}
                drivingMode={drivingMode}
                socSlider={socSlider}
                routeDistance={routeDistance}
                calculateDTE={calculateDTE}
                datasetProfile={activeDatasetProfile}
              />
            )}
          </div>
        </div>

        {userRole === 'user' && (
          <AdvancedIntelligenceSuite
            userRole={userRole}
            batteryData={batteryData}
            drivingMode={drivingMode}
            socSlider={socSlider}
            routeDistance={routeDistance}
            calculateDTE={calculateDTE}
            datasetProfile={activeDatasetProfile}
          />
        )}
      </div>
    </div>
  );
}

