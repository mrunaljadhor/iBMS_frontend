'use client';

import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { calculateBatteryHealthMetrics } from '../utils/batteryHealth';
import { TRINITY_DATASET_PROFILE } from '../utils/trinityDatasetProfile';

const API_BASE = '';

const SAMPLE_FLEET = [
  { id: 'north-17', region: 'Northern Fleet', soh: 78.4, temperature: 39.2, cycles: 1468, voltageDiff: 0.094, maintenance: 'overdue' },
  { id: 'north-23', region: 'Northern Fleet', soh: 81.7, temperature: 36.1, cycles: 1322, voltageDiff: 0.073, maintenance: 'due soon' },
  { id: 'north-31', region: 'Northern Fleet', soh: 83.6, temperature: 34.8, cycles: 1184, voltageDiff: 0.058, maintenance: 'healthy' },
  { id: 'central-08', region: 'Central Fleet', soh: 86.9, temperature: 31.4, cycles: 975, voltageDiff: 0.047, maintenance: 'healthy' },
  { id: 'south-02', region: 'Southern Fleet', soh: 89.3, temperature: 29.7, cycles: 830, voltageDiff: 0.039, maintenance: 'healthy' }
];

const suiteCard = {
  background: 'linear-gradient(160deg, rgba(8, 10, 14, 0.96) 0%, rgba(2, 3, 6, 0.96) 100%)',
  border: '1px solid rgba(148, 163, 184, 0.22)',
  borderRadius: '16px',
  padding: '18px',
  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
  backdropFilter: 'blur(16px)'
};

const miniCard = {
  background: 'rgba(15, 23, 42, 0.52)',
  border: '1px solid rgba(71, 85, 105, 0.45)',
  borderRadius: '12px',
  padding: '14px'
};

