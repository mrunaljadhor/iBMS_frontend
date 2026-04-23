'use client'

import { useState } from 'react'
import StatCard from './StatCard'

export default function FeasibilityChecker() {
  const [formData, setFormData] = useState({
    current_soc: 75,
    origin: '28.5355,77.3910',
    destination: '28.7041,77.1025',
  })

  const [feasibility, setFeasibility] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'current_soc' ? parseFloat(value) : value
    }))
  }

  const checkFeasibility = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/feasibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      setFeasibility(data)
    } catch (error) {
      console.error('Failed to check feasibility:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    switch(status) {
      case 'SAFE': return 'text-green-400'
      case 'CRITICAL': return 'text-yellow-400'
      case 'IMPOSSIBLE': return 'text-red-400'
      default: return 'text-blue-400'
    }
  }

  const getStatusBg = (status) => {
    switch(status) {
      case 'SAFE': return 'bg-green-500/10 border-green-500'
      case 'CRITICAL': return 'bg-yellow-500/10 border-yellow-500'
      case 'IMPOSSIBLE': return 'bg-red-500/10 border-red-500'
      default: return 'bg-blue-500/10 border-blue-500'
    }
  }

  return (
    <div className="space-y-8">
      {/* AMSA Logic Explanation */}
      <div className="card border-2 border-purple-500 bg-purple-500/10">
        <h3 className="text-lg font-semibold text-purple-400 mb-4">🤖 AMSA Decision Logic</h3>
        <p className="text-gray-300 mb-4">
          The Automated Mode Switching Algorithm (AMSA) analyzes your current battery state and route to 
          automatically recommend or enforce the optimal driving mode.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-gray-700 rounded p-3">
            <p className="text-green-400 font-semibold mb-2">✅ SAFE</p>
            <p className="text-gray-300">Both ECO and SPORT modes available. You have full control.</p>
          </div>
          <div className="bg-gray-700 rounded p-3">
            <p className="text-yellow-400 font-semibold mb-2">⚠️ CRITICAL</p>
            <p className="text-gray-300">SPORT mode is disabled. Only ECO mode recommended to reach destination.</p>
          </div>
          <div className="bg-gray-700 rounded p-3">
            <p className="text-red-400 font-semibold mb-2">🔴 IMPOSSIBLE</p>
            <p className="text-gray-300">Cannot reach destination. Charging required immediately.</p>
          </div>
        </div>
      </div>

      {/* Feasibility Checker Form */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-6">🔍 Check Route Feasibility</h3>
        
        <form onSubmit={checkFeasibility} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Current SOC (%)</label>
              <input
                type="number"
                name="current_soc"
                value={formData.current_soc}
                onChange={handleInputChange}
                min="0"
                max="100"
                step="1"
                className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Origin (Lat,Lng)</label>
              <input
                type="text"
                name="origin"
                value={formData.origin}
                onChange={handleInputChange}
                placeholder="28.5355,77.3910"
                className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Destination (Lat,Lng)</label>
              <input
                type="text"
                name="destination"
                value={formData.destination}
                onChange={handleInputChange}
                placeholder="28.7041,77.1025"
                className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? '🔄 Checking...' : '🚀 Check Feasibility'}
          </button>
        </form>
      </div>

      {/* Feasibility Results */}
      {feasibility && (
        <>
          {/* AMSA Decision Banner */}
          <div className={`card border-2 ${getStatusBg(feasibility.amsa_decision.action === 'CHARGE_REQUIRED' ? 'IMPOSSIBLE' : feasibility.amsa_decision.action === 'FORCE_ECO_MODE' ? 'CRITICAL' : 'SAFE')}`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className={`text-xl font-bold ${getStatusColor(feasibility.feasibility.status)}`}>
                {feasibility.feasibility.status === 'SAFE' && '✅ ROUTE FEASIBLE'}
                {feasibility.feasibility.status === 'CRITICAL' && '⚠️ CRITICAL CONDITIONS'}
                {feasibility.feasibility.status === 'IMPOSSIBLE' && '🔴 CHARGE REQUIRED'}
              </h4>
              <div className={`text-3xl ${getStatusColor(feasibility.feasibility.status)}`}>
                {feasibility.feasibility.status === 'SAFE' && '👍'}
                {feasibility.feasibility.status === 'CRITICAL' && '⚡'}
                {feasibility.feasibility.status === 'IMPOSSIBLE' && '🔌'}
              </div>
            </div>

            <p className="text-lg font-semibold mb-4">{feasibility.amsa_decision.recommendation}</p>
            
            {feasibility.amsa_decision.alert && (
              <div className={`p-4 rounded-lg ${
                feasibility.feasibility.status === 'SAFE' ? 'bg-green-900/30' :
                feasibility.feasibility.status === 'CRITICAL' ? 'bg-yellow-900/30' :
                'bg-red-900/30'
              }`}>
                <p className="font-semibold">{feasibility.amsa_decision.alert}</p>
              </div>
            )}
          </div>

          {/* Detailed Metrics */}
          <div className="grid-auto">
            <StatCard
              title="Route Distance"
              value={feasibility.route_distance_km}
              unit="km"
              icon="📍"
              status="info"
            />
            
            <StatCard
              title="ECO Mode Range"
              value={feasibility.feasibility.eco_dte.toFixed(0)}
              unit="km"
              icon="🌱"
              status="info"
              subtext={`Safety margin: ${feasibility.feasibility.safety_margin_eco.toFixed(1)} km`}
            />
            
            <StatCard
              title="SPORT Mode Range"
              value={feasibility.feasibility.sport_dte.toFixed(0)}
              unit="km"
              icon="🏎️"
              status="info"
              subtext={`Safety margin: ${feasibility.feasibility.safety_margin_sport.toFixed(1)} km`}
            />
          </div>

          {/* Recommendations */}
          <div className="card">
            <h4 className="text-lg font-semibold mb-4">Recommendations</h4>
            <div className="space-y-3">
              {feasibility.feasibility.status === 'SAFE' && (
                <>
                  <div className="p-3 bg-green-900/20 border border-green-700 rounded">
                    <p className="font-semibold text-green-400">✅ Route is fully feasible in both modes</p>
                    <p className="text-sm text-gray-300">Choose ECO for efficiency, SPORT for comfort</p>
                  </div>
                  <div className="p-3 bg-blue-900/20 border border-blue-700 rounded">
                    <p className="text-sm">
                      <strong>Suggested:</strong> Use ECO mode to extend range. 
                      SPORT mode available for quick sprints if needed.
                    </p>
                  </div>
                </>
              )}
              
              {feasibility.feasibility.status === 'CRITICAL' && (
                <>
                  <div className="p-3 bg-yellow-900/20 border border-yellow-700 rounded">
                    <p className="font-semibold text-yellow-400">⚠️ ECO mode strongly recommended</p>
                    <p className="text-sm text-gray-300">SPORT mode will not be sufficient to reach destination</p>
                  </div>
                </>
              )}
              
              {feasibility.feasibility.status === 'IMPOSSIBLE' && (
                <>
                  <div className="p-3 bg-red-900/20 border border-red-700 rounded">
                    <p className="font-semibold text-red-400">🔴 Cannot reach destination</p>
                    <p className="text-sm text-gray-300">Even in ECO mode, there is insufficient battery</p>
                  </div>
                  <div className="p-3 bg-blue-900/20 border border-blue-700 rounded">
                    <p className="text-sm">
                      <strong>Action Required:</strong> Charge the battery before attempting this route.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Test Scenarios */}
      <div className="card">
        <h4 className="text-lg font-semibold mb-4">Test Scenarios</h4>
        <div className="space-y-2">
          {[
            { soc: 90, scenario: 'Well-charged, short trip', status: 'SAFE' },
            { soc: 50, scenario: 'Half-charged, medium trip', status: 'CRITICAL' },
            { soc: 15, scenario: 'Low charge, long trip', status: 'IMPOSSIBLE' },
          ].map((test, idx) => (
            <button
              key={idx}
              onClick={() => {
                setFormData(prev => ({ ...prev, current_soc: test.soc }))
              }}
              className="w-full flex items-center justify-between p-3 bg-gray-700 hover:bg-gray-600 rounded transition"
            >
              <div className="text-left">
                <p className="text-white font-semibold">{test.scenario}</p>
                <p className="text-gray-400 text-sm">SOC: {test.soc}%</p>
              </div>
              <span className={`text-sm font-semibold ${
                test.status === 'SAFE' ? 'text-green-400' :
                test.status === 'CRITICAL' ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {test.status}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
