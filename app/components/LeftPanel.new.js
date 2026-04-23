'use client';

import { useState } from 'react';

const MetricCard = ({ label, value, unit, icon, color = 'blue' }) => {
  const colorMap = {
    blue: 'text-blue-400',
    green: 'text-emerald-400',
    orange: 'text-orange-400',
    purple: 'text-purple-400',
    red: 'text-red-400',
  };

  return (
    <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/40 rounded-xl p-4 border border-slate-700/50 hover:border-blue-500/40 transition-all hover:shadow-lg hover:shadow-blue-500/10">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
          <div className="flex items-baseline gap-2">
            <p className={`text-2xl font-bold ${colorMap[color]}`}>{value}</p>
            <p className="text-xs text-gray-500">{unit}</p>
          </div>
        </div>
        <span className="text-3xl opacity-60">{icon}</span>
      </div>
    </div>
  );
};

export default function LeftPanel({ batteryData, drivingMode, setDrivingMode, socSlider, setSocSlider, calculateDTE, routeData, setRouteData }) {
  const dte = calculateDTE();
  const dteStatus = dte > 100 ? 'safe' : dte > 40 ? 'critical' : 'impossible';

  return (
    <div className="flex flex-col gap-6">
      {/* ===== BATTERY STATUS CARD - PREMIUM ===== */}
      <div className="card slide-up">
        <div className="flex items-center justify-between mb-7">
          <h3 className="text-xl font-bold text-white">Battery Status</h3>
          <span className="text-4xl">🔋</span>
        </div>

        {/* SOC Progress Bar Premium */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-300">State of Charge</span>
            <span className={`text-3xl font-bold ${
              batteryData.soc > 50
                ? 'text-emerald-400'
                : batteryData.soc > 20
                ? 'text-amber-400'
                : 'text-red-400'
            }`}>
              {batteryData.soc.toFixed(1)}%
            </span>
          </div>
          <div className="h-5 bg-slate-700/50 rounded-full overflow-hidden border border-slate-600">
            <div
              className={`h-full transition-all duration-500 ${
                batteryData.soc > 50
                  ? 'bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-400 shadow-lg shadow-emerald-500/50'
                  : batteryData.soc > 20
                  ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-400 shadow-lg shadow-amber-500/50'
                  : 'bg-gradient-to-r from-red-500 via-rose-500 to-red-400 shadow-lg shadow-red-500/50'
              }`}
              style={{ width: `${batteryData.soc}%` }}
            />
          </div>
        </div>

        {/* Battery Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <MetricCard label="Voltage" value={batteryData.voltage} unit="V" icon="⚡" color="blue" />
          <MetricCard label="Current" value={batteryData.current} unit="A" icon="🔌" color="orange" />
          <MetricCard label="Temperature" value={batteryData.temperature} unit="°C" icon="🌡️" color="red" />
          <MetricCard label="Capacity" value={batteryData.capacity} unit="kWh" icon="📦" color="purple" />
        </div>
      </div>

      {/* ===== HEALTH METRICS ===== */}
      <div className="card slide-up">
        <div className="flex items-center justify-between mb-7">
          <h3 className="text-xl font-bold text-white">Health Metrics</h3>
          <span className="text-4xl">❤️</span>
        </div>
        <div className="space-y-6">
          <div>
            <div className="flex items-end justify-between mb-3">
              <span className="text-sm font-semibold text-gray-300">State of Health (SOH)</span>
              <span className="text-2xl font-bold text-emerald-400">{batteryData.soh}%</span>
            </div>
            <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden border border-slate-600">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-green-400 shadow-lg shadow-emerald-500/50" style={{ width: `${batteryData.soh}%` }} />
            </div>
          </div>
          <div>
            <div className="flex items-end justify-between">
              <span className="text-sm font-semibold text-gray-300">Remaining Useful Life</span>
              <span className="text-2xl font-bold text-purple-400">{batteryData.rul}</span>
              <span className="text-sm text-gray-400">years</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== DRIVING MODE & DTE ===== */}
      <div className="card slide-up">
        <div className="flex items-center justify-between mb-7">
          <h3 className="text-xl font-bold text-white">Driving Mode</h3>
          <span className="text-4xl">🚗</span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {['ECO', 'SPORT'].map(mode => (
            <button
              key={mode}
              onClick={() => setDrivingMode(mode)}
              className={`py-4 px-4 rounded-lg font-bold transition-all duration-300 border ${
                drivingMode === mode
                  ? 'bg-gradient-to-br from-blue-600 to-blue-500 text-white border-blue-400 shadow-lg shadow-blue-500/30'
                  : 'bg-slate-800/40 text-gray-300 border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="text-3xl mb-1">{mode === 'ECO' ? '🌱' : '⚡'}</div>
              <div className="text-sm">{mode}</div>
            </button>
          ))}
        </div>

        <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/40 rounded-xl p-6 border border-slate-700/50">
          <div className="mb-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Distance to Empty</p>
            <div className="flex items-baseline gap-3">
              <p className={`text-5xl font-bold ${
                dteStatus === 'safe'
                  ? 'text-cyan-400'
                  : dteStatus === 'critical'
                  ? 'text-amber-400'
                  : 'text-red-400'
              }`}>
                {dte}
              </p>
              <p className="text-gray-400 text-lg">km</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">💨 {drivingMode === 'ECO' ? '150' : '250'} Wh/km consumption</p>
        </div>
      </div>

      {/* ===== SOC SIMULATOR ===== */}
      <div className="card slide-up">
        <div className="flex items-center justify-between mb-7">
          <h3 className="text-xl font-bold text-white">SOC Simulator</h3>
          <span className="text-4xl">⚡</span>
        </div>
        <div className="space-y-4">
          <input
            type="range"
            min="0"
            max="100"
            value={socSlider}
            onChange={(e) => setSocSlider(Number(e.target.value))}
            className="w-full h-3 bg-slate-700/50 rounded-full appearance-none cursor-pointer accent-blue-500 transition border border-slate-600"
          />
          <div className="flex justify-between items-center p-4 bg-slate-800/40 rounded-lg border border-slate-700/50">
            <span className="text-sm font-semibold text-gray-300">Simulated SOC</span>
            <span className="text-3xl font-bold text-blue-400">{socSlider}%</span>
          </div>
        </div>
      </div>

      {/* ===== ROUTE PLANNER ===== */}
      <div className="card slide-up">
        <div className="flex items-center justify-between mb-7">
          <h3 className="text-xl font-bold text-white">Route Planner</h3>
          <span className="text-4xl">🗺️</span>
        </div>
        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Origin</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" placeholder="Latitude" step="0.0001" className="px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition text-sm" />
              <input type="number" placeholder="Longitude" step="0.0001" className="px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Destination</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" placeholder="Latitude" step="0.0001" className="px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition text-sm" />
              <input type="number" placeholder="Longitude" step="0.0001" className="px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition text-sm" />
            </div>
          </div>
          <button type="submit" className="btn-primary w-full mt-4 h-11 font-semibold">
            📍 Calculate Route
          </button>
        </form>
      </div>
    </div>
  );
}