const whispererPrompts = [
  'Which batteries in the northern fleet are at highest risk this week?',
  'Summarize maintenance actions for batteries below 80% SoH.',
  'What is the hottest battery right now and why is it risky?'
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pickRegion(question) {
  const normalized = String(question || '').toLowerCase();

  if (normalized.includes('north')) return 'Northern Fleet';
  if (normalized.includes('south')) return 'Southern Fleet';
  if (normalized.includes('central')) return 'Central Fleet';
  return null;
}

function riskScore(battery) {
  const sohPenalty = (100 - battery.soh) * 0.55;
  const temperaturePenalty = Math.max(0, battery.temperature - 30) * 0.85;
  const cyclePenalty = Math.max(0, battery.cycles - 900) / 70;
  const imbalancePenalty = battery.voltageDiff * 120;
  const maintenancePenalty = battery.maintenance === 'overdue' ? 12 : battery.maintenance === 'due soon' ? 6 : 0;

  return sohPenalty + temperaturePenalty + cyclePenalty + imbalancePenalty + maintenancePenalty;
}

function buildWhispererAnswer(question, liveContext) {
  const region = pickRegion(question);
  const fleet = region ? SAMPLE_FLEET.filter((battery) => battery.region === region) : SAMPLE_FLEET;
  const ranked = [...fleet]
    .map((battery) => ({
      ...battery,
      riskScore: Number(riskScore(battery).toFixed(1))
    }))
    .sort((left, right) => right.riskScore - left.riskScore);

  const topThree = ranked.slice(0, 3);
  const critical = topThree.filter((battery) => battery.soh < 80);
  const topBattery = ranked[0];
  const liveSoH = Number(liveContext.healthMetrics?.soh?.toFixed?.(1) ?? liveContext.healthMetrics?.soh ?? 0);
  const liveRul = Number(liveContext.healthMetrics?.rulYears?.toFixed?.(1) ?? liveContext.healthMetrics?.rulYears ?? 0);
  const estimatedRange = typeof liveContext.calculateDTE === 'function' ? liveContext.calculateDTE() : 0;

  let answer = `I scanned ${ranked.length} batteries${region ? ` in the ${region.toLowerCase()}` : ''}. `;

  if (topBattery) {
    answer += `${topBattery.id} is the highest-risk unit with ${topBattery.soh.toFixed(1)}% SoH, ${topBattery.temperature.toFixed(1)}°C, and a risk score of ${topBattery.riskScore.toFixed(1)}. `;
  }

  if (critical.length) {
    answer += `${critical.map((battery) => battery.id).join(', ')} are already below the 80% SoH threshold and should be prioritized for inspection this week. `;
  } else if (ranked.length) {
    answer += 'No units in the selected slice are below 80% SoH yet, but the top-ranked batteries should be monitored daily. ';
  }

  answer += `The live pack context currently shows ${liveSoH.toFixed(1)}% SoH, ${liveRul.toFixed(1)} years of RUL, and an estimated DTE of ${estimatedRange} km.`;

  return {
    answer,
    confidence: ranked.length ? 'High' : 'Medium',
    citations: [
      {
        label: 'Live telemetry',
        detail: `SOC ${Number(liveContext.socSlider || 0).toFixed(1)}%, temperature ${Number(liveContext.temperature || 0).toFixed(1)}°C, route ${Number(liveContext.routeDistance || 0)} km`
      },
      {
        label: 'Historical fleet logs',
        detail: `${ranked.length} records scanned from ${region || 'all regions'}; top battery ${topBattery?.id || 'n/a'} is leading the risk ranking`
      },
      {
        label: 'Model context',
        detail: `${liveContext.datasetName || TRINITY_DATASET_PROFILE.datasetName} with ${liveContext.drivingMode || 'ECO'} mode calibration`
      }
    ],
    ranked
  };
}

function buildXaiBreakdown(healthMetrics, batteryData) {
  const factors = [
    { label: 'Thermal stress', value: clamp(Number(healthMetrics?.tempPenalty || 0) * 12, 8, 48) },
    { label: 'Voltage imbalance', value: clamp(Number(healthMetrics?.imbalancePenalty || 0) * 10, 8, 34) },
    { label: 'Low SOC exposure', value: clamp(Number(healthMetrics?.lowSocPenalty || 0) * 18, 5, 22) },
    { label: 'Aging / cycle history', value: clamp((Number(healthMetrics?.batteryAgeYears || 0) * 3.3) + (Number(healthMetrics?.cycleCount || 0) / 420), 12, 40) }
  ];

  const total = factors.reduce((sum, factor) => sum + factor.value, 0) || 1;
  const normalized = factors.map((factor) => ({
    ...factor,
    percent: Number(((factor.value / total) * 100).toFixed(1))
  }));

  const narrative = `RUL is primarily driven by ${normalized[0].label.toLowerCase()} and ${normalized[1].label.toLowerCase()} for ${batteryData?.Dataset_Name || TRINITY_DATASET_PROFILE.datasetName}.`;

  return {
    normalized,
    narrative,
    signal: `${Number(healthMetrics?.soh || 0).toFixed(1)}% SoH with ${Number(healthMetrics?.rulYears || 0).toFixed(1)} years remaining`
  };
}

function buildDigitalTwinCurve({ baseSoh, loadIncreasePct, ambientTempDeltaC, cycleStressPct, horizonDays }) {
  const baseDailyDrop = clamp((100 - baseSoh) * 0.0085, 0.03, 0.32);
  const scenarioMultiplier = 1 + (loadIncreasePct * 0.018) + (ambientTempDeltaC * 0.032) + (cycleStressPct * 0.012);

  return Array.from({ length: horizonDays + 1 }, (_, day) => {
    const baseline = clamp(baseSoh - (baseDailyDrop * day), 0, 100);
    const scenario = clamp(baseSoh - (baseDailyDrop * scenarioMultiplier * day) - (loadIncreasePct * 0.04) - (ambientTempDeltaC * 0.12), 0, 100);

    return {
      day,
      baseline: Number(baseline.toFixed(1)),
      scenario: Number(scenario.toFixed(1))
    };
  });
}

async function postJson(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed for ${path}`);
  }

  return response.json();
}

export default function AdvancedIntelligenceSuite({
  batteryData,
  drivingMode,
  socSlider,
  routeDistance,
  calculateDTE,
  datasetProfile
}) {
  const [question, setQuestion] = useState(whispererPrompts[0]);
  const [messages, setMessages] = useState([]);
  const [edgeClients, setEdgeClients] = useState(6);
  const [federatedRound, setFederatedRound] = useState(3);
  const [loadIncreasePct, setLoadIncreasePct] = useState(15);
  const [ambientTempDeltaC, setAmbientTempDeltaC] = useState(6);
  const [cycleStressPct, setCycleStressPct] = useState(18);
  const [avgSpeedKmh, setAvgSpeedKmh] = useState(60);
  const [accelAggressionPct, setAccelAggressionPct] = useState(10);
  const [remoteAnalytics, setRemoteAnalytics] = useState({ whisperer: null, xai: null, federated: null, twin: null });

  const liveTemperature = Number(batteryData?.Max_Temp_C || batteryData?.temperature || 25);
  const liveVoltDiff = Number(batteryData?.Volt_Diff_V || batteryData?.voltage_diff || 0.05);

  const healthMetrics = calculateBatteryHealthMetrics({
    soc: socSlider,
    temperatureC: liveTemperature,
    voltageDiffV: liveVoltDiff,
    datasetProfile: datasetProfile || TRINITY_DATASET_PROFILE
  });

  const xai = buildXaiBreakdown(healthMetrics, batteryData);
  const baseSoH = Number(healthMetrics?.soh || 0);
  const twinData = buildDigitalTwinCurve({
    baseSoh,
    loadIncreasePct,
    ambientTempDeltaC,
    cycleStressPct,
    avgSpeedKmh,
    accelAggressionPct,
    horizonDays: 7
  });

  const federatedNodes = Array.from({ length: edgeClients }, (_, index) => {
    const nodeLoss = clamp(0.8 - (federatedRound * 0.04) - (index * 0.03), 0.12, 0.82);
    const nodeAccuracy = clamp(91.8 + (federatedRound * 0.72) + (index * 0.18), 90, 98.9);

    return {
      id: `edge-${index + 1}`,
      loss: Number(nodeLoss.toFixed(2)),
      accuracy: Number(nodeAccuracy.toFixed(1)),
      uplinkKb: Number((240 + (index * 18)).toFixed(0))
    };
  });

  const federatedBandwidth = edgeClients * 185;
  const federatedWeights = edgeClients * 9;
  const bandwidthSavings = Math.max(0, Math.round(100 - ((federatedWeights / federatedBandwidth) * 100)));

  const whispererResponse = remoteAnalytics.whisperer || buildWhispererAnswer(question, {
    socSlider,
    routeDistance,
    drivingMode,
    datasetName: datasetProfile?.datasetName,
    calculateDTE,
    healthMetrics,
    temperature: liveTemperature
  });

  const xaiDisplay = remoteAnalytics.xai
    ? {
        normalized: (remoteAnalytics.xai.breakdown || []).map((factor) => ({
          label: factor.label,
          percent: factor.percent
        })),
        narrative: remoteAnalytics.xai.narrative,
        signal: remoteAnalytics.xai.signal
      }
    : xai;

  const federatedDisplay = remoteAnalytics.federated || {
    round: federatedRound,
    edge_nodes: edgeClients,
    clients: federatedNodes,
    global_accuracy: Number((91.8 + federatedRound * 0.6).toFixed(1)),
    bandwidth_saved_pct: bandwidthSavings
  };

  const twinDisplay = remoteAnalytics.twin || {
    curve: twinData,
    projected_dte: projectedDte,
    summary: {
      baseSoh,
      loadIncreasePct,
      ambientTempDeltaC,
      cycleStressPct,
      avgSpeedKmh,
      accelAggressionPct
    }
  };

  useEffect(() => {
    let cancelled = false;

    const syncAnalytics = async () => {
      try {
        const [xaiResult, federatedResult, twinResult] = await Promise.all([
          postJson('/api/intelligence/xai', {
            voltage: Number(batteryData?.Voltage_V || batteryData?.Voltage || 0),
            current: Number(batteryData?.Current_A || batteryData?.Current || 0),
            temperature: liveTemperature,
            cycleCount: Number(batteryData?.Cycle_Count || 0),
            soc: socSlider,
            datasetProfile
          }),
          postJson('/api/intelligence/federated', {
            rounds: federatedRound,
            edgeNodes: edgeClients
          }),
          postJson('/api/intelligence/digital-twin', {
            baseSoh,
            loadIncreasePct,
            ambientTempDeltaC,
            cycleStressPct,
            avgSpeedKmh,
            accelAggressionPct,
            days: 7
          })
        ]);

        if (!cancelled) {
          setRemoteAnalytics((current) => ({
            ...current,
            xai: xaiResult,
            federated: federatedResult,
            twin: twinResult
          }));
        }
      } catch (error) {
        console.error('Failed to sync analytics:', error);
      }
    };

    syncAnalytics();

    return () => {
      cancelled = true;
    };
  }, [batteryData, baseSoH, cycleStressPct, datasetProfile, edgeClients, federatedRound, liveTemperature, loadIncreasePct, socSlider, ambientTempDeltaC, avgSpeedKmh, accelAggressionPct]);

  const handleSend = async (nextQuestion) => {
    const trimmed = String(nextQuestion || question).trim();
    if (!trimmed) return;

    let response = null;

    try {
      response = await postJson('/api/intelligence/whisperer', {
        question: trimmed,
        liveContext: {
          socSlider,
          routeDistance,
          drivingMode,
          datasetName: datasetProfile?.datasetName,
          temperature: liveTemperature,
          dte: typeof calculateDTE === 'function' ? calculateDTE() : 0
        }
      });
    } catch (error) {
      console.error('Whisperer request failed, using local fallback:', error);
      response = buildWhispererAnswer(trimmed, {
        socSlider,
        routeDistance,
        drivingMode,
        datasetName: datasetProfile?.datasetName,
        calculateDTE,
        healthMetrics,
        temperature: liveTemperature
      });
    }

    setMessages((current) => [
      ...current,
      { role: 'user', text: trimmed },
      { role: 'assistant', text: response.answer || response.text || response.answerText || response.message || response.answer || '', citations: response.citations || [] }
    ]);

    setQuestion('');
  };

  const handleRunFederatedRound = async () => {
    const nextRound = federatedRound + 1;
    setFederatedRound(nextRound);

    try {
      const result = await postJson('/api/intelligence/federated', {
        rounds: nextRound,
        edgeNodes: edgeClients
      });
      setRemoteAnalytics((current) => ({ ...current, federated: result }));
    } catch (error) {
      console.error('Federated update failed:', error);
    }
  };

  const scenarioDailyDrop = clamp((100 - baseSoH) * 0.0085 * (1 + loadIncreasePct * 0.018 + ambientTempDeltaC * 0.032 + cycleStressPct * 0.012), 0.05, 0.75);
  const projectedRul = clamp((baseSoH - healthMetrics.eolThreshold) / (scenarioDailyDrop * 365), 0, 15);
  const projectedDte = typeof calculateDTE === 'function' ? Math.max(0, Math.round(calculateDTE() * (1 - loadIncreasePct * 0.01) * (1 - ambientTempDeltaC * 0.004))) : 0;
  const twinCurve = twinDisplay.curve || twinData;

  return (
    <section style={{ marginTop: '22px' }} className="slide-up">
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', letterSpacing: '0.02em' }}>
          Intelligence Suite
        </h3>
        <p style={{ marginTop: '6px', color: '#94a3b8', fontSize: '13px' }}>
          Conversational analytics, explainable AI, federated learning, and digital twin simulation in one place.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
        <div style={suiteCard}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h4 style={{ fontSize: '15px', color: '#e2e8f0', fontWeight: 700 }}>Battery Whisperer</h4>
            <span className="badge-info">RAG Ready</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            {whispererPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => {
                  setQuestion(prompt);
                  handleSend(prompt);
                }}
                style={{
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  background: 'rgba(2, 132, 199, 0.14)',
                  color: '#bae6fd',
                  borderRadius: '999px',
                  padding: '7px 10px',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                {prompt}
              </button>
            ))}
          </div>

          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={4}
            placeholder="Ask the Battery Whisperer a fleet question..."
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              border: '1px solid rgba(71, 85, 105, 0.5)',
              background: 'rgba(15, 23, 42, 0.65)',
              color: '#f8fafc',
              resize: 'vertical',
              fontSize: '13px',
              marginBottom: '10px'
            }}
          />

          <button className="btn-primary" onClick={() => handleSend()} style={{ width: '100%', marginBottom: '12px' }}>
            Ask the fleet
          </button>

          <div style={{ display: 'grid', gap: '10px' }}>
            {(messages.length ? messages : [{ role: 'assistant', text: whispererResponse.answer || whispererResponse.text || '', citations: whispererResponse.citations || [] }]).map((message, index) => (
              <div key={`${message.role}-${index}`} style={{ ...miniCard, borderColor: message.role === 'assistant' ? 'rgba(34, 197, 94, 0.32)' : 'rgba(59, 130, 246, 0.32)' }}>
                <p style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '6px' }}>
                  {message.role === 'assistant' ? 'Assistant' : 'Operator'}
                </p>
                <p style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.6 }}>{message.text}</p>
                {message.role === 'assistant' && message.citations && (
                  <div style={{ marginTop: '10px', display: 'grid', gap: '8px' }}>
                    {message.citations.map((citation) => (
                      <div key={citation.label} style={{ fontSize: '11px', color: '#cbd5e1' }}>
                        <strong style={{ color: '#7dd3fc' }}>{citation.label}:</strong> {citation.detail}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={suiteCard}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h4 style={{ fontSize: '15px', color: '#e2e8f0', fontWeight: 700 }}>Explainable AI</h4>
            <span className="badge-warning">SHAP / LIME</span>
          </div>

          <div style={{ marginBottom: '12px', ...miniCard }}>
            <p style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Why this RUL</p>
            <p style={{ color: '#f8fafc', fontSize: '13px' }}>{xaiDisplay.narrative}</p>
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
            {xaiDisplay.normalized.map((factor) => (
              <div key={factor.label} style={miniCard}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#e2e8f0', fontSize: '12px' }}>{factor.label}</span>
                  <span style={{ color: '#7dd3fc', fontSize: '12px', fontWeight: 700 }}>{factor.percent}%</span>
                </div>
                <div style={{ height: '8px', borderRadius: '999px', background: 'rgba(71, 85, 105, 0.5)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${factor.percent}%`,
                      height: '100%',
                      borderRadius: 'inherit',
                      background: 'linear-gradient(90deg, #22c55e, #38bdf8)'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '12px', ...miniCard }}>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Current signal</p>
            <p style={{ color: '#f8fafc', fontSize: '13px' }}>{xaiDisplay.signal}</p>
          </div>
        </div>

        <div style={suiteCard}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h4 style={{ fontSize: '15px', color: '#e2e8f0', fontWeight: 700 }}>Federated Learning</h4>
            <span className="badge-success">Edge-Cloud</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px', marginBottom: '12px' }}>
            <div style={miniCard}>
              <p style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Rounds</p>
              <p style={{ fontSize: '26px', color: '#22c55e', fontWeight: 700 }}>{federatedDisplay.round || federatedRound}</p>
            </div>
            <div style={miniCard}>
              <p style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Edge nodes</p>
              <input
                type="range"
                min="3"
                max="10"
                value={edgeClients}
                onChange={(event) => setEdgeClients(Number(event.target.value))}
                style={{ width: '100%' }}
              />
              <p style={{ color: '#e2e8f0', fontSize: '13px', marginTop: '4px' }}>{edgeClients} micro-models</p>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '10px', marginBottom: '12px' }}>
            {(federatedDisplay.clients || federatedNodes).slice(0, 4).map((node) => (
              <div key={node.id} style={miniCard}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#e2e8f0', fontSize: '12px' }}>{node.id}</span>
                  <span style={{ color: '#93c5fd', fontSize: '12px' }}>{node.accuracy}% acc</span>
                </div>
                <div style={{ height: '8px', borderRadius: '999px', background: 'rgba(71, 85, 105, 0.5)', overflow: 'hidden', marginBottom: '6px' }}>
                  <div style={{ width: `${(1 - node.loss) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8, #22c55e)' }} />
                </div>
                <p style={{ color: '#94a3b8', fontSize: '11px' }}>Local update: {node.uplinkKb} KB</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
            <div style={miniCard}>
              <p style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Bandwidth saved</p>
              <p style={{ color: '#f8fafc', fontSize: '18px', fontWeight: 700 }}>{federatedDisplay.bandwidth_saved_pct ?? bandwidthSavings}%</p>
            </div>
            <div style={miniCard}>
              <p style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Global gain</p>
              <p style={{ color: '#f8fafc', fontSize: '18px', fontWeight: 700 }}>{(federatedDisplay.global_accuracy ?? (91.8 + federatedRound * 0.6)).toFixed(1)}%</p>
            </div>
          </div>

          <button className="btn-secondary" onClick={handleRunFederatedRound} style={{ width: '100%', marginTop: '12px' }}>
            Aggregate next round
          </button>
        </div>

        <div style={suiteCard}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h4 style={{ fontSize: '15px', color: '#e2e8f0', fontWeight: 700 }}>Digital Twin Simulator</h4>
            <span className="badge-danger">What-If</span>
          </div>

          <div style={{ display: 'grid', gap: '10px', marginBottom: '12px' }}>
            <div style={miniCard}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '12px' }}>Load increase: {loadIncreasePct}%</label>
              <input type="range" min="0" max="25" value={loadIncreasePct} onChange={(event) => setLoadIncreasePct(Number(event.target.value))} style={{ width: '100%' }} />
            </div>
            <div style={miniCard}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '12px' }}>Ambient temperature delta: +{ambientTempDeltaC}°C</label>
              <input type="range" min="0" max="12" value={ambientTempDeltaC} onChange={(event) => setAmbientTempDeltaC(Number(event.target.value))} style={{ width: '100%' }} />
            </div>
            <div style={miniCard}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '12px' }}>Cycle aggression: {cycleStressPct}%</label>
              <input type="range" min="0" max="30" value={cycleStressPct} onChange={(event) => setCycleStressPct(Number(event.target.value))} style={{ width: '100%' }} />
            </div>
            <div style={miniCard}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '12px' }}>Avg Speed: {avgSpeedKmh} km/h</label>
              <input type="range" min="20" max="120" value={avgSpeedKmh} onChange={(event) => setAvgSpeedKmh(Number(event.target.value))} style={{ width: '100%' }} />
            </div>
            <div style={miniCard}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '12px' }}>Acceleration Aggression: {accelAggressionPct}%</label>
              <input type="range" min="0" max="100" value={accelAggressionPct} onChange={(event) => setAccelAggressionPct(Number(event.target.value))} style={{ width: '100%' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px', marginBottom: '12px' }}>
            <div style={miniCard}>
              <p style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Projected RUL</p>
              <p style={{ color: '#f8fafc', fontSize: '18px', fontWeight: 700 }}>{projectedRul.toFixed(1)} yrs</p>
            </div>
            <div style={miniCard}>
              <p style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Projected DTE</p>
              <p style={{ color: '#f8fafc', fontSize: '18px', fontWeight: 700 }}>{projectedDte} km</p>
            </div>
          </div>

          <div style={{ width: '100%', height: '220px', marginBottom: '10px' }}>
            <ResponsiveContainer>
              <LineChart data={twinCurve}>
                <CartesianGrid stroke="rgba(148, 163, 184, 0.18)" strokeDasharray="3 3" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: '#020617', border: '1px solid rgba(148, 163, 184, 0.25)', borderRadius: '10px', color: '#e2e8f0' }}
                />
                <Line type="monotone" dataKey="baseline" stroke="#38bdf8" strokeWidth={3} dot={false} name="Baseline SoH" />
                <Line type="monotone" dataKey="scenario" stroke="#f97316" strokeWidth={3} dot={false} name="What-if SoH" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <p style={{ color: '#cbd5e1', fontSize: '12px' }}>
            Scenario change is being evaluated against the live pack context in {drivingMode} mode with {Number(routeDistance || 0)} km route pressure and {Number(calculateDTE?.() || 0)} km available DTE.
          </p>
        </div>
      </div>
    </section>
  );
}